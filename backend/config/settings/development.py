"""Configuración de desarrollo.

Es la que selecciona `manage.py` por defecto, así que basta con levantar el
proyecto con Docker para trabajar en local sin configurar nada extra.
"""
import os

from .base import *  # noqa: F401,F403

# El desarrollo se apoya en las trazas de Django, así que no tiene sentido
# apagarlo. No se lee del entorno a propósito: si alguien lo apaga desde el
# `.env` pierde el feedback de errores sin darse cuenta.
DEBUG = True

# La seguridad no es el objetivo en local, así que se permite una clave de
# ejemplo. En producción la clave es obligatoria (`production.py`).
SECRET_KEY = os.getenv("SECRET_KEY", "clave-insegura-de-desarrollo")

ALLOWED_HOSTS = [
    h for h in os.getenv("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",") if h
]

# Orígenes del frontend (Vite) permitidos por CORS.
CORS_ALLOWED_ORIGINS = [
    o for o in os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:5173").split(",") if o
]

# Las imágenes se guardan en disco dentro del contenedor. El volumen montado
# (`./backend:/app`) las conserva entre reinicios; no se versionan porque
# `.gitignore` excluye `backend/media/`.
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

# En desarrollo el backend está publicado en el puerto 8000, así que el
# navegador pide las imágenes directamente a Django. El SPA corre en 5173,
# pero a una etiqueta `<img>` no le afecta CORS.
MEDIA_URL_PUBLICA = os.getenv("MEDIA_URL_PUBLICA", "http://localhost:8000")

STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
    },
}
