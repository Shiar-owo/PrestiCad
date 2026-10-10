"""Almacenamiento local privado para documentos de garantía."""
from django.core.files.storage import FileSystemStorage
from django.utils.deconstruct import deconstructible


@deconstructible
class AlmacenamientoPrivadoGarantias(FileSystemStorage):
    """Guarda archivos en disco sin ofrecer una URL pública de descarga."""

    def url(self, name):
        raise ValueError(
            "Los documentos de garantía solo se descargan desde el endpoint protegido."
        )
