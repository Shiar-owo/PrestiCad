"""Aplicación de Django del módulo inventario.

Corresponde al Bounded Context *Gestión de Inventario* (alta, edición y
consulta de materiales con sus parámetros de reputación).
"""
from django.apps import AppConfig


class InventarioConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.inventario"
    verbose_name = "Inventario"
