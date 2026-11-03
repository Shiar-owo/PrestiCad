from django.urls import path

from apps.reservas.views import (
    CancelarReservaView,
    ColaMaterialView,
    CrearReservaView,
    MisReservasView,
    RechazarReservaView,
    ReservasConfirmadasView,
)

urlpatterns = [
    path("reservas/", CrearReservaView.as_view(), name="crear-reserva"),
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

