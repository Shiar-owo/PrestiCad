# constants.py — Enums/choices del dominio de inventario (tipo, estado)

TIPOS_MATERIAL = [
    ("equipo", "Equipo"),
    ("libro", "Libro"),
    ("objeto", "Objeto"),
]

ESTADOS_MATERIAL = [
    ("disponible", "Disponible"),
    ("en_mantenimiento", "En Mantenimiento"),
    ("reservado", "Reservado"),
    ("prestado", "Prestado"),
]

# Mapeo de Tiers de materiales accesibles según el Tier de reputación del usuario (RN03, HU05)
TIERS_ACCESIBLES = {
    "restringido": ("restringido",),
    "estandar": ("restringido", "estandar"),
    "avanzado": ("restringido", "estandar", "avanzado"),
}
