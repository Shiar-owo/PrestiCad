from django.db import migrations


def poblar_instancias_existentes(apps, schema_editor):
    Material = apps.get_model("inventario", "Material")
    InstanciaMaterial = apps.get_model("inventario", "InstanciaMaterial")

    instancias_a_crear = []
    for material in Material.objects.all():
        stock = max(getattr(material, "stock", 1), 1)
        for i in range(1, stock + 1):
            codigo_ejemplar = f"{material.codigo_inventario}-{i:02d}"
            # Evitar duplicados si ya existiera
            if InstanciaMaterial.objects.filter(codigo_ejemplar=codigo_ejemplar).exists():
                continue

            num_serie = material.numero_serie or ""
            if num_serie and stock > 1:
                num_serie = f"{num_serie}-{i:02d}"

            instancias_a_crear.append(
                InstanciaMaterial(
                    material=material,
                    codigo_ejemplar=codigo_ejemplar,
                    numero_serie=num_serie,
                    estado=material.estado if material.estado in ("disponible", "prestado", "en_mantenimiento", "reservado") else "disponible",
                    estado_fisico=material.estado_fisico or "Operativo",
                    observaciones=f"Ejemplar #{i} inicial migrado desde inventario.",
                    ubicacion="",
                )
            )

    if instancias_a_crear:
        InstanciaMaterial.objects.bulk_create(instancias_a_crear)


def revertir_poblado(apps, schema_editor):
    InstanciaMaterial = apps.get_model("inventario", "InstanciaMaterial")
    InstanciaMaterial.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ("inventario", "0003_instanciamaterial"),
    ]

    operations = [
        migrations.RunPython(poblar_instancias_existentes, revertir_poblado),
    ]
