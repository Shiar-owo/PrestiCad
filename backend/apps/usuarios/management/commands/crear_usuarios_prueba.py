"""Crea cuentas compartidas para probar los roles en desarrollo."""
from django.conf import settings
from django.contrib.auth.hashers import make_password
from django.core.management.base import BaseCommand, CommandError

from apps.usuarios.models import Credencial, Rol, Usuario


CONTRASENA_PRUEBA = "PresticadDemo2026!"
USUARIOS_PRUEBA = (
    {
        "email": "prestatario@presticad.test",
        "nombre": "Prueba",
        "apellido": "Prestatario",
        "dni": "70000001",
        "tipo": "alumno",
        "rol": "prestatario",
    },
    {
        "email": "administrador@presticad.test",
        "nombre": "Prueba",
        "apellido": "Administrador",
        "dni": "70000002",
        "tipo": "administrativo",
        "rol": "administrador",
    },
    {
        "email": "gestor@presticad.test",
        "nombre": "Prueba",
        "apellido": "Gestor",
        "dni": "70000003",
        "tipo": "administrativo",
        "rol": "gestor",
    },
)


class Command(BaseCommand):
    help = "Crea las cuentas de prueba compartidas (solo en DEBUG)."

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError("Las cuentas de prueba solo se pueden crear con DEBUG=True.")

        creados = 0
        for datos in USUARIOS_PRUEBA:
            datos_usuario = datos.copy()
            nombre_rol = datos_usuario.pop("rol")
            rol = Rol.objects.get(nombre=nombre_rol)
            usuario, usuario_creado = Usuario.objects.get_or_create(
                email=datos_usuario["email"],
                defaults={
                    **datos_usuario,
                    "facultad": "Escuela Profesional de Ciencia de la Computación",
                    "departamento_carrera": "Ciencia de la Computación",
                    "rol": rol,
                    "estado": "activo",
                },
            )
            _, credencial_creada = Credencial.objects.get_or_create(
                email=usuario.email,
                defaults={
                    "usuario": usuario,
                    "password_hash": make_password(CONTRASENA_PRUEBA),
                },
            )
            if usuario_creado or credencial_creada:
                creados += 1

        self.stdout.write(self.style.SUCCESS(
            f"Cuentas de prueba listas. Cuentas nuevas o completadas: {creados}."
        ))
