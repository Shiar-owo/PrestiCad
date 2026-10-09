"""Rutas del módulo inventario."""
from django.urls import path

from apps.inventario.views import (
    InstanciaMaterialDetailView,
    InstanciaMaterialListCreateView,
    MaterialDetailView,
    MaterialListCreateView,
    MaterialSearchView,
)

urlpatterns = [
    path("materiales/", MaterialListCreateView.as_view(), name="materiales"),
    path("materiales/buscar/", MaterialSearchView.as_view(), name="materiales-buscar"),
    path("materiales/buscar", MaterialSearchView.as_view()),
    path("materiales/<uuid:pk>/", MaterialDetailView.as_view(), name="material-detalle"),
    path(
        "materiales/<uuid:material_id>/instancias/",
        InstanciaMaterialListCreateView.as_view(),
        name="material-instancias",
    ),
    path(
        "instancias/<uuid:pk>/",
        InstanciaMaterialDetailView.as_view(),
        name="instancia-detalle",
    ),
]
