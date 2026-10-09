"""Endpoints del módulo inventario.

Vistas delgadas: validan la petición y delegan la lógica a `services.py`.
"""
from rest_framework import status
from rest_framework.generics import (
    ListAPIView,
    ListCreateAPIView,
    RetrieveUpdateAPIView,
    RetrieveUpdateDestroyAPIView,
)
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.inventario import services
from apps.inventario.models import InstanciaMaterial, Material
from apps.inventario.permissions import EsGestorOAdministrador
from apps.inventario.serializers import (
    InstanciaMaterialModificacionSerializer,
    InstanciaMaterialSerializer,
    MaterialActualizacionSerializer,
    MaterialRegistroSerializer,
    MaterialSerializer,
)

# La foto llega como archivo. El parser global sigue siendo JSON a propósito
# para el resto de la API, así que el multipart se habilita solo en las vistas
# que aceptan imágenes.
PARSERS_CON_ARCHIVOS = [MultiPartParser, FormParser, JSONParser]


class MaterialListCreateView(ListCreateAPIView):
    """Lista los materiales del inventario (GET) y registra uno (POST)."""

    queryset = Material.objects.all().order_by("nombre")
    serializer_class = MaterialSerializer
    permission_classes = [EsGestorOAdministrador]
    parser_classes = PARSERS_CON_ARCHIVOS

    def get_serializer_class(self):
        if self.request.method == "POST":
            return MaterialRegistroSerializer
        return MaterialSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        # 400: el formato de los datos no es válido.
        serializer.is_valid(raise_exception=True)

        try:
            material = services.registrar_material(**serializer.validated_data)
        except services.InventarioError as error:
            # 409: el código de inventario ya existe (no se crea ningún registro).
            return Response(
                {error.campo: [error.mensaje]},
                status=status.HTTP_409_CONFLICT,
            )

        return Response(MaterialSerializer(material).data, status=status.HTTP_201_CREATED)


class MaterialDetailView(RetrieveUpdateAPIView):
    """Consulta un material (GET) y lo edita (PUT/PATCH).

    El cambio de estado viaja como un campo más de la edición: un PATCH con
    solo `estado` es el mecanismo para pasar un material a 'En Mantenimiento'
    (HU04 criterio 8).
    """

    queryset = Material.objects.all()
    serializer_class = MaterialSerializer
    permission_classes = [EsGestorOAdministrador]
    parser_classes = PARSERS_CON_ARCHIVOS

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return MaterialActualizacionSerializer
        return MaterialSerializer

    def update(self, request, *args, **kwargs):
        material = self.get_object()
        serializer = self.get_serializer(
            data=request.data, partial=kwargs.get("partial", False)
        )
        serializer.is_valid(raise_exception=True)

        try:
            material = services.actualizar_material(material.id, **serializer.validated_data)
        except services.InventarioError as error:
            # 409: el código de inventario ya pertenece a otro material.
            codigo_en_uso = error.campo == "codigo_inventario"
            return Response(
                {error.campo: [error.mensaje]},
                status=(
                    status.HTTP_409_CONFLICT
                    if codigo_en_uso
                    else status.HTTP_400_BAD_REQUEST
                ),
            )

        return Response(MaterialSerializer(material).data, status=status.HTTP_200_OK)


class MaterialSearchView(ListAPIView):
    """Búsqueda y consulta de materiales con filtros y visibilidad por Tier (HU05, T05.03).

    GET /api/materiales/buscar/?q=&categoria=&estado=&tier=
    Permite filtrar por nombre parcial (case-insensitive), categoría ('equipo', 'libro', 'objeto')
    y estado ('disponible', 'prestado', 'reservado', 'en_mantenimiento').
    Aplica automáticamente la regla de negocio RN03 según el tier del usuario autenticado.
    """

    serializer_class = MaterialSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        params = self.request.query_params
        q = params.get("q")
        categoria = params.get("categoria") or params.get("tipo")
        estado = params.get("estado")
        tier = params.get("tier")

        usuario = getattr(self.request, "usuario_autenticado", None)
        if usuario is None and hasattr(self.request, "user") and self.request.user.is_authenticated:
            usuario = self.request.user

        return services.buscar_materiales(
            q=q,
            categoria=categoria,
            estado=estado,
            tier_usuario=tier or None,
            usuario=usuario,
        )


class InstanciaMaterialListCreateView(ListCreateAPIView):
    """Lista las instancias de un material (GET) y registra una nueva unidad física (POST)."""

    def get_permissions(self):
        if self.request.method == "POST":
            return [EsGestorOAdministrador()]
        return [AllowAny()]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return InstanciaMaterialModificacionSerializer
        return InstanciaMaterialSerializer

    def get_queryset(self):
        material_id = self.kwargs.get("material_id")
        return services.listar_instancias_material(material_id)

    def create(self, request, *args, **kwargs):
        material_id = self.kwargs.get("material_id")
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            instancia = services.crear_instancia_material(
                material_id, **serializer.validated_data
            )
        except services.InventarioError as error:
            return Response(
                {error.campo: [error.mensaje]},
                status=(
                    status.HTTP_409_CONFLICT
                    if error.campo == "codigo_ejemplar"
                    else status.HTTP_400_BAD_REQUEST
                ),
            )

        return Response(
            InstanciaMaterialSerializer(instancia).data,
            status=status.HTTP_201_CREATED,
        )


class InstanciaMaterialDetailView(RetrieveUpdateDestroyAPIView):
    """Consulta (GET), edita (PATCH/PUT) o elimina (DELETE) una instancia física."""

    queryset = InstanciaMaterial.objects.all()

    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return [EsGestorOAdministrador()]

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return InstanciaMaterialModificacionSerializer
        return InstanciaMaterialSerializer

    def update(self, request, *args, **kwargs):
        instancia = self.get_object()
        serializer = self.get_serializer(
            data=request.data, partial=kwargs.get("partial", False)
        )
        serializer.is_valid(raise_exception=True)

        try:
            instancia = services.actualizar_instancia_material(
                instancia.id, **serializer.validated_data
            )
        except services.InventarioError as error:
            return Response(
                {error.campo: [error.mensaje]},
                status=(
                    status.HTTP_409_CONFLICT
                    if error.campo == "codigo_ejemplar"
                    else status.HTTP_400_BAD_REQUEST
                ),
            )

        return Response(InstanciaMaterialSerializer(instancia).data, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        instancia = self.get_object()
        try:
            services.eliminar_instancia_material(instancia.id)
        except services.InventarioError as error:
            return Response(
                {error.campo: [error.mensaje]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)
