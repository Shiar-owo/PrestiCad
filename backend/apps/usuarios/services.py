"""Capa de servicios: reglas de negocio del módulo usuarios.

Las vistas son delgadas y delegan aquí. Los servicios NO acceden a tablas de
otros módulos; se comunican con ellos solo a través de sus propios servicios.
"""
from django.contrib.auth.hashers import make_password
from django.db import IntegrityError, transaction

from apps.usuarios.models import Credencial, Usuario


class UsuariosError(Exception):
    """Error de negocio del módulo usuarios.

    Lleva el campo afectado y un mensaje en español para mostrarlo en la
    respuesta HTTP (la vista lo traduce a un 409 Conflict).
    """

    def __init__(self, campo, mensaje):
        self.campo = campo
        self.mensaje = mensaje
        super().__init__(mensaje)


def obtener_usuario_por_id(usuario_id):
    """Devuelve un usuario dado su id."""
    try:
        return Usuario.objects.get(pk=usuario_id)
    except Usuario.DoesNotExist:
        return None


def obtener_perfil(usuario):
    """Devuelve el perfil con los datos disponibles actualmente en Usuario.

    El historial de préstamos se incorporará cuando exista el servicio
    propietario de esos datos. La reputación se mantiene detrás de una
    función privada para poder delegarla al módulo correspondiente cuando
    HU12 esté implementada.
    """
    return {
        "nombre": usuario.nombre,
        "apellido": usuario.apellido,
        "email": usuario.email,
        "dni": usuario.dni,
        "telefono": usuario.telefono,
        "tipo": usuario.tipo,
        **_obtener_reputacion_actual(usuario),
    }


def _obtener_reputacion_actual(usuario):
    """Lee los valores provisionales de reputación almacenados en Usuario."""
    return {
        "reputacion_puntaje": usuario.reputacion_puntaje,
        "reputacion_tier": usuario.reputacion_tier,
    }


def actualizar_perfil(usuario, *, nombre, telefono=None):
    """Actualiza solo los campos editables del perfil.

    La validación de entrada se realiza en el serializer. El servicio también
    limita explícitamente los campos persistidos para proteger sus invariantes
    si se invoca desde otro punto interno.
    """
    usuario.nombre = nombre.strip()
    campos_actualizados = ["nombre", "updated_at"]

    if telefono is not None:
        usuario.telefono = telefono.strip()
        campos_actualizados.append("telefono")

    usuario.save(update_fields=campos_actualizados)
    return usuario


@transaction.atomic
def registrar_usuario(*, nombre, apellido, email, dni, telefono="", tipo, facultad, departamento_carrera="", password):
    """Registra un usuario junto con su credencial de acceso.

    Reglas de negocio (HU01):
    - El email y el DNI no pueden estar duplicados (email sin distinguir mayúsculas).
    - La creación es transaccional: el usuario y su credencial se crean juntos
      o no se crea ninguno.
    - La contraseña se guarda hasheada, nunca en claro.
    - El rol y el estado quedan en sus valores por defecto (prestatario y activo);
      la reputación inicia en Neutral (0 puntos) — ver T01.04.

    Eleva `UsuariosError` si el email o el DNI ya están registrados.
    """
    email = email.strip().lower()
    if Usuario.objects.filter(email__iexact=email).exists():
        raise UsuariosError("email", "El email ya está registrado.")
    if Usuario.objects.filter(dni=dni).exists():
        raise UsuariosError("dni", "El DNI ya está registrado.")

    try:
        usuario = Usuario.objects.create(
            email=email,
            nombre=nombre,
            apellido=apellido,
            dni=dni,
            telefono=telefono,
            tipo=tipo,
            facultad=facultad,
            departamento_carrera=departamento_carrera,
        )
        Credencial.objects.create(
            usuario=usuario,
            email=email,
            password_hash=make_password(password),
        )
    except IntegrityError as exc:
        # Respaldo frente a condiciones de carrera: la unicidad también está
        # garantizada a nivel de base de datos.
        if "email" in str(exc).lower():
            raise UsuariosError("email", "El email ya está registrado.") from exc
        raise UsuariosError("dni", "El DNI ya está registrado.") from exc

    return usuario
