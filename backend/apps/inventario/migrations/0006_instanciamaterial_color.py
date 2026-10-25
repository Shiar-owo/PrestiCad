from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("inventario", "0005_instanciamaterial_foto"),
    ]

    operations = [
        migrations.AddField(
            model_name="instanciamaterial",
            name="color",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Color propio de esta unidad; si queda vacío, se muestra el color del material.",
                max_length=30,
                verbose_name="Color del ejemplar",
            ),
        ),
    ]
