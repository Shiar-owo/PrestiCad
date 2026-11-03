from rest_framework import serializers

from apps.inventario.models import InstanciaMaterial, Material
from apps.reservas.constants import MENSAJES_ERROR_RESERVA, VALORES_PRIORIDAD_RESERVA
from apps.reservas.models import Reserva
from apps.reservas.services import calcular_posicion_en_cola


class CrearReservaSerializer(serializers.Serializer):
    """Valida los campos de entrada para crear una solicitud de reserva normal (HU06)."""

    material_id = serializers.UUIDField(
        error_messages={
            "required": "Selecciona un material para reservar.",
            "null": "Selecciona un material para reservar.",
            "invalid": "El identificador del material no es válido.",
        }
    )
    prioridad = serializers.ChoiceField(
        choices=VALORES_PRIORIDAD_RESERVA,
        error_messages={
            "required": MENSAJES_ERROR_RESERVA["prioridad_invalida"],
            "null": MENSAJES_ERROR_RESERVA["prioridad_invalida"],
            "invalid_choice": MENSAJES_ERROR_RESERVA["prioridad_invalida"],
        },
    )
    justificacion = serializers.CharField(
        allow_blank=False,
        trim_whitespace=True,
        error_messages={
            "required": MENSAJES_ERROR_RESERVA["justificacion_obligatoria"],
            "null": MENSAJES_ERROR_RESERVA["justificacion_obligatoria"],
            "blank": MENSAJES_ERROR_RESERVA["justificacion_obligatoria"],
        },
    )


class MotivoAccionReservaSerializer(serializers.Serializer):
    """Valida el motivo obligatorio para cancelar o rechazar una reserva."""

    motivo = serializers.CharField(
        allow_blank=False,
        trim_whitespace=True,
        error_messages={
            "required": MENSAJES_ERROR_RESERVA["motivo_obligatorio"],
            "null": MENSAJES_ERROR_RESERVA["motivo_obligatorio"],
            "blank": MENSAJES_ERROR_RESERVA["motivo_obligatorio"],
        },
    )


class UsuarioResumenReservaSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    dni = serializers.CharField(read_only=True)
    nombres = serializers.CharField(read_only=True)
    apellidos = serializers.CharField(read_only=True)
    nombre_completo = serializers.SerializerMethodField()
    correo = serializers.EmailField(read_only=True)
    reputacion_puntaje = serializers.IntegerField(read_only=True)
    reputacion_tier = serializers.CharField(read_only=True)

    def get_nombre_completo(self, obj):
        return f"{obj.nombres} {obj.apellidos}".strip()


class MaterialResumenReservaSerializer(serializers.ModelSerializer):
    unidades_disponibles = serializers.SerializerMethodField()
    resumen_estados = serializers.ReadOnlyField()

    class Meta:
        model = Material
        fields = [
            "id",
            "nombre",
            "codigo_material",
            "tipo",
            "estado",
            "stock",
            "tier_minimo_requerido",
            "tiempo_maximo_prestamo",
            "es_alto_valor",
            "unidades_disponibles",
            "resumen_estados",
        ]

    def get_unidades_disponibles(self, obj):
        resumen = obj.resumen_estados
        return resumen.get("disponible", 0)


class InstanciaResumenReservaSerializer(serializers.ModelSerializer):
    class Meta:
        model = InstanciaMaterial
        fields = [
            "id",
            "codigo_ejemplar",
            "numero_serie",
            "estado",
            "color",
            "ubicacion",
            "observaciones",
        ]


class ReservaDetalleSerializer(serializers.ModelSerializer):
    usuario = UsuarioResumenReservaSerializer(read_only=True)
    material = MaterialResumenReservaSerializer(read_only=True)
    instancia = InstanciaResumenReservaSerializer(read_only=True)
    prestamo_id = serializers.IntegerField(read_only=True)
    posicion_cola = serializers.SerializerMethodField()
    garantia = serializers.SerializerMethodField()

    class Meta:
        model = Reserva
        fields = [
            "id",
            "usuario",
            "material",
            "instancia",
            "prestamo_id",
            "prioridad",
            "justificacion",
            "estado",
            "es_excepcion",
            "motivo_rechazo",
            "motivo_cancelacion",
            "fecha_solicitud",
            "fecha_limite_espera",
            "fecha_confirmacion",
            "fecha_limite_recojo",
            "fecha_recojo",
            "posicion_cola",
            "garantia",
            "created_at",
            "updated_at",
        ]

    def get_posicion_cola(self, obj):
        if hasattr(obj, "posicion_cola"):
            return obj.posicion_cola
        return calcular_posicion_en_cola(obj)

    def get_garantia(self, obj):
        garantia = getattr(obj, "garantia", None)
        if garantia is None:
            return None
        return {
            "id": garantia.id,
            "estado": garantia.estado,
            "tiene_documento_identidad": bool(garantia.documento_identidad),
            "tiene_compromiso_responsabilidad": bool(garantia.compromiso_responsabilidad),
            "garantia_completa": bool(
                garantia.estado == "registrada"
                and garantia.documento_identidad
                and garantia.compromiso_responsabilidad
            ),
            "fecha_registro": garantia.fecha_registro,
        }


class ColaMaterialSerializer(serializers.Serializer):
    material = MaterialResumenReservaSerializer(read_only=True)
    en_espera = ReservaDetalleSerializer(many=True, read_only=True)
    en_espera_normales = ReservaDetalleSerializer(many=True, read_only=True)
    en_espera_excepciones = ReservaDetalleSerializer(many=True, read_only=True)
    reservas_confirmadas = ReservaDetalleSerializer(many=True, read_only=True)
    instancias_disponibles = InstanciaResumenReservaSerializer(many=True, read_only=True)
