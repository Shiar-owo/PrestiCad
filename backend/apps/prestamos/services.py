from datetime import timedelta
import math
from pathlib import Path

from django.core.files.base import ContentFile
from django.core.exceptions import ValidationError
from django.db.models import Case, CharField, Count, DateTimeField, F, IntegerField, Q, Value, When
from django.db import transaction
from django.utils import timezone

from apps.inventario import services as servicios_inventario
from apps.inventario.constants import TIERS_ACCESIBLES
from apps.inventario.models import InstanciaMaterial, Material
from apps.prestamos.constants import (
    ESTADOS_DEVOLUBLES,
    ESTADOS_QUE_OCUPAN_UNIDAD,
    MAXIMO_DIAS_PRESTAMO,
    MAXIMO_MINUTOS_PRESTAMO,
    MAXIMO_PRESTAMOS_ACTIVOS_TIER,
    MAXIMO_PRESTATARIOS_SUGERIDOS,
    MENSAJES_ERROR_PRESTAMO,
    MINIMO_DIAS_PRESTAMO,
    MINIMO_MINUTOS_PRESTAMO,
    TIEMPO_GRACIA_MINUTOS,
    VALORES_ESTADOS_CHECKLIST_DEVOLUCION,
    formatear_duracion_minutos,
)
from apps.prestamos.models import Devolucion, FotoChecklist, Garantia, Prestamo
from apps.prestamos.reportes import generar_reporte_dano
from apps.prestamos.validators import validar_foto_checklist, validar_pdf_garantia
from apps.reservas.constants import TOLERANCIA_RECOJO_MINUTOS
from apps.usuarios.models import Usuario
from apps.usuarios.services import (
    actualizar_reputacion,
    calcular_bonificacion_con_tope_semanal,
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


def buscar_prestatarios_por_dni(prefijo):
    """Busca prestatarios activos por prefijo de DNI para la entrega de materiales."""
    return (
        Usuario.objects.select_related("rol")
        .filter(
            rol__nombre="prestatario",
            estado="activo",
            dni__startswith=prefijo,
        )
        .order_by("dni")[:MAXIMO_PRESTATARIOS_SUGERIDOS]
    )


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


def tiene_prestamos_vencidos(usuario_id, ahora=None):
    """Verifica si el usuario tiene préstamos con fecha límite superada y no devueltos."""
    ahora = ahora or timezone.now()
    return Prestamo.objects.filter(
        usuario_id=usuario_id,
    ).filter(
        Q(estado="vencido") | Q(estado="activo", fecha_limite__lt=ahora)
    ).exists()


def contar_prestamos_activos_usuario(usuario_id):
    """Devuelve el total de préstamos vigentes o vencidos en posesión del prestatario."""
    return Prestamo.objects.filter(
        usuario_id=usuario_id,
        estado__in=ESTADOS_QUE_OCUPAN_UNIDAD,
    ).count()


def validar_limite_prestamos_activos(usuario, ahora=None):
    """Verifica morosidad y límite de concurrencia según el Tier del prestatario."""
    if tiene_prestamos_vencidos(usuario.pk, ahora=ahora):
        raise PrestamoError(
            "dni_prestatario",
            MENSAJES_ERROR_PRESTAMO["prestamo_vencido_pendiente"],
            status_code=409,
        )

    maximo = MAXIMO_PRESTAMOS_ACTIVOS_TIER.get(usuario.reputacion_tier, 3)
    activos = contar_prestamos_activos_usuario(usuario.pk)
    if activos >= maximo:
        raise PrestamoError(
            "dni_prestatario",
            MENSAJES_ERROR_PRESTAMO["limite_prestamos_alcanzado"].format(maximo=maximo),
            status_code=409,
        )



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
        Prestamo.objects.select_related("material", "instancia")
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


def consultar_historial_prestamos(ahora=None, estado=None, dni=None, nombre=None):
    """Lista global de préstamos para consulta histórica de gestión."""
    prestamos = _consultar_prestamos_con_estado(ahora=ahora).select_related(
        "usuario",
        "registrado_por",
        "registrado_por__rol",
        "devolucion",
        "devolucion__realizado_por",
        "devolucion__realizado_por__rol",
    )
    if estado == "devoluble":
        prestamos = prestamos.filter(estado_consulta__in=("activo", "vencido"))
    elif estado is not None:
        prestamos = prestamos.filter(estado_consulta=estado)
    if dni is not None:
        prestamos = prestamos.filter(usuario__dni=dni)
    if nombre:
        for termino in nombre.strip().split():
            prestamos = prestamos.filter(
                Q(usuario__nombre__icontains=termino)
                | Q(usuario__apellido__icontains=termino)
            )
    return prestamos


def consultar_historial_por_material(
    material_id,
    instancia_id,
    fecha_desde=None,
    fecha_hasta=None,
):
    """Devuelve préstamos de una instancia y sus estadísticas de puntualidad.

    El período se aplica a la fecha de entrega. Las estadísticas consideran
    solo préstamos devueltos; la puntualidad se determina por fecha límite.
    """
    if not Material.objects.filter(pk=material_id).exists():
        raise PrestamoError(
            "material_id",
            "No existe el material solicitado.",
            status_code=404,
        )
    if not InstanciaMaterial.objects.filter(
        pk=instancia_id,
        material_id=material_id,
    ).exists():
        raise PrestamoError(
            "instancia_id",
            "La instancia seleccionada no pertenece a este material.",
            status_code=404,
        )

    prestamos = (
        _consultar_prestamos_con_estado()
        .filter(material_id=material_id, instancia_id=instancia_id)
        .select_related("usuario", "devolucion")
    )
    if fecha_desde is not None:
        prestamos = prestamos.filter(fecha_entrega__date__gte=fecha_desde)
    if fecha_hasta is not None:
        prestamos = prestamos.filter(fecha_entrega__date__lte=fecha_hasta)

    devueltos = prestamos.filter(devolucion__isnull=False)
    total_devoluciones = devueltos.count()
    a_tiempo = devueltos.filter(
        devolucion__fecha_devolucion__lte=F("fecha_limite"),
    ).count()
    tardios = total_devoluciones - a_tiempo

    resumen = {
        "total_prestamos": prestamos.count(),
        "total_devoluciones": total_devoluciones,
        "porcentaje_a_tiempo": round(a_tiempo * 100 / total_devoluciones, 2)
        if total_devoluciones
        else 0,
        "porcentaje_tardias": round(tardios * 100 / total_devoluciones, 2)
        if total_devoluciones
        else 0,
    }
    return prestamos, resumen


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
            "prestamo__instancia",
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


def _validar_elegibilidad(usuario, material, *, es_excepcion=False):
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
    if es_excepcion:
        if (
            usuario.reputacion_tier not in ("restringido", "estandar")
            or tiers_permitidos is None
            or material.tier_minimo_requerido in tiers_permitidos
        ):
            raise PrestamoError(
                "es_excepcion",
                "El préstamo excepcional solo aplica a usuarios en Tier Restringido o Estándar "
                "con material de un Tier superior.",
            )
        return

    if tiers_permitidos is None or material.tier_minimo_requerido not in tiers_permitidos:
        raise PrestamoError(
            "dni_prestatario",
            "El Tier de reputación del usuario no permite recibir este material.",
        )


def _resolver_duracion_prestamo(tiempo_prestamo_minutos, tiempo_prestamo_dias):
    """Normaliza la duración del préstamo en minutos y días equivalentes.

    Acepta `tiempo_prestamo_minutos` (mínimo 1 hora, máximo 14 días, 23 horas y 30 minutos) o
    `tiempo_prestamo_dias` por compatibilidad, devolviendo `(minutos, dias, campo_error)`.
    """
    if tiempo_prestamo_minutos is not None:
        if (
            isinstance(tiempo_prestamo_minutos, bool)
            or not isinstance(tiempo_prestamo_minutos, int)
        ):
            raise PrestamoError(
                "tiempo_prestamo_minutos",
                "El tiempo de préstamo debe ser un número entero de minutos.",
            )
        if tiempo_prestamo_minutos < MINIMO_MINUTOS_PRESTAMO:
            raise PrestamoError(
                "tiempo_prestamo_minutos",
                "El tiempo mínimo de préstamo es de 1 h (60 min).",
            )
        if tiempo_prestamo_minutos > MAXIMO_MINUTOS_PRESTAMO:
            raise PrestamoError(
                "tiempo_prestamo_minutos",
                f"El plazo pactado máximo es de {formatear_duracion_minutos(MAXIMO_MINUTOS_PRESTAMO)}; "
                f"con la tolerancia de {TIEMPO_GRACIA_MINUTOS} minutos, el total es de {MAXIMO_DIAS_PRESTAMO} días.",
            )
        dias = max(1, math.ceil(tiempo_prestamo_minutos / 1440))
        return tiempo_prestamo_minutos, dias, "tiempo_prestamo_minutos"

    if (
        isinstance(tiempo_prestamo_dias, bool)
        or not isinstance(tiempo_prestamo_dias, int)
        or tiempo_prestamo_dias < MINIMO_DIAS_PRESTAMO
        or tiempo_prestamo_dias > MAXIMO_DIAS_PRESTAMO
    ):
        raise PrestamoError(
            "tiempo_prestamo_dias",
            f"El tiempo de préstamo debe estar entre {MINIMO_DIAS_PRESTAMO} y {MAXIMO_DIAS_PRESTAMO} días.",
        )
    minutos_pactados = min(
        tiempo_prestamo_dias * 1440,
        MAXIMO_MINUTOS_PRESTAMO,
    )
    return minutos_pactados, tiempo_prestamo_dias, "tiempo_prestamo_dias"


def _validar_duracion_material(material, tiempo_prestamo_minutos, campo_duracion):
    """Verifica que el préstamo no supere el tiempo máximo configurado en el material."""
    maximo_configurado = getattr(material, "tiempo_maximo_prestamo", None)
    maximo_material = min(
        maximo_configurado or MAXIMO_MINUTOS_PRESTAMO,
        MAXIMO_MINUTOS_PRESTAMO,
    )
    if tiempo_prestamo_minutos > maximo_material:
        limite_legible = formatear_duracion_minutos(maximo_material)
        raise PrestamoError(
            campo_duracion,
            f"El tiempo solicitado supera el máximo permitido para este material ({limite_legible}).",
        )


def _validar_checklist(checklist_inicial):
    if not isinstance(checklist_inicial, list) or not checklist_inicial:
        raise PrestamoError(
            "checklist_inicial",
            "Registra al menos un elemento en el checklist inicial.",
        )
    for indice, elemento in enumerate(checklist_inicial, start=1):
        if not isinstance(elemento, dict):
            raise PrestamoError(
                "checklist_inicial",
                f"El elemento {indice} del checklist no es válido.",
            )
        if not str(elemento.get("elemento", "")).strip():
            raise PrestamoError(
                "checklist_inicial",
                f"El elemento {indice} requiere una descripción.",
            )


def _validar_fotos_checklist(checklist_inicial, fotos_checklist):
    if not isinstance(fotos_checklist, (list, tuple)) or len(fotos_checklist) != len(checklist_inicial):
        raise PrestamoError(
            "fotos_checklist",
            "Adjunta una foto por cada elemento del checklist inicial.",
        )
    for indice, (elemento, foto) in enumerate(zip(checklist_inicial, fotos_checklist), start=1):
        if not foto:
            raise PrestamoError(
                "fotos_checklist",
                f'El elemento «{elemento.get("elemento", "").strip()}» requiere una foto.',
            )
        try:
            validar_foto_checklist(foto)
        except ValidationError as error:
            mensaje = error.messages[0] if error.messages else "La foto no es válida."
            raise PrestamoError(
                "fotos_checklist",
                f"La foto del elemento {indice}: {mensaje}",
            ) from error


def _validar_documentos_garantia(
    material,
    documento_identidad,
    compromiso_responsabilidad,
    *,
    es_excepcion=False,
):
    documentos = (
        ("documento_identidad", documento_identidad, "El documento de identidad en PDF"),
        (
            "compromiso_responsabilidad",
            compromiso_responsabilidad,
            "El compromiso de responsabilidad en PDF",
        ),
    )
    requiere_garantia = es_excepcion or material.requiere_garantia()
    if not requiere_garantia:
        for campo, archivo, _ in documentos:
            if archivo is not None:
                raise PrestamoError(
                    campo,
                    "Este material no requiere documentos de garantía.",
                )
    if requiere_garantia:
        for campo, archivo, descripcion in documentos:
            if archivo is None:
                raise PrestamoError(
                    campo,
                    f"{descripcion} es obligatorio para préstamos excepcionales "
                    "y materiales de alto valor.",
                )

    for campo, archivo, _ in documentos:
        if archivo is None:
            continue
        try:
            validar_pdf_garantia(archivo)
        except ValidationError as error:
            raise PrestamoError(campo, error.messages[0]) from error


def crear_garantia_registrada(
    *,
    documento_identidad,
    compromiso_responsabilidad,
    prestamo=None,
    reserva=None,
):
    garantia = Garantia(
        prestamo=prestamo,
        reserva=reserva,
        tipo="documento_y_compromiso",
        estado="registrada",
        fecha_registro=timezone.now(),
    )
    archivos_guardados = []
    try:
        for nombre_campo, archivo in (
            ("documento_identidad", documento_identidad),
            ("compromiso_responsabilidad", compromiso_responsabilidad),
        ):
            campo_archivo = getattr(garantia, nombre_campo)
            campo_archivo.save(archivo.name, archivo, save=False)
            archivos_guardados.append((campo_archivo.storage, campo_archivo.name))
        garantia.save()
    except Exception:
        for almacenamiento, nombre in archivos_guardados:
            almacenamiento.delete(nombre)
        raise
    return garantia


def _crear_garantia_registrada(
    prestamo,
    documento_identidad,
    compromiso_responsabilidad,
    *,
    reserva=None,
):
    return crear_garantia_registrada(
        documento_identidad=documento_identidad,
        compromiso_responsabilidad=compromiso_responsabilidad,
        prestamo=prestamo,
        reserva=reserva,
    )


def obtener_documento_garantia_reserva(reserva_id, tipo):
    """Obtiene el FieldFile del documento de garantía asociado a una reserva excepcional."""
    from apps.reservas.models import Reserva

    campos = {
        "documento-identidad": ("documento_identidad", "documento-identidad"),
        "compromiso": ("compromiso_responsabilidad", "compromiso-responsabilidad"),
    }
    if tipo not in campos:
        raise PrestamoError(
            "tipo",
            "El tipo de documento de garantía no es válido.",
        )

    try:
        reserva = Reserva.objects.get(pk=reserva_id)
    except (Reserva.DoesNotExist, ValueError, TypeError) as error:
        raise PrestamoError(
            "reserva_id",
            "No existe la reserva indicada.",
            status_code=404,
        ) from error

    try:
        garantia = reserva.garantia
    except Garantia.DoesNotExist as error:
        raise PrestamoError(
            "garantia",
            "La reserva no tiene una garantía registrada.",
            status_code=404,
        ) from error

    nombre_campo, nombre_descarga = campos[tipo]
    documento = getattr(garantia, nombre_campo)
    if not documento:
        raise PrestamoError(
            nombre_campo,
            "El documento de garantía solicitado no está disponible.",
            status_code=404,
        )

    return documento, f"{nombre_descarga}-reserva-{reserva.pk}.pdf"


def obtener_documento_garantia(prestamo_id, tipo):
    """Obtiene el FieldFile del documento de garantía sin exponer su ruta de almacenamiento.

    Devuelve el objeto FieldFile (con su storage configurado) y el nombre de
    descarga.  La vista decide cómo servirlo: en producción (Cloudinary)
    redirigirá a la URL remota; en desarrollo abrirá el archivo localmente.
    """
    campos = {
        "documento-identidad": ("documento_identidad", "documento-identidad"),
        "compromiso": ("compromiso_responsabilidad", "compromiso-responsabilidad"),
    }
    if tipo not in campos:
        raise PrestamoError(
            "tipo",
            "El tipo de documento de garantía no es válido.",
        )

    try:
        prestamo = Prestamo.objects.get(pk=prestamo_id)
    except (Prestamo.DoesNotExist, ValueError, TypeError) as error:
        raise PrestamoError(
            "prestamo_id",
            "No existe el préstamo indicado.",
            status_code=404,
        ) from error

    try:
        garantia = prestamo.garantia
    except Garantia.DoesNotExist as error:
        raise PrestamoError(
            "garantia",
            "El préstamo no tiene una garantía registrada.",
            status_code=404,
        ) from error

    nombre_campo, nombre_descarga = campos[tipo]
    documento = getattr(garantia, nombre_campo)
    if not documento:
        raise PrestamoError(
            nombre_campo,
            "El documento de garantía solicitado no está disponible.",
            status_code=404,
        )

    return documento, f"{nombre_descarga}-prestamo-{prestamo.pk}.pdf"


@transaction.atomic
def actualizar_documento_garantia(*, prestamo_id, tipo, archivo=None, eliminar=False):
    """Reemplaza o elimina un PDF de garantía sin dejar la garantía vacía."""
    campos = {
        "documento-identidad": "documento_identidad",
        "compromiso": "compromiso_responsabilidad",
    }
    if tipo not in campos:
        raise PrestamoError("tipo", "El tipo de documento de garantía no es válido.")
    if (archivo is None and not eliminar) or (archivo is not None and eliminar):
        raise PrestamoError(
            "documento",
            "Adjunta un PDF para reemplazar o indica que deseas eliminar el documento.",
        )

    try:
        prestamo = Prestamo.objects.select_for_update().get(pk=prestamo_id)
    except (Prestamo.DoesNotExist, ValueError, TypeError) as error:
        raise PrestamoError(
            "prestamo_id",
            "No existe el préstamo indicado.",
            status_code=404,
        ) from error
    if prestamo.estado == "devuelto":
        raise PrestamoError(
            "prestamo_id",
            "No se pueden modificar ni eliminar datos o documentos de un préstamo ya finalizado.",
            status_code=409,
        )
    try:
        garantia = Garantia.objects.select_for_update().get(prestamo=prestamo)
    except Garantia.DoesNotExist as error:
        raise PrestamoError(
            "garantia",
            "El préstamo no tiene una garantía registrada.",
            status_code=404,
        ) from error

    nombre_campo = campos[tipo]
    otro_campo = (
        "compromiso_responsabilidad"
        if nombre_campo == "documento_identidad"
        else "documento_identidad"
    )
    documento_actual = getattr(garantia, nombre_campo)
    nombre_anterior = documento_actual.name if documento_actual else ""
    almacenamiento = documento_actual.storage

    if eliminar:
        if not getattr(garantia, otro_campo):
            raise PrestamoError(
                nombre_campo,
                "Debe conservar al menos un documento PDF de garantía.",
            )
        setattr(garantia, nombre_campo, None)
        garantia.estado = "pendiente"
        garantia.save(update_fields=[nombre_campo, "estado"])
        if nombre_anterior:
            transaction.on_commit(lambda: almacenamiento.delete(nombre_anterior))
    else:
        try:
            validar_pdf_garantia(archivo)
        except ValidationError as error:
            raise PrestamoError(nombre_campo, error.messages[0]) from error

        nombre_nuevo = almacenamiento.save(
            documento_actual.field.generate_filename(garantia, archivo.name),
            archivo,
        )
        setattr(garantia, nombre_campo, nombre_nuevo)
        if garantia.documento_identidad and garantia.compromiso_responsabilidad:
            garantia.estado = "registrada"
            garantia.fecha_registro = timezone.now()
        try:
            garantia.save(update_fields=[nombre_campo, "estado", "fecha_registro"])
        except Exception:
            almacenamiento.delete(nombre_nuevo)
            raise
        if nombre_anterior:
            transaction.on_commit(lambda: almacenamiento.delete(nombre_anterior))

    return garantia


def consultar_detalle_historial_prestamo(prestamo_id, ahora=None):
    """Recupera la ficha completa asociada a una entrega histórica."""
    try:
        return (
            _consultar_prestamos_con_estado(ahora=ahora)
            .select_related(
                "usuario",
                "registrado_por",
                "registrado_por__rol",
                "devolucion",
                "devolucion__realizado_por",
                "devolucion__realizado_por__rol",
                "material",
                "instancia",
                "garantia",
            )
            .get(pk=prestamo_id)
        )
    except (Prestamo.DoesNotExist, ValueError, TypeError) as error:
        raise PrestamoError(
            "prestamo_id",
            "No existe el préstamo indicado.",
            status_code=404,
        ) from error


def obtener_foto_checklist(prestamo_id, fase, indice):
    """Obtiene el FieldFile de la foto del checklist para su entrega mediante endpoint protegido.

    Devuelve el objeto FieldFile (con su storage configurado) y el nombre del
    archivo para que la vista decida cómo servirlo: en producción (Cloudinary)
    redirigirá a la URL remota; en desarrollo abrirá el archivo localmente.
    """
    try:
        foto = FotoChecklist.objects.get(
            prestamo_id=prestamo_id,
            fase=fase,
            indice=indice,
        )
    except (FotoChecklist.DoesNotExist, ValueError, TypeError) as error:
        raise PrestamoError(
            "foto_checklist",
            "No existe la foto indicada del checklist.",
            status_code=404,
        ) from error

    if not foto.imagen:
        raise PrestamoError(
            "foto_checklist",
            "La foto del checklist no está disponible.",
            status_code=404,
        )

    return foto.imagen, Path(foto.imagen.name).name


@transaction.atomic
def registrar_prestamo(
    *,
    dni_prestatario,
    material_id,
    instancia_id=None,
    reserva_id=None,
    tiempo_prestamo_minutos=None,
    tiempo_prestamo_dias=None,
    checklist_inicial,
    fotos_checklist,
    registrado_por,
    documento_identidad=None,
    compromiso_responsabilidad=None,
    fecha_entrega=None,
    fecha_fin=None,
    es_excepcion=False,
):
    """Registra la entrega con elegibilidad, garantía, conversión opcional de reserva y control atómico de stock."""
    minutos_prestamo, dias_prestamo, campo_duracion = _resolver_duracion_prestamo(
        tiempo_prestamo_minutos,
        tiempo_prestamo_dias,
    )
    _validar_checklist(checklist_inicial)
    _validar_fotos_checklist(checklist_inicial, fotos_checklist)
    checklist_inicial = [
        {
            "elemento": str(elemento.get("elemento", "")).strip(),
            "observacion": str(elemento.get("observacion", "")).strip(),
        }
        for elemento in checklist_inicial
    ]

    prestatario = _obtener_prestatario_bloqueado(dni_prestatario)
    try:
        material = Material.objects.select_for_update().get(pk=material_id)
    except (Material.DoesNotExist, ValueError, TypeError) as error:
        raise PrestamoError(
            "material_id",
            "No existe el material indicado.",
            status_code=404,
        ) from error

    # La fecha de entrega es siempre la hora del servidor; nunca se acepta una fecha
    # de inicio controlada por el cliente.
    ahora_entrega = timezone.now()
    fecha_entrega = ahora_entrega
    minutos_solicitados_explicitamente = tiempo_prestamo_minutos
    minutos_calendario_directo = None
    if fecha_fin is not None and reserva_id is None:
        if fecha_fin <= fecha_entrega:
            raise PrestamoError("fecha_fin", "La fecha de fin debe ser posterior al momento de entrega.")
        if fecha_fin.second == 0 and fecha_fin.microsecond == 0:
            inicio_referencia = fecha_entrega.replace(second=0, microsecond=0)
            minutos_calendario_directo = int((fecha_fin - inicio_referencia).total_seconds() // 60)
        else:
            minutos_calendario_directo = int(round((fecha_fin - fecha_entrega).total_seconds() / 60))

        # Validación de día laborable (Lunes a Viernes) y horario de atención (09:00 a 17:00)
        from apps.reservas.constants import (
            DIAS_LABORABLES,
            HORA_RESERVA_MAXIMO_FIN,
            HORA_RESERVA_MINIMO_INICIO,
            MINUTO_RESERVA_MAXIMO_FIN,
        )
        from apps.reservas.disponibilidad import obtener_dia_no_laborable

        fin_local = timezone.localtime(fecha_fin) if timezone.is_aware(fecha_fin) else fecha_fin
        if fin_local.weekday() not in DIAS_LABORABLES:
            raise PrestamoError(
                "fecha_fin",
                "La fecha de devolución debe ser un día laborable (lunes a viernes).",
            )
        dia_fin_inhabilitado = obtener_dia_no_laborable(fin_local)
        if dia_fin_inhabilitado is not None:
            raise PrestamoError(
                "fecha_fin",
                f"El día {fin_local.strftime('%d/%m/%Y')} está inhabilitado ({dia_fin_inhabilitado.motivo}). La devolución debe ser un día laborable.",
            )
        minutos_fin = fin_local.hour * 60 + fin_local.minute
        if not (
            HORA_RESERVA_MINIMO_INICIO * 60
            <= minutos_fin
            <= HORA_RESERVA_MAXIMO_FIN * 60 + MINUTO_RESERVA_MAXIMO_FIN
        ):
            raise PrestamoError(
                "fecha_fin",
                f"La devolución pactada debe respetar el horario de devolución, entre "
                f"{HORA_RESERVA_MINIMO_INICIO:02d}:00 y "
                f"{HORA_RESERVA_MAXIMO_FIN:02d}:{MINUTO_RESERVA_MAXIMO_FIN:02d}.",
            )

        # Cuentan todos los días en medio (sin descontar fines de semana)
        if minutos_solicitados_explicitamente is not None:
            minutos_prestamo = minutos_solicitados_explicitamente
        else:
            minutos_prestamo = minutos_calendario_directo

        if minutos_prestamo < MINIMO_MINUTOS_PRESTAMO:
            raise PrestamoError("fecha_fin", "El préstamo debe durar al menos 1 h (60 min).")
        dias_prestamo = max(1, math.ceil(minutos_prestamo / 1440))
    reserva = None
    garantia_reserva_reutilizable = None
    if reserva_id is not None:
        from apps.reservas.models import Reserva
        from apps.reservas.services import calcular_minutos_habiles

        try:
            reserva = (
                Reserva.objects.select_for_update(of=("self",))
                .select_related("usuario", "material", "instancia")
                .get(pk=reserva_id)
            )
        except (Reserva.DoesNotExist, ValueError, TypeError) as error:
            raise PrestamoError(
                "reserva_id",
                "No existe la reserva indicada.",
                status_code=404,
            ) from error

        if reserva.usuario_id != prestatario.id:
            raise PrestamoError(
                "reserva_id",
                "La reserva indicada no pertenece al prestatario.",
            )
        if reserva.material_id != material.id:
            raise PrestamoError(
                "reserva_id",
                "La reserva indicada no corresponde al material seleccionado.",
            )
        limite_conversion = reserva.fecha_limite_recojo
        if (
            reserva.estado != "reservada"
            or limite_conversion is None
            or ahora_entrega > limite_conversion
        ):
            raise PrestamoError(
                "reserva_id",
                "La reserva no se encuentra confirmada y vigente para su conversión.",
                status_code=409,
            )
        if reserva.instancia_id is None:
            raise PrestamoError(
                "reserva_id",
                "La reserva no tiene un ejemplar asignado.",
                status_code=409,
            )
        if instancia_id is not None and str(instancia_id) != str(reserva.instancia_id):
            raise PrestamoError(
                "instancia_id",
                "Debe entregarse el ejemplar asignado a la reserva confirmada.",
            )
        instancia_id = reserva.instancia_id
        if reserva.fecha_inicio is None or reserva.fecha_fin is None:
            raise PrestamoError(
                "reserva_id",
                "La reserva no tiene un rango de fechas válido.",
                status_code=409,
            )
        if ahora_entrega < reserva.fecha_inicio:
            raise PrestamoError(
                "reserva_id",
                "No se puede entregar el ejemplar antes de la fecha de inicio reservada.",
                status_code=409,
            )
        # Solo se puede convertir la reserva el mismo día calendario de fecha_inicio
        entrega_local = timezone.localtime(ahora_entrega) if timezone.is_aware(ahora_entrega) else ahora_entrega
        inicio_local = timezone.localtime(reserva.fecha_inicio) if timezone.is_aware(reserva.fecha_inicio) else reserva.fecha_inicio
        if entrega_local.date() != inicio_local.date():
            raise PrestamoError(
                "reserva_id",
                f"La reserva solo puede convertirse a préstamo el día de inicio reservado "
                f"({inicio_local.strftime('%d/%m/%Y')}). Hoy es {entrega_local.strftime('%d/%m/%Y')}.",
                status_code=409,
            )
        minutos_prestamo = max(0, int((reserva.fecha_fin - ahora_entrega).total_seconds() // 60))
        if minutos_prestamo <= 0:
            raise PrestamoError(
                "reserva_id",
                "El rango de fechas de la reserva no es válido.",
                status_code=409,
            )
        dias_prestamo = max(1, math.ceil(minutos_prestamo / 1440))
        if reserva.es_excepcion:
            es_excepcion = True
        try:
            garantia_existente = Garantia.objects.select_for_update().get(reserva=reserva)
            if (
                garantia_existente.estado == "registrada"
                and garantia_existente.documento_identidad
                and garantia_existente.compromiso_responsabilidad
            ):
                garantia_reserva_reutilizable = garantia_existente
        except Garantia.DoesNotExist:
            garantia_reserva_reutilizable = None

    validar_limite_prestamos_activos(prestatario, ahora=ahora_entrega)
    _validar_elegibilidad(prestatario, material, es_excepcion=es_excepcion)
    _validar_duracion_material(material, minutos_prestamo, campo_duracion)

    if reserva is None:
        if material.estado == "en_mantenimiento":
            raise PrestamoError(
                "material_id",
                "El material no está disponible para entrega.",
                status_code=409,
            )
        from apps.reservas.models import Reserva

        if material.estado == "reservado":
            tiene_reservas_sistema = Reserva.objects.filter(
                material_id=material.id, estado="reservada"
            ).exists()
            if not tiene_reservas_sistema:
                raise PrestamoError(
                    "material_id",
                    "El material no está disponible para entrega.",
                    status_code=409,
                )
        fecha_fin_estimada = fecha_entrega + timedelta(minutes=minutos_prestamo + TOLERANCIA_RECOJO_MINUTOS)

        if instancia_id is not None:
            reserva_solapada = Reserva.objects.filter(
                instancia_id=instancia_id,
                estado="reservada",
                fecha_inicio__isnull=False,
                fecha_fin__isnull=False,
                fecha_inicio__lt=fecha_fin_estimada,
                fecha_fin__gt=fecha_entrega,
            ).first()
            if reserva_solapada:
                raise PrestamoError(
                    "tiempo_prestamo",
                    f"El ejemplar seleccionado tiene una reserva confirmada a partir de {timezone.localtime(reserva_solapada.fecha_inicio).strftime('%d/%m/%Y %H:%M')}. La entrega debe devolverse antes de ese horario.",
                    status_code=409,
                )
        else:
            from apps.reservas.disponibilidad import obtener_instancias_disponibles_en_rango

            libres = obtener_instancias_disponibles_en_rango(
                material.id, fecha_entrega, fecha_fin_estimada, bloquear_filas=True
            )
            candidata = libres.first()
            if candidata:
                instancia_id = candidata.id
            else:
                proxima_reserva = Reserva.objects.filter(
                    material_id=material.id,
                    estado="reservada",
                    fecha_inicio__gt=fecha_entrega,
                    fecha_inicio__lt=fecha_fin_estimada,
                ).order_by("fecha_inicio").first()
                if proxima_reserva:
                    raise PrestamoError(
                        "tiempo_prestamo",
                        f"Los ejemplares tienen una reserva programada a partir de {proxima_reserva.fecha_inicio.strftime('%d/%m/%Y %H:%M')}. La entrega debe finalizar antes de ese horario.",
                        status_code=409,
                    )
    elif material.estado == "en_mantenimiento":
        raise PrestamoError(
            "material_id",
            "El material no está disponible para entrega.",
            status_code=409,
        )

    if reserva is None:
        from apps.reservas.disponibilidad import obtener_dia_no_laborable

        hora_entrega_local = timezone.localtime(ahora_entrega)
        dia_hoy_inhabilitado = obtener_dia_no_laborable(hora_entrega_local)
        if dia_hoy_inhabilitado is not None:
            raise PrestamoError(
                "fecha_entrega",
                f"Hoy ({hora_entrega_local.strftime('%d/%m/%Y')}) está inhabilitado ({dia_hoy_inhabilitado.motivo}). No se pueden registrar entregas en días no laborables.",
            )
        cierre_local = hora_entrega_local.replace(hour=18, minute=0, second=0, microsecond=0)
        if hora_entrega_local > cierre_local:
            raise PrestamoError(
                "fecha_entrega",
                "Los préstamos se otorgan hasta las 18:00; después se atienden el siguiente día laborable.",
            )

    requiere_garantia = es_excepcion or material.requiere_garantia()
    if garantia_reserva_reutilizable is not None and documento_identidad is None and compromiso_responsabilidad is None:
        pass
    else:
        _validar_documentos_garantia(
            material,
            documento_identidad,
            compromiso_responsabilidad,
            es_excepcion=es_excepcion,
        )

    try:
        instancia_elegida = servicios_inventario.marcar_instancia_prestada(
            material.id,
            instancia_id=instancia_id,
            permitir_reservada=bool(instancia_id is not None or reserva is not None),
        )
    except servicios_inventario.InventarioError as error:
        raise PrestamoError(
            error.campo,
            error.mensaje,
            status_code=error.status_code,
        ) from error

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

    # Snapshot inmutable de los datos del Material e InstanciaMaterial
    # al momento del préstamo, para preservar trazabilidad histórica
    # incluso si posteriormente se editan estado, observaciones, número de
    # serie, parámetros o cualquier otro campo editable.
    material_snapshot = {
        "nombre": material.nombre,
        "descripcion": material.descripcion,
        "codigo_material": material.codigo_material,
        "tipo": material.tipo,
        "marca": material.marca,
        "modelo": material.modelo,
        "numero_serie": material.numero_serie,
        "color": material.color,
        "precio": str(material.precio),
        "es_alto_valor": material.es_alto_valor,
        "tier_minimo_requerido": material.tier_minimo_requerido,
        "tiempo_maximo_prestamo": material.tiempo_maximo_prestamo,
        "bonificacion_tiempo": material.bonificacion_tiempo,
        "deduccion_tardanza": material.deduccion_tardanza,
        "deduccion_dano_parcial": material.deduccion_dano_parcial,
        "deduccion_dano_total": material.deduccion_dano_total,
        "costo_reparacion": str(material.costo_reparacion) if material.costo_reparacion else None,
        "costo_reposicion": str(material.costo_reposicion) if material.costo_reposicion else None,
    }

    instancia_snapshot = {}
    if instancia_elegida and instancia_elegida.get("id"):
        instancia = InstanciaMaterial.objects.get(pk=instancia_elegida["id"])
        instancia_snapshot = {
            "codigo_ejemplar": instancia.codigo_ejemplar,
            "numero_serie": instancia.numero_serie,
            "estado": instancia.estado,
            "color": instancia.color,
            "observaciones": instancia.observaciones,
            "ubicacion": instancia.ubicacion,
            "foto": instancia.foto.name if instancia.foto else None,
        }

    prestamo = Prestamo.objects.create(
        usuario=prestatario,
        material=material,
        registrado_por=registrado_por,
        fecha_entrega=ahora_entrega,
        fecha_limite=(
            reserva.fecha_fin
            if reserva is not None
            else fecha_entrega + timedelta(
                minutes=(
                    minutos_calendario_directo
                    if minutos_calendario_directo is not None
                    else minutos_prestamo
                )
            )
        ),
        tiempo_prestamo_minutos=minutos_prestamo,
        tiempo_prestamo_dias=dias_prestamo,
        estado="activo",
        es_excepcion=es_excepcion,
        checklist_inicial=checklist_inicial,
        instancia_id=instancia_elegida["id"],
        material_snapshot=material_snapshot,
        instancia_snapshot=instancia_snapshot,
    )

    if reserva is not None:
        reserva.estado = "convertida_en_prestamo"
        reserva.fecha_recojo = ahora_entrega
        reserva.prestamo = prestamo
        reserva.save(update_fields=["estado", "fecha_recojo", "prestamo", "updated_at"])

    # Material.estado describe disponibilidad del conjunto: solo pasa a
    # prestado cuando ya no queda ninguna unidad libre. `stock` se mantiene
    # como total registrado; la disponibilidad se deriva de préstamos activos.
    unidades_restantes = unidades_disponibles - 1
    if unidades_restantes == 0:
        material.estado = "prestado"
        material.save(update_fields=("estado", "updated_at"))
    elif material.estado in ("prestado", "reservado") and material.instancias.filter(estado="disponible").exists():
        material.estado = "disponible"
        material.save(update_fields=("estado", "updated_at"))

    if requiere_garantia:
        if garantia_reserva_reutilizable is not None and documento_identidad is None and compromiso_responsabilidad is None:
            garantia_reserva_reutilizable.prestamo = prestamo
            garantia_reserva_reutilizable.save(update_fields=["prestamo"])
        elif garantia_reserva_reutilizable is not None:
            # Si se adjuntaron nuevos PDFs al convertir, actualizamos y vinculamos la garantía existente.
            for nombre_campo, archivo in (
                ("documento_identidad", documento_identidad),
                ("compromiso_responsabilidad", compromiso_responsabilidad),
            ):
                if archivo is not None:
                    campo_archivo = getattr(garantia_reserva_reutilizable, nombre_campo)
                    campo_archivo.save(archivo.name, archivo, save=False)
            garantia_reserva_reutilizable.prestamo = prestamo
            garantia_reserva_reutilizable.estado = "registrada"
            garantia_reserva_reutilizable.fecha_registro = timezone.now()
            garantia_reserva_reutilizable.save()
        else:
            _crear_garantia_registrada(
                prestamo,
                documento_identidad,
                compromiso_responsabilidad,
                reserva=reserva,
            )

    fotos_guardadas = []
    try:
        for indice, (elemento, foto) in enumerate(zip(checklist_inicial, fotos_checklist)):
            foto_modelo = FotoChecklist(
                prestamo=prestamo,
                fase="inicial",
                indice=indice,
                elemento=elemento["elemento"].strip(),
                imagen=foto,
            )
            try:
                foto_modelo.save()
            except Exception:
                if foto_modelo.imagen.name:
                    foto_modelo.imagen.storage.delete(foto_modelo.imagen.name)
                raise
            fotos_guardadas.append((foto_modelo.imagen.storage, foto_modelo.imagen.name))
    except Exception:
        for almacenamiento, nombre in fotos_guardadas:
            almacenamiento.delete(nombre)
        raise

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


def _validar_checklist_devolucion(checklist_devolucion, prestamo=None):
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
    if prestamo is not None:
        checklist_inicial = prestamo.checklist_inicial or []
        if len(checklist_devolucion) != len(checklist_inicial):
            raise PrestamoError(
                "checklist",
                "La devolución debe conservar todos los elementos del checklist inicial.",
            )
        for indice, (inicial, devuelto) in enumerate(
            zip(checklist_inicial, checklist_devolucion),
            start=1,
        ):
            elemento_inicial = (
                str(inicial.get("elemento", "")).strip()
                if isinstance(inicial, dict)
                else ""
            )
            elemento_devuelto = str(devuelto.get("elemento", "")).strip()
            if elemento_devuelto != elemento_inicial:
                raise PrestamoError(
                    "checklist",
                    f"La fila {indice} debe conservar el elemento «{elemento_inicial}» "
                    "y el orden del checklist inicial.",
                )


def _validar_evidencia_devolucion(checklist_devolucion, fotos_checklist):
    if len(fotos_checklist) != len(checklist_devolucion):
        raise PrestamoError(
            "fotos_checklist",
            "Adjunta una foto por cada fila con daño del checklist de devolución.",
        )
    for indice, elemento in enumerate(checklist_devolucion):
        tiene_dano = elemento["estado"] in ("dano_parcial", "dano_total")
        nombre = str(elemento.get("elemento", "")).strip()
        observacion = str(elemento.get("observacion", "")).strip()
        foto = fotos_checklist[indice]
        if tiene_dano and not observacion:
            raise PrestamoError(
                "checklist",
                f"El elemento «{nombre}» requiere una observación porque reporta daño.",
            )
        if tiene_dano and foto is None:
            raise PrestamoError(
                "fotos_checklist",
                f"El elemento «{nombre}» requiere una foto porque reporta daño.",
            )
        if foto is not None:
            try:
                validar_foto_checklist(foto)
            except ValidationError as error:
                raise PrestamoError(
                    "fotos_checklist",
                    f"La foto del elemento «{nombre}» no es válida: {error.messages[0]}",
                ) from error


def _normalizar_checklist_devolucion(checklist_devolucion):
    """Normaliza el estado y la observación de cada fila devuelta."""
    normalizado = []
    for item in checklist_devolucion:
        elemento = str(item.get("elemento", "")).strip()
        normalizado.append(
            {
                "elemento": elemento,
                "estado": item["estado"],
                "observacion": str(item.get("observacion", "")).strip(),
            }
        )
    return normalizado


def _dias_tardanza(fecha_devolucion, fecha_limite):
    """Días excedidos tras superar el tiempo de gracia de 30 minutos."""
    limite_con_gracia = fecha_limite + timedelta(minutes=TIEMPO_GRACIA_MINUTOS)
    diferencia = (fecha_devolucion - limite_con_gracia).total_seconds()
    if diferencia <= 0:
        return 0
    return max(1, math.ceil(diferencia / SEGUNDOS_POR_DIA))


def _calcular_resultado(prestamo, checklist, fecha_devolucion):
    """Aplica RN06: bonificación a tiempo, tiempo de gracia de 30 min, tardanza proporcional y sanción por daño.

    El daño global es el peor estado del checklist (total prevalece sobre
    parcial) y el cobro solo existe cuando el material tiene costo
    parametrizado (RF08).
    """
    material = prestamo.material
    usuario = prestamo.usuario

    a_tiempo = fecha_devolucion <= prestamo.fecha_limite
    limite_con_gracia = prestamo.fecha_limite + timedelta(minutes=TIEMPO_GRACIA_MINUTOS)
    en_tiempo_gracia = (not a_tiempo) and (fecha_devolucion <= limite_con_gracia)
    dias_tardanza = _dias_tardanza(fecha_devolucion, prestamo.fecha_limite)

    bonificacion_base = material.bonificacion_tiempo if a_tiempo else 0
    tope_semanal_alcanzado = False
    if a_tiempo and bonificacion_base > 0:
        (
            bonificacion,
            tope_semanal_alcanzado,
            _ganados_previos,
            _tope,
        ) = calcular_bonificacion_con_tope_semanal(usuario, bonificacion_base, ahora=fecha_devolucion)
    else:
        bonificacion = 0

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

    deduccion_dano_base = deduccion_dano
    if prestamo.es_excepcion:
        deduccion_dano *= 2

    puntos_delta = bonificacion - deduccion_tardanza - deduccion_dano
    reputacion_antes = usuario.reputacion_puntaje
    reputacion_despues = puntaje_reputacion_ajustado(reputacion_antes + puntos_delta)

    return {
        "a_tiempo": a_tiempo,
        "en_tiempo_gracia": en_tiempo_gracia,
        "dias_tardanza": dias_tardanza,
        "bonificacion_base": bonificacion_base,
        "bonificacion": bonificacion,
        "tope_semanal_alcanzado": tope_semanal_alcanzado,
        "deduccion_tardanza": deduccion_tardanza,
        "dano": dano,
        "hay_dano": dano != "sin_cambios",
        "deduccion_dano_base": deduccion_dano_base,
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
    _validar_checklist_devolucion(checklist_devolucion, prestamo)
    checklist = _normalizar_checklist_devolucion(checklist_devolucion)
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
    fotos_checklist=None,
    realizado_por,
    fecha_devolucion=None,
):
    """Devuelve el préstamo con sanciones, estados actualizados y registro 1:1.

    Todo ocurre en una transacción: reputación, préstamo, material y la
    `Devolucion` quedan consistentes; si algo falla, nada se aplica.
    """
    prestamo = _obtener_prestamo_para_devolucion(prestamo_id, bloquear=True)
    material = prestamo.material
    _validar_estado_devoluble(prestamo)
    _validar_checklist_devolucion(checklist_devolucion, prestamo)
    if fotos_checklist is None:
        fotos_checklist = [None] * len(checklist_devolucion)
    _validar_evidencia_devolucion(checklist_devolucion, fotos_checklist)
    checklist = _normalizar_checklist_devolucion(checklist_devolucion)
    fecha_devolucion = fecha_devolucion or timezone.now()

    resultado = _calcular_resultado(prestamo, checklist, fecha_devolucion)
    tipo_movimiento = "bonificacion_devolucion" if resultado["a_tiempo"] else (
        "sancion_dano_total" if resultado["dano"] == "dano_total" else (
            "sancion_dano_parcial" if resultado["dano"] == "dano_parcial" else "sancion_tardanza"
        )
    )
    puntos_solicitados = (
        resultado["bonificacion_base"]
        - resultado["deduccion_tardanza"]
        - resultado["deduccion_dano"]
    )
    actualizar_reputacion(
        prestamo.usuario,
        resultado["puntos_delta"],
        tipo=tipo_movimiento,
        puntos_solicitados=puntos_solicitados,
        tope_aplicado=resultado["tope_semanal_alcanzado"],
        prestamo_id=prestamo.id,
        descripcion=f"Devolución del préstamo #{prestamo.id} ({material.nombre})",
        fecha=fecha_devolucion,
    )

    prestamo.estado = "devuelto"
    prestamo.save(update_fields=["estado"])

    material = prestamo.material
    unidades_ocupadas = contar_unidades_prestadas_por_material(
        [material.pk]
    ).get(material.pk, 0)
    if unidades_ocupadas == 0 and material.estado == "prestado":
        material.estado = "disponible"
        material.save(update_fields=("estado", "updated_at"))

    estado_final_instancia = "en_mantenimiento" if resultado["hay_dano"] else "disponible"
    observaciones_instancia = (
        f"Devuelto con {resultado['dano']} en préstamo #{prestamo.id}."
        if resultado["hay_dano"]
        else None
    )
    try:
        servicios_inventario.registrar_devolucion_instancia(
            material.id,
            instancia_id=prestamo.instancia_id,
            estado_final=estado_final_instancia,
            observaciones=observaciones_instancia,
        )
    except servicios_inventario.InventarioError as error:
        raise PrestamoError(
            error.campo,
            error.mensaje,
            status_code=error.status_code,
        ) from error

    devolucion = Devolucion.objects.create(
        prestamo=prestamo,
        realizado_por=realizado_por,
        fecha_devolucion=fecha_devolucion,
        checklist_devolucion=checklist,
        resultado=resultado,
    )
    fotos_guardadas = []
    try:
        for indice, (elemento, foto) in enumerate(zip(checklist, fotos_checklist)):
            if foto is None:
                continue
            foto_modelo = FotoChecklist(
                prestamo=prestamo,
                fase="final",
                indice=indice,
                elemento=elemento["elemento"],
                imagen=foto,
            )
            try:
                foto_modelo.save()
            except Exception:
                if foto_modelo.imagen.name:
                    foto_modelo.imagen.storage.delete(foto_modelo.imagen.name)
                raise
            fotos_guardadas.append((foto_modelo.imagen.storage, foto_modelo.imagen.name))
        if resultado["hay_dano"]:
            _generar_reporte_de_dano(devolucion)
    except Exception:
        for almacenamiento, nombre in fotos_guardadas:
            almacenamiento.delete(nombre)
        raise
    return devolucion
