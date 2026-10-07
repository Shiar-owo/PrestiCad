from django.urls import path

from apps.prestamos.views import (
    HistorialPrestamosView,
    MisPrestamosView,
    RegistrarPrestamoView,
)

urlpatterns = [
    path("prestamos/", RegistrarPrestamoView.as_view(), name="registrar-prestamo"),
    path("prestamos/historial/", HistorialPrestamosView.as_view(), name="historial-prestamos"),
    path("prestamos/mis-prestamos/", MisPrestamosView.as_view(), name="mis-prestamos"),
]
