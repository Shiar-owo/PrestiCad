from django.urls import path

from apps.usuarios.views import (
    UsuarioEliminarView,
    UsuarioListCreateView,
    UsuarioRolView,
)

urlpatterns = [
    path("", UsuarioListCreateView.as_view(), name="usuarios"),
    path("<int:pk>/", UsuarioEliminarView.as_view(), name="usuario-eliminar"),
    path("<int:pk>/rol/", UsuarioRolView.as_view(), name="usuario-rol"),
]
