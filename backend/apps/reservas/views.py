from django.http import FileResponse, HttpResponseRedirect
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.reservas.permissions import (
    EsGestorDeAlmacen,
    EsGestorOAdministrador,
    EsGestorOPrestatarioTitularReserva,
    EsPrestatarioAutenticado,
)
from apps.reservas.serializers import (
    ColaMaterialSerializer,
    CrearReservaExcepcionalSerializer,
    CrearReservaSerializer,
    MotivoAccionReservaSerializer,
    ReservaDetalleSerializer,
)
from apps.reservas.services import (
    ReservaError,
    aprobar_excepcion,
    cancelar_reserva,
    consultar_cola_material,
    consultar_mis_reservas,
    consultar_reservas_confirmadas,
    crear_reserva,
    crear_reserva_excepcional,
    obtener_documento_garantia_reserva,
    rechazar_reserva,
)


class CrearReservaView(APIView):
    """Registra una solicitud de reserva normal o en lista de espera: POST /api/reservas/."""

    permission_classes = [EsPrestatarioAutenticado]
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    def post(self, request):
        serializer = CrearReservaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            reserva = crear_reserva(
                usuario=request.usuario_autenticado,
                **serializer.validated_data,
            )
        except ReservaError as error:
            return Response(
                {error.campo: [error.mensaje]},
                status=error.status_code,
            )

        return Response(
            ReservaDetalleSerializer(reserva).data,
            status=status.HTTP_201_CREATED,
        )


class CrearReservaExcepcionalView(APIView):
    """Registra una solicitud de reserva excepcional con garantía: POST /api/reservas/excepcion/."""

    permission_classes = [EsPrestatarioAutenticado]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        serializer = CrearReservaExcepcionalSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            reserva = crear_reserva_excepcional(
                usuario=request.usuario_autenticado,
                **serializer.validated_data,
            )
        except ReservaError as error:
            return Response(
                {error.campo: [error.mensaje]},
                status=error.status_code,
            )

        return Response(
            ReservaDetalleSerializer(reserva).data,
            status=status.HTTP_201_CREATED,
        )


class AprobarExcepcionReservaView(APIView):
    """Aprueba una solicitud excepcional en espera: POST/PUT /api/reservas/<uuid:id>/aprobar-excepcion/."""

    permission_classes = [EsGestorDeAlmacen]
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    def _aprobar(self, request, id):
        try:
            reserva = aprobar_excepcion(
                reserva_id=id,
                realizado_por=request.usuario_autenticado,
            )
        except ReservaError as error:
            return Response(
                {error.campo: [error.mensaje]},
                status=error.status_code,
            )

        return Response(ReservaDetalleSerializer(reserva).data)

    def post(self, request, id):
        return self._aprobar(request, id)

    def put(self, request, id):
        return self._aprobar(request, id)


class DescargarDocumentoGarantiaReservaView(APIView):
    """Descarga protegida del PDF de garantía de una reserva excepcional: GET /api/reservas/<uuid:id>/garantia/<str:tipo>/."""

    permission_classes = [EsGestorOPrestatarioTitularReserva]

    def get(self, request, id, tipo):
        try:
            documento, nombre = obtener_documento_garantia_reserva(id, tipo)
        except ReservaError as error:
            return Response(
                {error.campo: [error.mensaje]},
                status=error.status_code,
            )

        try:
            url = documento.url
        except ValueError:
            url = None

        if url and url.startswith(("http://", "https://")):
            return HttpResponseRedirect(url)

        try:
            archivo = documento.open("rb")
        except (FileNotFoundError, OSError):
            return Response(
                {"detail": "El archivo del documento de garantía no existe."},
                status=status.HTTP_404_NOT_FOUND,
            )
        respuesta = FileResponse(archivo, content_type="application/pdf")
        respuesta["Content-Disposition"] = f'inline; filename="{nombre}"'
        return respuesta


class MisReservasView(APIView):
    """Lista las reservas y solicitudes en espera del prestatario autenticado: GET /api/reservas/mis-reservas/."""

    permission_classes = [EsPrestatarioAutenticado]

    def get(self, request):
        reservas = consultar_mis_reservas(request.usuario_autenticado.id)
        return Response(ReservaDetalleSerializer(reservas, many=True).data)


class ColaMaterialView(APIView):
    """Devuelve la cola de espera, reservas confirmadas y ejemplares libres del material: GET /api/reservas/cola/<uuid:material_id>/."""

    permission_classes = [EsGestorOAdministrador]

    def get(self, request, material_id):
        try:
            cola = consultar_cola_material(material_id)
        except ReservaError as error:
            return Response(
                {error.campo: [error.mensaje]},
                status=error.status_code,
            )

        return Response(ColaMaterialSerializer(cola).data)


class ReservasConfirmadasView(APIView):
    """Lista las reservas confirmadas vigentes para convertirlas en préstamo: GET /api/reservas/confirmadas/?dni=..."""

    permission_classes = [EsGestorOAdministrador]

    def get(self, request):
        dni = request.query_params.get("dni", "")
        reservas = consultar_reservas_confirmadas(dni=dni)
        return Response(ReservaDetalleSerializer(reservas, many=True).data)


class CancelarReservaView(APIView):
    """Cancela manualmente una reserva confirmada: POST /api/reservas/<uuid:id>/cancelar/."""

    permission_classes = [EsGestorDeAlmacen]
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    def post(self, request, id):
        serializer = MotivoAccionReservaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            reserva = cancelar_reserva(
                reserva_id=id,
                motivo=serializer.validated_data["motivo"],
                realizado_por=request.usuario_autenticado,
            )
        except ReservaError as error:
            return Response(
                {error.campo: [error.mensaje]},
                status=error.status_code,
            )

        return Response(ReservaDetalleSerializer(reserva).data)


class RechazarReservaView(APIView):
    """Rechaza una solicitud en espera indicando el motivo: POST /api/reservas/<uuid:id>/rechazar/."""

    permission_classes = [EsGestorDeAlmacen]
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    def post(self, request, id):
        serializer = MotivoAccionReservaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            reserva = rechazar_reserva(
                reserva_id=id,
                motivo=serializer.validated_data["motivo"],
                realizado_por=request.usuario_autenticado,
            )
        except ReservaError as error:
            return Response(
                {error.campo: [error.mensaje]},
                status=error.status_code,
            )

        return Response(ReservaDetalleSerializer(reserva).data)
