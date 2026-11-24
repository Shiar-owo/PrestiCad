"""Permisos del módulo inventario."""
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import BasePermission

# El listado y la consulta del inventario son públicos; la escritura exige rol.
METODOS_DE_SOLO_LECTURA = ("GET", "HEAD", "OPTIONS")

ROLES_QUE_GESTIONAN_INVENTARIO = ("gestor", "administrador")


class EsGestorOAdministrador(BasePermission):
    """Permite escribir el inventario solo a gestores y administradores (HU04 criterio 5).

    La identidad se toma de la sesión activa que deja HU03, que el middleware
    `SesionAutenticadaMiddleware` expone como `request.usuario_autenticado`.
    Sin sesión no hay escritura, pero consultar el inventario sí es público.

    La denegación se lanza como `PermissionDenied` con el mensaje del dominio en
    lugar de devolver `False`: la autenticación de este proyecto no pasa por
    los autenticadores de DRF, así que `False` se traduciría al mensaje genérico
    de "credenciales no proveyeron".
    """

    message = "Solo un gestor o un administrador puede gestionar el inventario."
    message_sin_sesion = "Inicia sesión para gestionar el inventario."

    def has_permission(self, request, view):
        if request.method in METODOS_DE_SOLO_LECTURA:
            return True

        usuario = getattr(request, "usuario_autenticado", None)
        if usuario is None:
            raise PermissionDenied(detail=self.message_sin_sesion)

        if usuario.rol.nombre not in ROLES_QUE_GESTIONAN_INVENTARIO:
            raise PermissionDenied(detail=self.message)

        return True
