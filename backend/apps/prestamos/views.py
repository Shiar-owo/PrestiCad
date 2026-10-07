from rest_framework import status
from rest_framework.generics import GenericAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.prestamos.constants import ESTADOS_PRESTAMO
from apps.prestamos.consultar_serializers import (
    PrestamoConsultaSerializer,
    PrestamoHistorialSerializer,
)
from apps.prestamos.permissions import (
    EsGestorDeAlmacen,
    EsGestorOAdministrador,
    EsPrestatarioAutenticado,
)
from apps.prestamos.serializers import (
    PrestamoRegistroSerializer,
    RegistrarPrestamoSerializer,
)
from apps.prestamos.services import (
    PrestamoError,
    consultar_historial_prestamos,
    consultar_prestamos_usuario,
    registrar_prestamo,
)


class RegistrarPrestamoView(APIView):
    """Registra la entrega de un material: POST /api/prestamos/."""

    permission_classes = [EsGestorDeAlmacen]

    def post(self, request):
        serializer = RegistrarPrestamoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            prestamo = registrar_prestamo(
                **serializer.validated_data,
                registrado_por=request.usuario_autenticado,
            )
        except PrestamoError as error:
            return Response(
                {error.campo: [error.mensaje]},
                status=error.status_code,
            )

        return Response(
            PrestamoRegistroSerializer(prestamo).data,
            status=status.HTTP_201_CREATED,
        )


class MisPrestamosView(APIView):
    """Devuelve exclusivamente los préstamos del prestatario en sesión."""

    permission_classes = [EsPrestatarioAutenticado]

    def get(self, request):
        prestamos = consultar_prestamos_usuario(request.usuario_autenticado.id)
        return Response(PrestamoConsultaSerializer(prestamos, many=True).data)


class HistorialPrestamosPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 100


class HistorialPrestamosView(GenericAPIView):
    """Consulta paginada del historial global para administrador y gestor."""

    permission_classes = [EsGestorOAdministrador]
    serializer_class = PrestamoHistorialSerializer
    pagination_class = HistorialPrestamosPagination

    def get(self, request):
        estado = request.query_params.get("estado")
        estados_validos = dict(ESTADOS_PRESTAMO)
        if estado is not None and estado not in estados_validos:
            return Response(
                {"estado": ["El estado de préstamo no es válido."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        prestamos = consultar_historial_prestamos(estado=estado)
        pagina = self.paginate_queryset(prestamos)
        serializer = self.get_serializer(pagina, many=True)
        return self.get_paginated_response(serializer.data)
