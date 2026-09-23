from django.contrib import admin

from apps.usuarios.models import Credencial, Usuario


@admin.register(Usuario)
class UsuarioAdmin(admin.ModelAdmin):
    list_display = ("nombre", "apellido", "email", "dni", "facultad", "departamento_carrera", "tipo", "rol", "estado", "reputacion_tier")
    list_filter = ("tipo", "rol", "estado", "reputacion_tier", "facultad")
    search_fields = ("nombre", "apellido", "email", "dni", "facultad", "departamento_carrera")


@admin.register(Credencial)
class CredencialAdmin(admin.ModelAdmin):
    list_display = ("email", "usuario", "failed_attempts", "locked_until")
    search_fields = ("email", "usuario__email", "usuario__dni")