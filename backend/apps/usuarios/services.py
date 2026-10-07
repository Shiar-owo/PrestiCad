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