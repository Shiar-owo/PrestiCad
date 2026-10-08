import re

from django.conf import settings
from rest_framework import serializers

from apps.compartido.serializers import RechazarCamposNoPermitidosMixin
from apps.prestamos.constants import ESTADOS_CHECKLIST_DEVOLUCION
from apps.prestamos.models import Devolucion, Prestamo


class ChecklistInicialItemSerializer(serializers.Serializer):
    elemento = serializers.CharField(max_length=100)
    condicion = serializers.CharField(max_length=500)
    observacion = serializers.CharField(
        max_length=500,
        required=False,
        allow_blank=True,
        default="",
    )

    def to_internal_value(self, data):
        if isinstance(data, dict):
            campos_no_permitidos = set(data) - set(self.fields)
            if campos_no_permitidos:
                raise serializers.ValidationError({
                    campo: "Este campo no está permitido."
                    for campo in campos_no_permitidos
                })
        return super().to_internal_value(data)

    def validate_elemento(self, value):
        if not value.strip():
            raise serializers.ValidationError("Describe el elemento inspeccionado.")
        return value.strip()

    def validate_condicion(self, value):
        if not value.strip():
            raise serializers.ValidationError("Describe la condición inicial.")
        return value.strip()


class RegistrarPrestamoSerializer(
    RechazarCamposNoPermitidosMixin,
    serializers.Serializer,
):
    dni_prestatario = serializers.CharField(max_length=8)
    material_id = serializers.UUIDField()
    tiempo_prestamo_dias = serializers.IntegerField(min_value=1)
    checklist_inicial = ChecklistInicialItemSerializer(many=True, allow_empty=False)
    garantia_documento_identidad_recibido = serializers.BooleanField(default=False)
    garantia_compromiso_firmado_recibido = serializers.BooleanField(default=False)

    def validate_dni_prestatario(self, value):
        dni = value.strip()
        if not re.fullmatch(r"\d{8}", dni):
            raise serializers.ValidationError("El DNI debe tener exactamente 8 dígitos.")
        return dni


class PrestamoRegistroSerializer(serializers.ModelSerializer):
    usuario_id = serializers.IntegerField(source="usuario.id", read_only=True)
    usuario_nombre = serializers.SerializerMethodField()
    material_id = serializers.UUIDField(source="material.id", read_only=True)
    material_nombre = serializers.CharField(source="material.nombre", read_only=True)
    material_codigo = serializers.CharField(
        source="material.codigo_inventario",
        read_only=True,
    )
    requiere_garantia = serializers.BooleanField(read_only=True)
    garantia_completa = serializers.BooleanField(read_only=True)

    class Meta:
        model = Prestamo
        fields = (
            "id",
            "usuario_id",
            "usuario_nombre",
            "material_id",
            "material_nombre",
            "material_codigo",
            "fecha_entrega",
            "fecha_limite",
            "tiempo_prestamo_dias",
            "estado",
            "checklist_inicial",
            "requiere_garantia",
            "garantia_documento_identidad_recibido",
            "garantia_compromiso_firmado_recibido",
            "garantia_completa",
        )

    def get_usuario_nombre(self, prestamo):
        return f"{prestamo.usuario.nombre} {prestamo.usuario.apellido}".strip()


class ChecklistDevolucionItemSerializer(serializers.Serializer):
    """Fila del checklist de devolución contrastada contra la entrega (RN09)."""

    elemento = serializers.CharField(max_length=100)
    estado = serializers.ChoiceField(choices=ESTADOS_CHECKLIST_DEVOLUCION)
    condicion = serializers.CharField(
        max_length=500,
        required=False,
        allow_blank=True,
        default="",
    )
    observacion = serializers.CharField(
        max_length=500,
        required=False,
        allow_blank=True,
        default="",
    )

    def to_internal_value(self, data):
        if isinstance(data, dict):
            campos_no_permitidos = set(data) - set(self.fields)
            if campos_no_permitidos:
                raise serializers.ValidationError({
                    campo: "Este campo no está permitido."
                    for campo in campos_no_permitidos
                })
        return super().to_internal_value(data)

    def validate_elemento(self, value):
        if not value.strip():
            raise serializers.ValidationError("Describe el elemento inspeccionado.")
        return value.strip()


class DevolucionIngresoSerializer(
    RechazarCamposNoPermitidosMixin,
    serializers.Serializer,
):
    """Entrada común de estimación y registro de la devolución (HU11)."""

    checklist = ChecklistDevolucionItemSerializer(many=True, allow_empty=False)


def url_reporte_publica(devolucion):
    """URL abrible del PDF; patrón de `FotoMaterial` (MEDIA_URL_PUBLICA en dev)."""
    if not devolucion or not devolucion.reporte:
        return ""
    url = devolucion.reporte.url
    if url.startswith(("http://", "https://")):
        return url
    return f"{settings.MEDIA_URL_PUBLICA.rstrip('/')}/{url.lstrip('/')}"


class DevolucionResultadoSerializer(serializers.Serializer):
    """Resumen de sanciones que la API devuelve al estimar y al registrar."""

    prestamo_id = serializers.IntegerField()
    a_tiempo = serializers.BooleanField()
    dias_tardanza = serializers.IntegerField()
    bonificacion = serializers.IntegerField()
    deduccion_tardanza = serializers.IntegerField()
    dano = serializers.ChoiceField(choices=ESTADOS_CHECKLIST_DEVOLUCION)
    hay_dano = serializers.BooleanField()
    deduccion_dano = serializers.IntegerField()
    cobro_economico = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        allow_null=True,
    )
    puntos_delta = serializers.IntegerField()
    reputacion_antes = serializers.IntegerField()
    tier_antes = serializers.CharField()
    reputacion_despues = serializers.IntegerField()
    tier_despues = serializers.CharField()
    devolucion_id = serializers.IntegerField(required=False)
    reporte_url = serializers.CharField(required=False)


class ConsultaReportesSerializer(
    RechazarCamposNoPermitidosMixin,
    serializers.Serializer,
):
    """Parámetros de filtro del listado de reportes de daños (RN10).

    Los parámetros de paginación (`page`, `page_size`) los valida el
    paginador, por eso el usuario de la vista los excluye antes de validar.
    """

    dano = serializers.ChoiceField(
        choices=ESTADOS_CHECKLIST_DEVOLUCION,
        required=False,
    )
    fecha_desde = serializers.DateField(required=False)
    fecha_hasta = serializers.DateField(required=False)
    gestor_id = serializers.IntegerField(required=False, min_value=1)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        fecha_desde = attrs.get("fecha_desde")
        fecha_hasta = attrs.get("fecha_hasta")
        if fecha_desde and fecha_hasta and fecha_desde > fecha_hasta:
            raise serializers.ValidationError(
                {"fecha_desde": "La fecha inicial no puede ser posterior a la final."}
            )
        return attrs


class ReporteDevolucionSerializer(serializers.ModelSerializer):
    """Fila del listado de reportes de daños (consulta y descarga, RN10)."""

    devolucion_id = serializers.IntegerField(source="id", read_only=True)
    prestamo_id = serializers.IntegerField(source="prestamo.id", read_only=True)
    material_nombre = serializers.CharField(
        source="prestamo.material.nombre",
        read_only=True,
    )
    material_codigo = serializers.CharField(
        source="prestamo.material.codigo_inventario",
        read_only=True,
    )
    prestatario_nombre = serializers.SerializerMethodField()
    gestor_nombre = serializers.SerializerMethodField()
    dano = serializers.CharField(source="resultado.dano", read_only=True)
    deduccion_dano = serializers.IntegerField(
        source="resultado.deduccion_dano",
        read_only=True,
    )
    cobro_economico = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        source="resultado.cobro_economico",
        allow_null=True,
        read_only=True,
    )
    puntos_delta = serializers.IntegerField(
        source="resultado.puntos_delta",
        read_only=True,
    )
    reporte_url = serializers.SerializerMethodField()

    class Meta:
        model = Devolucion
        fields = (
            "devolucion_id",
            "prestamo_id",
            "material_nombre",
            "material_codigo",
            "prestatario_nombre",
            "gestor_nombre",
            "fecha_devolucion",
            "dano",
            "deduccion_dano",
            "cobro_economico",
            "puntos_delta",
            "reporte_url",
        )
        read_only_fields = fields

    def get_prestatario_nombre(self, devolucion):
        usuario = devolucion.prestamo.usuario
        return f"{usuario.nombre} {usuario.apellido}".strip()

    def get_gestor_nombre(self, devolucion):
        gestor = devolucion.realizado_por
        return f"{gestor.nombre} {gestor.apellido}".strip()

    def get_reporte_url(self, devolucion):
        return url_reporte_publica(devolucion)
