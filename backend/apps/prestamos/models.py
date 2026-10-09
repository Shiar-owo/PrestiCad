import uuid
from pathlib import Path

from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone

from apps.inventario.models import Material
from apps.prestamos.constants import ESTADOS_PRESTAMO
from apps.usuarios.models import Usuario


def ruta_reporte(instance, filename):
    """Destino del reporte de daños: `devoluciones/<año>/<mes>/<token>.pdf`.

    El token aleatorio evita que dos reportes con el mismo nombre de archivo
    se pisen. El PDF se emite en la devolución que lo genera (RN10) y se
    conserva como evidencia histórica.
    """
    extension = Path(filename).suffix.lower() or ".pdf"
    return f"devoluciones/{timezone.now():%Y/%m}/{uuid.uuid4().hex[:12]}{extension}"


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
    registrado_por = models.ForeignKey(
        Usuario,
        on_delete=models.PROTECT,
        related_name="prestamos_registrados",
    )
    fecha_entrega = models.DateTimeField(default=timezone.now)
    fecha_limite = models.DateTimeField()
    tiempo_prestamo_dias = models.PositiveIntegerField(
        validators=[MinValueValidator(1)],
    )
    estado = models.CharField(
        max_length=20,
        choices=ESTADOS_PRESTAMO,
        default="activo",
    )
    checklist_inicial = models.JSONField(default=list)
    garantia_documento_identidad_recibido = models.BooleanField(default=False)
    garantia_compromiso_firmado_recibido = models.BooleanField(default=False)
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

    @property
    def requiere_garantia(self):
        return self.material.requiere_garantia()

    @property
    def garantia_completa(self):
        if not self.requiere_garantia:
            return True
        return (
            self.garantia_documento_identidad_recibido
            and self.garantia_compromiso_firmado_recibido
        )


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
