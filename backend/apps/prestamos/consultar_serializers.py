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
