from django.db import migrations, models

ROLES = [
    ("prestatario", "Prestatario", "Rol por defecto: puede solicitar préstamos."),
    ("gestor", "Gestor de Almacén", "Administra el inventario y las reservas."),
    ("administrador", "Administrador", "Gestiona usuarios, roles y configuración del sistema."),
]


def sembrar_roles(apps, schema_editor):
    Rol = apps.get_model("usuarios", "Rol")
    for nombre, _, descripcion in ROLES:
        Rol.objects.get_or_create(nombre=nombre, defaults={"descripcion": descripcion})


def eliminar_roles(apps, schema_editor):
    Rol = apps.get_model("usuarios", "Rol")
    Rol.objects.filter(nombre__in=[n for n, _, _ in ROLES]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("usuarios", "0002_usuario_departamento_carrera_usuario_facultad"),
    ]

    operations = [
        migrations.CreateModel(
            name="Rol",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "nombre",
                    models.CharField(
                        choices=[
                            ("prestatario", "Prestatario"),
                            ("gestor", "Gestor de Almacén"),
                            ("administrador", "Administrador"),
                        ],
                        max_length=20,
                        unique=True,
                    ),
                ),
                ("descripcion", models.CharField(blank=True, default="", max_length=200)),
            ],
            options={
                "verbose_name": "Rol",
                "verbose_name_plural": "Roles",
                "ordering": ["nombre"],
            },
        ),
        migrations.RunPython(sembrar_roles, eliminar_roles),
    ]