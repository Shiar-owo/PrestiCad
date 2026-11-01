from django.contrib import admin

from apps.inventario.models import InstanciaMaterial, Material


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

    def get_queryset(self, request):
        return super().get_queryset(request).prefetch_related("instancias")

    def get_list_display(self, request):
        return ("nombre", "codigo_material", *super().get_list_display(request)[1:])

    @admin.display(description="Código de Material", ordering="codigo_inventario")
    def codigo_material(self, obj):
        return obj.codigo_inventario

    def formfield_for_dbfield(self, db_field, request, **kwargs):
        formfield = super().formfield_for_dbfield(db_field, request, **kwargs)
        if db_field.name == "codigo_inventario":
            formfield.label = "Código de Material"
        return formfield


@admin.register(InstanciaMaterial)
class InstanciaMaterialAdmin(admin.ModelAdmin):
    list_display = ("codigo_ejemplar", "material", "numero_serie", "estado", "ubicacion")
    list_filter = ("estado",)
    search_fields = ("codigo_ejemplar", "numero_serie", "material__nombre", "material__codigo_inventario")

    def formfield_for_dbfield(self, db_field, request, **kwargs):
        formfield = super().formfield_for_dbfield(db_field, request, **kwargs)
        if db_field.name == "codigo_ejemplar":
            formfield.label = "Código de Ejemplar"
        return formfield
