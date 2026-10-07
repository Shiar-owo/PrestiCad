"""Piezas de serialización reutilizables por varios módulos."""
from rest_framework import serializers


class RechazarCamposNoPermitidosMixin:
    """Rechaza claves que no forman parte del contrato de entrada.

    Evita que un cliente escriba campos fuera del contrato declarado (por
    ejemplo `id` o marcas de tiempo) en lugar de ignorarlos en silencio.
    """

    def validate(self, attrs):
        campos_no_permitidos = set(self.initial_data) - set(self.fields)
        if campos_no_permitidos:
            raise serializers.ValidationError(
                {campo: "Este campo no está permitido." for campo in campos_no_permitidos}
            )
        return super().validate(attrs)
