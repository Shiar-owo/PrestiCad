"""Endpoints del módulo inventario.

Vistas delgadas: validan la petición y delegan la lógica a `services.py`.
"""
from rest_framework import status
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateAPIView
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from apps.inventario import services
from apps.inventario.models import Material
from apps.inventario.permissions import EsGestorOAdministrador
from apps.inventario.serializers import (
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
