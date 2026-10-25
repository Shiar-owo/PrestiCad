"""Validaciones de archivos adjuntos a préstamos y garantías."""
from pathlib import Path

from django.conf import settings
from django.core.exceptions import ValidationError

from apps.prestamos.constants import (
    EXTENSIONES_FOTO_CHECKLIST_PERMITIDAS,
    FORMATOS_FOTO_CHECKLIST_PERMITIDOS,
    TAMANO_MAXIMO_FOTO_CHECKLIST_BYTES,
)


def validar_foto_checklist(archivo):
    """Valida tamaño, extensión y MIME; ImageField valida que sea una imagen real."""
    if archivo.size > TAMANO_MAXIMO_FOTO_CHECKLIST_BYTES:
        raise ValidationError(
            "La foto del checklist no debe pesar más de 5 MB.",
            code="foto_muy_grande",
        )
    if Path(archivo.name).suffix.lower() not in EXTENSIONES_FOTO_CHECKLIST_PERMITIDAS:
        raise ValidationError(
            "La foto debe tener extensión JPG, PNG o WEBP.",
            code="extension_foto_invalida",
        )
    if getattr(archivo, "content_type", None) not in FORMATOS_FOTO_CHECKLIST_PERMITIDOS:
        raise ValidationError(
            "La foto debe ser de tipo JPG, PNG o WEBP.",
            code="tipo_foto_invalido",
        )


def validar_pdf_garantia(archivo):
    """Exige PDF por extensión, MIME, cabecera y límite configurado."""
    limite = settings.GARANTIA_TAMANO_MAXIMO_BYTES
    if archivo.size > limite:
        raise ValidationError(
            "El archivo supera el tamaño máximo permitido para documentos de garantía.",
            code="archivo_muy_grande",
        )
    if Path(archivo.name).suffix.lower() != ".pdf":
        raise ValidationError(
            "El archivo debe tener extensión .pdf.",
            code="extension_pdf_invalida",
        )
    if getattr(archivo, "content_type", None) != "application/pdf":
        raise ValidationError(
            "El archivo debe ser de tipo application/pdf.",
            code="tipo_pdf_invalido",
        )

    try:
        cabecera = archivo.read(5)
        archivo.seek(0)
    except (AttributeError, OSError) as error:
        raise ValidationError(
            "No se pudo verificar el contenido del archivo PDF.",
            code="contenido_pdf_invalido",
        ) from error
    if cabecera != b"%PDF-":
        raise ValidationError(
            "El contenido del archivo no corresponde a un PDF válido.",
            code="contenido_pdf_invalido",
        )
