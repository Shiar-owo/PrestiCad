"""Capa de servicios: reglas de negocio del módulo usuarios.

Las vistas son delgadas y delegan aquí. Los servicios NO acceden a tablas de
otros módulos; se comunican con ellos solo a través de sus propios servicios.
"""


def obtener_usuario_por_id(usuario_id):
    """Devuelve un usuario dado su id."""
    from apps.usuarios.models import Usuario

    try:
        return Usuario.objects.get(pk=usuario_id)
    except Usuario.DoesNotExist:
        return None

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