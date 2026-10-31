from django.db import migrations


def copiar_estado_fisico_a_condicion_fisica(apps, schema_editor):
    InstanciaMaterial = apps.get_model("inventario", "InstanciaMaterial")
    alias = schema_editor.connection.alias
    for instancia in InstanciaMaterial.objects.using(alias).only("pk", "estado_fisico").iterator():
        InstanciaMaterial.objects.using(alias).filter(pk=instancia.pk).update(
            condicion_fisica=instancia.estado_fisico
        )


def copiar_condicion_fisica_a_estado_fisico(apps, schema_editor):
    InstanciaMaterial = apps.get_model("inventario", "InstanciaMaterial")
    alias = schema_editor.connection.alias
    for instancia in InstanciaMaterial.objects.using(alias).only("pk", "condicion_fisica").iterator():
        InstanciaMaterial.objects.using(alias).filter(pk=instancia.pk).update(
            estado_fisico=instancia.condicion_fisica
        )


class Migration(migrations.Migration):

    dependencies = [
        ("inventario", "0009_eliminar_estado_fisico_material"),
    ]

    operations = [
        migrations.RunPython(
            copiar_estado_fisico_a_condicion_fisica,
            copiar_condicion_fisica_a_estado_fisico,
        ),
        migrations.RemoveField(
            model_name="instanciamaterial",
            name="estado_fisico",
        ),
    ]
