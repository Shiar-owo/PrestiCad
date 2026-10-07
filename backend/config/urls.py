"""Rutas principales de la API."""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

from config.views import salud

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/salud/", salud, name="salud"),
    path("api/auth/", include("apps.usuarios.auth_urls")),
    path("api/usuarios/", include("apps.usuarios.urls")),
    path("api/", include("apps.inventario.urls")),
    path("api/", include("apps.prestamos.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
