from django.contrib import admin

from apps.usuarios import services
from apps.usuarios.models import Credencial, TransaccionReputacion, Usuario


@admin.register(Usuario)
class UsuarioAdmin(admin.ModelAdmin):
    list_display = ("nombre", "apellido", "email", "dni", "facultad", "departamento_carrera", "tipo", "rol", "estado", "reputacion_tier")
    list_filter = ("tipo", "rol", "estado", "reputacion_tier", "facultad")
    search_fields = ("nombre", "apellido", "email", "dni", "facultad", "departamento_carrera")

    def has_delete_permission(self, request, obj=None):
        if obj is None:
            return False
        return not services.usuario_tiene_prestamos_activos(obj.pk)


@admin.register(Credencial)
class CredencialAdmin(admin.ModelAdmin):
    list_display = ("email", "usuario", "failed_attempts", "locked_until")
    search_fields = ("email", "usuario__email", "usuario__dni")


@admin.register(TransaccionReputacion)
class TransaccionReputacionAdmin(admin.ModelAdmin):
    list_display = (
        "usuario",
        "fecha",
        "tipo",
        "puntos_delta",
        "puntos_solicitados",
        "tope_aplicado",
        "prestamo_id",
        "reserva_id",
    )
    list_filter = ("tipo", "tope_aplicado", "fecha")
    search_fields = (
        "usuario__email",
        "usuario__dni",
        "usuario__nombre",
        "usuario__apellido",
        "descripcion",
    )
    readonly_fields = ("created_at",)
