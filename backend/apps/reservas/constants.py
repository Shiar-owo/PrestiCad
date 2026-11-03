"""Constantes y catálogos del dominio de reservas y lista de espera."""

ESTADOS_RESERVA = [
    ("en_espera", "En espera"),
    ("reservada", "Reservada"),
    ("expirada", "Expirada"),
    ("rechazada", "Rechazada"),
    ("cancelada", "Cancelada"),
    ("cancelada_por_vencimiento", "Cancelada por vencimiento"),
    ("convertida_en_prestamo", "Convertida en préstamo"),
]

PRIORIDADES_RESERVA = [
    ("alta", "Alta"),
    ("media", "Media"),
    ("baja", "Baja"),
]

VALORES_PRIORIDAD_RESERVA = ("alta", "media", "baja")

# Orden numérico ascendente (0 es mayor jerarquía) para autopromoción y cola (RN11)
ORDEN_PRIORIDAD = {
    "alta": 0,
    "media": 1,
    "baja": 2,
}

ORDEN_TIER = {
    "avanzado": 0,
    "estandar": 1,
    "restringido": 2,
}

HORAS_ESPERA = 72
HORAS_RECOJO = 24

ESTADOS_ACTIVOS = ("en_espera", "reservada")

MENSAJES_ERROR_RESERVA = {
    "material_no_encontrado": "No existe el material indicado.",
    "reserva_no_encontrada": "No existe la reserva indicada.",
    "solo_prestatario": "Solo los usuarios con rol de prestatario pueden solicitar reservas.",
    "usuario_inactivo": "El usuario no está habilitado para realizar reservas.",
    "tier_insuficiente": "El Tier de reputación del usuario no permite reservar este material.",
    "tier_insuficiente_excepcion_disponible": (
        "Tu Tier actual es Restringido y el material requiere un Tier superior. "
        "Puedes solicitar una reserva excepcional por necesidad académica adjuntando los documentos de garantía."
    ),
    "maximo_reservas_activas": "Has alcanzado el límite máximo de solicitudes de reserva activas.",
    "prioridad_invalida": "La prioridad debe ser alta, media o baja.",
    "justificacion_obligatoria": "La justificación de la reserva es obligatoria.",
    "motivo_obligatorio": "El motivo es obligatorio para completar esta acción.",
    "estado_invalido_cancelar": "Solo se pueden cancelar reservas en estado reservada.",
    "estado_invalido_rechazar": "Solo se pueden rechazar solicitudes que se encuentran en espera.",
    "excepcion_solo_restringido": (
        "La solicitud excepcional solo aplica a usuarios en Tier Restringido "
        "para materiales de un Tier superior."
    ),
    "sin_instancia_disponible": "No hay ejemplares disponibles para confirmar la reserva en este momento.",
    "motivo_vencimiento_recojo": "Cancelada automáticamente por no recoger el ejemplar dentro del plazo de 24 horas.",
}
