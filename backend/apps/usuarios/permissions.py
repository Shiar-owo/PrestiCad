from rest_framework.permissions import BasePermission


class EsAdministrador(BasePermission):
    """Permite la operación solo a una sesión autenticada de administrador."""

    message = "Solo un administrador puede gestionar roles de usuario."

    def has_permission(self, request, view):
        usuario = request.user
        return bool(
            getattr(usuario, "is_authenticated", False)
            and getattr(usuario, "rol", None)
            and usuario.rol.nombre == "administrador"
        )
