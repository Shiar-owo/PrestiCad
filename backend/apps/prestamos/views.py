from django.http import FileResponse
from rest_framework import status
from rest_framework.generics import GenericAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.prestamos.constants import ESTADOS_PRESTAMO
from apps.prestamos.consultar_serializers import (
    PrestamoDevolucionDetalleSerializer,
    PrestamoConsultaSerializer,
    PrestamoHistorialSerializer,
)
from apps.prestamos.models import Devolucion
from apps.prestamos.permissions import (
    EsGestorDeAlmacen,
    EsGestorOAdministrador,
    EsPrestatarioAutenticado,
)
from apps.prestamos.serializers import (
    ConsultaReportesSerializer,
    DevolucionIngresoSerializer,
    DevolucionResultadoSerializer,
    PrestamoRegistroSerializer,
    RegistrarPrestamoSerializer,
    ReporteDevolucionSerializer,
    url_reporte_publica,
)
from apps.prestamos.services import (
    PrestamoError,
    consultar_historial_prestamos,
    consultar_prestamo_para_devolucion,
    consultar_prestamos_usuario,
    consultar_reportes_devolucion,
    estimar_devolucion,
    registrar_devolucion,
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


def _respuesta_error(error):
    return Response(
        {error.campo: [error.mensaje]},
        status=error.status_code,
    )


def _respuesta_resultado(resultado, prestamo_id, devolucion=None, http_status=200):
    datos = {
        **resultado,
        "prestamo_id": prestamo_id,
    }
    if devolucion is not None:
        datos["devolucion_id"] = devolucion.id
        datos["reporte_url"] = url_reporte_publica(devolucion)
    return Response(
        DevolucionResultadoSerializer(datos).data,
        status=http_status,
    )


class DetallePrestamoParaDevolucionView(APIView):
    """GET /api/prestamos/{id}/ — datos para el formulario de devolución (HU11)."""

    permission_classes = [EsGestorDeAlmacen]

    def get(self, request, prestamo_id):
        try:
            prestamo = consultar_prestamo_para_devolucion(prestamo_id)
        except PrestamoError as error:
            return _respuesta_error(error)
        return Response(PrestamoDevolucionDetalleSerializer(prestamo).data)


class EstimarDevolucionView(APIView):
    """POST /api/prestamos/{id}/devolucion/estimar/ — resumen sin persistir (HU11)."""

    permission_classes = [EsGestorDeAlmacen]

    def post(self, request, prestamo_id):
        serializer = DevolucionIngresoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            resultado = estimar_devolucion(
                prestamo_id=prestamo_id,
                checklist_devolucion=serializer.validated_data["checklist"],
            )
        except PrestamoError as error:
            return _respuesta_error(error)

        return _respuesta_resultado(resultado, prestamo_id)


class RegistrarDevolucionView(APIView):
    """POST /api/prestamos/{id}/devolucion/ — registra y calcula sanciones (HU11)."""

    permission_classes = [EsGestorDeAlmacen]

    def post(self, request, prestamo_id):
        serializer = DevolucionIngresoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            devolucion = registrar_devolucion(
                prestamo_id=prestamo_id,
                checklist_devolucion=serializer.validated_data["checklist"],
                realizado_por=request.usuario_autenticado,
            )
        except PrestamoError as error:
            return _respuesta_error(error)

        return _respuesta_resultado(
            devolucion.resultado,
            prestamo_id,
            devolucion=devolucion,
            http_status=status.HTTP_201_CREATED,
        )


class ReporteDevolucionView(APIView):
    """GET /api/prestamos/devoluciones/{id}/reporte/ — descarga el PDF (RN10)."""

    permission_classes = [EsGestorDeAlmacen]

    def get(self, request, devolucion_id):
        devolucion = Devolucion.objects.filter(pk=devolucion_id).first()
        if devolucion is None:
            return Response(
                {"devolucion_id": ["No existe la devolución indicada."]},
                status=status.HTTP_404_NOT_FOUND,
            )
        if not devolucion.reporte:
            return Response(
                {"reporte": ["Esta devolución no tiene reporte de daños."]},
                status=status.HTTP_404_NOT_FOUND,
            )

        archivo = devolucion.reporte.open("rb")
        respuesta = FileResponse(archivo, content_type="application/pdf")
        respuesta["Content-Disposition"] = (
            f'attachment; filename="reporte-dano-prestamo-{devolucion.prestamo_id}.pdf"'
        )
        return respuesta


class PaginacionReportesDevolucion(PageNumberPagination):
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 100


class ListarReportesDevolucionView(GenericAPIView):
    """GET /api/prestamos/devoluciones/reportes/ — consulta paginada (RN10)."""

    permission_classes = [EsGestorOAdministrador]
    serializer_class = ReporteDevolucionSerializer
    pagination_class = PaginacionReportesDevolucion

    def get(self, request):
        parametros = {
            clave: valor
            for clave, valor in request.query_params.items()
            if clave not in ("page", "page_size")
        }
        consulta = ConsultaReportesSerializer(data=parametros)
        consulta.is_valid(raise_exception=True)

        reportes = consultar_reportes_devolucion(**consulta.validated_data)
        pagina = self.paginate_queryset(reportes)
        serializer = self.get_serializer(pagina, many=True)
        return self.get_paginated_response(serializer.data)
