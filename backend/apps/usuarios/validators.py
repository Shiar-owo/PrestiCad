"""Validadores para el módulo de usuarios."""
import phonenumbers
from phonenumbers import NumberParseException
from rest_framework import serializers


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
