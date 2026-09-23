"""Middleware del módulo usuarios."""
from datetime import datetime, timedelta

from django.conf import settings
from django.utils import timezone

from apps.usuarios.sesiones import CLAVE_SESION_USUARIO_ID, CLAVE_SESION_ULTIMA_ACTIVIDAD


class ExpiracionSesionInactividadMiddleware:
    """Expira sesiones autenticadas cuando superan el tiempo de inactividad."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        self._verificar_inactividad(request)
        response = self.get_response(request)
        return response

    def _verificar_inactividad(self, request):
        session = getattr(request, "session", None)
        if session is None or CLAVE_SESION_USUARIO_ID not in session:
            return

        ultima_actividad = session.get(CLAVE_SESION_ULTIMA_ACTIVIDAD)
        if ultima_actividad is None:
            session[CLAVE_SESION_ULTIMA_ACTIVIDAD] = timezone.now().isoformat()
            session.modified = True
            return

        ultima_actividad_dt = datetime.fromisoformat(ultima_actividad)
        if timezone.is_naive(ultima_actividad_dt):
            ultima_actividad_dt = timezone.make_aware(
                ultima_actividad_dt,
                timezone.get_current_timezone(),
            )

        limite_inactividad = timedelta(minutes=settings.SESSION_IDLE_TIMEOUT_MINUTES)
        ahora = timezone.now()

        if ahora - ultima_actividad_dt >= limite_inactividad:
            session.flush()
            return

        session[CLAVE_SESION_ULTIMA_ACTIVIDAD] = ahora.isoformat()
        session.modified = True