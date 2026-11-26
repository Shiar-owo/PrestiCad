"""Reglas de negocio del módulo de usuarios."""
from datetime import timedelta

from django.contrib.auth.hashers import check_password, make_password
from django.db import IntegrityError, models, transaction
from django.utils import timezone

from apps.usuarios.constants import MAXIMO_PUNTOS_SEMANALES_TIER
from apps.usuarios.models import Credencial, Rol, TransaccionReputacion, Usuario
from apps.usuarios.validators import validar_y_normalizar_telefono

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


class EstadoUsuarioInvalidoError(Exception):
    """El estado solicitado no es válido para la gestión administrativa."""


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


ESTADOS_GESTIONABLES_ADMIN = ("activo", "inactivo")


def cambiar_estado_usuario(usuario_id, nuevo_estado):
    """Activa o desactiva la cuenta de un usuario desde el panel administrativo."""
    usuario = obtener_usuario_por_id(usuario_id)
    if usuario is None:
        raise UsuarioNoEncontradoError(f"No existe un usuario con id={usuario_id}")

    if nuevo_estado not in ESTADOS_GESTIONABLES_ADMIN:
        raise EstadoUsuarioInvalidoError(
            f"'{nuevo_estado}' no es un estado válido. Opciones: {list(ESTADOS_GESTIONABLES_ADMIN)}"
        )

    usuario.estado = nuevo_estado
    usuario.save(update_fields=["estado", "updated_at"])
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

    if telefono:
        try:
            telefono = validar_y_normalizar_telefono(telefono, default_region="PE", obligatorio=False)
        except Exception as exc:
            mensaje = exc.detail[0] if hasattr(exc, "detail") and isinstance(exc.detail, list) else str(exc)
            raise UsuariosError("telefono", str(mensaje))

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


def obtener_perfil(usuario, ahora=None):
    return {
        "nombre": usuario.nombre,
        "apellido": usuario.apellido,
        "email": usuario.email,
        "email_secundario": usuario.email_secundario,
        "dni": usuario.dni,
        "telefono": usuario.telefono,
        "telefono_secundario": usuario.telefono_secundario,
        "telefono_terciario": usuario.telefono_terciario,
        "tipo": usuario.tipo,
        "facultad": usuario.facultad,
        "departamento_carrera": usuario.departamento_carrera,
        "reputacion_puntaje": usuario.reputacion_puntaje,
        "reputacion_tier": usuario.reputacion_tier,
        "foto_perfil": usuario.foto_perfil,
        "reputacion_puntos_ganados_semana": calcular_puntos_ganados_semana_actual(usuario, ahora=ahora),
        "reputacion_tope_semanal": MAXIMO_PUNTOS_SEMANALES_TIER.get(usuario.reputacion_tier, 60),
    }


_SIN_CAMBIO = object()


def _eliminar_archivo_foto_perfil(storage, nombre):
    """Borra del storage el archivo de foto de perfil anterior o eliminado."""
    try:
        storage.delete(nombre)
    except Exception:  # noqa: BLE001
        pass


def actualizar_perfil(
    usuario,
    *,
    telefono=None,
    telefono_secundario=None,
    telefono_terciario=None,
    email_secundario=None,
    foto_perfil=_SIN_CAMBIO,
    eliminar_foto_perfil=False,
):
    campos_actualizados = ["updated_at"]
    foto_anterior = usuario.foto_perfil.name if usuario.foto_perfil else None
    storage_foto = Usuario._meta.get_field("foto_perfil").storage

    if telefono is not None:
        telefono_limpio = telefono.strip()
        if telefono_limpio:
            try:
                telefono_limpio = validar_y_normalizar_telefono(telefono_limpio, default_region="PE", obligatorio=False)
            except Exception as exc:
                mensaje = exc.detail[0] if hasattr(exc, "detail") and isinstance(exc.detail, list) else str(exc)
                raise UsuariosError("telefono", str(mensaje))
        usuario.telefono = telefono_limpio
        campos_actualizados.append("telefono")

    if telefono_secundario is not None:
        sec_limpio = telefono_secundario.strip()
        if sec_limpio:
            try:
                sec_limpio = validar_y_normalizar_telefono(sec_limpio, default_region="PE", obligatorio=False)
            except Exception as exc:
                mensaje = exc.detail[0] if hasattr(exc, "detail") and isinstance(exc.detail, list) else str(exc)
                raise UsuariosError("telefono_secundario", str(mensaje))
        usuario.telefono_secundario = sec_limpio
        campos_actualizados.append("telefono_secundario")

    if telefono_terciario is not None:
        ter_limpio = telefono_terciario.strip()
        if ter_limpio:
            try:
                ter_limpio = validar_y_normalizar_telefono(ter_limpio, default_region="PE", obligatorio=False)
            except Exception as exc:
                mensaje = exc.detail[0] if hasattr(exc, "detail") and isinstance(exc.detail, list) else str(exc)
                raise UsuariosError("telefono_terciario", str(mensaje))
        usuario.telefono_terciario = ter_limpio
        campos_actualizados.append("telefono_terciario")

    if email_secundario is not None:
        usuario.email_secundario = email_secundario.strip().lower()
        campos_actualizados.append("email_secundario")

    if eliminar_foto_perfil or foto_perfil is None:
        usuario.foto_perfil = None
        campos_actualizados.append("foto_perfil")
    elif foto_perfil is not _SIN_CAMBIO:
        usuario.foto_perfil = foto_perfil
        campos_actualizados.append("foto_perfil")

    usuario.save(update_fields=campos_actualizados)

    foto_nueva = usuario.foto_perfil.name if usuario.foto_perfil else None
    if foto_anterior and foto_anterior != foto_nueva:
        transaction.on_commit(lambda: _eliminar_archivo_foto_perfil(storage_foto, foto_anterior))

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


def obtener_inicio_semana_operativa(ahora=None):
    """Devuelve el lunes de la semana actual a las 00:00:00 en la zona horaria local."""
    ahora_local = timezone.localtime(ahora or timezone.now())
    inicio_dia = ahora_local.replace(hour=0, minute=0, second=0, microsecond=0)
    return inicio_dia - timedelta(days=ahora_local.weekday())


def calcular_puntos_ganados_semana_actual(usuario, ahora=None):
    """Suma los puntos positivos de transacciones registradas desde el lunes en curso."""
    inicio_semana = obtener_inicio_semana_operativa(ahora)
    total = (
        TransaccionReputacion.objects.filter(
            usuario=usuario,
            fecha__gte=inicio_semana,
            puntos_delta__gt=0,
        ).aggregate(total=models.Sum("puntos_delta"))["total"]
        or 0
    )
    return total


def calcular_bonificacion_con_tope_semanal(usuario, bonificacion_base, ahora=None):
    """Aplica la cota máxima semanal de ganancia de puntos según el Tier del usuario.

    Devuelve: (bonificacion_efectiva, tope_alcanzado, ganados_previos, tope)
    """
    if bonificacion_base <= 0:
        return 0, False, 0, 0

    tope = MAXIMO_PUNTOS_SEMANALES_TIER.get(usuario.reputacion_tier, 60)
    ganados_previos = calcular_puntos_ganados_semana_actual(usuario, ahora=ahora)
    margen_disponible = max(0, tope - ganados_previos)

    bonificacion_efectiva = min(bonificacion_base, margen_disponible)
    tope_alcanzado = (ganados_previos + bonificacion_efectiva) >= tope

    return bonificacion_efectiva, tope_alcanzado, ganados_previos, tope


def registrar_transaccion_reputacion(
    *,
    usuario,
    puntos_delta,
    tipo="ajuste_administrativo",
    puntos_solicitados=None,
    tope_aplicado=False,
    prestamo_id=None,
    reserva_id=None,
    descripcion="",
    fecha=None,
):
    """Persiste el evento inmutable de cambio de puntos para auditoría."""
    fecha_movimiento = fecha or timezone.now()
    solicitados = puntos_delta if puntos_solicitados is None else puntos_solicitados

    return TransaccionReputacion.objects.create(
        usuario=usuario,
        fecha=fecha_movimiento,
        tipo=tipo,
        puntos_delta=puntos_delta,
        puntos_solicitados=solicitados,
        tope_aplicado=tope_aplicado,
        prestamo_id=prestamo_id,
        reserva_id=reserva_id,
        descripcion=descripcion,
    )


def actualizar_reputacion(
    usuario,
    delta,
    *,
    tipo="ajuste_administrativo",
    puntos_solicitados=None,
    tope_aplicado=False,
    prestamo_id=None,
    reserva_id=None,
    descripcion="",
    fecha=None,
):
    """Aplica un delta al puntaje con clamp, recalcula el Tier y persiste TransaccionReputacion (RN03).

    Devuelve el puntaje resultante para que el llamante pueda componer el
    resultado que persista o exponga.
    """
    puntaje_nuevo = puntaje_reputacion_ajustado(usuario.reputacion_puntaje + delta)
    usuario.reputacion_puntaje = puntaje_nuevo
    usuario.reputacion_tier = tier_por_puntaje(puntaje_nuevo)
    usuario.save(
        update_fields=["reputacion_puntaje", "reputacion_tier", "updated_at"],
    )
    registrar_transaccion_reputacion(
        usuario=usuario,
        puntos_delta=delta,
        tipo=tipo,
        puntos_solicitados=puntos_solicitados,
        tope_aplicado=tope_aplicado,
        prestamo_id=prestamo_id,
        reserva_id=reserva_id,
        descripcion=descripcion,
        fecha=fecha,
    )
    return puntaje_nuevo
