import apps.inventario.models
import apps.inventario.validators
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("inventario", "0004_poblar_instancias"),
    ]

    operations = [
        migrations.AddField(
            model_name="instanciamaterial",
            name="foto",
            field=models.ImageField(
                blank=True,
                help_text="Imagen del ejemplar: JPG, PNG o WEBP, hasta 5 MB.",
                upload_to=apps.inventario.models.ruta_foto,
                validators=[apps.inventario.validators.validar_foto],
                verbose_name="Foto del ejemplar",
            ),
        ),
    ]
