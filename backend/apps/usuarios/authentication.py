from rest_framework.authentication import SessionAuthentication

from apps.usuarios.models import Usuario


class AutenticacionSesionUsuario(SessionAuthentication):
    """Recupera el usuario del dominio guardado en la sesión de Django."""

    def authenticate(self, request):
        usuario_id = request._request.session.get("usuario_id")
        if not usuario_id:
            return None

        usuario = (
            Usuario.objects.select_related("rol")
            .filter(pk=usuario_id, estado="activo")
            .first()
        )
        if usuario is None:
            request._request.session.flush()
            return None

        self.enforce_csrf(request)
        return usuario, None
