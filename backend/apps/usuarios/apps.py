"""Aplicación de Django del módulo usuarios.

Corresponde al Bounded Context *Identidad y Acceso* (registro, roles,
autenticación y perfil).
"""
from django.apps import AppConfig


class UsuariosConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.usuarios"
    verbose_name = "Usuarios"