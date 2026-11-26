# constants.py — Enums/choices del dominio (tipo, rol, estado, tier)

TIPOS_USUARIO = [
    ("alumno", "Alumno"),
    ("docente", "Docente"),
    ("administrativo", "Administrativo"),
]

ROLES = [
    ("prestatario", "Prestatario"),
    ("gestor", "Gestor de Almacén"),
    ("administrador", "Administrador"),
]

ESTADOS_USUARIO = [
    ("activo", "Activo"),
    ("inactivo", "Inactivo"),
    ("suspendido", "Suspendido"),
]

TIERS = [
    ("avanzado", "Avanzado"),
    ("estandar", "Estándar"),
    ("restringido", "Restringido"),
]

MAXIMO_PUNTOS_SEMANALES_TIER = {
    "restringido": 30,
    "estandar": 60,
    "avanzado": 80,
}

TIPOS_TRANSACCION_REPUTACION = [
    ("bonificacion_devolucion", "Bonificación por entrega a tiempo"),
    ("sancion_tardanza", "Sanción por devolución tardía"),
    ("sancion_dano_parcial", "Sanción por daño parcial"),
    ("sancion_dano_total", "Sanción por daño total"),
    ("sancion_reserva_vencida", "Sanción por reserva no recogida"),
    ("ajuste_administrativo", "Ajuste manual de administración"),
]
