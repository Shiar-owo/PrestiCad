from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("inventario", "0008_instanciamaterial_condicion_fisica"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="material",
            name="estado_fisico",
        ),
    ]
