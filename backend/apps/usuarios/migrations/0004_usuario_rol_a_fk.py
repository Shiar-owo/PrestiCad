import django.db.models.deletion
from django.db import migrations, models


def copiar_rol_a_fk(apps, schema_editor):
    """Traslada el valor de texto de `rol` (ej. 'gestor') al nuevo campo FK."""
    Usuario = apps.get_model("usuarios", "Usuario")
    Rol = apps.get_model("usuarios", "Rol")

    mapa_roles = {rol.nombre: rol for rol in Rol.objects.all()}
    for usuario in Usuario.objects.all():
        usuario.rol_fk = mapa_roles.get(usuario.rol_temporal, mapa_roles["prestatario"])
        usuario.save(update_fields=["rol_fk"])


def revertir_copia(apps, schema_editor):
    """No-op: al revertir se vuelve a un CharField vacío, no hace falta copiar."""


class Migration(migrations.Migration):

    dependencies = [
        ("usuarios", "0003_crear_rol_y_sembrar"),
    ]

    operations = [
        # 1) Renombrar el CharField viejo para poder leerlo durante la copia
        #    sin chocar con el nombre final `rol`.
        migrations.RenameField(model_name="usuario", old_name="rol", new_name="rol_temporal"),
        # 2) Agregar el nuevo campo FK (nullable por ahora, se completa abajo).
        migrations.AddField(
            model_name="usuario",
            name="rol_fk",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="usuarios",
                to="usuarios.rol",
            ),
        ),
        # 3) Copiar los valores de texto al nuevo campo relacional.
        migrations.RunPython(copiar_rol_a_fk, revertir_copia),
        # 4) Quitar el campo de texto viejo.
        migrations.RemoveField(model_name="usuario", name="rol_temporal"),
        # 5) Renombrar `rol_fk` -> `rol` y quitar el null=True temporal.
        migrations.RenameField(model_name="usuario", old_name="rol_fk", new_name="rol"),
        migrations.AlterField(
            model_name="usuario",
            name="rol",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name="usuarios",
                to="usuarios.rol",
            ),
        ),
    ]