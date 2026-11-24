from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("inventario", "0012_eliminar_condicion_fisica_instancia"),
    ]

    operations = [
        migrations.AddField(
            model_name="material",
            name="precio",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10, verbose_name="Precio"),
            preserve_default=False,
        ),
    ]
