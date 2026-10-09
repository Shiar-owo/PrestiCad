"""Generación del reporte PDF de daños en la devolución (RN10, HU11).

Toda devolución que detecta daño parcial o total debe producir este PDF como
evidencia auditable: datos del préstamo, actores, tipo de daño, elementos
dañados contrastados con el checklist inicial y la sanción aplicada.
"""
from io import BytesIO

from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

AZUL_INSTITUCIONAL = colors.HexColor("#003c84")
AZUL_CLARO = colors.HexColor("#e3edf7")
BORDE = colors.HexColor("#c2d2e4")

ETIQUETAS_DANO = {
    "dano_parcial": "DAÑO PARCIAL",
    "dano_total": "DAÑO TOTAL",
}

ETIQUETAS_ESTADO = {
    "sin_cambios": "Sin cambios",
    "dano_parcial": "Daño parcial",
    "dano_total": "Daño total",
}


def _formatear_fecha(valor):
    if not valor:
        return "—"
    return timezone.localtime(valor).strftime("%d/%m/%Y %H:%M")


def _estilos():
    base = getSampleStyleSheet()
    return {
        "marca": ParagraphStyle(
            "Marca",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=11,
            textColor=AZUL_INSTITUCIONAL,
            spaceAfter=2,
        ),
        "titulo": ParagraphStyle(
            "Titulo",
            parent=base["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=16,
            textColor=colors.HexColor("#123a63"),
            spaceAfter=4,
        ),
        "seccion": ParagraphStyle(
            "Seccion",
            parent=base["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=12,
            textColor=AZUL_INSTITUCIONAL,
            spaceBefore=12,
            spaceAfter=6,
        ),
        "cuerpo": ParagraphStyle(
            "Cuerpo",
            parent=base["Normal"],
            fontSize=10,
            leading=14,
        ),
        "nota": ParagraphStyle(
            "Nota",
            parent=base["Normal"],
            fontSize=8,
            textColor=colors.HexColor("#2f5578"),
        ),
        "celda": ParagraphStyle(
            "Celda",
            parent=base["Normal"],
            fontSize=9,
            leading=12,
        ),
        "celda_negrita": ParagraphStyle(
            "CeldaNegrita",
            parent=base["Normal"],
            fontSize=9,
            leading=12,
            fontName="Helvetica-Bold",
        ),
    }


def _tabla(filas, anchos, estilos):
    tabla = Table(filas, colWidths=anchos, hAlign="LEFT")
    tabla.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), AZUL_CLARO),
                ("GRID", (0, 0), (-1, -1), 0.5, BORDE),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return tabla


def generar_reporte_dano(devolucion):
    """Construye el PDF del reporte de daños y devuelve sus bytes."""
    prestamo = devolucion.prestamo
    material = prestamo.material
    prestatario = prestamo.usuario
    gestor = devolucion.realizado_por
    resultado = devolucion.resultado
    estilos = _estilos()

    nombre_prestatario = (
        f"{prestatario.nombre} {prestatario.apellido}".strip()
    )
    nombre_gestor = f"{gestor.nombre} {gestor.apellido}".strip()

    buffer = BytesIO()
    documento = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
        title=f"Reporte de daños - préstamo {prestamo.pk}",
        author="PrestiCad",
    )

    historia = [
        Paragraph("PrestiCad · Sistema de préstamos e inventario", estilos["marca"]),
        Paragraph("Reporte de daños en devolución", estilos["titulo"]),
        Paragraph(
            f"Emitido el {_formatear_fecha(devolucion.fecha_devolucion)} · "
            f"Documento generado automáticamente (RN10).",
            estilos["cuerpo"],
        ),
        Spacer(1, 8),
        Paragraph("Datos del préstamo", estilos["seccion"]),
    ]

    datos_prestamo = [
        (Paragraph("Préstamo N°", estilos["celda_negrita"]), str(prestamo.pk)),
        (Paragraph("Material", estilos["celda_negrita"]), material.nombre),
        (
            Paragraph("Código de inventario", estilos["celda_negrita"]),
            material.codigo_inventario,
        ),
        (
            Paragraph("Fecha de entrega", estilos["celda_negrita"]),
            _formatear_fecha(prestamo.fecha_entrega),
        ),
        (
            Paragraph("Fecha límite", estilos["celda_negrita"]),
            _formatear_fecha(prestamo.fecha_limite),
        ),
        (
            Paragraph("Fecha de devolución", estilos["celda_negrita"]),
            _formatear_fecha(devolucion.fecha_devolucion),
        ),
        (
            Paragraph("Prestatario", estilos["celda_negrita"]),
            f"{nombre_prestatario} · DNI {prestatario.dni}",
        ),
        (
            Paragraph("Registrado por", estilos["celda_negrita"]),
            nombre_gestor,
        ),
        (
            Paragraph("Tipo de daño", estilos["celda_negrita"]),
            Paragraph(
                f"<b>{ETIQUETAS_DANO.get(resultado['dano'], 'SIN DAÑOS')}</b>",
                estilos["celda"],
            ),
        ),
    ]
    historia.append(
        _tabla(datos_prestamo, [4.5 * cm, 12.3 * cm], estilos)
    )

    daniados = [
        item for item in devolucion.checklist_devolucion if item["estado"] != "sin_cambios"
    ]
    historia.append(Paragraph("Elementos dañados", estilos["seccion"]))
    filas = [
        [
            Paragraph("Elemento", estilos["celda_negrita"]),
            Paragraph("Condición inicial", estilos["celda_negrita"]),
            Paragraph("Estado devuelto", estilos["celda_negrita"]),
            Paragraph("Observación", estilos["celda_negrita"]),
        ]
    ]
    for item in daniados:
        filas.append(
            [
                Paragraph(item["elemento"], estilos["celda"]),
                Paragraph(item["condicion"] or "—", estilos["celda"]),
                Paragraph(
                    ETIQUETAS_ESTADO.get(item["estado"], item["estado"]),
                    estilos["celda"],
                ),
                Paragraph(item["observacion"] or "—", estilos["celda"]),
            ]
        )
    historia.append(
        Table(
            filas,
            colWidths=[3.6 * cm, 5.2 * cm, 3.4 * cm, 4.6 * cm],
            hAlign="LEFT",
            style=TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), AZUL_INSTITUCIONAL),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("GRID", (0, 0), (-1, -1), 0.5, BORDE),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]
            ),
        )
    )

    cobro = resultado["cobro_economico"]
    if cobro is None:
        cobro_texto = "Sin costo parametrizado para este material"
    else:
        cobro_texto = f"S/ {cobro}"

    puntos = [
        (
            Paragraph("Bonificación por entrega a tiempo", estilos["celda_negrita"]),
            f"+{resultado['bonificacion']} pts"
            if resultado["a_tiempo"]
            else "No aplica (entrega fuera de plazo)",
        ),
        (
            Paragraph(
                f"Deducción por tardanza · {resultado['dias_tardanza']} día(s)",
                estilos["celda_negrita"],
            ),
            f"-{resultado['deduccion_tardanza']} pts"
            if resultado["deduccion_tardanza"]
            else "No aplica",
        ),
        (
            Paragraph("Deducción por daño", estilos["celda_negrita"]),
            f"-{resultado['deduccion_dano']} pts"
            if resultado["deduccion_dano"]
            else "No aplica",
        ),
        (
            Paragraph("Impacto neto en reputación", estilos["celda_negrita"]),
            f"{resultado['puntos_delta']:+d} pts",
        ),
        (
            Paragraph("Reputación resultante", estilos["celda_negrita"]),
            f"{resultado['reputacion_antes']} ({resultado['tier_antes'].title()})"
            f" → {resultado['reputacion_despues']} ({resultado['tier_despues'].title()})",
        ),
        (
            Paragraph("Cobro económico", estilos["celda_negrita"]),
            cobro_texto,
        ),
    ]
    historia.append(Paragraph("Sanciones aplicadas", estilos["seccion"]))
    historia.append(_tabla(puntos, [8.5 * cm, 8.3 * cm], estilos))

    historia.append(Spacer(1, 16))
    historia.append(
        Paragraph(
            "Documento generado por PrestiCad en la registración de la "
            "devolución. Conserva este reporte como evidencia del estado en "
            "que fue recibido el material.",
            estilos["nota"],
        )
    )

    documento.build(historia)
    return buffer.getvalue()
