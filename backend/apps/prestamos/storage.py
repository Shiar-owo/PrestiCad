"""Almacenamiento privado para documentos de garantía."""
from django.core.exceptions import ImproperlyConfigured
from django.core.files.storage import FileSystemStorage
from django.core.files.storage import storages
from django.utils.deconstruct import deconstructible

try:
    from cloudinary_storage.storage import RawMediaCloudinaryStorage
    from cloudinary.utils import cloudinary_url
except (ImportError, ImproperlyConfigured):
    # En desarrollo no hay credenciales de Cloudinary y el paquete falla al
    # importarse. El storage privado de Cloudinary solo se usa en producción.
    RawMediaCloudinaryStorage = None
    cloudinary_url = None


@deconstructible
class AlmacenamientoPrivadoGarantias(FileSystemStorage):
    """Guarda archivos en disco sin ofrecer una URL pública de descarga."""

    def url(self, name):
        raise ValueError(
            "Los documentos de garantía solo se descargan desde el endpoint protegido."
        )


if RawMediaCloudinaryStorage is not None:
    @deconstructible
    class AlmacenamientoPrivadoGarantiasCloudinary(RawMediaCloudinaryStorage):
        """Guarda archivos en Cloudinary con acceso privado mediante URLs firmadas."""

        def url(self, name):
            if not name:
                raise ValueError("Nombre de archivo inválido.")
            name = self._prepend_prefix(name)
            if cloudinary_url is None:
                raise ValueError(
                    "cloudinary no está disponible para generar URLs firmadas."
                )
            url, _ = cloudinary_url(
                name,
                resource_type=self._get_resource_type(name),
                type="authenticated",
                sign_url=True,
                secure=True,
            )
            return url
else:
    AlmacenamientoPrivadoGarantiasCloudinary = None


def obtener_almacenamiento_garantias():
    """Obtiene el alias privado configurado para los documentos de garantía."""
    return storages["garantias"]
