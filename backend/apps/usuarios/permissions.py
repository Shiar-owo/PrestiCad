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


class EsGestorAlmacen(BasePermission):
    """Permite consultar la elegibilidad de un prestatario al gestor."""

    message = "Solo un gestor de almacén puede consultar la elegibilidad para préstamos."

    def has_permission(self, request, view):
        usuario = getattr(request, "usuario_autenticado", None)
        return bool(usuario and usuario.rol.nombre == "gestor")
