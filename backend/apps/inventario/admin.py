from django.contrib import admin

from apps.inventario.models import InstanciaMaterial, Material


@admin.register(Material)
class MaterialAdmin(admin.ModelAdmin):
    readonly_fields = ("es_alto_valor",)
    list_display = (
        "nombre",
        "codigo_material",
        "tipo",
        "precio",
        "estado",
        "stock",
        "tier_minimo_requerido",
        "es_alto_valor",
    )
    list_filter = ("tipo", "estado", "tier_minimo_requerido", "es_alto_valor")
    search_fields = ("nombre", "codigo_material", "descripcion", "marca", "modelo")

    def get_queryset(self, request):
        return super().get_queryset(request).prefetch_related("instancias")


@admin.register(InstanciaMaterial)
class InstanciaMaterialAdmin(admin.ModelAdmin):
    list_display = ("codigo_ejemplar", "material", "numero_serie", "estado", "ubicacion")
    list_filter = ("estado",)
    search_fields = ("codigo_ejemplar", "numero_serie", "material__nombre", "material__codigo_material")
