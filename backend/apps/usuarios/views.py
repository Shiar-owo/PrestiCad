"""Endpoints del módulo usuarios y autenticación por sesión."""
import json

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST
from rest_framework import status
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.usuarios import services
from apps.usuarios.authentication import AutenticacionSesionUsuario
from apps.usuarios.models import Usuario
from apps.usuarios.permissions import EsAdministrador
from apps.usuarios.serializers import (
    CambioRolSerializer,
    UsuarioListaSerializer,
    UsuarioRegistroSerializer,
    UsuarioSerializer,
)


@ensure_csrf_cookie
@require_GET
def csrf_token(request):
    return JsonResponse({"detalle": "Token CSRF preparado."})


@csrf_protect
@require_POST
def iniciar_sesion(request):
    try:
        datos = json.loads(request.body or "{}")
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse({"detail": "La solicitud no contiene JSON válido."}, status=400)

    email = datos.get("email", "")
    contrasena = datos.get("password", "")
    if not isinstance(email, str) or not isinstance(contrasena, str) or not email or not contrasena:
        return JsonResponse({"detail": "El email y la contraseña son obligatorios."}, status=400)

    try:
        usuario = services.autenticar_usuario(email, contrasena)
    except services.CredencialesInvalidasError:
        return JsonResponse({"detail": "Email o contraseña incorrectos."}, status=400)

    request.session.cycle_key()
    request.session["usuario_id"] = usuario.pk
    request.session.set_expiry(1800)
    return JsonResponse({"usuario": UsuarioListaSerializer(usuario).data})


@csrf_protect
@require_POST
def cerrar_sesion(request):
    request.session.flush()
    return JsonResponse({"detalle": "Sesión cerrada correctamente."})


class SesionActualView(APIView):
    authentication_classes = [AutenticacionSesionUsuario]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UsuarioListaSerializer(request.user).data)


class UsuarioListCreateView(ListCreateAPIView):
    """Lista usuarios para administradores y permite el registro público."""

    queryset = Usuario.objects.select_related("rol").all()

    def get_serializer_class(self):
        if self.request.method == "POST":
            return UsuarioRegistroSerializer
        return UsuarioListaSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [AllowAny()]
        return [EsAdministrador()]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            usuario = services.registrar_usuario(**serializer.validated_data)
        except services.UsuariosError as error:
            return Response(
                {error.campo: [error.mensaje]},
                status=status.HTTP_409_CONFLICT,
            )
        return Response(UsuarioSerializer(usuario).data, status=status.HTTP_201_CREATED)


class UsuarioRolView(RetrieveUpdateAPIView):
    queryset = Usuario.objects.select_related("rol").all()
    serializer_class = CambioRolSerializer
    authentication_classes = [AutenticacionSesionUsuario]
    permission_classes = [EsAdministrador]

    def update(self, request, *args, **kwargs):
        usuario = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        nuevo_rol = serializer.validated_data["rol"].nombre
        try:
            usuario_actualizado = services.cambiar_rol_usuario(usuario.id, nuevo_rol)
        except services.RolInvalidoError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except services.UsuarioNoEncontradoError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_404_NOT_FOUND)
        return Response(self.get_serializer(usuario_actualizado).data)


class UsuarioEliminarView(APIView):
    authentication_classes = [AutenticacionSesionUsuario]
    permission_classes = [EsAdministrador]

    def delete(self, request, pk):
        usuario = services.obtener_usuario_por_id(pk)
        if usuario is None:
            return Response({"detail": "No existe el usuario solicitado."}, status=404)
        if services.usuario_tiene_prestamos_activos(usuario.pk):
            return Response(
                {"detail": "No se puede eliminar un usuario con préstamos activos."},
                status=status.HTTP_409_CONFLICT,
            )
        usuario.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
