"""Capa de servicios: reglas de negocio del módulo usuarios.

Las vistas son delgadas y delegan aquí. Los servicios NO acceden a tablas de
otros módulos; se comunican con ellos solo a través de sus propios servicios.
"""
from datetime import timedelta

from django.contrib.auth.hashers import check_password, make_password
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.usuarios.models import Credencial, Usuario


INTENTOS_FALLIDOS_MAXIMOS = 5
MINUTOS_BLOQUEO_CUENTA = 15


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


def obtener_credencial_por_email(email):
    """Devuelve la credencial asociada a un email de acceso normalizado."""
    email_normalizado = email.strip().lower()
    return Credencial.objects.select_related("usuario").filter(email__iexact=email_normalizado).first()


def _bloqueo_expirado(credencial):
    """Indica si el bloqueo temporal ya venció."""
    return bool(credencial.locked_until and credencial.locked_until <= timezone.now())


def _reiniciar_intentos_autenticacion(credencial):
    """Limpia el contador y desbloqueo de la credencial."""
    credencial.failed_attempts = 0
    credencial.locked_until = None
    credencial.save(update_fields=["failed_attempts", "locked_until"])


def _registrar_fallo_autenticacion(credencial):
    """Incrementa fallos y bloquea la cuenta cuando alcanza el límite."""
    credencial.failed_attempts += 1

    if credencial.failed_attempts >= INTENTOS_FALLIDOS_MAXIMOS:
        credencial.locked_until = timezone.now() + timedelta(minutes=MINUTOS_BLOQUEO_CUENTA)

    credencial.save(update_fields=["failed_attempts", "locked_until"])


def autenticar_usuario(*, email, password):
    """Autentica un usuario por email y contraseña.

    Reglas de negocio (HU03):
    - El email se normaliza a minúsculas y se compara sin distinción de mayúsculas.
    - Una credencial bloqueada no puede autenticar hasta que venza el bloqueo.
    - Los fallos incrementan el contador; al quinto fallo se bloquea la cuenta.
    - Un acceso exitoso reinicia el contador y el bloqueo.
    """
    credencial = obtener_credencial_por_email(email)
    if credencial is None:
        raise UsuariosError("email", "El email o la contraseña son incorrectos.")

    if credencial.locked_until and not _bloqueo_expirado(credencial):
        raise UsuariosError("email", "La cuenta está bloqueada temporalmente.")

    if not check_password(password, credencial.password_hash):
        _registrar_fallo_autenticacion(credencial)
        raise UsuariosError("password", "El email o la contraseña son incorrectos.")

    _reiniciar_intentos_autenticacion(credencial)
    return credencial.usuario

class RolInvalidoError(Exception):
    """El rol solicitado no existe en la taxonomía del sistema."""


class UsuarioNoEncontradoError(Exception):
    """No existe un usuario con el id indicado."""


def listar_usuarios_con_rol():
    """Devuelve todos los usuarios para que el administrador vea su rol actual (HU02, criterio 1)."""
    from apps.usuarios.models import Usuario

    return Usuario.objects.all()


def cambiar_rol_usuario(usuario_id, nuevo_rol):
    """Cambia el rol de un usuario, validando la taxonomía del sistema.

    Reglas aplicadas (HU02):
    - El rol debe pertenecer a la lista de ROLES definida en constants.py.
    - El cambio se persiste de inmediato (criterio 4).
    - `tipo` nunca se toca aquí: tipo y rol son independientes (criterio 3).
    """
    from apps.usuarios.constants import ROLES

    usuario = obtener_usuario_por_id(usuario_id)
    if usuario is None:
        raise UsuarioNoEncontradoError(f"No existe un usuario con id={usuario_id}")

    roles_validos = {clave for clave, _ in ROLES}
    if nuevo_rol not in roles_validos:
        raise RolInvalidoError(f"'{nuevo_rol}' no es un rol válido. Opciones: {sorted(roles_validos)}")

    usuario.rol = nuevo_rol
    usuario.save(update_fields=["rol", "updated_at"])
    return usuario


def usuario_tiene_prestamos_activos(usuario_id):
    """Indica si el usuario tiene préstamos activos (HU02, criterio 5).

    TODO: el módulo `prestamos` aún no existe. Cuando se implemente,
    reemplazar este stub por una llamada a su servicio.
    """
    return False


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
