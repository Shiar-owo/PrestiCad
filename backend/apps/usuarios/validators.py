"""Validadores para el módulo de usuarios."""
import phonenumbers
from phonenumbers import NumberParseException
from django.core.exceptions import ValidationError
from rest_framework import serializers

TAMANIO_MAXIMO_FOTO = 4 * 1024 * 1024
FORMATOS_PERMITIDOS_FOTO = frozenset({"image/jpeg", "image/png", "image/webp"})
MENSAJE_TAMANIO_FOTO = "La foto no debe pesar más de 4 MB."
MENSAJE_FORMATO_FOTO = "La foto debe estar en formato JPG, PNG o WEBP."


def validar_foto_usuario(foto):
    """Verifica el tamaño y el formato de la foto de perfil subida.

    Válido tanto para validación del modelo Django como para serializers.
    """
    if not foto:
        return

    if hasattr(foto, "size") and foto.size > TAMANIO_MAXIMO_FOTO:
        raise ValidationError(MENSAJE_TAMANIO_FOTO, code="foto_muy_grande")

    if hasattr(foto, "content_type") and foto.content_type not in FORMATOS_PERMITIDOS_FOTO:
        raise ValidationError(MENSAJE_FORMATO_FOTO, code="formato_foto_invalido")


def validar_y_normalizar_telefono(valor: str, default_region: str = "PE", obligatorio: bool = True) -> str:
    """Valida obligatoriedad, longitud y coherencia de un número telefónico.

    Si es válido, lo devuelve formateado en estándar internacional E.164 (ej. +51987654321).
    Si es inválido, lanza serializers.ValidationError con mensaje en español.
    """
    if valor is None:
        valor = ""

    texto = valor.strip()
    if not texto:
        if obligatorio:
            raise serializers.ValidationError("El teléfono o celular es obligatorio.")
        return ""

    try:
        numero = phonenumbers.parse(texto, default_region)
    except NumberParseException:
        raise serializers.ValidationError("Ingresa un número de teléfono o celular válido.")

    if not phonenumbers.is_valid_number(numero):
        raise serializers.ValidationError(
            "El número de teléfono o celular no es válido o su longitud y prefijo no coinciden con la región."
        )

    return phonenumbers.format_number(numero, phonenumbers.PhoneNumberFormat.E164)
