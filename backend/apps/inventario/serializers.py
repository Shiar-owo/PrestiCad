"""Contratos JSON del módulo inventario.

Las validaciones de formato se declaran aquí; las reglas de negocio (código
único, estado inicial, valores por defecto) se delegan a `services.py`.
"""
from rest_framework import serializers

from apps.compartido.serializers import RechazarCamposNoPermitidosMixin
from apps.inventario.constants import ESTADOS_MATERIAL, TIPOS_MATERIAL
from apps.inventario.models import Material
from apps.usuarios.constants import TIERS

MENSAJES_NOMBRE = {
    "required": "El nombre del material es obligatorio.",
    "blank": "El nombre del material es obligatorio.",
}

MENSAJES_CODIGO = {
    "required": "El código de inventario es obligatorio.",
    "blank": "El código de inventario es obligatorio.",
    "max_length": "El código de inventario admite máximo 30 caracteres.",
}

MENSAJES_STOCK = {
    "min_value": "El stock debe ser al menos 1 unidad.",
    "invalid": "Ingresa un stock numérico.",
}

# Campos de la ficha técnica y de los parámetros de reputación: se repiten en
# los contratos de alta y de edición.
CAMPOS_FICHA_Y_REPUTACION = (
    "marca",
    "modelo",
    "numero_serie",
    "color",
    "estado_fisico",
    "foto_url",
    "tier_minimo_requerido",
    "bonificacion_tiempo",
    "deduccion_tardanza",
    "deduccion_dano_parcial",
    "deduccion_dano_total",
    "costo_reparacion",
    "costo_reposicion",
)


class MaterialSerializer(serializers.ModelSerializer):
    """Contrato de salida JSON del inventario."""

    unidades_disponibles = serializers.SerializerMethodField()

    class Meta:
        model = Material
        fields = (
            "id",
            "nombre",
            "descripcion",
            "codigo_inventario",
            "tipo",
            "estado",
            "es_alto_valor",
            *CAMPOS_FICHA_Y_REPUTACION,
            "stock",
            "unidades_disponibles",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def get_unidades_disponibles(self, material):
        """Unidades libres de un material.

        Hoy coincide con `stock`: las loans y reservas (HU09/HU06) aún no
        existen. Cuando existan, se descontarán aquí los préstamos activos y
        las reservas vigentes.
        """
        return material.stock


class MaterialRegistroSerializer(RechazarCamposNoPermitidosMixin, serializers.ModelSerializer):
    """Contrato de entrada del endpoint POST /api/materiales.

    - `estado` NO forma parte del contrato: el material nace 'Disponible'
      (HU04 criterio 6) y su cambio de estado se hace por la edición.
    - La unicidad de `codigo_inventario` NO se valida aquí: la delega al
      servicio para devolver un 409 Conflict en lugar de un 400.
    - Los parámetros de reputación son opcionales; si no llegan, el servicio
      aplica los valores por defecto configurables (criterio 3).
    """

    nombre = serializers.CharField(max_length=150, error_messages=MENSAJES_NOMBRE)
    codigo_inventario = serializers.CharField(max_length=30, error_messages=MENSAJES_CODIGO)
    tipo = serializers.ChoiceField(
        choices=TIPOS_MATERIAL,
        error_messages={"invalid_choice": "Tipo de material inválido."},
    )
    stock = serializers.IntegerField(required=False, min_value=1, error_messages=MENSAJES_STOCK)
    tier_minimo_requerido = serializers.ChoiceField(
        choices=TIERS,
        required=False,
        error_messages={"invalid_choice": "Tier mínimo inválido."},
    )

    class Meta:
        model = Material
        fields = (
            "nombre",
            "descripcion",
            "codigo_inventario",
            "tipo",
            "stock",
            "es_alto_valor",
            *CAMPOS_FICHA_Y_REPUTACION,
        )
        extra_kwargs = {
            "descripcion": {"required": False, "allow_blank": True, "default": ""},
            "es_alto_valor": {"required": False, "default": False},
            "marca": {"required": False, "allow_blank": True, "default": ""},
            "modelo": {"required": False, "allow_blank": True, "default": ""},
            "numero_serie": {"required": False, "allow_blank": True, "default": ""},
            "color": {"required": False, "allow_blank": True, "default": ""},
            "estado_fisico": {"required": False, "allow_blank": True, "default": ""},
            "foto_url": {"required": False, "allow_blank": True, "default": ""},
            "bonificacion_tiempo": {"required": False},
            "deduccion_tardanza": {"required": False},
            "deduccion_dano_parcial": {"required": False},
            "deduccion_dano_total": {"required": False},
            "costo_reparacion": {"required": False, "allow_null": True},
            "costo_reposicion": {"required": False, "allow_null": True},
        }


class MaterialActualizacionSerializer(RechazarCamposNoPermitidosMixin, serializers.ModelSerializer):
    """Contrato de entrada de la edición de materiales (PUT/PATCH).

    A diferencia del alta, aquí `estado` sí es editable: es el mecanismo para
    poner un material en 'En Mantenimiento' (HU04 criterio 8). El resto de
    campos son opcionales para que un PATCH pueda cambiar solo el estado.
    """

    nombre = serializers.CharField(max_length=150, required=False, error_messages=MENSAJES_NOMBRE)
    codigo_inventario = serializers.CharField(
        max_length=30, required=False, error_messages=MENSAJES_CODIGO
    )
    tipo = serializers.ChoiceField(
        choices=TIPOS_MATERIAL, required=False, error_messages={"invalid_choice": "Tipo de material inválido."}
    )
    estado = serializers.ChoiceField(
        choices=ESTADOS_MATERIAL, required=False, error_messages={"invalid_choice": "Estado de material inválido."}
    )
    stock = serializers.IntegerField(required=False, min_value=1, error_messages=MENSAJES_STOCK)

    class Meta:
        model = Material
        fields = (
            "nombre",
            "descripcion",
            "codigo_inventario",
            "tipo",
            "estado",
            "es_alto_valor",
            *CAMPOS_FICHA_Y_REPUTACION,
            "stock",
        )
        extra_kwargs = {
            "descripcion": {"required": False, "allow_blank": True},
            "marca": {"required": False, "allow_blank": True},
            "modelo": {"required": False, "allow_blank": True},
            "numero_serie": {"required": False, "allow_blank": True},
            "color": {"required": False, "allow_blank": True},
            "estado_fisico": {"required": False, "allow_blank": True},
            "foto_url": {"required": False, "allow_blank": True},
            "es_alto_valor": {"required": False},
            "bonificacion_tiempo": {"required": False},
            "deduccion_tardanza": {"required": False},
            "deduccion_dano_parcial": {"required": False},
            "deduccion_dano_total": {"required": False},
            "costo_reparacion": {"required": False, "allow_null": True},
            "costo_reposicion": {"required": False, "allow_null": True},
        }
