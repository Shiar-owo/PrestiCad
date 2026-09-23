from rest_framework import serializers

from apps.usuarios.models import Credencial, Usuario


class UsuarioSerializer(serializers.ModelSerializer):
    """Contrato de entrada/salida JSON para el módulo usuarios.

    Las validaciones de datos se declaran aquí; la lógica de negocio
    (duplicados, transacciones) se delega a `services.py`.
    """

    class Meta:
        model = Usuario
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at")


class CredencialSerializer(serializers.ModelSerializer):
    """Contrato de entrada/salida JSON para las credenciales de acceso."""

    class Meta:
        model = Credencial
        fields = "__all__"
        read_only_fields = ("id", "failed_attempts", "locked_until")