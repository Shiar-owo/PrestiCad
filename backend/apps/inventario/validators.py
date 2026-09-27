"""Validaciones de la foto del material (HU04, criterio 1).

Viven fuera del modelo para poder usarlas en los dos caminos por los que
entra un archivo: los validadores del campo del modelo (que se ejecutan en
`full_clean`, por ejemplo en el admin) y los contratos JSON, porque DRF no
corre los validadores del modelo durante `is_valid()`.
"""
from django.core.exceptions import ValidationError

# 5 MB. Es un límite del requisito, no una opción de despliegue, así que no
# vive en `settings`.
TAMANIO_MAXIMO = 5 * 1024 * 1024

# El `content_type` lo declara el navegador, así que por sí solo no prueba
# nada; el `ImageField` abre el archivo con Pillow y descarta un archivo que
# no sea una imagen de verdad. Esta lista acota los formatos admitidos.
FORMATOS_PERMITIDOS = frozenset({"image/jpeg", "image/png", "image/webp"})

MENSAJE_TAMANIO = "La foto no debe pesar más de 5 MB."
MENSAJE_FORMATO = "La foto debe estar en formato JPG, PNG o WEBP."


def validar_foto(foto):
    """Verifica el tamaño y el formato de la foto subida.

    Levanta `ValidationError` con un mensaje en español, para que la vista
    pueda devolverlo tal cual en la respuesta.
    """
    if foto.size > TAMANIO_MAXIMO:
        raise ValidationError(MENSAJE_TAMANIO, code="foto_muy_grande")

    if foto.content_type not in FORMATOS_PERMITIDOS:
        raise ValidationError(MENSAJE_FORMATO, code="formato_foto_invalido")
