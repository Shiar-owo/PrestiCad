"""Rutas del módulo inventario."""
from django.urls import path

from apps.inventario.views import MaterialDetailView, MaterialListCreateView

urlpatterns = [
    path("materiales/", MaterialListCreateView.as_view(), name="materiales"),
    path("materiales/<uuid:pk>/", MaterialDetailView.as_view(), name="material-detalle"),
]
