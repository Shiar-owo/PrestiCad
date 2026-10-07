"""Estados del ciclo de vida de un préstamo."""

ESTADOS_PRESTAMO = [
    ("reservado", "Reservado"),
    ("activo", "Activo"),
    ("devuelto", "Devuelto"),
    ("vencido", "Vencido"),
]

ESTADOS_QUE_OCUPAN_UNIDAD = ("activo", "vencido")
