import math
import uuid
from pathlib import Path

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone

from apps.inventario.models import Material
from apps.prestamos.constants import (
    ESTADOS_GARANTIA,
    ESTADOS_PRESTAMO,
    FASES_FOTO_CHECKLIST,
    MAXIMO_DIAS_PRESTAMO,
    MAXIMO_MINUTOS_PRESTAMO,
    MINIMO_DIAS_PRESTAMO,
    MINIMO_MINUTOS_PRESTAMO,
    TIPOS_GARANTIA,
)
from apps.prestamos.storage import obtener_almacenamiento_garantias
from apps.prestamos.validators import validar_foto_checklist
from apps.usuarios.models import Usuario


def ruta_reporte(instance, filename):
    """Destino del reporte de daños: `devoluciones/<año>/<mes>/<token>.pdf`.

    El token aleatorio evita que dos reportes con el mismo nombre de archivo
    se pisen. El PDF se emite en la devolución que lo genera (RN10) y se
    conserva como evidencia histórica.
    """
    extension = Path(filename).suffix.lower() or ".pdf"
    return f"devoluciones/{timezone.now():%Y/%m}/{uuid.uuid4().hex[:12]}{extension}"


def ruta_documento_garantia(instance, filename):
    """Genera una ruta privada que no conserva el nombre original del archivo."""
    return f"garantias/{timezone.now():%Y/%m}/{uuid.uuid4().hex}.pdf"


def ruta_foto_checklist(instance, filename):
    """Genera una ruta privada y aleatoria para la foto de un checklist."""
    extension = Path(filename).suffix.lower() or ".jpg"
    return f"checklists/{timezone.now():%Y/%m}/{uuid.uuid4().hex}{extension}"


class Prestamo(models.Model):
    """Entrega trazable de una unidad de inventario a un prestatario."""

    usuario = models.ForeignKey(
        Usuario,
        on_delete=models.PROTECT,
        related_name="prestamos",
    )
    material = models.ForeignKey(
        Material,
        on_delete=models.PROTECT,
        related_name="prestamos",
    )
    instancia = models.ForeignKey(
        "inventario.InstanciaMaterial",
        on_delete=models.PROTECT,
        related_name="prestamos",
        null=True,
        blank=True,
    )
    registrado_por = models.ForeignKey(
        Usuario,
        on_delete=models.PROTECT,
        related_name="prestamos_registrados",
    )
    fecha_entrega = models.DateTimeField(default=timezone.now)
    fecha_limite = models.DateTimeField()
    tiempo_prestamo_minutos = models.PositiveIntegerField(
        default=1440,
        validators=[
            MinValueValidator(MINIMO_MINUTOS_PRESTAMO),
            MaxValueValidator(MAXIMO_MINUTOS_PRESTAMO),
        ],
    )
    tiempo_prestamo_dias = models.PositiveIntegerField(
        default=1,
        validators=[
            MinValueValidator(MINIMO_DIAS_PRESTAMO),
            MaxValueValidator(MAXIMO_DIAS_PRESTAMO),
        ],
    )
    estado = models.CharField(
        max_length=20,
        choices=ESTADOS_PRESTAMO,
        default="activo",
    )
    checklist_inicial = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Préstamo"
        verbose_name_plural = "Préstamos"
        ordering = ["-fecha_entrega", "-id"]
        indexes = [
            models.Index(fields=["usuario", "estado"], name="prest_usuario_estado_idx"),
            models.Index(fields=["material", "estado"], name="prest_material_estado_idx"),
            models.Index(fields=["fecha_limite"], name="prest_fecha_limite_idx"),
        ]

    def __str__(self):
        return f"Préstamo {self.pk}: {self.material} para {self.usuario}"

    def save(self, *args, **kwargs):
        if self._state.adding:
            if (
                self.tiempo_prestamo_minutos == 1440
                and self.tiempo_prestamo_dias
                and self.tiempo_prestamo_dias != 1
            ):
                self.tiempo_prestamo_minutos = self.tiempo_prestamo_dias * 1440
            elif self.tiempo_prestamo_minutos:
                self.tiempo_prestamo_dias = max(
                    1, math.ceil(self.tiempo_prestamo_minutos / 1440)
                )
        super().save(*args, **kwargs)

    @property
    def requiere_garantia(self):
        return self.material.requiere_garantia()

    @property
    def garantia_completa(self):
        if not self.requiere_garantia:
            return True
        try:
            garantia = self.garantia
        except Garantia.DoesNotExist:
            return False
        return bool(
            garantia.estado == "registrada"
            and garantia.documento_identidad
            and garantia.compromiso_responsabilidad
        )


class Garantia(models.Model):
    """Documentos que respaldan un préstamo de material de alto valor."""

    prestamo = models.OneToOneField(
        Prestamo,
        on_delete=models.PROTECT,
        related_name="garantia",
    )
    tipo = models.CharField(
        max_length=40,
        choices=TIPOS_GARANTIA,
        default="documento_y_compromiso",
    )
    estado = models.CharField(
        max_length=20,
        choices=ESTADOS_GARANTIA,
        default="pendiente",
    )
    documento_identidad = models.FileField(
        upload_to=ruta_documento_garantia,
        storage=obtener_almacenamiento_garantias,
        blank=True,
        null=True,
        verbose_name="Documento de identidad (PDF)",
    )
    compromiso_responsabilidad = models.FileField(
        upload_to=ruta_documento_garantia,
        storage=obtener_almacenamiento_garantias,
        blank=True,
        null=True,
        verbose_name="Compromiso de responsabilidad (PDF)",
    )
    fecha_registro = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Garantía"
        verbose_name_plural = "Garantías"

    def __str__(self):
        return f"Garantía del préstamo {self.prestamo_id}"


class FotoChecklist(models.Model):
    """Foto privada asociada a un elemento y fase de inspección del préstamo."""

    prestamo = models.ForeignKey(
        Prestamo,
        on_delete=models.CASCADE,
        related_name="fotos_checklist",
    )
    fase = models.CharField(max_length=10, choices=FASES_FOTO_CHECKLIST)
    indice = models.PositiveSmallIntegerField()
    elemento = models.CharField(max_length=100)
    imagen = models.ImageField(
        upload_to=ruta_foto_checklist,
        storage=obtener_almacenamiento_garantias,
        validators=[validar_foto_checklist],
        verbose_name="Foto del checklist",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Foto de checklist"
        verbose_name_plural = "Fotos de checklist"
        ordering = ["indice"]
        constraints = [
            models.UniqueConstraint(
                fields=("prestamo", "fase", "indice"),
                name="prest_foto_check_fase_indice_uniq",
            ),
        ]

    def __str__(self):
        return f"Foto {self.elemento} del checklist {self.fase} del préstamo {self.prestamo_id}"


class Devolucion(models.Model):
    """Registro único de la devolución de un préstamo (HU11).

    Es 1:1 con `Prestamo`: un préstamo entregado se devuelve una sola vez.
    Guarda el checklist de devolución normalizado y el resultado calculado
    (bonificación/sanciones de RN06) como evidencia auditable; cuando la
    devolución detecta daño parcial o total, `reporte` almacena el PDF
    obligatorio de RN10.
    """

    prestamo = models.OneToOneField(
        Prestamo,
        on_delete=models.PROTECT,
        related_name="devolucion",
    )
    realizado_por = models.ForeignKey(
        Usuario,
        on_delete=models.PROTECT,
        related_name="devoluciones_registradas",
    )
    fecha_devolucion = models.DateTimeField(default=timezone.now)
    checklist_devolucion = models.JSONField(default=list)
    resultado = models.JSONField(default=dict)
    reporte = models.FileField(
        upload_to=ruta_reporte,
        blank=True,
        null=True,
        verbose_name="Reporte de daños (PDF)",
        help_text="PDF obligatorio cuando la devolución detecta daño (RN10).",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Devolución"
        verbose_name_plural = "Devoluciones"
        ordering = ["-fecha_devolucion", "-id"]

    def __str__(self):
        return f"Devolución del préstamo {self.prestamo_id}"
