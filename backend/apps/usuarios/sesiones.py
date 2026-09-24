"""Utilidades de sesión del módulo usuarios."""
from django.utils import timezone


CLAVE_SESION_USUARIO_ID = "usuario_id"
CLAVE_SESION_ULTIMA_ACTIVIDAD = "ultima_actividad"


def registrar_sesion_activa(session, usuario_id):
    """Guarda los metadatos mínimos de una sesión autenticada."""
    session[CLAVE_SESION_USUARIO_ID] = usuario_id
    session[CLAVE_SESION_ULTIMA_ACTIVIDAD] = timezone.now().isoformat()
    session.modified = True