"""Carga un escenario ficticio y repetible para la demostración de PrestiCad."""
from datetime import timedelta
from pathlib import Path
import shutil

from django.conf import settings
from django.contrib.auth.hashers import make_password
from django.core.management.color import no_style
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from django.utils import timezone

from apps.inventario.models import InstanciaMaterial, Material
from apps.prestamos.models import Devolucion, Garantia, Prestamo
from apps.usuarios.models import Credencial, Rol, Usuario


CLAVE_DEMO = "PresticadDemo2026!"
FACULTAD = "Escuela Profesional de Ciencia de la Computación"

USUARIOS = (
    {
        "email": "prestatario@presticad.test", "nombre": "Lucía",
        "apellido": "Paredes", "dni": "70000001", "tipo": "alumno",
        "rol": "prestatario", "puntaje": 320, "tier": "avanzado",
    },
    {
        "email": "prestatario.estandar@presticad.test", "nombre": "Marco",
        "apellido": "Quispe", "dni": "70000004", "tipo": "alumno",
        "rol": "prestatario", "puntaje": 45, "tier": "estandar",
    },
    {
        "email": "prestatario.restringido@presticad.test", "nombre": "Ana",
        "apellido": "Salazar", "dni": "70000005", "tipo": "alumno",
        "rol": "prestatario", "puntaje": -120, "tier": "restringido",
    },
    {
        "email": "administrador@presticad.test", "nombre": "Prueba",
        "apellido": "Administrador", "dni": "70000002", "tipo": "administrativo",
        "rol": "administrador", "puntaje": 0, "tier": "estandar",
    },
    {
        "email": "gestor@presticad.test", "nombre": "Prueba",
        "apellido": "Gestor", "dni": "70000003", "tipo": "administrativo",
        "rol": "gestor", "puntaje": 0, "tier": "estandar",
    },
)

MATERIALES = (
    {
        "codigo_inventario": "DEMO-LAP-001", "nombre": "Laptop de préstamo",
        "descripcion": "Laptop para prácticas, con cargador y funda.",
        "tipo": "equipo", "marca": "Lenovo", "modelo": "ThinkPad E14",
        "numero_serie": "DEMO-LEN-014", "color": "Negro",
        "estado_fisico": "Bueno", "es_alto_valor": False,
        "tier_minimo_requerido": "estandar", "foto": "laptop.jpg",
        "ejemplares": (
            ("DEMO-LAP-001-01", "disponible", "Operativo", "Almacén A-01"),
            ("DEMO-LAP-001-02", "disponible", "Desgaste leve", "Almacén A-01"),
        ),
    },
    {
        "codigo_inventario": "DEMO-CAM-001", "nombre": "Cámara de alto valor",
        "descripcion": "Cámara mirrorless con lente y batería. Requiere garantía.",
        "tipo": "equipo", "marca": "Canon", "modelo": "EOS R50",
        "numero_serie": "DEMO-CAN-050", "color": "Negro",
        "estado": "prestado", "estado_fisico": "Excelente", "es_alto_valor": True,
        "tier_minimo_requerido": "avanzado", "foto": "camara.jpg",
        "ejemplares": (
            ("DEMO-CAM-001-01", "prestado", "Excelente", "Almacén A-02"),
        ),
    },
    {
        "codigo_inventario": "DEMO-MUL-001", "nombre": "Multímetro digital",
        "descripcion": "Multímetro de laboratorio con puntas de prueba.",
        "tipo": "equipo", "marca": "Fluke", "modelo": "117",
        "numero_serie": "DEMO-FLU-117", "color": "Amarillo",
        "estado_fisico": "Operativo", "es_alto_valor": False,
        "tier_minimo_requerido": "restringido", "foto": "multimetro.jpg",
        "ejemplares": (
            ("DEMO-MUL-001-01", "disponible", "Operativo", "Laboratorio B-03"),
            ("DEMO-MUL-001-02", "en_mantenimiento", "Punta por reemplazar", "Taller"),
        ),
    },
    {
        "codigo_inventario": "DEMO-LIB-001", "nombre": "Clean Code",
        "descripcion": "Libro de consulta para desarrollo de software.",
        "tipo": "libro", "marca": "Prentice Hall", "modelo": "Edición 1",
        "numero_serie": "", "color": "Rojo", "estado_fisico": "Bueno",
        "es_alto_valor": False, "tier_minimo_requerido": "restringido",
        "foto": "libro.jpg",
        "ejemplares": (
            ("DEMO-LIB-001-01", "disponible", "Bueno", "Biblioteca C-02"),
        ),
    },
)

PRESTAMOS_DEMO = (990001, 990002, 990003)


class Command(BaseCommand):
    help = "Carga un escenario ficticio de usuarios, inventario y préstamos."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reiniciar", action="store_true",
            help="Recrea solo los préstamos y devoluciones del escenario demo.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        if not settings.DEBUG and not settings.CREAR_USUARIOS_PRUEBA:
            raise CommandError(
                "La carga demo solo está habilitada en DEBUG o con "
                "CREAR_USUARIOS_PRUEBA=true."
            )
        self._copiar_fotos_demo()

        password = settings.CONTRASENA_USUARIOS_PRUEBA or CLAVE_DEMO
        if options["reiniciar"]:
            self._reiniciar_prestamos()

        roles = {rol.nombre: rol for rol in Rol.objects.all()}
        usuarios = {}
        for datos in USUARIOS:
            datos = datos.copy()
            nombre_rol = datos.pop("rol")
            puntaje = datos.pop("puntaje")
            tier = datos.pop("tier")
            email = datos["email"]
            usuario, _ = Usuario.objects.update_or_create(
                email=email,
                defaults={
                    **datos,
                    "facultad": FACULTAD,
                    "departamento_carrera": "Ciencia de la Computación",
                    "rol": roles[nombre_rol],
                    "estado": "activo",
                    "reputacion_puntaje": puntaje,
                    "reputacion_tier": tier,
                },
            )
            Credencial.objects.update_or_create(
                email=email,
                defaults={
                    "usuario": usuario,
                    "password_hash": make_password(password),
                    "failed_attempts": 0,
                    "locked_until": None,
                },
            )
            usuarios[email] = usuario

        materiales = self._cargar_inventario()
        self._cargar_prestamos(usuarios, materiales)
        self.stdout.write(self.style.SUCCESS(
            "Escenario demo listo: 5 usuarios, 4 materiales y 3 préstamos. "
            f"Contraseña de demostración: {password}"
        ))

    def _copiar_fotos_demo(self):
        directorio_assets = Path(__file__).resolve().parents[3] / "inventario" / "demo_media"
        directorio_media = Path(settings.MEDIA_ROOT) / "demo"
        nombres = {datos["foto"] for datos in MATERIALES}
        faltantes = [nombre for nombre in nombres if not (directorio_assets / nombre).is_file()]
        if faltantes:
            raise CommandError(f"Faltan imágenes demo: {', '.join(sorted(faltantes))}.")
        directorio_media.mkdir(parents=True, exist_ok=True)
        for nombre in nombres:
            shutil.copy2(directorio_assets / nombre, directorio_media / nombre)

    def _cargar_inventario(self):
        materiales = {}
        for datos in MATERIALES:
            datos = datos.copy()
            codigo = datos.pop("codigo_inventario")
            foto = datos.pop("foto")
            ejemplares = datos.pop("ejemplares")
            material, _ = Material.objects.update_or_create(
                codigo_inventario=codigo,
                defaults={**datos, "foto": f"demo/{foto}", "stock": len(ejemplares)},
            )
            materiales[codigo] = material
            for codigo_ejemplar, estado, estado_fisico, ubicacion in ejemplares:
                InstanciaMaterial.objects.update_or_create(
                    codigo_ejemplar=codigo_ejemplar,
                    defaults={
                        "material": material,
                        "estado": estado,
                        "estado_fisico": estado_fisico,
                        "ubicacion": ubicacion,
                        "foto": f"demo/{foto}",
                    },
                )
        return materiales

    def _cargar_prestamos(self, usuarios, materiales):
        ahora = timezone.now()
        gestor = usuarios["gestor@presticad.test"]
        avanzado = usuarios["prestatario@presticad.test"]
        estandar = usuarios["prestatario.estandar@presticad.test"]
        restringido = usuarios["prestatario.restringido@presticad.test"]
        laptop = materiales["DEMO-LAP-001"]
        camara = materiales["DEMO-CAM-001"]
        multimetro = materiales["DEMO-MUL-001"]

        # IDs fijos hacen que la carga sea idempotente y que --reiniciar pueda
        # identificar exclusivamente los préstamos que pertenecen al escenario.
        prestamo_camara, _ = Prestamo.objects.update_or_create(
            pk=PRESTAMOS_DEMO[0],
            defaults={
                "usuario": avanzado,
                "material": camara,
                "instancia": InstanciaMaterial.objects.get(codigo_ejemplar="DEMO-CAM-001-01"),
                "registrado_por": gestor,
                "fecha_entrega": ahora - timedelta(days=1),
                "fecha_limite": ahora + timedelta(days=6),
                "tiempo_prestamo_dias": 7,
                "estado": "activo",
                "checklist_inicial": [
                    {"elemento": "Cámara", "estado": "sin_cambios"},
                    {"elemento": "Lente", "estado": "sin_cambios"},
                ],
            },
        )
        Garantia.objects.update_or_create(
            prestamo=prestamo_camara,
            defaults={"tipo": "documento_y_compromiso", "estado": "pendiente"},
        )

        Prestamo.objects.update_or_create(
            pk=PRESTAMOS_DEMO[1],
            defaults={
                "usuario": estandar,
                "material": laptop,
                "instancia": InstanciaMaterial.objects.get(codigo_ejemplar="DEMO-LAP-001-01"),
                "registrado_por": gestor,
                "fecha_entrega": ahora - timedelta(days=2),
                "fecha_limite": ahora + timedelta(days=5),
                "tiempo_prestamo_dias": 7,
                "estado": "activo",
                "checklist_inicial": [{"elemento": "Laptop", "estado": "sin_cambios"}],
            },
        )

        fecha_entrega = ahora - timedelta(days=20)
        prestamo_devuelto, _ = Prestamo.objects.update_or_create(
            pk=PRESTAMOS_DEMO[2],
            defaults={
                "usuario": restringido,
                "material": multimetro,
                "instancia": InstanciaMaterial.objects.get(codigo_ejemplar="DEMO-MUL-001-01"),
                "registrado_por": gestor,
                "fecha_entrega": fecha_entrega,
                "fecha_limite": fecha_entrega + timedelta(days=7),
                "tiempo_prestamo_dias": 7,
                "estado": "devuelto",
                "checklist_inicial": [{"elemento": "Multímetro", "estado": "sin_cambios"}],
            },
        )
        Devolucion.objects.update_or_create(
            prestamo=prestamo_devuelto,
            defaults={
                "realizado_por": gestor,
                "fecha_devolucion": fecha_entrega + timedelta(days=9),
                "checklist_devolucion": [{
                    "elemento": "Puntas de prueba", "estado": "dano_parcial",
                    "observacion": "Aislamiento desgastado; requiere reemplazo.",
                }],
                "resultado": {
                    "tipo": "dano_parcial", "dias_tardanza": 2,
                    "delta_reputacion": -50, "reputacion_antes": -70,
                    "reputacion_despues": -120, "tier_antes": "restringido",
                    "tier_despues": "restringido",
                },
            },
        )
        for sql in connection.ops.sequence_reset_sql(no_style(), [Prestamo]):
            with connection.cursor() as cursor:
                cursor.execute(sql)

    def _reiniciar_prestamos(self):
        Devolucion.objects.filter(prestamo_id__in=PRESTAMOS_DEMO).delete()
        Garantia.objects.filter(prestamo_id__in=PRESTAMOS_DEMO).delete()
        Prestamo.objects.filter(pk__in=PRESTAMOS_DEMO).delete()
