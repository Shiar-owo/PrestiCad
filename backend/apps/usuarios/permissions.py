from rest_framework.permissions import BasePermission

from apps.usuarios.models import Usuario


class EsAdministrador(BasePermission):
    """Autoriza la acción solo si quien la solicita tiene rol 'administrador'.

    Implementa PRTCAD-37 (middleware/autorización por roles) para HU02.

    LIMITACIÓN ACTUAL: HU03 (Iniciar sesión) todavía no está implementada en
    el repositorio, por lo que no existe sesión ni JWT de donde tomar al
    usuario autenticado. Como solución interina, el solicitante se identifica
    mediante el header `X-Usuario-Id`. Cuando se implemente HU03, reemplazar
    `_usuario_solicitante` para leer `request.user` (o el payload del token)
    en vez de este header.
    """

    message = "Solo un administrador puede gestionar roles de usuario."

    def _usuario_solicitante(self, request):
        usuario_id = request.headers.get("X-Usuario-Id")
        if not usuario_id:
            return None
        return Usuario.objects.filter(pk=usuario_id).select_related("rol").first()

    def has_permission(self, request, view):
        usuario = self._usuario_solicitante(request)
        if usuario is None:
            return False
        return usuario.rol.nombre == "administrador"