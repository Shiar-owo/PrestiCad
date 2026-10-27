"""Almacenamiento privado para documentos de garantía y assets de Cloudinary."""
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured
from django.core.files.storage import FileSystemStorage
from django.core.files.storage import storages
from django.utils.deconstruct import deconstructible

# Extensiones de archivo que Cloudinary debe tratar como documentos (resource_type='raw').
_EXTENSIONES_DOCUMENTO = {".pdf", ".doc", ".docx", ".txt"}

try:
    from cloudinary_storage.storage import MediaCloudinaryStorage
    from cloudinary.utils import cloudinary_url
except (ImportError, ImproperlyConfigured):
    # En desarrollo no hay credenciales de Cloudinary y el paquete falla al
    # importarse. Los storages de Cloudinary solo se usan en producción.
    MediaCloudinaryStorage = None
    cloudinary_url = None


@deconstructible
class AlmacenamientoPrivadoGarantias(FileSystemStorage):
    """Guarda archivos en disco sin ofrecer una URL pública de descarga."""

    def url(self, name):
        raise ValueError(
            "Los documentos de garantía solo se descargan desde el endpoint protegido."
        )


if MediaCloudinaryStorage is not None:
    @deconstructible
    class AlmacenamientoPresticadCloudinary(MediaCloudinaryStorage):
        """Storage de Cloudinary que detecta el tipo de recurso automáticamente.

        - 'raw'   → PDFs y documentos de texto (garantías, reportes de daños).
        - 'image' → Fotos de materiales, instancias y checklist.

        Permite usar un único storage para todos los assets del proyecto sin
        que Cloudinary rechace PDFs servidos como imágenes.
        """

        def _get_resource_type(self, name):
            extension = Path(name).suffix.lower()
            if extension in _EXTENSIONES_DOCUMENTO:
                return "raw"
            return "image"

    @deconstructible
    class AlmacenamientoPrivadoGarantiasCloudinary(AlmacenamientoPresticadCloudinary):
        """Guarda garantías y fotos de checklist en Cloudinary.

        Las URLs se generan con type='upload' (mismo tipo con el que se suben),
        para que Cloudinary pueda servirlos correctamente.  El acceso al archivo
        real queda protegido por el endpoint de Django, que verifica roles antes
        de redirigir.
        """

        def url(self, name):
            if not name:
                raise ValueError("Nombre de archivo inválido.")
            name = self._prepend_prefix(name)
            if cloudinary_url is None:
                raise ValueError(
                    "cloudinary no está disponible para generar URLs."
                )
            url, _ = cloudinary_url(
                name,
                resource_type=self._get_resource_type(name),
                type="upload",
                secure=True,
            )
            return url
else:
    AlmacenamientoPresticadCloudinary = None
    AlmacenamientoPrivadoGarantiasCloudinary = None


def obtener_almacenamiento_garantias():
    """Obtiene el alias privado configurado para los documentos de garantía."""
    return storages["garantias"]
