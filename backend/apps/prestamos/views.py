from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.prestamos.permissions import EsGestorDeAlmacen
from apps.prestamos.serializers import (
    PrestamoRegistroSerializer,
    RegistrarPrestamoSerializer,
)
from apps.prestamos.services import PrestamoError, registrar_prestamo


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
