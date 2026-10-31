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
        "email": "prestatario@presticad.test", "nombre": "Rous",
        "apellido": "Garay", "dni": "70000001", "tipo": "alumno",
        "rol": "prestatario", "puntaje": 320, "tier": "avanzado",
    },
    {
        "email": "prestatario.estandar@presticad.test", "nombre": "Josué",
        "apellido": "Rodríguez", "dni": "70000004", "tipo": "alumno",
        "rol": "prestatario", "puntaje": 45, "tier": "estandar",
    },
    {
        "email": "prestatario.restringido@presticad.test", "nombre": "Melissa",
        "apellido": "Retamozo", "dni": "70000005", "tipo": "alumno",
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
        "descripcion": "Laptop con Windows 11 para actividades académicas.",
        "tipo": "equipo", "marca": "Equipo institucional",
        "modelo": "Laptop con Windows 11",
        "numero_serie": "DEMO-LAP-014", "color": "Plata",
        "estado_fisico": "Bueno", "es_alto_valor": False,
        "tier_minimo_requerido": "estandar", "foto": "laptop.jpg",
        "ejemplares": (
            ("DEMO-LAP-001-01", "prestado", "Operativo", "Almacén A-01"),
            ("DEMO-LAP-001-02", "disponible", "Desgaste leve", "Almacén A-01"),
        ),
    },
    {
        "codigo_inventario": "DEMO-VR-001", "nombre": "Gafas de realidad virtual",
        "descripcion": "Visor Meta Quest 2 con dos controles para experiencias de realidad virtual.",
        "tipo": "equipo", "marca": "Meta", "modelo": "Quest 2",
        "numero_serie": "DEMO-META-002", "color": "Blanco",
        "estado": "prestado", "estado_fisico": "Excelente", "es_alto_valor": True,
        "tier_minimo_requerido": "avanzado", "foto": "gafas_vr.jpg",
        "ejemplares": (
            ("DEMO-VR-001-01", "prestado", "Excelente", "Almacén A-02"),
        ),
    },
    {
        "codigo_inventario": "DEMO-CALC-001", "nombre": "Calculadora científica Casio",
        "descripcion": "Calculadora científica para cursos de matemática, física e ingeniería.",
        "tipo": "equipo", "marca": "Casio", "modelo": "fx-991ES PLUS",
        "numero_serie": "DEMO-CAS-991", "color": "Negro",
        "estado_fisico": "Bueno", "es_alto_valor": False,
        "tier_minimo_requerido": "restringido", "foto": "calculadora_cientifica.jpg",
        "ejemplares": (
            ("DEMO-CALC-001-01", "disponible", "Operativo", "Almacén B-03"),
            ("DEMO-CALC-001-02", "en_mantenimiento", "Tapa de pilas fisurada", "Taller"),
        ),
    },
    {
        "codigo_inventario": "DEMO-LIB-001", "nombre": "C++ Programming Language",
        "descripcion": "Libro de consulta sobre C++, sus estructuras, funciones y programación orientada a objetos.",
        "tipo": "libro", "marca": "", "modelo": "Edición ilustrativa",
        "numero_serie": "", "color": "Blanco", "estado_fisico": "Bueno",
        "es_alto_valor": False, "tier_minimo_requerido": "restringido",
        "foto": "libro_crls.jpeg",
        "ejemplares": (
            ("DEMO-LIB-001-01", "disponible", "Bueno", "Biblioteca C-02"),
        ),
    },
)

PRESTAMOS_DEMO = (990001, 990002, 990003)
CODIGOS_MATERIALES_DEMO_ANTERIORES = {
    "DEMO-CAM-001": "DEMO-VR-001",
    "DEMO-MUL-001": "DEMO-CALC-001",
}


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
            usuario_existente = Usuario.objects.filter(email=email).first()
            if usuario_existente:
                # No cambiamos el DNI de una cuenta que ya existe: podría
                # pertenecer también a otra persona del entorno local.
                datos["dni"] = usuario_existente.dni
            else:
                dni_solicitado = datos["dni"]
                datos["dni"] = self._dni_demo_disponible(dni_solicitado)
                if datos["dni"] != dni_solicitado:
                    self.stdout.write(self.style.WARNING(
                        f"El DNI demo {dni_solicitado} ya está ocupado; "
                        f"se asignará {datos['dni']} a {email}."
                    ))
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

        self._migrar_codigos_demo_anteriores()
        materiales = self._cargar_inventario()
        self._cargar_prestamos(usuarios, materiales)
        self._eliminar_materiales_demo_anteriores()
        self.stdout.write(self.style.SUCCESS(
            "Escenario demo listo: 5 usuarios, 4 materiales y 3 préstamos. "
            f"Contraseña de demostración: {password}"
        ))

    def _dni_demo_disponible(self, dni_preferido):
        if not Usuario.objects.filter(dni=dni_preferido).exists():
            return dni_preferido
        for candidato in range(70000010, 80000000):
            dni = str(candidato)
            if not Usuario.objects.filter(dni=dni).exists():
                return dni
        raise CommandError("No se encontró un DNI libre para crear las cuentas demo.")

    def _copiar_fotos_demo(self):
        directorio_assets = Path(__file__).resolve().parents[3] / "inventario" / "demo_media"
        directorio_media = Path(settings.MEDIA_ROOT) / "inventario"
        nombres = {datos["foto"] for datos in MATERIALES}
        faltantes = [nombre for nombre in nombres if not (directorio_assets / nombre).is_file()]
        if faltantes:
            raise CommandError(f"Faltan imágenes demo: {', '.join(sorted(faltantes))}.")
        directorio_media.mkdir(parents=True, exist_ok=True)
        for nombre in nombres:
            shutil.copy2(directorio_assets / nombre, directorio_media / nombre)
        # Retira copias obsoletas de la carga anterior, no archivos subidos
        # por el usuario (la aplicación no guardaba cargas en media/demo).
        directorio_anterior = Path(settings.MEDIA_ROOT) / "demo"
        for nombre in ("laptop.jpg", "camara.jpg", "multimetro.jpg", "libro.jpg"):
            try:
                (directorio_anterior / nombre).unlink(missing_ok=True)
            except OSError:
                pass
        try:
            directorio_anterior.rmdir()
        except OSError:
            pass

    def _migrar_codigos_demo_anteriores(self):
        """Conserva las filas demo existentes al cambiar cámara/multímetro."""
        codigos_ejemplares_anteriores = {
            "DEMO-CAM-001": {"DEMO-CAM-001-01": "DEMO-VR-001-01"},
            "DEMO-MUL-001": {
                "DEMO-MUL-001-01": "DEMO-CALC-001-01",
                "DEMO-MUL-001-02": "DEMO-CALC-001-02",
            },
        }
        for codigo_anterior, codigo_nuevo in CODIGOS_MATERIALES_DEMO_ANTERIORES.items():
            material = Material.objects.filter(codigo_inventario=codigo_anterior).first()
            if material is None or Material.objects.filter(codigo_inventario=codigo_nuevo).exists():
                continue
            material.codigo_inventario = codigo_nuevo
            material.save(update_fields=["codigo_inventario"])
            for (
                codigo_ejemplar_anterior,
                codigo_ejemplar_nuevo,
            ) in codigos_ejemplares_anteriores[codigo_anterior].items():
                instancia = InstanciaMaterial.objects.filter(
                    codigo_ejemplar=codigo_ejemplar_anterior,
                    material=material,
                ).first()
                if instancia and not InstanciaMaterial.objects.filter(
                    codigo_ejemplar=codigo_ejemplar_nuevo
                ).exists():
                    instancia.codigo_ejemplar = codigo_ejemplar_nuevo
                    instancia.save(update_fields=["codigo_ejemplar"])

    def _eliminar_materiales_demo_anteriores(self):
        """Retira materiales demo obsoletos si ya no tienen préstamos asociados."""
        for codigo in CODIGOS_MATERIALES_DEMO_ANTERIORES:
            material = Material.objects.filter(codigo_inventario=codigo).first()
            if material is not None and not material.prestamos.exists():
                material.delete()

    def _cargar_inventario(self):
        materiales = {}
        for datos in MATERIALES:
            datos = datos.copy()
            codigo = datos.pop("codigo_inventario")
            foto = datos.pop("foto")
            ejemplares = datos.pop("ejemplares")
            material, _ = Material.objects.update_or_create(
                codigo_inventario=codigo,
                defaults={**datos, "foto": f"inventario/{foto}", "stock": len(ejemplares)},
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
                        "foto": f"inventario/{foto}",
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
        gafas_vr = materiales["DEMO-VR-001"]
        calculadora = materiales["DEMO-CALC-001"]

        # IDs fijos hacen que la carga sea idempotente y que --reiniciar pueda
        # identificar exclusivamente los préstamos que pertenecen al escenario.
        prestamo_gafas_vr, _ = Prestamo.objects.update_or_create(
            pk=PRESTAMOS_DEMO[0],
            defaults={
                "usuario": avanzado,
                "material": gafas_vr,
                "instancia": InstanciaMaterial.objects.get(codigo_ejemplar="DEMO-VR-001-01"),
                "registrado_por": gestor,
                "fecha_entrega": ahora - timedelta(days=1),
                "fecha_limite": ahora + timedelta(days=6),
                "tiempo_prestamo_dias": 7,
                "estado": "activo",
                "checklist_inicial": [
                    {"elemento": "Visor de realidad virtual", "estado": "sin_cambios"},
                    {"elemento": "Controles", "estado": "sin_cambios"},
                ],
            },
        )
        Garantia.objects.update_or_create(
            prestamo=prestamo_gafas_vr,
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
                "material": calculadora,
                "instancia": InstanciaMaterial.objects.get(codigo_ejemplar="DEMO-CALC-001-01"),
                "registrado_por": gestor,
                "fecha_entrega": fecha_entrega,
                "fecha_limite": fecha_entrega + timedelta(days=7),
                "tiempo_prestamo_dias": 7,
                "estado": "devuelto",
                "checklist_inicial": [{"elemento": "Calculadora científica", "estado": "sin_cambios"}],
            },
        )
        Devolucion.objects.update_or_create(
            prestamo=prestamo_devuelto,
            defaults={
                "realizado_por": gestor,
                "fecha_devolucion": fecha_entrega + timedelta(days=9),
                "checklist_devolucion": [{
                    "elemento": "Tapa del compartimento de pilas", "estado": "dano_parcial",
                    "observacion": "La tapa presenta una fisura; la calculadora enciende y funciona.",
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
