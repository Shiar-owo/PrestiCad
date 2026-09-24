"""Capa de servicios: reglas de negocio del módulo usuarios.

Las vistas son delgadas y delegan aquí. Los servicios NO acceden a tablas de
otros módulos; se comunican con ellos solo a través de sus propios servicios.
"""


class RolInvalidoError(Exception):
    """El rol solicitado no existe en la taxonomía del sistema."""


class UsuarioNoEncontradoError(Exception):
    """No existe un usuario con el id indicado."""


def obtener_usuario_por_id(usuario_id):
    """Devuelve un usuario dado su id."""
    from apps.usuarios.models import Usuario

    try:
        return Usuario.objects.get(pk=usuario_id)
    except Usuario.DoesNotExist:
        return None


def listar_usuarios_con_rol():
    """Devuelve todos los usuarios para que el administrador vea su rol actual (HU02, criterio 1)."""
    from apps.usuarios.models import Usuario

    return Usuario.objects.all()


def cambiar_rol_usuario(usuario_id, nuevo_rol):
    """Cambia el rol de un usuario, validando contra la entidad Rol.

    `nuevo_rol` es el código de texto del rol (ej. 'gestor'), igual que antes;
    internamente ahora se resuelve contra la tabla `Rol` (PRTCAD-35/36).

    Reglas aplicadas (HU02):
    - El rol debe existir en la tabla Rol (sembrada desde constants.ROLES).
    - El cambio se persiste de inmediato (criterio 4).
    - `tipo` nunca se toca aquí: tipo y rol son independientes (criterio 3).

    Lanza UsuarioNoEncontradoError o RolInvalidoError si corresponde.
    Devuelve la instancia de Usuario ya actualizada.
    """
    from apps.usuarios.models import Rol

    usuario = obtener_usuario_por_id(usuario_id)
    if usuario is None:
        raise UsuarioNoEncontradoError(f"No existe un usuario con id={usuario_id}")

    try:
        rol = Rol.objects.get(nombre=nuevo_rol)
    except Rol.DoesNotExist as exc:
        from apps.usuarios.constants import ROLES

        opciones = sorted(clave for clave, _ in ROLES)
        raise RolInvalidoError(f"'{nuevo_rol}' no es un rol válido. Opciones: {opciones}") from exc

    usuario.rol = rol
    usuario.save(update_fields=["rol", "updated_at"])
    return usuario


def usuario_tiene_prestamos_activos(usuario_id):
    """Indica si el usuario tiene préstamos activos (HU02, criterio 5).

    TODO: el módulo `prestamos` aún no existe en el repositorio. Cuando se
    implemente (HU09/HU17), reemplazar este stub por una llamada a su
    servicio, p.ej. `from apps.prestamos.services import tiene_prestamos_activos`.
    Por ahora devuelve False para no bloquear otras funcionalidades.
    """
    return False