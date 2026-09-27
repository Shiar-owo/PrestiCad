from django.urls import path

from apps.usuarios.views import PerfilUsuarioView, UsuarioListCreateView, UsuarioRolView

urlpatterns = [
    path("", UsuarioListCreateView.as_view(), name="usuarios"),
    path("perfil/", PerfilUsuarioView.as_view(), name="perfil-usuario"),
    path("<int:pk>/rol/", UsuarioRolView.as_view(), name="usuario-rol"),
]
