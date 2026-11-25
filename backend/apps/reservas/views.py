from django.http import FileResponse, HttpResponseRedirect
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.reservas.permissions import (
    EsAdministradorReservas,
    EsGestorDeAlmacen,
    EsGestorOAdministrador,
    EsGestorOPrestatarioTitularReserva,
    EsPrestatarioAutenticado,
)
from apps.reservas.serializers import (
    ColaMaterialSerializer,
    CrearDiaNoLaborableSerializer,
    CrearReservaExcepcionalSerializer,
    CrearReservaSerializer,
    DiaNoLaborableSerializer,
    MotivoAccionReservaSerializer,
    ReservaDetalleSerializer,
)
from apps.reservas.services import (
    ReservaError,
    aprobar_excepcion,
    cancelar_reserva,
    consultar_cola_general,
    consultar_cola_material,
    consultar_mis_reservas,
    consultar_reservas_confirmadas,
    crear_dia_no_laborable,
    eliminar_dia_no_laborable,
    listar_dias_no_laborables,
    obtener_reserva_confirmada_para_conversion,
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

    permission_classes = [EsGestorOAdministrador]
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
    """Devuelve la cola de espera, reservas confirmadas y ejemplares libres (del material o general): GET /api/reservas/cola/ o /api/reservas/cola/<uuid:material_id>/."""

    permission_classes = [EsGestorOAdministrador]

    def get(self, request, material_id=None):
        try:
            if material_id:
                cola = consultar_cola_material(material_id)
            else:
                cola = consultar_cola_general()
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


class ReservaConfirmadaConversionView(APIView):
    """Obtiene una reserva vigente para precargar y convertir en préstamo."""

    permission_classes = [EsGestorOAdministrador]

    def get(self, request, id):
        reserva = obtener_reserva_confirmada_para_conversion(id)
        if reserva is None:
            return Response(
                {"detail": "La reserva ya no está vigente o no tiene un ejemplar asignado para entregar."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(ReservaDetalleSerializer(reserva).data)


class CancelarReservaView(APIView):
    """Cancela una reserva activa (el gestor o el titular): POST /api/reservas/<uuid:id>/cancelar/."""

    permission_classes = [EsGestorOPrestatarioTitularReserva]
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    def post(self, request, id):
        serializer = MotivoAccionReservaSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)

        try:
            motivo = serializer.validated_data.get("motivo") or "Cancelada por el prestatario."
            reserva = cancelar_reserva(
                reserva_id=id,
                motivo=motivo,
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

    permission_classes = [EsGestorOAdministrador]
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


class DisponibilidadMaterialView(APIView):
    """Consulta la disponibilidad de un material en un rango de fechas para el calendario: GET /api/materiales/<id>/disponibilidad/."""

    permission_classes = []

    def get(self, request, material_id):
        from apps.inventario.models import Material
        from apps.reservas.disponibilidad import consultar_disponibilidad_calendario

        desde = request.query_params.get("desde")
        hasta = request.query_params.get("hasta")
        usuario = getattr(request, "usuario_autenticado", None)
        rol = getattr(getattr(usuario, "rol", None), "nombre", None)
        incluir_prestatario = rol in ("gestor", "administrador")
        try:
            datos = consultar_disponibilidad_calendario(
                material_id,
                desde=desde,
                hasta=hasta,
                incluir_prestatario=incluir_prestatario,
            )
            return Response(datos, status=status.HTTP_200_OK)
        except Material.DoesNotExist:
            return Response(
                {"detail": "No existe el material indicado."},
                status=status.HTTP_404_NOT_FOUND,
            )
        except ValueError as error:
            return Response(
                {"detail": f"Formato de fecha inválido: {error}"},
                status=status.HTTP_400_BAD_REQUEST,
            )


class DiasNoLaborablesListCreateView(APIView):
    """Consulta abierta y registro administrativo de días no laborables: /api/dias-no-laborables/."""

    parser_classes = [JSONParser, FormParser]

    def get_permissions(self):
        if self.request.method == "POST":
            return [EsAdministradorReservas()]
        return []

    def get(self, request):
        from datetime import datetime

        desde_str = request.query_params.get("desde")
        hasta_str = request.query_params.get("hasta")
        try:
            desde = datetime.strptime(desde_str, "%Y-%m-%d").date() if desde_str else None
            hasta = datetime.strptime(hasta_str, "%Y-%m-%d").date() if hasta_str else None
        except ValueError as error:
            return Response(
                {"detail": f"Formato de fecha inválido: {error}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        dias = listar_dias_no_laborables(desde=desde, hasta=hasta)
        return Response(DiaNoLaborableSerializer(dias, many=True).data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = CrearDiaNoLaborableSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            registro, reservas_afectadas = crear_dia_no_laborable(
                fecha=serializer.validated_data["fecha"],
                motivo=serializer.validated_data["motivo"],
                creado_por=request.usuario_autenticado,
            )
        except ReservaError as error:
            return Response({error.campo: [error.mensaje]}, status=error.status_code)

        datos = dict(DiaNoLaborableSerializer(registro).data)
        datos["reservas_afectadas"] = reservas_afectadas
        return Response(datos, status=status.HTTP_201_CREATED)


class DiaNoLaborableDetailView(APIView):
    """Rehabilita un día no laborable: DELETE /api/dias-no-laborables/<int:dia_id>/."""

    permission_classes = [EsAdministradorReservas]

    def delete(self, request, dia_id):
        try:
            eliminar_dia_no_laborable(dia_id)
        except ReservaError as error:
            return Response({error.campo: [error.mensaje]}, status=error.status_code)
        return Response(status=status.HTTP_204_NO_CONTENT)
