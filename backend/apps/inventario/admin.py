from django.contrib import admin

from apps.inventario.models import Material


@admin.register(Material)
class MaterialAdmin(admin.ModelAdmin):
    list_display = (
        "nombre",
        "codigo_inventario",
        "tipo",
        "estado",
        "stock",
        "tier_minimo_requerido",
        "es_alto_valor",
    )
    list_filter = ("tipo", "estado", "tier_minimo_requerido", "es_alto_valor")
    search_fields = ("nombre", "codigo_inventario", "descripcion", "marca", "modelo")
