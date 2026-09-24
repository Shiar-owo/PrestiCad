from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from apps.usuarios.constants import ESTADOS_USUARIO, ROLES, TIERS, TIPOS_USUARIO


def rol_prestatario_por_defecto():
    """Devuelve el pk del rol 'prestatario', creándolo si aún no existe.

    Se usa como `default` de Usuario.rol para no romper la creación de
    usuarios (HU01) ahora que el rol es una relación y no un choice-field.
    """
    rol, _ = Rol.objects.get_or_create(
        nombre="prestatario",
        defaults={"descripcion": "Rol por defecto: puede solicitar préstamos."},
    )
    return rol.pk


class Rol(models.Model):
    """Entidad del dominio: rol de sistema que determina permisos (HU02, PRTCAD-35).

    Antes `rol` era un simple choice-field embebido en `Usuario`. Ahora es
    una entidad propia para poder relacionarla con `Usuario` vía FK y, a
    futuro, adjuntarle permisos granulares.
    """

    nombre = models.CharField(max_length=20, choices=ROLES, unique=True)
    descripcion = models.CharField(max_length=200, blank=True, default="")

    class Meta:
        verbose_name = "Rol"
        verbose_name_plural = "Roles"
        ordering = ["nombre"]

    def __str__(self):
        return self.get_nombre_display()


class Usuario(models.Model):
    """Entidad del dominio: usuario del sistema de préstamos.

    Corresponde al Bounded Context *Identidad y Acceso*.
    Aquí solo se declara la estructura de datos y validaciones simples;
    las reglas de negocio viven en `services.py`.
    """

    email = models.EmailField(unique=True, verbose_name="Email (contacto)")
    nombre = models.CharField(max_length=100)
    apellido = models.CharField(max_length=100)
    dni = models.CharField(max_length=8, unique=True)
    telefono = models.CharField(max_length=20, blank=True, default="")
    tipo = models.CharField(max_length=20, choices=TIPOS_USUARIO)
    facultad = models.CharField(max_length=100, verbose_name="Facultad")
    departamento_carrera = models.CharField(
        max_length=100,
        blank=True,
        default="",
        verbose_name="Departamento / Carrera",
    )
    rol = models.ForeignKey(
        Rol,
        on_delete=models.PROTECT,
        related_name="usuarios",
        default=rol_prestatario_por_defecto,
    )
    estado = models.CharField(max_length=20, choices=ESTADOS_USUARIO, default="activo")

    reputacion_puntaje = models.IntegerField(
        default=0,
        validators=[MinValueValidator(-500), MaxValueValidator(500)],
        verbose_name="Puntaje de reputación",
    )
    reputacion_tier = models.CharField(
        max_length=20, choices=TIERS, default="estandar", verbose_name="Tier de reputación"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Usuario"
        verbose_name_plural = "Usuarios"
        ordering = ["apellido", "nombre"]

    def __str__(self):
        return f"{self.nombre} {self.apellido}"


class Credencial(models.Model):
    """Entidad del dominio: credenciales de acceso del usuario.

    Guarda el email de login, la contraseña hasheada y el control de
    intentos fallidos/bloqueo. Está en relación 1:1 con `Usuario`.
    """

    usuario = models.OneToOneField(Usuario, on_delete=models.CASCADE, related_name="credencial")
    email = models.EmailField(unique=True, verbose_name="Email (login)")
    password_hash = models.CharField(max_length=255)
    failed_attempts = models.PositiveIntegerField(default=0, verbose_name="Intentos fallidos")
    locked_until = models.DateTimeField(null=True, blank=True, verbose_name="Bloqueado hasta")

    class Meta:
        verbose_name = "Credencial"
        verbose_name_plural = "Credenciales"

    def __str__(self):
        return self.email