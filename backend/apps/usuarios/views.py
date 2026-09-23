"""Endpoints del módulo usuarios.

Vistas delgadas: validan la petición y delegan la lógica a `services.py`.
"""
from rest_framework import status
from rest_framework.generics import ListCreateAPIView
from rest_framework.response import Response

from apps.usuarios import services
from apps.usuarios.models import Usuario
from apps.usuarios.serializers import UsuarioRegistroSerializer, UsuarioSerializer


class UsuarioListCreateView(ListCreateAPIView):
    """Lista usuarios (GET) y los registra (POST)."""

    queryset = Usuario.objects.all()
    serializer_class = UsuarioSerializer

    def get_serializer_class(self):
        if self.request.method == "POST":
            return UsuarioRegistroSerializer
        return UsuarioSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        # 400: el formato de los datos no es válido.
        serializer.is_valid(raise_exception=True)

        try:
            usuario = services.registrar_usuario(**serializer.validated_data)
        except services.UsuariosError as error:
            # 409: email o DNI ya registrados (no se crea ningún registro).
            return Response(
                {error.campo: [error.mensaje]},
                status=status.HTTP_409_CONFLICT,
            )

        return Response(UsuarioSerializer(usuario).data, status=status.HTTP_201_CREATED)