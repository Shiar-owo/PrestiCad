from django.urls import path

from apps.usuarios.views import (
    PerfilUsuarioView,
    UsuarioEliminarView,
    UsuarioEstadoView,
    UsuarioListCreateView,
    UsuarioRolView,
    PerfilElegibilidadPrestamoView,
)

urlpatterns = [
    path("", UsuarioListCreateView.as_view(), name="usuarios"),
    path("perfil/", PerfilUsuarioView.as_view(), name="perfil-usuario"),
    path("elegibilidad-prestamo/", PerfilElegibilidadPrestamoView.as_view(), name="elegibilidad-prestamo"),
    path("<int:pk>/", UsuarioEliminarView.as_view(), name="usuario-eliminar"),
    path("<int:pk>/rol/", UsuarioRolView.as_view(), name="usuario-rol"),
    path("<int:pk>/estado/", UsuarioEstadoView.as_view(), name="usuario-estado"),
]
