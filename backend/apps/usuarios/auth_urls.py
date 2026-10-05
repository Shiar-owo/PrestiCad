from django.urls import path

from apps.usuarios.views import SesionActualView, cerrar_sesion, csrf_token, iniciar_sesion

urlpatterns = [
    path("csrf/", csrf_token, name="auth-csrf"),
    path("login/", iniciar_sesion, name="auth-login"),
    path("logout/", cerrar_sesion, name="auth-logout"),
    path("me/", SesionActualView.as_view(), name="auth-me"),
]
