from django.db import migrations


MAXIMO_DURACION_MINUTOS = 3 * 24 * 60


def limitar_maximos_guardados(apps, schema_editor):
    Material = apps.get_model("inventario", "Material")
    Material.objects.using(schema_editor.connection.alias).filter(
        tiempo_maximo_prestamo__gt=MAXIMO_DURACION_MINUTOS,
    ).update(tiempo_maximo_prestamo=MAXIMO_DURACION_MINUTOS)


class Migration(migrations.Migration):

    dependencies = [
        ("inventario", "0017_alter_material_tiempo_maximo_prestamo"),
    ]

    operations = [
        migrations.RunPython(limitar_maximos_guardados, migrations.RunPython.noop),
    ]
