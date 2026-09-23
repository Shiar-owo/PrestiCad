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