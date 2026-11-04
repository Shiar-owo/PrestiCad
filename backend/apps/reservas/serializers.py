from datetime import timedelta

from django.conf import settings
from rest_framework import serializers

from apps.inventario.models import InstanciaMaterial, Material
from apps.prestamos.constants import TAMANO_MAXIMO_SOLICITUD_BYTES
from apps.prestamos.validators import validar_pdf_garantia
from apps.reservas.constants import (
    DIAS_LABORABLES,
    HORA_RESERVA_MAXIMO_FIN,
    HORA_RESERVA_MINIMO_INICIO,
    HORARIO_ATENCION_FIN,
    HORARIO_ATENCION_INICIO,
    MENSAJES_ERROR_RESERVA,
    VALORES_PRIORIDAD_RESERVA,
)
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
    instancia_id = serializers.UUIDField(
        required=False,
        error_messages={
            "invalid": "El identificador de la instancia no es válido.",
        }
    )
    fecha_inicio = serializers.DateTimeField(
        required=False,
        error_messages={
            "invalid": "La fecha y hora de inicio de la reserva no es válida.",
        }
    )
    fecha_fin = serializers.DateTimeField(
        required=False,
        error_messages={
            "invalid": "La fecha y hora de fin de la reserva no es válida.",
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

    def validate(self, attrs):
        attrs = super().validate(attrs)
        fecha_inicio = attrs.get("fecha_inicio")
        fecha_fin = attrs.get("fecha_fin")
        if fecha_inicio is not None or fecha_fin is not None:
            if fecha_inicio is None or fecha_fin is None:
                raise serializers.ValidationError({
                    "fecha_inicio": "Debe indicar tanto la fecha de inicio como la de fin de la reserva.",
                    "fecha_fin": "Debe indicar tanto la fecha de inicio como la de fin de la reserva.",
                })
            if fecha_fin <= fecha_inicio:
                raise serializers.ValidationError({
                    "fecha_fin": "La fecha y hora de fin debe ser posterior a la de inicio.",
                })
            for etiqueta, valor in (("fecha_inicio", fecha_inicio), ("fecha_fin", fecha_fin)):
                if valor.weekday() not in DIAS_LABORABLES:
                    raise serializers.ValidationError({
                        etiqueta: "La reserva solo puede realizarse de lunes a viernes (días laborables).",
                    })
                minutos_dia = valor.hour * 60 + valor.minute
                if not (HORA_RESERVA_MINIMO_INICIO * 60 <= minutos_dia <= HORA_RESERVA_MAXIMO_FIN * 60):
                    raise serializers.ValidationError({
                        etiqueta: (
                            f"La reserva debe estar dentro del horario de atención "
                            f"({HORA_RESERVA_MINIMO_INICIO}:00 a {HORA_RESERVA_MAXIMO_FIN}:00)."
                        ),
                    })

            lunes_inicio = fecha_inicio.date() - timedelta(days=fecha_inicio.weekday())
            lunes_fin = fecha_fin.date() - timedelta(days=fecha_fin.weekday())
            if lunes_inicio != lunes_fin:
                raise serializers.ValidationError({
                    "fecha_fin": "La reserva debe realizarse dentro de la misma semana (lunes a viernes) y no puede extenderse cruzando el fin de semana.",
                })
        return attrs


class CrearReservaExcepcionalSerializer(CrearReservaSerializer):
    """Valida los campos y documentos PDF obligatorios para una reserva excepcional (HU06, HU13)."""

    documento_identidad = serializers.FileField(
        required=True,
        allow_empty_file=False,
        validators=[validar_pdf_garantia],
        error_messages={
            "required": "El documento de identidad en PDF es obligatorio para reservas excepcionales.",
            "null": "El documento de identidad en PDF es obligatorio para reservas excepcionales.",
            "empty": "El documento de identidad en PDF no puede estar vacío.",
        },
    )
    compromiso_responsabilidad = serializers.FileField(
        required=True,
        allow_empty_file=False,
        validators=[validar_pdf_garantia],
        error_messages={
            "required": "El compromiso de responsabilidad en PDF es obligatorio para reservas excepcionales.",
            "null": "El compromiso de responsabilidad en PDF es obligatorio para reservas excepcionales.",
            "empty": "El compromiso de responsabilidad en PDF no puede estar vacío.",
        },
    )

    def validate(self, attrs):
        attrs = super().validate(attrs)
        archivos = [
            attrs.get("documento_identidad"),
            attrs.get("compromiso_responsabilidad"),
        ]
        total = sum(getattr(archivo, "size", 0) for archivo in archivos if archivo)
        if total > TAMANO_MAXIMO_SOLICITUD_BYTES:
            raise serializers.ValidationError(
                {
                    "archivos": [
                        "El total de archivos de la solicitud no debe superar 4 MB."
                    ]
                }
            )
        return attrs


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
    nombre = serializers.CharField(read_only=True)
    apellido = serializers.CharField(read_only=True)
    nombre_completo = serializers.SerializerMethodField()
    email = serializers.EmailField(read_only=True)
    reputacion_puntaje = serializers.IntegerField(read_only=True)
    reputacion_tier = serializers.CharField(read_only=True)

    def get_nombre_completo(self, obj):
        return f"{obj.nombre} {obj.apellido}".strip()


class MaterialResumenReservaSerializer(serializers.ModelSerializer):
    unidades_disponibles = serializers.SerializerMethodField()
    resumen_estados = serializers.ReadOnlyField()
    foto = serializers.SerializerMethodField(read_only=True)

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
            "foto",
        ]

    def get_unidades_disponibles(self, obj):
        resumen = obj.resumen_estados
        return resumen.get("disponible", 0)

    def get_foto(self, obj):
        if obj.foto:
            url = obj.foto.url
            if url.startswith(("http://", "https://")):
                return url
            base = getattr(settings, "MEDIA_URL_PUBLICA", "").rstrip("/")
            return f"{base}{url}" if base else url
        return None


class InstanciaResumenReservaSerializer(serializers.ModelSerializer):
    foto = serializers.SerializerMethodField(read_only=True)

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
            "foto",
        ]

    def get_foto(self, obj):
        if obj.foto:
            url = obj.foto.url
            if url.startswith(("http://", "https://")):
                return url
            base = getattr(settings, "MEDIA_URL_PUBLICA", "").rstrip("/")
            return f"{base}{url}" if base else url
        return None


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
