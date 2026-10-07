from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import BasePermission


class EsGestorDeAlmacen(BasePermission):
    """Solo el gestor autenticado puede formalizar una entrega (HU09)."""

    message_sin_sesion = "Inicia sesión como gestor para registrar un préstamo."
    message_rol = "Solo un gestor de almacén puede registrar préstamos."

    def has_permission(self, request, view):
        usuario = getattr(request, "usuario_autenticado", None)
        if usuario is None:
            raise PermissionDenied(detail=self.message_sin_sesion)
        if usuario.rol.nombre != "gestor":
            raise PermissionDenied(detail=self.message_rol)
        return True


class EsPrestatarioAutenticado(BasePermission):
    """Permite consultar préstamos propios solo al prestatario de la sesión."""

    message_sin_sesion = "Inicia sesión como prestatario para consultar tus préstamos."
    message_rol = "Solo un prestatario puede consultar sus préstamos."

    def has_permission(self, request, view):
        usuario = getattr(request, "usuario_autenticado", None)
        if usuario is None:
            raise PermissionDenied(detail=self.message_sin_sesion)
        if usuario.rol.nombre != "prestatario":
            raise PermissionDenied(detail=self.message_rol)
        return True
