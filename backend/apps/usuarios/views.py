"""Endpoints del módulo usuarios.

Vistas delgadas: validan la petición y delegan la lógica a `services.py`.
"""
from rest_framework import status
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateAPIView
from rest_framework.response import Response

from apps.usuarios import services
from apps.usuarios.models import Usuario
from apps.usuarios.serializers import (
    UsuarioSerializer,
    UsuarioRegistroSerializer,
    CambioRolSerializer,
)


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


class UsuarioRolView(RetrieveUpdateAPIView):
    """GET/PATCH /api/usuarios/<id>/rol/ — ver y cambiar el rol (HU02)."""

    queryset = Usuario.objects.all()
    serializer_class = CambioRolSerializer

    def update(self, request, *args, **kwargs):
        usuario = self.get_object()
        nuevo_rol = request.data.get("rol")

        if not nuevo_rol:
            return Response({"detail": "El campo 'rol' es obligatorio."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            usuario_actualizado = services.cambiar_rol_usuario(usuario.id, nuevo_rol)
        except services.RolInvalidoError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except services.UsuarioNoEncontradoError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_404_NOT_FOUND)

        serializer = self.get_serializer(usuario_actualizado)
        return Response(serializer.data, status=status.HTTP_200_OK)