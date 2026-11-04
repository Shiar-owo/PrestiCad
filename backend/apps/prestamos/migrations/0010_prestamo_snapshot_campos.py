from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("prestamos", "0009_garantia_reserva"),
    ]

    operations = [
        migrations.AddField(
            model_name="prestamo",
            name="material_snapshot",
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text="Copia inmutable de los datos del Material al momento del préstamo.",
            ),
        ),
        migrations.AddField(
            model_name="prestamo",
            name="instancia_snapshot",
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text="Copia inmutable de los datos de la InstanciaMaterial al momento del préstamo.",
            ),
        ),
    ]
