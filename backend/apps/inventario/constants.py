# constants.py — Enums/choices del dominio de inventario (tipo, estado)

TIPOS_MATERIAL = [
    ("equipo", "Equipo"),
    ("libro", "Libro"),
    ("objeto", "Objeto"),
]

UMBRAL_PRECIO_ALTO_VALOR = 200

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

# Rango permitido para el parámetro configurable de tiempo máximo de préstamo
# de un material (en minutos): mínimo 30 minutos y máximo 15 días (21600 minutos).
MINIMO_TIEMPO_MAXIMO_PRESTAMO_MINUTOS = 30
MAXIMO_TIEMPO_MAXIMO_PRESTAMO_MINUTOS = 15 * 24 * 60

# Tiempo máximo de préstamo por defecto (en minutos) según el Tier mínimo del material:
# - Avanzado: 6 horas (360 min) — equipos especializados/restringidos dentro del campus
# - Estándar: 24 horas / 1 día (1440 min)
# - Restringido: 3 días (4320 min)
TIEMPO_MAXIMO_DEFAULT_POR_TIER = {
    "avanzado": 360,
    "estandar": 1440,
    "restringido": 4320,
}
DEFAULT_TIEMPO_MAXIMO_PRESTAMO_MINUTOS = TIEMPO_MAXIMO_DEFAULT_POR_TIER["estandar"]

