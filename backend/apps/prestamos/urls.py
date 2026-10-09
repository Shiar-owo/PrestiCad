from django.urls import path

from apps.prestamos.views import (
    DetallePrestamoParaDevolucionView,
    EstimarDevolucionView,
    HistorialPrestamosView,
    ListarReportesDevolucionView,
    MisPrestamosView,
    RegistrarDevolucionView,
    RegistrarPrestamoView,
    ReporteDevolucionView,
)

urlpatterns = [
    path("prestamos/", RegistrarPrestamoView.as_view(), name="registrar-prestamo"),
    path("prestamos/historial/", HistorialPrestamosView.as_view(), name="historial-prestamos"),
    path("prestamos/mis-prestamos/", MisPrestamosView.as_view(), name="mis-prestamos"),
    path(
        "prestamos/devoluciones/reportes/",
        ListarReportesDevolucionView.as_view(),
        name="reportes-devolucion",
    ),
    path(
        "prestamos/devoluciones/<int:devolucion_id>/reporte/",
        ReporteDevolucionView.as_view(),
        name="reporte-devolucion",
    ),
    path(
        "prestamos/<int:prestamo_id>/devolucion/estimar/",
        EstimarDevolucionView.as_view(),
        name="estimar-devolucion",
    ),
    path(
        "prestamos/<int:prestamo_id>/devolucion/",
        RegistrarDevolucionView.as_view(),
        name="registrar-devolucion",
    ),
    path(
        "prestamos/<int:prestamo_id>/",
        DetallePrestamoParaDevolucionView.as_view(),
        name="detalle-prestamo-devolucion",
    ),
]
