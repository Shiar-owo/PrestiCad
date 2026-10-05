"""Endpoints del módulo usuarios."""
import json

from django.http import JsonResponse
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from django.views.decorators.http import require_GET
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
    ActualizarPerfilSerializer,
    CambioRolSerializer,
    LoginSerializer,
    PerfilUsuarioSerializer,
    SesionUsuarioSerializer,
    UsuarioListaSerializer,
    UsuarioRegistroSerializer,
    UsuarioSerializer,
)
from apps.usuarios.sesiones import registrar_sesion_activa


@ensure_csrf_cookie
@require_GET
def csrf_token(request):
    return JsonResponse({"detalle": "Token CSRF preparado."})


class SesionActualView(APIView):
    authentication_classes = [AutenticacionSesionUsuario]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        usuario = request.user
        return Response(SesionUsuarioSerializer({
            "id": usuario.id,
            "nombre": usuario.nombre,
            "apellido": usuario.apellido,
            "email": usuario.email,
            "rol": usuario.rol.nombre,
            "estado": usuario.estado,
            "reputacion_tier": usuario.reputacion_tier,
        }).data)


@method_decorator(ensure_csrf_cookie, name="dispatch")
class AuthLoginView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            usuario = services.autenticar_usuario(**serializer.validated_data)
        except services.UsuariosError as error:
            if error.mensaje == "La cuenta está bloqueada temporalmente.":
                return Response({"detail": error.mensaje}, status=status.HTTP_423_LOCKED)
            return Response(
                {"detail": "Email o contraseña incorrectos"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        request.session.cycle_key()
        registrar_sesion_activa(request.session, usuario.id)
        return Response({
            "mensaje": "Sesión iniciada correctamente.",
            "usuario": SesionUsuarioSerializer({
                "id": usuario.id,
                "nombre": usuario.nombre,
                "apellido": usuario.apellido,
                "email": usuario.email,
                "rol": usuario.rol.nombre,
                "estado": usuario.estado,
                "reputacion_tier": usuario.reputacion_tier,
            }).data,
        }, status=status.HTTP_200_OK)


class AuthLogoutView(APIView):
    def post(self, request, *args, **kwargs):
        request.session.flush()
        return Response({"mensaje": "Sesión cerrada correctamente."}, status=status.HTTP_200_OK)


class UsuarioListCreateView(ListCreateAPIView):
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
            return Response({error.campo: [error.mensaje]}, status=status.HTTP_409_CONFLICT)
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
        try:
            actualizado = services.cambiar_rol_usuario(
                usuario.id,
                serializer.validated_data["rol"].nombre,
            )
        except services.RolInvalidoError as error:
            return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)
        except services.UsuarioNoEncontradoError as error:
            return Response({"detail": str(error)}, status=status.HTTP_404_NOT_FOUND)
        return Response(self.get_serializer(actualizado).data, status=status.HTTP_200_OK)


class UsuarioEliminarView(APIView):
    authentication_classes = [AutenticacionSesionUsuario]
    permission_classes = [EsAdministrador]

    def delete(self, request, pk):
        usuario = services.obtener_usuario_por_id(pk)
        if usuario is None:
            return Response({"detail": "No existe el usuario solicitado."}, status=status.HTTP_404_NOT_FOUND)
        if services.usuario_tiene_prestamos_activos(usuario.pk):
            return Response(
                {"detail": "No se puede eliminar un usuario con préstamos activos."},
                status=status.HTTP_409_CONFLICT,
            )
        usuario.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@method_decorator(csrf_protect, name="dispatch")
@method_decorator(ensure_csrf_cookie, name="dispatch")
class PerfilUsuarioView(APIView):
    authentication_classes = []
    permission_classes = []

    def _usuario_sesion(self, request):
        return getattr(request, "usuario_autenticado", None)

    def get(self, request, *args, **kwargs):
        usuario = self._usuario_sesion(request)
        if usuario is None:
            return Response({"detail": "Debes iniciar sesión para consultar tu perfil."}, status=401)
        return Response(PerfilUsuarioSerializer(services.obtener_perfil(usuario)).data)

    def put(self, request, *args, **kwargs):
        usuario = self._usuario_sesion(request)
        if usuario is None:
            return Response({"detail": "Debes iniciar sesión para actualizar tu perfil."}, status=401)
        serializer = ActualizarPerfilSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        actualizado = services.actualizar_perfil(usuario, **serializer.validated_data)
        return Response(PerfilUsuarioSerializer(services.obtener_perfil(actualizado)).data)
