from django.db import migrations, models
import django.db.models.deletion
import django.core.validators
import django.utils.timezone


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("inventario", "0002_remove_material_foto_url_material_foto"),
        ("usuarios", "0006_unir_ramas_usuario"),
    ]

    operations = [
        migrations.CreateModel(
            name="Prestamo",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("fecha_entrega", models.DateTimeField(default=django.utils.timezone.now)),
                (
                    "fecha_limite",
                    models.DateTimeField(),
                ),
                (
                    "tiempo_prestamo_dias",
                    models.PositiveIntegerField(
                        validators=[django.core.validators.MinValueValidator(1)],
                    ),
                ),
                (
                    "estado",
                    models.CharField(
                        choices=[
                            ("reservado", "Reservado"),
                            ("activo", "Activo"),
                            ("devuelto", "Devuelto"),
                            ("vencido", "Vencido"),
                        ],
                        default="activo",
                        max_length=20,
                    ),
                ),
                ("checklist_inicial", models.JSONField(default=list)),
                (
                    "garantia_documento_identidad_recibido",
                    models.BooleanField(default=False),
                ),
                (
                    "garantia_compromiso_firmado_recibido",
                    models.BooleanField(default=False),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "material",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="prestamos",
                        to="inventario.material",
                    ),
                ),
                (
                    "registrado_por",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="prestamos_registrados",
                        to="usuarios.usuario",
                    ),
                ),
                (
                    "usuario",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="prestamos",
                        to="usuarios.usuario",
                    ),
                ),
            ],
            options={
                "verbose_name": "Préstamo",
                "verbose_name_plural": "Préstamos",
                "ordering": ["-fecha_entrega", "-id"],
            },
        ),
        migrations.AddIndex(
            model_name="prestamo",
            index=models.Index(
                fields=["usuario", "estado"], name="prest_usuario_estado_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="prestamo",
            index=models.Index(
                fields=["material", "estado"], name="prest_material_estado_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="prestamo",
            index=models.Index(fields=["fecha_limite"], name="prest_fecha_limite_idx"),
        ),
    ]
