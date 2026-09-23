"""Endpoints del módulo usuarios.

Vistas delgadas: validan la petición y delegan la lógica a `services.py`.
"""
from rest_framework import status
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateAPIView
from rest_framework.response import Response

from apps.usuarios import services
from apps.usuarios.models import Usuario
from apps.usuarios.serializers import UsuarioSerializer, CambioRolSerializer

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

class UsuarioRolView(RetrieveUpdateAPIView):
    """GET/PATCH /api/usuarios/<id>/rol/ — ver y cambiar el rol (HU02)."""

    queryset = Usuario.objects.all()
    serializer_class = CambioRolSerializer

    def update(self, request, *args, **kwargs):
        usuario = self.get_object()
        nuevo_rol = request.data.get("rol")

        if not nuevo_rol:
            return Response({"detail": "El campo 'rol' es obl   igatorio."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            usuario_actualizado = services.cambiar_rol_usuario(usuario.id, nuevo_rol)
        except services.RolInvalidoError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except services.UsuarioNoEncontradoError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_404_NOT_FOUND)

        serializer = self.get_serializer(usuario_actualizado)
        return Response(serializer.data, status=status.HTTP_200_OK)