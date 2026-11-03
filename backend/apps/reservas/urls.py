from django.urls import path

from apps.reservas.views import (
    AprobarExcepcionReservaView,
    CancelarReservaView,
    ColaMaterialView,
    CrearReservaExcepcionalView,
    CrearReservaView,
    DescargarDocumentoGarantiaReservaView,
    MisReservasView,
    RechazarReservaView,
    ReservasConfirmadasView,
)

urlpatterns = [
    path("reservas/", CrearReservaView.as_view(), name="crear-reserva"),
    path(
        "reservas/excepcion/",
        CrearReservaExcepcionalView.as_view(),
        name="crear-reserva-excepcion",
    ),
    path("reservas/mis-reservas/", MisReservasView.as_view(), name="mis-reservas"),
    path(
        "reservas/cola/<uuid:material_id>/",
        ColaMaterialView.as_view(),
        name="cola-reservas-material",
    ),
    path(
        "reservas/confirmadas/",
        ReservasConfirmadasView.as_view(),
        name="reservas-confirmadas",
    ),
    path(
        "reservas/<uuid:id>/aprobar-excepcion/",
        AprobarExcepcionReservaView.as_view(),
        name="aprobar-excepcion-reserva",
    ),
    path(
        "reservas/<uuid:id>/garantia/<str:tipo>/",
        DescargarDocumentoGarantiaReservaView.as_view(),
        name="descargar-documento-garantia-reserva",
    ),
    path(
        "reservas/<uuid:id>/cancelar/",
        CancelarReservaView.as_view(),
        name="cancelar-reserva",
    ),
    path(
        "reservas/<uuid:id>/rechazar/",
        RechazarReservaView.as_view(),
        name="rechazar-reserva",
    ),
]

