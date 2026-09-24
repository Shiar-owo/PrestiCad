"""Rutas principales de la API.

Cada módulo aporta su propio `urls.py` y se monta aquí bajo `/api/<modulo>/`.
"""
from django.contrib import admin
from django.urls import include, path

from config.views import salud

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/salud/", salud, name="salud"),
    path("api/auth/", include("apps.usuarios.auth_urls")),
    path("api/usuarios/", include("apps.usuarios.urls")),
]