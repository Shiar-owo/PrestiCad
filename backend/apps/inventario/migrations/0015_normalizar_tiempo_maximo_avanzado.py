"""Normaliza materiales de Tier avanzado con tiempo máximo entre 30 y 59 minutos al default de 360."""
from django.db import migrations


def normalizar_tiempo_avanzado(apps, schema_editor):
    Material = apps.get_model("inventario", "Material")
    materiales = Material.objects.filter(
        tier_minimo_requerido="avanzado",
        tiempo_maximo_prestamo__gte=30,
        tiempo_maximo_prestamo__lte=59,
    )
    for material in materiales:
        material.tiempo_maximo_prestamo = 360
        material.save(update_fields=["tiempo_maximo_prestamo", "updated_at"])


class Migration(migrations.Migration):

    dependencies = [
        ("inventario", "0014_material_tiempo_maximo_prestamo_and_more"),
    ]

    operations = [
        migrations.RunPython(normalizar_tiempo_avanzado, migrations.RunPython.noop),
    ]
