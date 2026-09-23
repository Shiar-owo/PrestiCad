from django.core.validators import RegexValidator
from rest_framework import serializers

from apps.usuarios.constants import TIPOS_USUARIO
from apps.usuarios.models import Credencial, Usuario

DNI_VALIDATOR = RegexValidator(
    r"^\d{8}$",
    message="El DNI debe tener exactamente 8 dígitos numéricos.",
)

MENSAJES_CAMPO_NOMBRE = {
    "required": "El nombre es obligatorio.",
    "blank": "El nombre es obligatorio.",
}


class RechazarCamposNoPermitidosMixin:
    """Rechaza claves que no forman parte del contrato de entrada."""

    def validate(self, attrs):
        campos_no_permitidos = set(self.initial_data) - set(self.fields)
        if campos_no_permitidos:
            raise serializers.ValidationError(
                {
                    campo: "Este campo no está permitido."
                    for campo in campos_no_permitidos
                }
            )
        return super().validate(attrs)


class UsuarioSerializer(serializers.ModelSerializer):
    """Contrato de salida JSON para el módulo usuarios.

    Las validaciones de datos se declaran aquí; la lógica de negocio
    (duplicados, transacciones) se delega a `services.py`.
    """

    class Meta:
        model = Usuario
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at")


class UsuarioRegistroSerializer(RechazarCamposNoPermitidosMixin, serializers.ModelSerializer):
    """Contrato de entrada del endpoint POST /api/usuarios.

    Valida el formato de los datos (T01.05). La unicidad de email/DNI NO se
    valida aquí: se delega al servicio para devolver un 409 Conflict en lugar
    de un 400. La reputación no forma parte del contrato: no es sobrescribible
    al registrar (RN03 / T01.04).
    """

    email = serializers.EmailField(
        error_messages={
            "required": "El email es obligatorio.",
            "invalid": "Ingresa un correo electrónico válido.",
        },
    )
    dni = serializers.CharField(
        max_length=8,
        validators=[DNI_VALIDATOR],
        error_messages={"required": "El DNI es obligatorio."},
    )
    tipo = serializers.ChoiceField(
        choices=TIPOS_USUARIO,
        error_messages={"invalid_choice": "Tipo de usuario inválido."},
    )
    password = serializers.CharField(
        write_only=True,
        min_length=8,
        error_messages={
            "min_length": "La contraseña debe tener al menos 8 caracteres.",
            "required": "La contraseña es obligatoria.",
        },
    )

    class Meta:
        model = Usuario
        fields = (
            "nombre",
            "apellido",
            "email",
            "dni",
            "telefono",
            "tipo",
            "facultad",
            "departamento_carrera",
            "password",
        )
        extra_kwargs = {
            "nombre": {"error_messages": MENSAJES_CAMPO_NOMBRE},
            "apellido": {"error_messages": {"required": "El apellido es obligatorio.", "blank": "El apellido es obligatorio."}},
            "telefono": {"required": False, "allow_blank": True, "default": ""},
            "facultad": {"error_messages": {"required": "La facultad es obligatoria.", "blank": "La facultad es obligatoria."}},
            "departamento_carrera": {"required": False, "allow_blank": True, "default": ""},
        }


class PerfilUsuarioSerializer(serializers.Serializer):
    """Contrato de salida parcial del perfil con los datos disponibles."""

    nombre = serializers.CharField()
    apellido = serializers.CharField()
    email = serializers.EmailField()
    dni = serializers.CharField()
    telefono = serializers.CharField(allow_blank=True)
    tipo = serializers.ChoiceField(choices=TIPOS_USUARIO)
    reputacion_puntaje = serializers.IntegerField()
    reputacion_tier = serializers.CharField()


class ActualizarPerfilSerializer(RechazarCamposNoPermitidosMixin, serializers.Serializer):
    """Valida únicamente los campos editables del perfil."""

    nombre = serializers.CharField(
        max_length=100,
        error_messages=MENSAJES_CAMPO_NOMBRE,
    )
    telefono = serializers.CharField(max_length=20, required=False, allow_blank=True)

class CredencialSerializer(serializers.ModelSerializer):
    """Contrato de entrada/salida JSON para las credenciales de acceso."""

    class Meta:
        model = Credencial
        fields = "__all__"
        read_only_fields = ("id", "failed_attempts", "locked_until")
