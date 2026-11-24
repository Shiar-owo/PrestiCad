from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("inventario", "0010_eliminar_estado_fisico_legado_instancia"),
    ]

    operations = [
        migrations.RenameField(
            model_name="material",
            old_name="codigo_inventario",
            new_name="codigo_material",
        ),
        migrations.AlterField(
            model_name="material",
            name="codigo_material",
            field=models.CharField(
                help_text="Identificador único del material en el inventario.",
                max_length=30,
                unique=True,
                verbose_name="Código de material",
            ),
        ),
    ]
