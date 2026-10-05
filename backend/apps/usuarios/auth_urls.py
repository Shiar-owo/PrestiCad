from django.urls import path

from apps.usuarios.views import (
    AuthLoginView,
    AuthLogoutView,
    SesionActualView,
    csrf_token,
)

urlpatterns = [
    path("csrf/", csrf_token, name="auth-csrf"),
    path("login/", AuthLoginView.as_view(), name="auth-login"),
    path("logout/", AuthLogoutView.as_view(), name="auth-logout"),
    path("me/", SesionActualView.as_view(), name="auth-me"),
]
