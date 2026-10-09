import uuid
from pathlib import Path

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone

from apps.inventario.constants import (
    ESTADOS_INSTANCIA,
    ESTADOS_MATERIAL,
    TIPOS_MATERIAL,
)
from apps.inventario.validators import validar_foto

# La taxonomía de Tiers es la misma que usa el módulo usuarios (RN03): un
# material declara el Tier mínimo que un usuario necesita para llevárselo.
# Se importa solo la lista de opciones: el módulo inventario no accede a
# ninguna tabla de usuarios.
from apps.usuarios.constants import TIERS

# Los `default` de los parámetros de reputación reproducen los valores de
# `settings.MATERIALES_REPUTACION_DEFAULTS`, que es la fuente configurable
# que aplica el servicio al registrar un material (T04.04).
DEFAULT_TIER_MINIMO = "estandar"
DEFAULT_BONIFICACION_TIEMPO = 5
DEFAULT_DEDUCCION_TARDANZA = 10
DEFAULT_DEDUCCION_DANO_PARCIAL = 30
DEFAULT_DEDUCCION_DANO_TOTAL = 60

# Rango de los puntos de reputación por objeto (RN06). Misma magnitud que el
# rango de `Usuario.reputacion_puntaje` (-500 a 500).
PUNTOS_MINIMO = 0
PUNTOS_MAXIMO = 500


def ruta_foto(instance, filename):
    """Destino de la foto dentro del storage: `materiales/<año>/<mes>/<token>.<ext>`.

    El token aleatorio evita que dos materiales con el mismo nombre de archivo
    se pisen: conservar el nombre original haría que el segundo sobrescribiera
    al primero. La fecha mantiene ordenadas las carpetas y no estorba, porque
    `CloudinaryStorage.get_available_name` devuelve el nombre tal cual y no
    deduplica.
    """
    extension = Path(filename).suffix.lower() or ".jpg"
    return f"materiales/{timezone.now():%Y/%m}/{uuid.uuid4().hex[:12]}{extension}"


class Material(models.Model):
    """Entidad del dominio: material del inventario de préstamos.

    Es el *Aggregate Root* del contexto de inventario (ver
    `docs/diagrams/ddd_detailed/03-inventario.puml`). Reúne la identidad y
    clasificación del material, su ficha técnica, sus parámetros de
    reputación (RN06) y la cantidad de unidades registradas (HU04, criterio 5).

    Aquí solo se declara la estructura de datos y las validaciones simples;
    las reglas de negocio (código único, estado inicial, defaults) viven en
    `services.py`.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    nombre = models.CharField(max_length=150)
    descripcion = models.TextField(blank=True, default="")
    codigo_inventario = models.CharField(
        max_length=30,
        unique=True,
        verbose_name="Código de inventario",
        help_text="Identificador único del material en el inventario.",
    )

    tipo = models.CharField(max_length=20, choices=TIPOS_MATERIAL)
    estado = models.CharField(
        max_length=20,
        choices=ESTADOS_MATERIAL,
        default="disponible",
    )
    es_alto_valor = models.BooleanField(
        default=False,
        verbose_name="Es de alto valor",
        help_text="Los equipos de alto valor exigen garantía al prestarlos (RN05).",
    )

    # Ficha técnica (value object `FichaTecnica` del modelo de dominio).
    marca = models.CharField(max_length=80, blank=True, default="")
    modelo = models.CharField(max_length=80, blank=True, default="")
    numero_serie = models.CharField(max_length=50, blank=True, default="")
    color = models.CharField(max_length=30, blank=True, default="")
    estado_fisico = models.CharField(
        max_length=50,
        blank=True,
        default="",
        verbose_name="Estado físico",
    )
    foto = models.ImageField(
        upload_to=ruta_foto,
        blank=True,
        validators=[validar_foto],
        verbose_name="Foto del material",
        help_text="Imagen del material: JPG, PNG o WEBP, hasta 5 MB.",
    )

    # Parámetros de reputación por objeto (value object `AtributosReputacion`,
    # RN06). Las sanciones de la devolución se calculan con estos valores.
    tier_minimo_requerido = models.CharField(
        max_length=20,
        choices=TIERS,
        default=DEFAULT_TIER_MINIMO,
        verbose_name="Tier mínimo requerido",
    )
    bonificacion_tiempo = models.PositiveIntegerField(
        default=DEFAULT_BONIFICACION_TIEMPO,
        validators=[MinValueValidator(PUNTOS_MINIMO), MaxValueValidator(PUNTOS_MAXIMO)],
        verbose_name="Bonificación por entrega a tiempo",
    )
    deduccion_tardanza = models.PositiveIntegerField(
        default=DEFAULT_DEDUCCION_TARDANZA,
        validators=[MinValueValidator(PUNTOS_MINIMO), MaxValueValidator(PUNTOS_MAXIMO)],
        verbose_name="Deducción por tardanza (por día)",
    )
    deduccion_dano_parcial = models.PositiveIntegerField(
        default=DEFAULT_DEDUCCION_DANO_PARCIAL,
        validators=[MinValueValidator(PUNTOS_MINIMO), MaxValueValidator(PUNTOS_MAXIMO)],
        verbose_name="Deducción por daño parcial",
    )
    deduccion_dano_total = models.PositiveIntegerField(
        default=DEFAULT_DEDUCCION_DANO_TOTAL,
        validators=[MinValueValidator(PUNTOS_MINIMO), MaxValueValidator(PUNTOS_MAXIMO)],
        verbose_name="Deducción por daño total",
    )
    costo_reparacion = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="Costo de reparación",
    )
    costo_reposicion = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="Costo de reposición",
    )

    stock = models.PositiveIntegerField(
        default=1,
        validators=[MinValueValidator(1)],
        verbose_name="Unidades registradas",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Material"
        verbose_name_plural = "Materiales"
        ordering = ["nombre"]
        indexes = [
            models.Index(fields=["estado"], name="material_estado_idx"),
            models.Index(fields=["tipo"], name="material_tipo_idx"),
        ]

    def __str__(self):
        return f"{self.nombre} ({self.codigo_inventario})"

    def esta_disponible(self):
        """RN01: solo un material en estado 'Disponible' puede prestarse."""
        return self.estado == "disponible"

    def requiere_garantia(self):
        """RN05: los materiales de alto valor exigen garantía al prestarlos."""
        return self.es_alto_valor

    @property
    def total_instancias(self):
        """Total de instancias físicas. Fallback a stock si no tiene instancias creadas."""
        instancias = list(self.instancias.all())
        return len(instancias) if instancias else self.stock

    @property
    def resumen_estados(self):
        """Desglose de estados operativos entre todas las instancias registradas."""
        instancias = list(self.instancias.all())
        if not instancias:
            return {
                "total": self.stock,
                "disponible": self.stock if self.estado == "disponible" else 0,
                "reservado": self.stock if self.estado == "reservado" else 0,
                "prestado": self.stock if self.estado == "prestado" else 0,
                "en_mantenimiento": self.stock if self.estado == "en_mantenimiento" else 0,
                "de_baja": 0,
            }

        conteo = {
            "total": len(instancias),
            "disponible": 0,
            "reservado": 0,
            "prestado": 0,
            "en_mantenimiento": 0,
            "de_baja": 0,
        }
        for inst in instancias:
            if inst.estado in conteo:
                conteo[inst.estado] += 1
        return conteo


class InstanciaMaterial(models.Model):
    """Copia física o ejemplar individual de un material.

    Representa la unidad tangible que un usuario solicita, reserva o recibe
    en préstamo. Cada instancia posee su propia identificación patrimonial
    única (`codigo_ejemplar`), número de serie de fábrica opcional, estado
    operativo (`disponible`, `reservado`, `prestado`, `en_mantenimiento`,
    `de_baja`), estado físico y observaciones de almacén.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    material = models.ForeignKey(
        Material,
        on_delete=models.CASCADE,
        related_name="instancias",
        verbose_name="Material al que pertenece",
    )
    codigo_ejemplar = models.CharField(
        max_length=50,
        unique=True,
        verbose_name="Código de ejemplar / patrimonial",
        help_text="Identificador único de la copia física (ej. LIB-CLRS-01).",
    )
    numero_serie = models.CharField(
        max_length=80,
        blank=True,
        default="",
        verbose_name="Número de serie",
        help_text="Número de serie del fabricante si aplica a esta unidad.",
    )
    estado = models.CharField(
        max_length=20,
        choices=ESTADOS_INSTANCIA,
        default="disponible",
        verbose_name="Estado de la instancia",
    )
    estado_fisico = models.CharField(
        max_length=100,
        blank=True,
        default="Operativo",
        verbose_name="Estado físico",
        help_text="Condición física de este ejemplar (ej. Excelente, Bueno, Desgaste leve).",
    )
    observaciones = models.TextField(
        blank=True,
        default="",
        verbose_name="Observaciones",
        help_text="Notas específicas sobre esta copia (accesorios, defectos, etc.).",
    )
    ubicacion = models.CharField(
        max_length=100,
        blank=True,
        default="",
        verbose_name="Ubicación física",
        help_text="Estante, repisa o lugar donde se guarda en almacén.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Instancia de Material"
        verbose_name_plural = "Instancias de Material"
        ordering = ["codigo_ejemplar"]
        indexes = [
            models.Index(fields=["material", "estado"], name="instancia_mat_est_idx"),
            models.Index(fields=["codigo_ejemplar"], name="instancia_cod_idx"),
        ]

    def __str__(self):
        return f"{self.material.nombre} [{self.codigo_ejemplar}] ({self.get_estado_display()})"

    def esta_disponible(self):
        return self.estado == "disponible"
