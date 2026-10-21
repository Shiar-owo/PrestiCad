"""Estados del ciclo de vida de un préstamo."""

ESTADOS_PRESTAMO = [
    ("reservado", "Reservado"),
    ("activo", "Activo"),
    ("devuelto", "Devuelto"),
    ("vencido", "Vencido"),
]

TIPOS_GARANTIA = [
    ("documento_y_compromiso", "Documento y compromiso"),
]

ESTADOS_GARANTIA = [
    ("pendiente", "Pendiente"),
    ("registrada", "Registrada"),
]

ESTADOS_QUE_OCUPAN_UNIDAD = ("activo", "vencido")

# Límites para sugerir prestatarios al registrar una entrega.
MINIMO_DIGITOS_BUSQUEDA_PRESTATARIO = 3
MAXIMO_PRESTATARIOS_SUGERIDOS = 10

# Límites del registro de entrega (HU09).
MAXIMO_DIAS_PRESTAMO = 30
TAMANO_MAXIMO_FOTO_CHECKLIST_BYTES = 5 * 1024 * 1024
FORMATOS_FOTO_CHECKLIST_PERMITIDOS = frozenset({"image/jpeg", "image/png", "image/webp"})
EXTENSIONES_FOTO_CHECKLIST_PERMITIDAS = frozenset({".jpg", ".jpeg", ".png", ".webp"})

FASES_FOTO_CHECKLIST = [
    ("inicial", "Checklist inicial"),
    ("final", "Checklist de devolución"),
]

# Solo los préstamos entregados y no devueltos admiten una devolución (HU11).
ESTADOS_DEVOLUBLES = ("activo", "vencido")

# Estado normalizado de cada ítem en el checklist de devolución (RN09). Se
# contrasta con la condición inicial registrada al entregar para detectar
# daños nuevos y aplicar las sanciones de RN06.
ESTADOS_CHECKLIST_DEVOLUCION = [
    ("sin_cambios", "Sin cambios"),
    ("dano_parcial", "Daño parcial"),
    ("dano_total", "Daño total"),
]

VALORES_ESTADOS_CHECKLIST_DEVOLUCION = (
    "sin_cambios",
    "dano_parcial",
    "dano_total",
)
