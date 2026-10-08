from datetime import timedelta
import math

from django.core.files.base import ContentFile
from django.db.models import Case, CharField, Count, DateTimeField, F, IntegerField, Value, When
from django.db import transaction
from django.utils import timezone

from apps.inventario.constants import TIERS_ACCESIBLES
from apps.inventario.models import Material
from apps.prestamos.constants import (
    ESTADOS_DEVOLUBLES,
    ESTADOS_QUE_OCUPAN_UNIDAD,
    VALORES_ESTADOS_CHECKLIST_DEVOLUCION,
)
from apps.prestamos.models import Devolucion, Prestamo
from apps.prestamos.reportes import generar_reporte_dano
from apps.usuarios.models import Usuario
from apps.usuarios.services import (
    actualizar_reputacion,
    puntaje_reputacion_ajustado,
    tier_por_puntaje,
)

SEGUNDOS_POR_DIA = 86400


class PrestamoError(Exception):
    def __init__(self, campo, mensaje, status_code=400):
        self.campo = campo
        self.mensaje = mensaje
        self.status_code = status_code
        super().__init__(mensaje)


def contar_unidades_disponibles(material):
    """Devuelve stock total menos unidades ocupadas por préstamos vigentes."""
    ocupadas = contar_unidades_prestadas_por_material([material.pk]).get(material.pk, 0)
    return max(material.stock - ocupadas, 0)


def contar_unidades_prestadas_por_material(material_ids):
    """Contrato de lectura para inventario: conteo por material en una consulta."""
    identificadores = list(material_ids)
    if not identificadores:
        return {}

    filas = (
        Prestamo.objects.filter(
            material_id__in=identificadores,
            estado__in=ESTADOS_QUE_OCUPAN_UNIDAD,
        )
        .values("material_id")
        .annotate(total=Count("id"))
        .values_list("material_id", "total")
    )
    return dict(filas)


def tiene_prestamos_activos(usuario_id):
    """Contrato consumido por usuarios para impedir eliminar prestatarios ocupados."""
    return Prestamo.objects.filter(
        usuario_id=usuario_id,
        estado__in=ESTADOS_QUE_OCUPAN_UNIDAD,
    ).exists()


def _consultar_prestamos_con_estado(ahora=None):
    """Prepara préstamos con estado visible y orden de consulta determinista."""
    ahora = ahora or timezone.now()
    condicion_vencido = When(
        estado="activo",
        fecha_limite__lt=ahora,
        then=Value("vencido"),
    )
    condicion_estado_vencido = When(estado="vencido", then=Value(0))
    condicion_activo_vencido = When(
        estado="activo",
        fecha_limite__lt=ahora,
        then=Value(0),
    )
    return (
        Prestamo.objects.select_related("material")
        .annotate(
            estado_consulta=Case(
                condicion_vencido,
                default=F("estado"),
                output_field=CharField(),
            ),
            _prioridad_vencido=Case(
                condicion_estado_vencido,
                condicion_activo_vencido,
                default=Value(1),
                output_field=IntegerField(),
            ),
            _fecha_vencido_orden=Case(
                When(estado="vencido", then=F("fecha_limite")),
                When(estado="activo", fecha_limite__lt=ahora, then=F("fecha_limite")),
                output_field=DateTimeField(),
            ),
            _fecha_entrega_orden=Case(
                When(estado="vencido", then=Value(None)),
                When(
                    estado="activo",
                    fecha_limite__lt=ahora,
                    then=Value(None),
                ),
                default=F("fecha_entrega"),
                output_field=DateTimeField(),
            ),
        )
        .order_by(
            "_prioridad_vencido",
            "_fecha_vencido_orden",
            "-_fecha_entrega_orden",
            "-id",
        )
    )


def consultar_prestamos_usuario(usuario_id, ahora=None):
    """Lista préstamos propios, deriva vencidos en lectura y prioriza su vencimiento."""
    return _consultar_prestamos_con_estado(ahora=ahora).filter(usuario_id=usuario_id)


def consultar_historial_prestamos(ahora=None, estado=None):
    """Lista global de préstamos para consulta histórica de gestión."""
    prestamos = _consultar_prestamos_con_estado(ahora=ahora).select_related("usuario")
    if estado is not None:
        prestamos = prestamos.filter(estado_consulta=estado)
    return prestamos


def consultar_prestamo_para_devolucion(prestamo_id):
    """Detalle para el formulario de devolución con el estado visible (vencido
    derivado en lectura) y los datos del prestatario."""
    try:
        return (
            _consultar_prestamos_con_estado()
            .select_related("usuario", "usuario__rol")
            .get(pk=prestamo_id)
        )
    except (Prestamo.DoesNotExist, ValueError, TypeError) as error:
        raise PrestamoError(
            "prestamo_id",
            "No existe el préstamo indicado.",
            status_code=404,
        ) from error


def consultar_reportes_devolucion(
    dano=None,
    fecha_desde=None,
    fecha_hasta=None,
    gestor_id=None,
):
    """Listado de devoluciones con reporte de daños para su consulta (RN10).

    Solo las devoluciones que generaron PDF (daño parcial o total); los
    filtros son opcionales y acumulativos.
    """
    reportes = (
        Devolucion.objects.exclude(reporte="")
        .select_related(
            "prestamo",
            "prestamo__material",
            "prestamo__usuario",
            "realizado_por",
        )
        .order_by("-fecha_devolucion", "-id")
    )
    if dano is not None:
        reportes = reportes.filter(resultado__dano=dano)
    if fecha_desde is not None:
        reportes = reportes.filter(fecha_devolucion__date__gte=fecha_desde)
    if fecha_hasta is not None:
        reportes = reportes.filter(fecha_devolucion__date__lte=fecha_hasta)
    if gestor_id is not None:
        reportes = reportes.filter(realizado_por_id=gestor_id)
    return reportes


def _obtener_prestatario_bloqueado(dni):
    try:
        return Usuario.objects.select_for_update().select_related("rol").get(dni=dni)
    except Usuario.DoesNotExist as error:
        raise PrestamoError(
            "dni_prestatario",
            "No existe un usuario registrado con ese DNI.",
            status_code=404,
        ) from error


def _validar_elegibilidad(usuario, material):
    if usuario.rol.nombre != "prestatario":
        raise PrestamoError(
            "dni_prestatario",
            "El usuario indicado no tiene el rol de prestatario.",
        )
    if usuario.estado != "activo":
        raise PrestamoError(
            "dni_prestatario",
            "El usuario no está habilitado para recibir préstamos.",
        )

    tiers_permitidos = TIERS_ACCESIBLES.get(usuario.reputacion_tier)
    if tiers_permitidos is None or material.tier_minimo_requerido not in tiers_permitidos:
        raise PrestamoError(
            "dni_prestatario",
            "El Tier de reputación del usuario no permite recibir este material.",
        )


def _validar_checklist(checklist_inicial):
    if not isinstance(checklist_inicial, list) or not checklist_inicial:
        raise PrestamoError(
            "checklist_inicial",
            "Registra al menos una condición en el checklist inicial.",
        )
    for indice, elemento in enumerate(checklist_inicial, start=1):
        if not isinstance(elemento, dict):
            raise PrestamoError(
                "checklist_inicial",
                f"El elemento {indice} del checklist no es válido.",
            )
        if not elemento.get("elemento", "").strip() or not elemento.get("condicion", "").strip():
            raise PrestamoError(
                "checklist_inicial",
                f"El elemento {indice} requiere descripción y condición.",
            )


@transaction.atomic
def registrar_prestamo(
    *,
    dni_prestatario,
    material_id,
    tiempo_prestamo_dias,
    checklist_inicial,
    registrado_por,
    garantia_documento_identidad_recibido=False,
    garantia_compromiso_firmado_recibido=False,
    fecha_entrega=None,
):
    """Registra la entrega con elegibilidad, garantía y control atómico de stock."""
    if not isinstance(tiempo_prestamo_dias, int) or tiempo_prestamo_dias < 1:
        raise PrestamoError(
            "tiempo_prestamo_dias",
            "El tiempo de préstamo debe ser al menos un día.",
        )
    _validar_checklist(checklist_inicial)

    prestatario = _obtener_prestatario_bloqueado(dni_prestatario)
    try:
        material = Material.objects.select_for_update().get(pk=material_id)
    except (Material.DoesNotExist, ValueError, TypeError) as error:
        raise PrestamoError(
            "material_id",
            "No existe el material indicado.",
            status_code=404,
        ) from error

    _validar_elegibilidad(prestatario, material)

    if material.estado in ("en_mantenimiento", "reservado"):
        raise PrestamoError(
            "material_id",
            "El material no está disponible para entrega.",
            status_code=409,
        )

    unidades_disponibles = contar_unidades_disponibles(material)
    prestamos_existentes = material.prestamos.filter(
        estado__in=ESTADOS_QUE_OCUPAN_UNIDAD
    ).count()
    if unidades_disponibles < 1 or (material.estado == "prestado" and prestamos_existentes == 0):
        raise PrestamoError(
            "material_id",
            "No quedan unidades disponibles de este material.",
            status_code=409,
        )

    requiere_garantia = material.requiere_garantia()
    if requiere_garantia and not garantia_documento_identidad_recibido:
        raise PrestamoError(
            "garantia_documento_identidad_recibido",
            "El gestor debe confirmar la recepción del documento de identidad.",
        )
    if requiere_garantia and not garantia_compromiso_firmado_recibido:
        raise PrestamoError(
            "garantia_compromiso_firmado_recibido",
            "El gestor debe confirmar la recepción del compromiso firmado.",
        )

    fecha_entrega = fecha_entrega or timezone.now()
    prestamo = Prestamo.objects.create(
        usuario=prestatario,
        material=material,
        registrado_por=registrado_por,
        fecha_entrega=fecha_entrega,
        fecha_limite=fecha_entrega + timedelta(days=tiempo_prestamo_dias),
        tiempo_prestamo_dias=tiempo_prestamo_dias,
        estado="activo",
        checklist_inicial=checklist_inicial,
        garantia_documento_identidad_recibido=garantia_documento_identidad_recibido,
        garantia_compromiso_firmado_recibido=garantia_compromiso_firmado_recibido,
    )

    # Material.estado describe disponibilidad del conjunto: solo pasa a
    # prestado cuando ya no queda ninguna unidad libre. `stock` se mantiene
    # como total registrado; la disponibilidad se deriva de préstamos activos.
    unidades_restantes = unidades_disponibles - 1
    if unidades_restantes == 0:
        material.estado = "prestado"
        material.save(update_fields=("estado", "updated_at"))
    elif material.estado == "prestado":
        # Puede ocurrir si inventario se reabasteció sin actualizar el estado.
        material.estado = "disponible"
        material.save(update_fields=("estado", "updated_at"))

    return prestamo


def _obtener_prestamo_para_devolucion(prestamo_id, *, bloquear=False):
    """Carga el préstamo con los datos que la devolución necesita consultar."""
    consulta = Prestamo.objects.select_related(
        "material", "usuario", "usuario__rol", "registrado_por"
    )
    if bloquear:
        consulta = consulta.select_for_update()
    try:
        return consulta.get(pk=prestamo_id)
    except (Prestamo.DoesNotExist, ValueError, TypeError) as error:
        raise PrestamoError(
            "prestamo_id",
            "No existe el préstamo indicado.",
            status_code=404,
        ) from error


def _validar_estado_devoluble(prestamo):
    if prestamo.estado in ESTADOS_DEVOLUBLES:
        return
    if prestamo.estado == "devuelto":
        raise PrestamoError(
            "prestamo_id",
            "Este préstamo ya fue devuelto.",
            status_code=409,
        )
    raise PrestamoError(
        "prestamo_id",
        "El préstamo no está en un estado que permita registrar la devolución.",
        status_code=409,
    )


def _validar_checklist_devolucion(checklist_devolucion):
    if not isinstance(checklist_devolucion, list) or not checklist_devolucion:
        raise PrestamoError(
            "checklist",
            "Registra al menos un elemento en el checklist de devolución.",
        )
    for indice, elemento in enumerate(checklist_devolucion, start=1):
        if not isinstance(elemento, dict):
            raise PrestamoError(
                "checklist",
                f"El elemento {indice} del checklist no es válido.",
            )
        if not elemento.get("elemento", "").strip():
            raise PrestamoError(
                "checklist",
                f"El elemento {indice} requiere una descripción.",
            )
        if elemento.get("estado") not in VALORES_ESTADOS_CHECKLIST_DEVOLUCION:
            raise PrestamoError(
                "checklist",
                f"El elemento {indice} tiene un estado de devolución no válido.",
            )


def _normalizar_checklist_devolucion(prestamo, checklist_devolucion):
    """Ordena las filas y ancla la condición inicial al checklist de entrega (RN09).

    La comparación de daños se apoya en la condición registrada al entregar;
    el estado devuelto es siempre el que informó el gestor en esta operación.
    """
    condiciones_iniciales = {
        str(item.get("elemento", "")).strip().lower(): str(item.get("condicion", "")).strip()
        for item in prestamo.checklist_inicial or []
        if isinstance(item, dict)
    }
    normalizado = []
    for item in checklist_devolucion:
        elemento = str(item.get("elemento", "")).strip()
        normalizado.append(
            {
                "elemento": elemento,
                "condicion": condiciones_iniciales.get(
                    elemento.lower(),
                    str(item.get("condicion", "")).strip(),
                ),
                "estado": item["estado"],
                "observacion": str(item.get("observacion", "")).strip(),
            }
        )
    return normalizado


def _dias_tardanza(fecha_devolucion, fecha_limite):
    """Días completos excedidos, con mínimo de un día si ya pasó la fecha límite."""
    diferencia = (fecha_devolucion - fecha_limite).total_seconds()
    if diferencia <= 0:
        return 0
    return max(1, math.ceil(diferencia / SEGUNDOS_POR_DIA))


def _calcular_resultado(prestamo, checklist, fecha_devolucion):
    """Aplica RN06: bonificación a tiempo, tardanza proporcional y sanción por daño.

    El daño global es el peor estado del checklist (total prevalece sobre
    parcial) y el cobro solo existe cuando el material tiene costo
    parametrizado (RF08).
    """
    material = prestamo.material
    usuario = prestamo.usuario

    a_tiempo = fecha_devolucion <= prestamo.fecha_limite
    dias_tardanza = _dias_tardanza(fecha_devolucion, prestamo.fecha_limite)
    bonificacion = material.bonificacion_tiempo if a_tiempo else 0
    deduccion_tardanza = dias_tardanza * material.deduccion_tardanza

    estados = {item["estado"] for item in checklist}
    if "dano_total" in estados:
        dano = "dano_total"
        deduccion_dano = material.deduccion_dano_total
        cobro = material.costo_reposicion
    elif "dano_parcial" in estados:
        dano = "dano_parcial"
        deduccion_dano = material.deduccion_dano_parcial
        cobro = material.costo_reparacion
    else:
        dano = "sin_cambios"
        deduccion_dano = 0
        cobro = None

    puntos_delta = bonificacion - deduccion_tardanza - deduccion_dano
    reputacion_antes = usuario.reputacion_puntaje
    reputacion_despues = puntaje_reputacion_ajustado(reputacion_antes + puntos_delta)

    return {
        "a_tiempo": a_tiempo,
        "dias_tardanza": dias_tardanza,
        "bonificacion": bonificacion,
        "deduccion_tardanza": deduccion_tardanza,
        "dano": dano,
        "hay_dano": dano != "sin_cambios",
        "deduccion_dano": deduccion_dano,
        "cobro_economico": str(cobro) if cobro is not None else None,
        "puntos_delta": puntos_delta,
        "reputacion_antes": reputacion_antes,
        "tier_antes": usuario.reputacion_tier,
        "reputacion_despues": reputacion_despues,
        "tier_despues": tier_por_puntaje(reputacion_despues),
    }


def estimar_devolucion(*, prestamo_id, checklist_devolucion, fecha_devolucion=None):
    """Resumen de sanciones sin persistir nada: misma fuentes que el registro."""
    prestamo = _obtener_prestamo_para_devolucion(prestamo_id)
    _validar_estado_devoluble(prestamo)
    _validar_checklist_devolucion(checklist_devolucion)
    checklist = _normalizar_checklist_devolucion(prestamo, checklist_devolucion)
    fecha_devolucion = fecha_devolucion or timezone.now()
    return _calcular_resultado(prestamo, checklist, fecha_devolucion)


def _generar_reporte_de_dano(devolucion):
    """Persiste el PDF obligatorio de RN10 dentro de la transacción (si falla, nada)."""
    nombre = f"reporte-dano-prestamo-{devolucion.prestamo_id}.pdf"
    contenido = ContentFile(generar_reporte_dano(devolucion))
    devolucion.reporte.save(nombre, contenido, save=True)


@transaction.atomic
def registrar_devolucion(
    *,
    prestamo_id,
    checklist_devolucion,
    realizado_por,
    fecha_devolucion=None,
):
    """Devuelve el préstamo con sanciones, estados actualizados y registro 1:1.

    Todo ocurre en una transacción: reputación, préstamo, material y la
    `Devolucion` quedan consistentes; si algo falla, nada se aplica.
    """
    prestamo = _obtener_prestamo_para_devolucion(prestamo_id, bloquear=True)
    _validar_estado_devoluble(prestamo)
    _validar_checklist_devolucion(checklist_devolucion)
    checklist = _normalizar_checklist_devolucion(prestamo, checklist_devolucion)
    fecha_devolucion = fecha_devolucion or timezone.now()

    resultado = _calcular_resultado(prestamo, checklist, fecha_devolucion)
    actualizar_reputacion(prestamo.usuario, resultado["puntos_delta"])

    prestamo.estado = "devuelto"
    prestamo.save(update_fields=["estado"])

    material = prestamo.material
    unidades_ocupadas = contar_unidades_prestadas_por_material(
        [material.pk]
    ).get(material.pk, 0)
    if unidades_ocupadas == 0 and material.estado == "prestado":
        material.estado = "disponible"
        material.save(update_fields=("estado", "updated_at"))

    devolucion = Devolucion.objects.create(
        prestamo=prestamo,
        realizado_por=realizado_por,
        fecha_devolucion=fecha_devolucion,
        checklist_devolucion=checklist,
        resultado=resultado,
    )
    if resultado["hay_dano"]:
        _generar_reporte_de_dano(devolucion)
    return devolucion
