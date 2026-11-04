from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import BasePermission

from apps.reservas.models import Reserva


class EsPrestatarioAutenticado(BasePermission):
    """Permite crear y consultar reservas propias únicamente a prestatarios autenticados."""

    message_sin_sesion = "Inicia sesión como prestatario para gestionar tus reservas."
    message_rol = "Solo un usuario con rol de prestatario puede realizar esta acción."

    def has_permission(self, request, view):
        usuario = getattr(request, "usuario_autenticado", None)
        if usuario is None:
            raise PermissionDenied(detail=self.message_sin_sesion)
        if usuario.rol.nombre != "prestatario":
            raise PermissionDenied(detail=self.message_rol)
        return True


class EsGestorDeAlmacen(BasePermission):
    """Permite acciones operativas sobre la cola y las reservas exclusivamente al gestor de almacén."""

    message_sin_sesion = "Inicia sesión como gestor de almacén para gestionar reservas."
    message_rol = "Solo un gestor de almacén puede realizar esta acción."

    def has_permission(self, request, view):
        usuario = getattr(request, "usuario_autenticado", None)
        if usuario is None:
            raise PermissionDenied(detail=self.message_sin_sesion)
        if usuario.rol.nombre != "gestor":
            raise PermissionDenied(detail=self.message_rol)
        return True


class EsGestorOAdministrador(BasePermission):
    """Permite consultar la cola de reservas al gestor de almacén o al administrador."""

    message_sin_sesion = "Inicia sesión para consultar la cola de reservas."
    message_rol = "Solo gestión de almacén o administración puede consultar la cola de reservas."
    roles_permitidos = {"gestor", "administrador"}

    def has_permission(self, request, view):
        usuario = getattr(request, "usuario_autenticado", None)
        if usuario is None:
            raise PermissionDenied(detail=self.message_sin_sesion)
        if usuario.rol.nombre not in self.roles_permitidos:
            raise PermissionDenied(detail=self.message_rol)
        return True


class EsGestorOPrestatarioTitularReserva(BasePermission):
    """Permite consultar los documentos de garantía de una reserva al gestor, administrador o al titular."""

    def has_permission(self, request, view):
        usuario = getattr(request, "usuario_autenticado", None)
        if usuario is None:
            raise PermissionDenied(detail="Inicia sesión para consultar esta garantía.")

        if usuario.rol.nombre in ("gestor", "administrador"):
            return True
        reserva_id = view.kwargs.get("id") or view.kwargs.get("reserva_id")
        if usuario.rol.nombre == "prestatario" and Reserva.objects.filter(
            pk=reserva_id,
            usuario_id=usuario.id,
        ).exists():
            return True

        raise PermissionDenied(
            detail="Solo gestión de almacén, administración o el prestatario titular pueden consultar esta garantía."
        )
