from django.urls import path

from apps.usuarios.views import UsuarioListCreateView,  UsuarioRolView

urlpatterns = [
    path("", UsuarioListCreateView.as_view(), name="usuarios"),
    path("<int:pk>/rol/", UsuarioRolView.as_view(), name="usuario-rol"),
]