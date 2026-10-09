"""Reglas de negocio del módulo de usuarios."""
from datetime import timedelta

from django.contrib.auth.hashers import check_password, make_password
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.usuarios.models import Credencial, Rol, Usuario

INTENTOS_FALLIDOS_MAXIMOS = 5
MINUTOS_BLOQUEO_CUENTA = 15

# Rango del puntaje de reputación (RN03). El clamp vive aquí para que la
# devolución (HU11) y la gestión de reputación (HU12) compartan fuente.
PUNTOS_MINIMO_REPUTACION = -500
PUNTOS_MAXIMO_REPUTACION = 500

# Rangos de Tier por puntaje (RN03): avanzado 201..500, estándar -50..200,
# restringido -500..-51. Cubren el rango completo de puntaje.
RANGOS_TIER = (
    ("avanzado", 201, 500),
    ("estandar", -50, 200),
    ("restringido", -500, -51),
)


class UsuariosError(Exception):
    """Error de negocio con campo y mensaje aptos para la API."""

    def __init__(self, campo, mensaje):
        self.campo = campo
        self.mensaje = mensaje
        super().__init__(mensaje)


class RolInvalidoError(Exception):
    """El rol solicitado no existe en la taxonomía del sistema."""


class UsuarioNoEncontradoError(Exception):
    """No existe un usuario con el id indicado."""


def obtener_usuario_por_id(usuario_id):
    try:
        return Usuario.objects.select_related("rol").get(pk=usuario_id)
    except Usuario.DoesNotExist:
        return None


def obtener_credencial_por_email(email):
    email_normalizado = email.strip().lower()
    return Credencial.objects.select_related("usuario", "usuario__rol").filter(
        email__iexact=email_normalizado
    ).first()


def _bloqueo_expirado(credencial):
    return bool(credencial.locked_until and credencial.locked_until <= timezone.now())


def _reiniciar_intentos_autenticacion(credencial):
    credencial.failed_attempts = 0
    credencial.locked_until = None
    credencial.save(update_fields=["failed_attempts", "locked_until"])


def _registrar_fallo_autenticacion(credencial):
    credencial.failed_attempts += 1
    if credencial.failed_attempts >= INTENTOS_FALLIDOS_MAXIMOS:
        credencial.locked_until = timezone.now() + timedelta(minutes=MINUTOS_BLOQUEO_CUENTA)
    credencial.save(update_fields=["failed_attempts", "locked_until"])


def autenticar_usuario(*, email, password):
    """Autentica por email, controla intentos y devuelve al usuario activo."""
    credencial = obtener_credencial_por_email(email)
    if credencial is None:
        raise UsuariosError("email", "El email o la contraseña son incorrectos.")

    if credencial.locked_until and not _bloqueo_expirado(credencial):
        raise UsuariosError("email", "La cuenta está bloqueada temporalmente.")

    if not check_password(password, credencial.password_hash):
        _registrar_fallo_autenticacion(credencial)
        raise UsuariosError("password", "El email o la contraseña son incorrectos.")

    if credencial.usuario.estado != "activo":
        raise UsuariosError("email", "El email o la contraseña son incorrectos.")

    _reiniciar_intentos_autenticacion(credencial)
    return credencial.usuario


def listar_usuarios_con_rol():
    return Usuario.objects.select_related("rol").all()


def cambiar_rol_usuario(usuario_id, nuevo_rol):
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


def registrar_usuario(*, nombre, apellido, email, dni, telefono="", tipo, facultad,
                      departamento_carrera="", password):
    """Crea usuario y credencial en una transacción, con contraseña hasheada."""
    email = email.strip().lower()
    dni = dni.strip()
    if Usuario.objects.filter(email__iexact=email).exists():
        raise UsuariosError("email", "El email ya está registrado.")
    if Usuario.objects.filter(dni=dni).exists():
        raise UsuariosError("dni", "El DNI ya está registrado.")

    try:
        with transaction.atomic():
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
        if Usuario.objects.filter(email__iexact=email).exists():
            raise UsuariosError("email", "El email ya está registrado.") from exc
        raise UsuariosError("dni", "El DNI ya está registrado.") from exc
    return usuario


def usuario_tiene_prestamos_activos(usuario_id):
    """Impide borrados hasta disponer del servicio dueño de los préstamos."""
    try:
        from apps.prestamos.services import tiene_prestamos_activos
    except ImportError:
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


def actualizar_perfil(usuario, *, nombre, telefono=None):
    usuario.nombre = nombre.strip()
    campos_actualizados = ["nombre", "updated_at"]
    if telefono is not None:
        usuario.telefono = telefono.strip()
        campos_actualizados.append("telefono")
    usuario.save(update_fields=campos_actualizados)
    return usuario


def puntaje_reputacion_ajustado(puntaje):
    """Recorta un puntaje al rango válido [-500, 500] (RN03)."""
    return max(PUNTOS_MINIMO_REPUTACION, min(PUNTOS_MAXIMO_REPUTACION, puntaje))


def tier_por_puntaje(puntaje):
    """Deriva el Tier de acceso a partir de un puntaje (RN03, HU12)."""
    puntaje = puntaje_reputacion_ajustado(puntaje)
    for tier, limite_inferior, limite_superior in RANGOS_TIER:
        if limite_inferior <= puntaje <= limite_superior:
            return tier
    return "estandar"


def actualizar_reputacion(usuario, delta):
    """Aplica un delta al puntaje con clamp y recalcula el Tier (RN03).

    Devuelve el puntaje resultante para que el llamante pueda componer el
    resultado que persista o exponga.
    """
    puntaje_nuevo = puntaje_reputacion_ajustado(usuario.reputacion_puntaje + delta)
    usuario.reputacion_puntaje = puntaje_nuevo
    usuario.reputacion_tier = tier_por_puntaje(puntaje_nuevo)
    usuario.save(
        update_fields=["reputacion_puntaje", "reputacion_tier", "updated_at"],
    )
    return puntaje_nuevo
