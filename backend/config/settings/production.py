"""Configuración de producción.

La seleccionan `wsgi.py` y `asgi.py` por defecto. Ningún dato crítico tiene
aquí un valor por defecto: si falta, Django no arranca en lugar de arrancar
abierto. La configuración real de producción (imágenes en Cloudinary) se
agrega en un commit posterior.
"""
import os

from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F401,F403

# El valor por defecto de DEBUG es True, así que en producción se fija
# explícitamente en lugar de leerse del entorno.
DEBUG = False

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise ImproperlyConfigured(
        "Define SECRET_KEY en el entorno de producción: no se puede arrancar "
        "con una clave de ejemplo."
    )

ALLOWED_HOSTS = [h for h in os.getenv("DJANGO_ALLOWED_HOSTS", "").split(",") if h]
if not ALLOWED_HOSTS:
    raise ImproperlyConfigured(
        "Define DJANGO_ALLOWED_HOSTS en el entorno de producción con los "
        "dominios que sirven la API."
    )

# El proyecto es un frontend servido por nginx más una API, así que el origen
# del SPA hay que declararlo: dejarlo vacío rompe el navegador en silencio.
CORS_ALLOWED_ORIGINS = [o for o in os.getenv("CORS_ALLOWED_ORIGINS", "").split(",") if o]
if not CORS_ALLOWED_ORIGINS:
    raise ImproperlyConfigured(
        "Define CORS_ALLOWED_ORIGINS en el entorno de producción con el origen "
        "del frontend."
    )

# nginx termina TLS y Django corre detrás, así que hay que declararlo para que
# `request.is_secure()` refleje la conexión real.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# Las cookies de sesión y CSRF solo viajan por HTTPS. No se activa
# SECURE_SSL_REDIRECT porque obligaría a redirigir a https y rompería un
# despliegue sin TLS; conviene habilitarlo junto con SECURE_HSTS_SECONDS
# cuando exista un certificado.
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

# En producción las imágenes no tocan el disco del contenedor: van a
# Cloudinary, que a su vez las sirve por CDN.
CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET")
if not all([CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET]):
    raise ImproperlyConfigured(
        "Define CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y "
        "CLOUDINARY_API_SECRET en el entorno de producción."
    )

CLOUDINARY_STORAGE = {
    "CLOUD_NAME": CLOUDINARY_CLOUD_NAME,
    "API_KEY": CLOUDINARY_API_KEY,
    "API_SECRET": CLOUDINARY_API_SECRET,
    "SECURE": True,
    # El paquete usa MEDIA_URL como prefijo del nombre remoto si no se indica
    # otra cosa, y dejaría la ruta local horneada en el nombre del asset.
    "PREFIX": "",
}

STORAGES = {
    "default": {
        "BACKEND": "cloudinary_storage.storage.MediaCloudinaryStorage",
    },
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
    },
}
