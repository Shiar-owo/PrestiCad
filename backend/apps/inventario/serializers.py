"""Contratos JSON del módulo inventario.

Las validaciones de formato se declaran aquí; las reglas de negocio (código
único, estado inicial, valores por defecto) se delegan a `services.py`.
"""
from django.conf import settings
from rest_framework import serializers

from apps.compartido.serializers import RechazarCamposNoPermitidosMixin
from apps.inventario.constants import ESTADOS_MATERIAL, TIPOS_MATERIAL
from apps.inventario.models import Material
from apps.inventario.validators import validar_foto
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
    "foto",
    "tier_minimo_requerido",
    "bonificacion_tiempo",
    "deduccion_tardanza",
    "deduccion_dano_parcial",
    "deduccion_dano_total",
    "costo_reparacion",
    "costo_reposicion",
)


class FotoMaterial(serializers.ImageField):
    """Devuelve la foto del material como una URL que el navegador pueda abrir.

    El comportamiento por defecto de DRF no sirve: con contexto de petición usa
    `request.build_absolute_uri()`, y en desarrollo el proxy de Vite reenvía el
    Host del contenedor (`backend:8000`), que el navegador no resuelve. Sin
    contexto devuelve una ruta relativa, que el SPA tampoco puede cargar
    porque Vite no proxea `/media/`.

    Aquí se antepone `MEDIA_URL_PUBLICA`. En producción no hace falta: el
    storage de Cloudinary ya entrega una URL absoluta, que se devuelve tal
    cual.
    """

    def to_representation(self, value):
        if not value:
            return ""

        url = value.url
        if url.startswith(("http://", "https://")):
            return url

        return f"{settings.MEDIA_URL_PUBLICA.rstrip('/')}/{url.lstrip('/')}"


class MaterialListSerializer(serializers.ListSerializer):
    """Resuelve en lote la disponibilidad informada por el módulo préstamos."""

    def to_representation(self, data):
        materiales = list(data.all() if hasattr(data, "all") else data)
        from apps.prestamos.services import contar_unidades_prestadas_por_material

        conteos = contar_unidades_prestadas_por_material(
            material.pk for material in materiales
        )
        self._context = {
            **self._context,
            "unidades_prestadas_por_material": conteos,
        }
        return super().to_representation(materiales)


class MaterialSerializer(serializers.ModelSerializer):
    """Contrato de salida JSON del inventario."""

    unidades_disponibles = serializers.SerializerMethodField()
    foto = FotoMaterial(read_only=True)

    class Meta:
        model = Material
        list_serializer_class = MaterialListSerializer
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

        El stock es el total registrado. Los préstamos activos consumen una
        unidad cada uno; HU06 deberá extender este cálculo con las reservas
        vigentes cuando ese módulo se integre.
        """
        if material._state.adding:
            return material.stock

        prestamos_por_material = self.context.get("unidades_prestadas_por_material")
        if prestamos_por_material is None:
            from apps.prestamos.services import contar_unidades_prestadas_por_material

            prestamos_por_material = contar_unidades_prestadas_por_material([material.pk])
        prestamos_activos = prestamos_por_material.get(material.pk, 0)
        return max(material.stock - prestamos_activos, 0)


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
    # `validators` es necesario porque DRF no ejecuta los validadores del
    # modelo durante `is_valid()`. `allow_empty_file=False` evita que un
    # `<input type="file">` sin elegir llegue como un archivo vacío.
    foto = serializers.ImageField(
        required=False,
        allow_null=True,
        allow_empty_file=False,
        validators=[validar_foto],
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
    foto = serializers.ImageField(
        required=False,
        allow_null=True,
        allow_empty_file=False,
        validators=[validar_foto],
    )

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
            "es_alto_valor": {"required": False},
            "bonificacion_tiempo": {"required": False},
            "deduccion_tardanza": {"required": False},
            "deduccion_dano_parcial": {"required": False},
            "deduccion_dano_total": {"required": False},
            "costo_reparacion": {"required": False, "allow_null": True},
            "costo_reposicion": {"required": False, "allow_null": True},
        }
