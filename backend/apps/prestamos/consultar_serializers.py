"""Serializadores de lectura del módulo de préstamos."""
from rest_framework import serializers

from apps.prestamos.models import Prestamo


class PrestamoConsultaSerializer(serializers.ModelSerializer):
    material_id = serializers.UUIDField(source="material.id", read_only=True)
    material_nombre = serializers.CharField(source="material.nombre", read_only=True)
    material_codigo = serializers.CharField(
        source="material.codigo_inventario",
        read_only=True,
    )
    estado = serializers.CharField(source="estado_consulta", read_only=True)

    class Meta:
        model = Prestamo
        fields = (
            "id",
            "material_id",
            "material_nombre",
            "material_codigo",
            "fecha_entrega",
            "fecha_limite",
            "tiempo_prestamo_dias",
            "estado",
        )
        read_only_fields = fields


class PrestamoHistorialSerializer(serializers.ModelSerializer):
    prestatario_nombre = serializers.SerializerMethodField()
    material_id = serializers.UUIDField(source="material.id", read_only=True)
    material_nombre = serializers.CharField(source="material.nombre", read_only=True)
    material_codigo = serializers.CharField(
        source="material.codigo_inventario",
        read_only=True,
    )
    estado = serializers.CharField(source="estado_consulta", read_only=True)

    class Meta:
        model = Prestamo
        fields = (
            "id",
            "prestatario_nombre",
            "material_id",
            "material_nombre",
            "material_codigo",
            "fecha_entrega",
            "fecha_limite",
            "tiempo_prestamo_dias",
            "estado",
        )
        read_only_fields = fields

    def get_prestatario_nombre(self, obj):
        return f"{obj.usuario.nombre} {obj.usuario.apellido}".strip()


class PrestamoDevolucionDetalleSerializer(serializers.ModelSerializer):
    """Datos para el formulario de devolución: estado visible, actores,
    checklist inicial y parámetros de sanción del material (RN06)."""

    material_id = serializers.UUIDField(source="material.id", read_only=True)
    material_nombre = serializers.CharField(source="material.nombre", read_only=True)
    material_codigo = serializers.CharField(
        source="material.codigo_inventario",
        read_only=True,
    )
    estado = serializers.CharField(source="estado_consulta", read_only=True)
    prestatario_nombre = serializers.SerializerMethodField()
    prestatario_dni = serializers.CharField(source="usuario.dni", read_only=True)
    bonificacion_tiempo = serializers.IntegerField(
        source="material.bonificacion_tiempo",
        read_only=True,
    )
    deduccion_tardanza = serializers.IntegerField(
        source="material.deduccion_tardanza",
        read_only=True,
    )
    deduccion_dano_parcial = serializers.IntegerField(
        source="material.deduccion_dano_parcial",
        read_only=True,
    )
    deduccion_dano_total = serializers.IntegerField(
        source="material.deduccion_dano_total",
        read_only=True,
    )
    costo_reparacion = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        source="material.costo_reparacion",
        read_only=True,
        allow_null=True,
    )
    costo_reposicion = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        source="material.costo_reposicion",
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = Prestamo
        fields = (
            "id",
            "material_id",
            "material_nombre",
            "material_codigo",
            "fecha_entrega",
            "fecha_limite",
            "tiempo_prestamo_dias",
            "estado",
            "prestatario_nombre",
            "prestatario_dni",
            "checklist_inicial",
            "bonificacion_tiempo",
            "deduccion_tardanza",
            "deduccion_dano_parcial",
            "deduccion_dano_total",
            "costo_reparacion",
            "costo_reposicion",
        )
        read_only_fields = fields

    def get_prestatario_nombre(self, obj):
        return f"{obj.usuario.nombre} {obj.usuario.apellido}".strip()
