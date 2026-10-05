"""Reglas de negocio del módulo de usuarios."""
from datetime import timedelta

from django.contrib.auth.hashers import check_password, make_password
from django.db import IntegrityError, transaction
from django.utils import timezone


class UsuariosError(Exception):
    def __init__(self, campo, mensaje):
        self.campo = campo
        self.mensaje = mensaje
        super().__init__(mensaje)


class RolInvalidoError(Exception):
    """El rol solicitado no existe en la taxonomía del sistema."""


class UsuarioNoEncontradoError(Exception):
    """No existe un usuario con el id indicado."""


class CredencialesInvalidasError(Exception):
    """Las credenciales no son válidas o la cuenta está bloqueada."""


def obtener_usuario_por_id(usuario_id):
    from apps.usuarios.models import Usuario

    try:
        return Usuario.objects.select_related("rol").get(pk=usuario_id)
    except Usuario.DoesNotExist:
        return None


def listar_usuarios_con_rol():
    from apps.usuarios.models import Usuario

    return Usuario.objects.select_related("rol").all()


def cambiar_rol_usuario(usuario_id, nuevo_rol):
    from apps.usuarios.models import Rol

    usuario = obtener_usuario_por_id(usuario_id)
    if usuario is None:
        raise UsuarioNoEncontradoError(f"No existe un usuario con id={usuario_id}")

    try:
        rol = Rol.objects.get(nombre=nuevo_rol)
    except (Rol.DoesNotExist, TypeError) as exc:
        from apps.usuarios.constants import ROLES

        opciones = sorted(clave for clave, _ in ROLES)
        raise RolInvalidoError(f"'{nuevo_rol}' no es un rol válido. Opciones: {opciones}") from exc

    usuario.rol = rol
    usuario.save(update_fields=["rol", "updated_at"])
    return usuario


def registrar_usuario(**datos):
    from apps.usuarios.models import Credencial, Usuario

    email = datos.pop("email").strip().lower()
    dni = datos.get("dni", "").strip()
    if Usuario.objects.filter(email__iexact=email).exists():
        raise UsuariosError("email", "El email ya está registrado.")
    if Usuario.objects.filter(dni=dni).exists():
        raise UsuariosError("dni", "El DNI ya está registrado.")

    contrasena = datos.pop("password")
    try:
        with transaction.atomic():
            usuario = Usuario.objects.create(email=email, **datos)
            Credencial.objects.create(
                usuario=usuario,
                email=email,
                password_hash=make_password(contrasena),
            )
    except IntegrityError as exc:
        if Usuario.objects.filter(email__iexact=email).exists():
            raise UsuariosError("email", "El email ya está registrado.") from exc
        raise UsuariosError("dni", "El DNI ya está registrado.") from exc
    return usuario


def autenticar_usuario(email, contrasena):
    from apps.usuarios.models import Credencial

    credencial = (
        Credencial.objects.select_related("usuario", "usuario__rol")
        .filter(email__iexact=email.strip())
        .first()
    )
    ahora = timezone.now()
    if credencial is None:
        raise CredencialesInvalidasError
    if credencial.locked_until and credencial.locked_until > ahora:
        raise CredencialesInvalidasError

    if not check_password(contrasena, credencial.password_hash):
        credencial.failed_attempts += 1
        if credencial.failed_attempts >= 5:
            credencial.failed_attempts = 0
            credencial.locked_until = ahora + timedelta(minutes=30)
        credencial.save(update_fields=["failed_attempts", "locked_until"])
        raise CredencialesInvalidasError

    usuario = credencial.usuario
    if usuario.estado != "activo":
        raise CredencialesInvalidasError

    credencial.failed_attempts = 0
    credencial.locked_until = None
    credencial.save(update_fields=["failed_attempts", "locked_until"])
    return usuario


def usuario_tiene_prestamos_activos(usuario_id):
    """Falla de forma segura mientras el módulo de préstamos no esté disponible."""
    try:
        from apps.prestamos.services import tiene_prestamos_activos
    except (ImportError, ModuleNotFoundError):
        return True
    return tiene_prestamos_activos(usuario_id)


def obtener_perfil(usuario):
    return {
        "nombre": usuario.nombre,
        "apellido": usuario.apellido,
        "email": usuario.email,
        "dni": usuario.dni,
        "telefono": usuario.telefono,
        "tipo": usuario.tipo,
        "reputacion_puntaje": usuario.reputacion_puntaje,
        "reputacion_tier": usuario.reputacion_tier,
    }


def actualizar_perfil(usuario, nombre, telefono=None):
    usuario.nombre = nombre.strip()
    if telefono is not None:
        usuario.telefono = telefono.strip()
    usuario.save(update_fields=["nombre", "telefono", "updated_at"])
    return usuario
