"""Serializadores de lectura del módulo de préstamos."""
from django.urls import reverse
from rest_framework import serializers

from apps.inventario.models import Material
from apps.inventario.serializers import FotoMaterial, InstanciaMaterialSerializer
from apps.prestamos.models import Garantia, Prestamo


def serializar_checklist_inicial(prestamo):
    """Devuelve el checklist sin condición inicial y con URL privada de la foto."""
    fotos = {
        foto.indice: foto
        for foto in prestamo.fotos_checklist.filter(fase="inicial")
    }
    checklist = []
    for indice, item in enumerate(prestamo.checklist_inicial or []):
        if not isinstance(item, dict):
            continue
        foto = fotos.get(indice)
        checklist.append({
            "elemento": str(item.get("elemento", "")),
            "observacion": str(item.get("observacion", "")),
            "foto_url": (
                reverse(
                    "foto-checklist",
                    kwargs={
                        "prestamo_id": prestamo.pk,
                        "fase": "inicial",
                        "indice": indice,
                    },
                )
                if foto and foto.imagen
                else ""
            ),
        })
    return checklist


class SugerenciaPrestatarioSerializer(serializers.Serializer):
    """Datos mínimos para identificar un prestatario durante la entrega."""

    dni = serializers.CharField(read_only=True)
    nombre_completo = serializers.SerializerMethodField()

    def get_nombre_completo(self, obj):
        return f"{obj.nombre} {obj.apellido}".strip()


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


class MaterialPrestamoHistorialSerializer(serializers.ModelSerializer):
    """Ficha técnica del material asociada al detalle histórico del préstamo."""

    foto = FotoMaterial(read_only=True)

    class Meta:
        model = Material
        fields = (
            "nombre",
            "descripcion",
            "codigo_inventario",
            "tipo",
            "estado",
            "es_alto_valor",
            "marca",
            "modelo",
            "numero_serie",
            "color",
            "foto",
            "tier_minimo_requerido",
            "bonificacion_tiempo",
            "deduccion_tardanza",
            "deduccion_dano_parcial",
            "deduccion_dano_total",
            "costo_reparacion",
            "costo_reposicion",
        )
        read_only_fields = fields


class DocumentosGarantiaHistorialSerializer(serializers.Serializer):
    documento_identidad_disponible = serializers.SerializerMethodField()
    compromiso_responsabilidad_disponible = serializers.SerializerMethodField()

    def _obtener_garantia(self, prestamo):
        try:
            return prestamo.garantia
        except Garantia.DoesNotExist:
            return None

    def get_documento_identidad_disponible(self, prestamo):
        garantia = self._obtener_garantia(prestamo)
        return bool(garantia and garantia.documento_identidad)

    def get_compromiso_responsabilidad_disponible(self, prestamo):
        garantia = self._obtener_garantia(prestamo)
        return bool(garantia and garantia.compromiso_responsabilidad)


class PrestamoHistorialDetalleSerializer(serializers.ModelSerializer):
    """Detalle completo de préstamo para el titular y el historial de gestión."""

    prestatario_nombre = serializers.SerializerMethodField()
    prestatario_dni = serializers.CharField(source="usuario.dni", read_only=True)
    material = MaterialPrestamoHistorialSerializer(read_only=True)
    instancia = InstanciaMaterialSerializer(read_only=True, allow_null=True)
    documentos_garantia = DocumentosGarantiaHistorialSerializer(
        source="*",
        read_only=True,
    )
    estado = serializers.CharField(source="estado_consulta", read_only=True)
    checklist_inicial = serializers.SerializerMethodField()

    class Meta:
        model = Prestamo
        fields = (
            "id",
            "prestatario_nombre",
            "prestatario_dni",
            "material",
            "instancia",
            "fecha_entrega",
            "fecha_limite",
            "tiempo_prestamo_dias",
            "estado",
            "checklist_inicial",
            "documentos_garantia",
        )
        read_only_fields = fields

    def get_prestatario_nombre(self, obj):
        return f"{obj.usuario.nombre} {obj.usuario.apellido}".strip()

    def get_checklist_inicial(self, obj):
        return serializar_checklist_inicial(obj)


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
    checklist_inicial = serializers.SerializerMethodField()
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

    def get_checklist_inicial(self, obj):
        return serializar_checklist_inicial(obj)
