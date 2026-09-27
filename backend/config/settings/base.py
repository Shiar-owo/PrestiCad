"""Configuración común a todos los entornos.

Reúne lo que no cambia entre desarrollo y producción: aplicaciones,
middlewares, base de datos, plantillas y el contrato de la API. Cada entorno
importa este módulo con `from .base import *` y solo redefine lo propio, de
modo que un ajuste agregado aquí lo heredan todos sin tener que recordarlo en
dos archivos.

Este módulo solo orquesta la aplicación (settings, urls, arranque);
NO contiene lógica de negocio. La lógica vive en cada módulo de `apps/`.
"""
import os
from pathlib import Path

from dotenv import load_dotenv

# Este archivo vive tres niveles por debajo de la raíz del backend
# (`config` > `settings` > `base.py`), así que el proyecto es `parents[2]`.
# Antes de mover el settings a este paquete, `parent.parent` apuntaba a
# `backend/config/` y el `.env` dejaba de cargarse sin ningún aviso.
BASE_DIR = Path(__file__).resolve().parents[2]

load_dotenv(BASE_DIR / ".env")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    # Módulos del dominio (monolito modular)
    "apps.usuarios",
    "apps.inventario",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "apps.usuarios.middleware.ExpiracionSesionInactividadMiddleware",
    "apps.usuarios.middleware.SesionAutenticadaMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("POSTGRES_DB", "presticad"),
        "USER": os.getenv("POSTGRES_USER", "presticad"),
        "PASSWORD": os.getenv("POSTGRES_PASSWORD", "presticad"),
        "HOST": os.getenv("POSTGRES_HOST", "db"),
        "PORT": os.getenv("POSTGRES_PORT", "5432"),
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "es-pe"
TIME_ZONE = "America/Lima"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"

# Origen público con el que el navegador resuelve los archivos servidos por
# Django. Solo interviene cuando el storage devuelve una ruta relativa: en
# producción Cloudinary ya devuelve una URL absoluta y este valor se ignora.
# Hace falta porque `request.build_absolute_uri()` usaría el Host que le
# reenvía el proxy de Vite (`backend:8000`), que el navegador no puede resolver.
MEDIA_URL_PUBLICA = os.getenv("MEDIA_URL_PUBLICA", "")

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

CSRF_TRUSTED_ORIGINS = [
    o.strip()
    for o in os.getenv(
        "CSRF_TRUSTED_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if o.strip()
]

SESSION_IDLE_TIMEOUT_MINUTES = int(os.getenv("SESSION_IDLE_TIMEOUT_MINUTES", "30"))

# Valores por defecto de los parámetros de reputación de cada material
# (HU04 criterio 3, RN06). Se aplican cuando el gestor no los parametriza al
# registrar el material; son configurables aquí sin tocar el código.
MATERIALES_REPUTACION_DEFAULTS = {
    "tier_minimo_requerido": "estandar",
    "bonificacion_tiempo": 5,
    "deduccion_tardanza": 10,
    "deduccion_dano_parcial": 30,
    "deduccion_dano_total": 60,
}

REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
        "rest_framework.renderers.BrowsableAPIRenderer",
    ],
    "DEFAULT_PARSER_CLASSES": [
        "rest_framework.parsers.JSONParser",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.AllowAny",
    ],
}
