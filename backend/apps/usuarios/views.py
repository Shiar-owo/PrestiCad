"""Endpoints del módulo usuarios.

Vistas delgadas: validan la petición y delegan la lógica a `services.py`.
"""
from rest_framework import status
from rest_framework.generics import ListCreateAPIView
from rest_framework.response import Response

from apps.usuarios.models import Usuario
from apps.usuarios.serializers import UsuarioSerializer


class UsuarioListCreateView(ListCreateAPIView):
    """Lista y crea usuarios."""

    queryset = Usuario.objects.all()
    serializer_class = UsuarioSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        # TODO: delegar la creación transaccional al servicio del módulo.
        self.perform_create(serializer)
        return Response(serializer.data, status=status.HTTP_201_CREATED)