from datetime import timedelta

from django.db.models import Case, CharField, Count, DateTimeField, F, IntegerField, Value, When
from django.db import transaction
from django.utils import timezone

from apps.inventario.constants import TIERS_ACCESIBLES
from apps.inventario.models import Material
from apps.prestamos.constants import ESTADOS_QUE_OCUPAN_UNIDAD
from apps.prestamos.models import Prestamo
from apps.usuarios.models import Usuario


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


def consultar_prestamos_usuario(usuario_id, ahora=None):
    """Lista préstamos propios, deriva vencidos en lectura y prioriza su vencimiento."""
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
        Prestamo.objects.filter(usuario_id=usuario_id)
        .select_related("material")
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
