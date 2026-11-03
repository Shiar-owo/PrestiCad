from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.reservas.permissions import (
    EsGestorDeAlmacen,
    EsGestorOAdministrador,
    EsPrestatarioAutenticado,
)
from apps.reservas.serializers import (
    ColaMaterialSerializer,
    CrearReservaSerializer,
    MotivoAccionReservaSerializer,
    ReservaDetalleSerializer,
)
from apps.reservas.services import (
    ReservaError,
    cancelar_reserva,
    consultar_cola_material,
    consultar_mis_reservas,
    consultar_reservas_confirmadas,
    crear_reserva,
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

    permission_classes = [EsGestorDeAlmacen]

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
