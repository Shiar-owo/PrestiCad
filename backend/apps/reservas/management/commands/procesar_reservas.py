from django.core.management.base import BaseCommand

from apps.reservas.services import expirar_reservas


class Command(BaseCommand):
    help = (
        "Procesa vencimientos de reservas confirmadas (24 h), solicitudes en espera (72 h) "
        "y ejecuta autopromociones pendientes."
    )

    def handle(self, *args, **options):
        resumen = expirar_reservas()
        mensaje = (
            "Procesamiento de reservas completado: "
            f"reservas_vencidas={resumen['reservas_vencidas']}, "
            f"solicitudes_expiradas={resumen['solicitudes_expiradas']}, "
            f"instancias_liberadas={resumen['instancias_liberadas']}, "
            f"reservas_promovidas={resumen['reservas_promovidas']}"
        )
        self.stdout.write(self.style.SUCCESS(mensaje))
        return mensaje
