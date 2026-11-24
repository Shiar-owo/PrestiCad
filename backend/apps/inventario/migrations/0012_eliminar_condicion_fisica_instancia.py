from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("inventario", "0011_rename_codigo_inventario_material_codigo_material"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="instanciamaterial",
            name="condicion_fisica",
        ),
    ]
