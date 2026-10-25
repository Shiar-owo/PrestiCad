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

ESTADOS_INSTANCIA = [
    ("disponible", "Disponible"),
    ("reservado", "Reservado"),
    ("prestado", "Prestado"),
    ("en_mantenimiento", "En Mantenimiento"),
    ("de_baja", "De Baja"),
]

# Estados permitidos al registrar ejemplares nuevos. Préstamo y reserva se
# asignan desde sus flujos operativos, no durante el alta del inventario.
ESTADOS_INICIALES_INSTANCIA = [
    ("disponible", "Disponible"),
    ("en_mantenimiento", "En mantenimiento"),
]

# Mapeo de Tiers de materiales accesibles según el Tier de reputación del usuario (RN03, HU05)
TIERS_ACCESIBLES = {
    "restringido": ("restringido",),
    "estandar": ("restringido", "estandar"),
    "avanzado": ("restringido", "estandar", "avanzado"),
}

# HU04: límite común para las filas de lote y registro por detalle.
MAXIMO_EJEMPLARES_REGISTRO = 50

MODOS_REGISTRO_MATERIAL = [
    ("unico", "Único"),
    ("lote", "Lote"),
    ("detalle", "Detalle"),
]
