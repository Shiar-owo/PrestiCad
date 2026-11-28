"""Estados del ciclo de vida de un préstamo."""

from apps.compartido.constants import (
    MAXIMO_ACTIVOS_SIMULTANEOS_POR_TIER,
    MAXIMO_DURACION_DIAS,
    MAXIMO_DURACION_PACTADA_MINUTOS,
    TOLERANCIA_DEVOLUCION_MINUTOS,
)

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

MAXIMO_PRESTAMOS_ACTIVOS_TIER = MAXIMO_ACTIVOS_SIMULTANEOS_POR_TIER

MENSAJES_ERROR_PRESTAMO = {
    "limite_prestamos_alcanzado": (
        "El prestatario ha alcanzado el límite máximo de préstamos activos permitidos "
        "para su nivel de reputación ({maximo} activos)."
    ),
    "prestamo_vencido_pendiente": (
        "El prestatario tiene al menos un préstamo vencido pendiente de devolución. "
        "Debe regularizar su situación antes de recibir nuevos materiales."
    ),
    "material_ya_prestado": (
        "El prestatario ya tiene un ejemplar en préstamo de este material. "
        "Solo se permite un ejemplar del mismo material por usuario a la vez."
    ),
}


# Límites para sugerir prestatarios al registrar una entrega.
MINIMO_DIGITOS_BUSQUEDA_PRESTATARIO = 3
MAXIMO_PRESTATARIOS_SUGERIDOS = 10

# Límites del registro de entrega y tiempo de gracia (HU09 / HU11 / PRTCAD-183).
MINIMO_MINUTOS_PRESTAMO = 60
MAXIMO_MINUTOS_PRESTAMO = MAXIMO_DURACION_PACTADA_MINUTOS
MINIMO_DIAS_PRESTAMO = 1
MAXIMO_DIAS_PRESTAMO = MAXIMO_DURACION_DIAS
TIEMPO_GRACIA_MINUTOS = TOLERANCIA_DEVOLUCION_MINUTOS


def formatear_duracion_minutos(minutos):
    """Formatea una duración en minutos en una expresión legible en español."""
    minutos = int(minutos)
    partes = []
    dias, resto = divmod(minutos, 1440)
    horas, minutos = divmod(resto, 60)
    if dias:
        partes.append(f"{dias} {'día' if dias == 1 else 'días'}")
    if horas:
        partes.append(f"{horas} {'hora' if horas == 1 else 'horas'}")
    if minutos or not partes:
        partes.append(f"{minutos} {'minuto' if minutos == 1 else 'minutos'}")
    if len(partes) == 1:
        return partes[0]
    return f"{', '.join(partes[:-1])} y {partes[-1]}"

TAMANO_MAXIMO_FOTO_CHECKLIST_BYTES = 4 * 1024 * 1024
# Vercel limita el cuerpo completo del rewrite a ~4.5 MB, así que la suma de
# todos los archivos de una misma petición no puede superar este valor.
TAMANO_MAXIMO_SOLICITUD_BYTES = 4 * 1024 * 1024
FORMATOS_FOTO_CHECKLIST_PERMITIDOS = frozenset({"image/jpeg", "image/png", "image/webp"})
EXTENSIONES_FOTO_CHECKLIST_PERMITIDAS = frozenset({".jpg", ".jpeg", ".png", ".webp"})

FASES_FOTO_CHECKLIST = [
    ("inicial", "Checklist inicial"),
    ("final", "Checklist de devolución"),
]

# Solo los préstamos entregados y no devueltos admiten una devolución (HU11).
ESTADOS_DEVOLUBLES = ("activo", "vencido")

# Estado normalizado de cada fila del checklist de devolución (RN09).
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
