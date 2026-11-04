from django.contrib import admin

from apps.reservas.models import Reserva


@admin.register(Reserva)
class ReservaAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "usuario",
        "material",
        "instancia",
        "estado",
        "es_excepcion",
        "fecha_solicitud",
        "fecha_limite_espera",
        "fecha_limite_recojo",
    )
    list_filter = ("estado", "es_excepcion")
    search_fields = (
        "usuario__dni",
        "usuario__email",
        "usuario__nombre",
        "usuario__apellido",
        "material__nombre",
        "material__codigo_material",
        "instancia__codigo_ejemplar",
    )
