from django.urls import path

from apps.prestamos.views import MisPrestamosView, RegistrarPrestamoView

urlpatterns = [
    path("prestamos/", RegistrarPrestamoView.as_view(), name="registrar-prestamo"),
    path("prestamos/mis-prestamos/", MisPrestamosView.as_view(), name="mis-prestamos"),
]
