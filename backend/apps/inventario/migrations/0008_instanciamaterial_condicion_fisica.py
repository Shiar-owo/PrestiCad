from django.db import migrations, models


def copiar_condicion_fisica_existente(apps, schema_editor):
    InstanciaMaterial = apps.get_model("inventario", "InstanciaMaterial")
    alias = schema_editor.connection.alias
    for instancia in InstanciaMaterial.objects.using(alias).only("pk", "estado_fisico").iterator():
        InstanciaMaterial.objects.using(alias).filter(pk=instancia.pk).update(
            condicion_fisica=instancia.estado_fisico
        )


class Migration(migrations.Migration):

    dependencies = [
        ("inventario", "0007_alter_instanciamaterial_foto_alter_material_foto"),
    ]

    operations = [
        migrations.AddField(
            model_name="instanciamaterial",
            name="condicion_fisica",
            field=models.CharField(
                blank=True,
                default="Operativo",
                help_text="Condición física de este ejemplar (ej. Excelente, Bueno, Desgaste leve).",
                max_length=100,
                verbose_name="Condición física",
            ),
        ),
        migrations.RunPython(copiar_condicion_fisica_existente, migrations.RunPython.noop),
    ]
