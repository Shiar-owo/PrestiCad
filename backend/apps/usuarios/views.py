"""Endpoints del módulo usuarios."""
import json

from django.http import JsonResponse
from django.db.models import Count, Exists, OuterRef, Q, Subquery, Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from django.views.decorators.http import require_GET
from rest_framework import status
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateAPIView
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from apps.compartido.pagination import PaginacionEstandar
from apps.compartido.busqueda import expresion_nombre_completo, normalizar_termino
from rest_framework.views import APIView

from apps.usuarios import services
from apps.usuarios.authentication import AutenticacionSesionUsuario
from apps.usuarios.models import TransaccionReputacion, Usuario
from apps.usuarios.permissions import EsAdministrador, EsGestorAlmacen
from apps.usuarios.serializers import (
    ActualizarPerfilSerializer,
    CambioEstadoUsuarioSerializer,
    CambioRolSerializer,
    LoginSerializer,
    PerfilUsuarioSerializer,
    PerfilElegibilidadPrestamoSerializer,
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
            "reputacion_puntaje": usuario.reputacion_puntaje,
            "reputacion_puntos_ganados_semana": services.calcular_puntos_ganados_semana_actual(usuario),
            "reputacion_tope_semanal": services.MAXIMO_PUNTOS_SEMANALES_TIER.get(usuario.reputacion_tier, 60),
            **services.obtener_limites_prestatario(usuario),
            "foto_perfil": usuario.foto_perfil,
        }, context={"request": request}).data)


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
                "reputacion_puntaje": usuario.reputacion_puntaje,
                "reputacion_puntos_ganados_semana": services.calcular_puntos_ganados_semana_actual(usuario),
                "reputacion_tope_semanal": services.MAXIMO_PUNTOS_SEMANALES_TIER.get(usuario.reputacion_tier, 60),
                **services.obtener_limites_prestatario(usuario),
                "foto_perfil": usuario.foto_perfil,
            }, context={"request": request}).data,
        }, status=status.HTTP_200_OK)


class AuthLogoutView(APIView):
    def post(self, request, *args, **kwargs):
        request.session.flush()
        return Response({"mensaje": "Sesión cerrada correctamente."}, status=status.HTTP_200_OK)


class UsuarioListCreateView(ListCreateAPIView):
    queryset = Usuario.objects.select_related("rol").all().order_by("nombre", "apellido", "id")
    pagination_class = PaginacionEstandar

    def get_queryset(self):
        from apps.prestamos.constants import ESTADOS_QUE_OCUPAN_UNIDAD
        from apps.prestamos.models import Prestamo
        from apps.reservas.constants import ESTADOS_ACTIVOS
        from apps.usuarios.services import obtener_inicio_semana_operativa

        ahora = timezone.now()
        puntos_semana = (
            TransaccionReputacion.objects.filter(
                usuario_id=OuterRef("pk"),
                fecha__gte=obtener_inicio_semana_operativa(ahora),
                puntos_delta__gt=0,
            )
            .order_by()
            .values("usuario_id")
            .annotate(total=Sum("puntos_delta"))
            .values("total")[:1]
        )
        prestamos_vencidos_subquery = Prestamo.objects.filter(
            usuario_id=OuterRef("pk"),
        ).filter(
            Q(estado="vencido") | Q(estado="activo", fecha_limite__lt=ahora)
        )
        queryset = super().get_queryset().annotate(
            prestamos_activos_total=Count(
                "prestamos",
                filter=Q(prestamos__estado__in=ESTADOS_QUE_OCUPAN_UNIDAD),
                distinct=True,
            ),
            reservas_activas_total=Count(
                "reservas",
                filter=Q(reservas__estado__in=ESTADOS_ACTIVOS),
                distinct=True,
            ),
            puntos_ganados_semana_total=Coalesce(Subquery(puntos_semana), Value(0)),
            tiene_prestamos_vencidos_flag=Exists(prestamos_vencidos_subquery),
        )
        q = self.request.query_params.get("q", "").strip()
        if q:
            queryset = queryset.annotate(nombre_completo_normalizado=expresion_nombre_completo())
            queryset = queryset.filter(nombre_completo_normalizado__contains=normalizar_termino(q))
        return queryset

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


class PerfilElegibilidadPrestamoView(APIView):
    """GET /api/usuarios/elegibilidad-prestamo/?dni=... para el gestor."""

    permission_classes = [EsGestorAlmacen]

    def get(self, request):
        dni = request.query_params.get("dni", "").strip()
        if len(dni) != 8 or not dni.isdigit():
            return Response({"dni": ["El DNI debe tener exactamente 8 dígitos numéricos."]}, status=400)
        usuario = Usuario.objects.select_related("rol").filter(dni=dni).first()
        if usuario is None:
            return Response({"detail": "No existe un usuario registrado con ese DNI."}, status=404)

        datos = dict(PerfilElegibilidadPrestamoSerializer(usuario).data)
        from apps.prestamos.constants import MAXIMO_PRESTAMOS_ACTIVOS_TIER
        from apps.prestamos.services import contar_prestamos_activos_usuario, tiene_prestamos_vencidos

        datos["prestamos_activos"] = contar_prestamos_activos_usuario(usuario.pk)
        datos["maximo_prestamos_activos"] = MAXIMO_PRESTAMOS_ACTIVOS_TIER.get(usuario.reputacion_tier, 3)
        datos["tiene_prestamos_vencidos"] = tiene_prestamos_vencidos(usuario.pk)
        return Response(datos)


class UsuarioRolView(RetrieveUpdateAPIView):
    queryset = Usuario.objects.select_related("rol").all()
    serializer_class = CambioRolSerializer
    authentication_classes = [AutenticacionSesionUsuario]
    permission_classes = [EsAdministrador]

    def update(self, request, *args, **kwargs):
        usuario = self.get_object()
        if request.user.pk == usuario.pk:
            return Response(
                {"detail": "No puedes cambiar tu propio rol."},
                status=status.HTTP_400_BAD_REQUEST,
            )

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


class UsuarioEstadoView(RetrieveUpdateAPIView):
    """Permite a un administrador activar o desactivar una cuenta de usuario."""

    queryset = Usuario.objects.select_related("rol").all()
    serializer_class = CambioEstadoUsuarioSerializer
    authentication_classes = [AutenticacionSesionUsuario]
    permission_classes = [EsAdministrador]

    def update(self, request, *args, **kwargs):
        usuario = self.get_object()
        if request.user.pk == usuario.pk:
            return Response(
                {"detail": "No puedes cambiar el estado de tu propia cuenta."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            actualizado = services.cambiar_estado_usuario(
                usuario.id,
                serializer.validated_data["estado"],
            )
        except services.EstadoUsuarioInvalidoError as error:
            return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)
        except services.UsuarioNoEncontradoError as error:
            return Response({"detail": str(error)}, status=status.HTTP_404_NOT_FOUND)

        datos = dict(self.get_serializer(actualizado).data)
        datos["tiene_prestamos_activos"] = services.usuario_tiene_prestamos_activos(actualizado.pk)
        return Response(datos, status=status.HTTP_200_OK)


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
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def _usuario_sesion(self, request):
        return getattr(request, "usuario_autenticado", None)

    def get(self, request, *args, **kwargs):
        usuario = self._usuario_sesion(request)
        if usuario is None:
            return Response({"detail": "Debes iniciar sesión para consultar tu perfil."}, status=401)
        return Response(PerfilUsuarioSerializer(services.obtener_perfil(usuario), context={"request": request}).data)

    def put(self, request, *args, **kwargs):
        usuario = self._usuario_sesion(request)
        if usuario is None:
            return Response({"detail": "Debes iniciar sesión para actualizar tu perfil."}, status=401)
        serializer = ActualizarPerfilSerializer(data=request.data, context={"usuario": usuario, "request": request})
        serializer.is_valid(raise_exception=True)
        try:
            actualizado = services.actualizar_perfil(usuario, **serializer.validated_data)
        except services.UsuariosError as error:
            return Response({error.campo: [error.mensaje]}, status=status.HTTP_400_BAD_REQUEST)
        return Response(PerfilUsuarioSerializer(services.obtener_perfil(actualizado), context={"request": request}).data)

    def patch(self, request, *args, **kwargs):
        return self.put(request, *args, **kwargs)
