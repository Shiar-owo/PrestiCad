"""Rutas principales de la API.

Cada módulo aporta su propio `urls.py` y se monta aquí bajo `/api/<modulo>/`.
"""
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
]

# Solo en desarrollo. En producción las imágenes las entrega Cloudinary, así
# que no hay nada que servir desde el disco del contenedor.
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

