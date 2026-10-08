"""Estados del ciclo de vida de un préstamo."""

ESTADOS_PRESTAMO = [
    ("reservado", "Reservado"),
    ("activo", "Activo"),
    ("devuelto", "Devuelto"),
    ("vencido", "Vencido"),
]

ESTADOS_QUE_OCUPAN_UNIDAD = ("activo", "vencido")

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
