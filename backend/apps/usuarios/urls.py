from django.urls import path

from apps.usuarios.views import UsuarioListCreateView

urlpatterns = [
    path("", UsuarioListCreateView.as_view(), name="usuarios"),
]