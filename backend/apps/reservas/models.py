import uuid

from django.db import models
from django.utils import timezone

from apps.reservas.constants import (
    ESTADOS_ACTIVOS,
    ESTADOS_RESERVA,
    PRIORIDADES_RESERVA,
)


class Reserva(models.Model):
    """Solicitud de reserva o lista de espera sobre un material del catálogo (HU06-HU08, HU13)."""

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    usuario = models.ForeignKey(
        "usuarios.Usuario",
        on_delete=models.PROTECT,
        related_name="reservas",
    )
    material = models.ForeignKey(
        "inventario.Material",
        on_delete=models.PROTECT,
        related_name="reservas",
    )
    instancia = models.ForeignKey(
        "inventario.InstanciaMaterial",
        on_delete=models.PROTECT,
        related_name="reservas",
        null=True,
        blank=True,
    )
    prestamo = models.OneToOneField(
        "prestamos.Prestamo",
        on_delete=models.PROTECT,
        related_name="reserva",
        null=True,
        blank=True,
    )
    prioridad = models.CharField(
        max_length=10,
        choices=PRIORIDADES_RESERVA,
        default="media",
    )
    justificacion = models.TextField()
    estado = models.CharField(
        max_length=30,
        choices=ESTADOS_RESERVA,
        default="en_espera",
    )
    es_excepcion = models.BooleanField(
        default=False,
        help_text="Reserva solicitada por excepción académica para un prestatario en Tier Restringido.",
    )
    motivo_rechazo = models.TextField(blank=True, default="")
    motivo_cancelacion = models.TextField(blank=True, default="")
    fecha_solicitud = models.DateTimeField(default=timezone.now)
    fecha_limite_espera = models.DateTimeField(null=True, blank=True)
    fecha_confirmacion = models.DateTimeField(null=True, blank=True)
    fecha_limite_recojo = models.DateTimeField(null=True, blank=True)
    fecha_recojo = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Reserva"
        verbose_name_plural = "Reservas"
        ordering = ["-fecha_solicitud", "-created_at"]
        indexes = [
            models.Index(fields=["material", "estado"], name="res_material_estado_idx"),
            models.Index(fields=["usuario", "estado"], name="res_usuario_estado_idx"),
            models.Index(fields=["fecha_limite_espera"], name="res_fecha_lim_espera_idx"),
            models.Index(fields=["fecha_limite_recojo"], name="res_fecha_lim_recojo_idx"),
            models.Index(fields=["estado", "es_excepcion"], name="res_estado_excepcion_idx"),
        ]

    def __str__(self):
        return f"Reserva {self.pk}: {self.material} para {self.usuario} ({self.estado})"

    @property
    def esta_activa(self):
        return self.estado in ESTADOS_ACTIVOS

    @property
    def consume_inventario(self):
        return self.estado == "reservada" and self.instancia_id is not None

    def puede_autopromoverse(self):
        return self.estado == "en_espera" and not self.es_excepcion

    def esta_vigente(self, ahora=None):
        ahora = ahora or timezone.now()
        if self.estado == "reservada" and self.fecha_limite_recojo:
            return ahora <= self.fecha_limite_recojo
        if self.estado == "en_espera" and self.fecha_limite_espera:
            return ahora <= self.fecha_limite_espera
        return False

    def expiro(self, ahora=None):
        ahora = ahora or timezone.now()
        if self.estado == "reservada" and self.fecha_limite_recojo:
            return ahora > self.fecha_limite_recojo
        if self.estado == "en_espera" and self.fecha_limite_espera:
            return ahora > self.fecha_limite_espera
        return False
