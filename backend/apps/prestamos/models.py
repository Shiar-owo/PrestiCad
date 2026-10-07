from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone

from apps.inventario.models import Material
from apps.prestamos.constants import ESTADOS_PRESTAMO
from apps.usuarios.models import Usuario


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
