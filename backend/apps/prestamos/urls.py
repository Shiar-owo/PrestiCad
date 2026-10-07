from django.urls import path

from apps.prestamos.views import RegistrarPrestamoView

urlpatterns = [
    path("prestamos/", RegistrarPrestamoView.as_view(), name="registrar-prestamo"),
]
