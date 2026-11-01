"""Endpoints del módulo inventario.

Vistas delgadas: validan la petición y delegan la lógica a `services.py`.
"""
from rest_framework import status
from rest_framework.generics import (
    ListAPIView,
    ListCreateAPIView,
    RetrieveUpdateDestroyAPIView,
)
import json
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.inventario import services
from apps.inventario.models import InstanciaMaterial, Material
from apps.inventario.permissions import EsGestorOAdministrador
from apps.inventario.serializers import (
    InstanciaMaterialCreacionSerializer,
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
        if request.content_type and request.content_type.startswith("multipart/"):
            # Copia superficial: `QueryDict.copy()` intenta copiar en
            # profundidad los archivos subidos y falla con sus streams.
            datos = {clave: valor for clave, valor in request.data.items()}
            filas = datos.get("instancias")
            if filas:
                try:
                    filas = json.loads(filas)
                except (TypeError, ValueError):
                    return Response(
                        {"instancias": "Las filas de ejemplares deben ser JSON válido."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                if isinstance(filas, list):
                    for indice, fila in enumerate(filas):
                        archivo = request.FILES.get(f"instancia_foto_{indice}")
                        if archivo is not None and isinstance(fila, dict):
                            fila["foto"] = archivo
                        datos.pop(f"instancia_foto_{indice}", None)
                    datos["instancias"] = filas
        else:
            datos = request.data
        serializer = self.get_serializer(data=datos)
        # 400: el formato de los datos no es válido.
        serializer.is_valid(raise_exception=True)

        try:
            material = services.registrar_material(**serializer.validated_data)
        except services.InventarioError as error:
            respuesta = {error.campo: [error.mensaje]}
            if getattr(error, "indice", None) is not None:
                respuesta["indice"] = error.indice
            return Response(
                respuesta,
                status=error.status_code,
            )
        except DjangoValidationError as error:
            return Response(
                error.message_dict if hasattr(error, "message_dict") else {"foto": error.messages},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(MaterialSerializer(material).data, status=status.HTTP_201_CREATED)


class MaterialDetailView(RetrieveUpdateDestroyAPIView):
    """Consulta, edita o elimina un material y sus ejemplares.

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
            # 409: el Código de Material ya pertenece a otro material.
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

    def destroy(self, request, *args, **kwargs):
        material = self.get_object()
        try:
            services.eliminar_material(material.id)
        except services.InventarioError as error:
            return Response(
                {error.campo: [error.mensaje]},
                status=error.status_code,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


class MaterialSearchView(ListAPIView):
    """Búsqueda y consulta de materiales con filtros (HU05, T05.03).

    GET /api/materiales/buscar/?q=&categoria=&estado=
    Permite filtrar por nombre parcial (case-insensitive), categoría ('equipo', 'libro', 'objeto')
    y estado ('disponible', 'prestado', 'reservado', 'en_mantenimiento').
    """

    serializer_class = MaterialSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        params = self.request.query_params
        q = params.get("q")
        categoria = params.get("categoria") or params.get("tipo")
        estado = params.get("estado")

        return services.buscar_materiales(
            q=q,
            categoria=categoria,
            estado=estado,
        )


class InstanciaMaterialListCreateView(ListCreateAPIView):
    """Lista las instancias de un material (GET) y registra una nueva unidad física (POST)."""

    parser_classes = PARSERS_CON_ARCHIVOS

    def get_permissions(self):
        if self.request.method == "POST":
            return [EsGestorOAdministrador()]
        return [AllowAny()]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return InstanciaMaterialCreacionSerializer
        return InstanciaMaterialSerializer

    def get_queryset(self):
        material_id = self.kwargs.get("material_id")
        estado = self.request.query_params.get("estado")
        try:
            return services.listar_instancias_material(material_id, estado=estado)
        except services.InventarioError as error:
            raise ValidationError({error.campo: [error.mensaje]}) from error

    def create(self, request, *args, **kwargs):
        material_id = self.kwargs.get("material_id")
        filas_recibidas = "instancias" in request.data
        if filas_recibidas:
            filas = request.data.get("instancias")
            if isinstance(filas, str):
                try:
                    filas = json.loads(filas)
                except (TypeError, ValueError):
                    return Response(
                        {"instancias": ["Las filas de ejemplares deben ser JSON válido."]},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            if not isinstance(filas, list):
                return Response(
                    {"instancias": ["Envía una lista de ejemplares válida."]},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if not 1 <= len(filas) <= services.MAXIMO_EJEMPLARES_REGISTRO:
                return Response(
                    {
                        "instancias": [
                            f"Registra entre 1 y {services.MAXIMO_EJEMPLARES_REGISTRO} ejemplares."
                        ]
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            filas = [dict(fila) if isinstance(fila, dict) else fila for fila in filas]
            for indice, fila in enumerate(filas):
                if isinstance(fila, dict):
                    foto = request.FILES.get(f"instancia_foto_{indice}")
                    if foto:
                        fila["foto"] = foto
            filas_validadas = []
            errores_por_fila = []
            for fila in filas:
                serializer = self.get_serializer(data=fila)
                if serializer.is_valid():
                    filas_validadas.append(serializer.validated_data)
                    errores_por_fila.append({})
                else:
                    filas_validadas.append(None)
                    errores_por_fila.append(serializer.errors)
            if any(errores_por_fila):
                return Response(
                    {"instancias": errores_por_fila},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)

        try:
            if filas_recibidas:
                instancias = services.crear_instancias_material(
                    material_id, filas_validadas
                )
            else:
                instancia = services.crear_instancia_material(
                    material_id, **serializer.validated_data
                )
        except services.InventarioError as error:
            if filas_recibidas and error.indice is not None:
                return Response(
                    {
                        "indice": error.indice,
                        "campo": error.campo,
                        "mensaje": error.mensaje,
                    },
                    status=error.status_code,
                )
            return Response(
                {error.campo: [error.mensaje]},
                status=error.status_code,
            )

        if filas_recibidas:
            return Response(
                InstanciaMaterialSerializer(instancias, many=True).data,
                status=status.HTTP_201_CREATED,
            )
        return Response(
            InstanciaMaterialSerializer(instancia).data,
            status=status.HTTP_201_CREATED,
        )


class InstanciaMaterialDetailView(RetrieveUpdateDestroyAPIView):
    """Consulta (GET), edita (PATCH/PUT) o elimina (DELETE) una instancia física."""

    queryset = InstanciaMaterial.objects.all()
    parser_classes = PARSERS_CON_ARCHIVOS

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
                    if error.campo == "codigo_ejemplar" or error.status_code == 409
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
                status=error.status_code,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)
