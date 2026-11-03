"""Pruebas de servicios, API y concurrencia para el módulo de reservas (HU06-HU08, HU13)."""
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from datetime import timedelta
from io import BytesIO
import tempfile
from threading import Barrier
from unittest.mock import patch

from django.core.files.storage import FileSystemStorage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.db import close_old_connections
from django.test import TestCase, TransactionTestCase, override_settings
from django.utils import timezone
from PIL import Image
from rest_framework.test import APITestCase

from apps.inventario.models import InstanciaMaterial
from apps.inventario.services import (
    actualizar_instancia_material,
    crear_instancia_material,
    registrar_material,
)
from apps.prestamos.models import FotoChecklist, Garantia
from apps.prestamos.services import (
    PrestamoError,
    registrar_devolucion,
    registrar_prestamo as registrar_prestamo_real,
)
from apps.reservas.models import Reserva
from apps.reservas.services import (
    ReservaError,
    aprobar_excepcion,
    autopromover_material,
    cancelar_reserva,
    consultar_cola_material,
    consultar_mis_reservas,
    consultar_reservas_confirmadas,
    crear_reserva,
    crear_reserva_excepcional,
    expirar_reservas,
    rechazar_reserva,
)
from apps.usuarios.models import Rol
from apps.usuarios.services import registrar_usuario
from apps.usuarios.sesiones import (
    CLAVE_SESION_ULTIMA_ACTIVIDAD,
    CLAVE_SESION_USUARIO_ID,
)


CHECKLIST = [
    {"elemento": "Carcasa", "observacion": ""},
    {"elemento": "Cable", "observacion": ""},
]


def crear_foto_checklist(nombre="elemento.png"):
    contenido = BytesIO()
    Image.new("RGB", (2, 2), "white").save(contenido, format="PNG")
    return SimpleUploadedFile(nombre, contenido.getvalue(), content_type="image/png")


def crear_pdf(nombre="documento.pdf", contenido_extra=b""):
    return SimpleUploadedFile(
        nombre,
        b"%PDF-1.7\ncontenido de prueba" + contenido_extra,
        content_type="application/pdf",
    )


@contextmanager
def storage_garantias_temporal():
    with tempfile.TemporaryDirectory() as directorio:
        almacenamiento = FileSystemStorage(location=directorio)
        with (
            patch.object(
                Garantia._meta.get_field("documento_identidad"),
                "storage",
                almacenamiento,
            ),
            patch.object(
                Garantia._meta.get_field("compromiso_responsabilidad"),
                "storage",
                almacenamiento,
            ),
            patch.object(
                FotoChecklist._meta.get_field("imagen"),
                "storage",
                almacenamiento,
            ),
        ):
            yield directorio


def crear_usuario(email, dni, rol="prestatario", **cambios):
    usuario = registrar_usuario(
        nombre="Ana",
        apellido="Torres",
        email=email,
        dni=dni,
        tipo="estudiante",
        facultad="Ingeniería",
        password="ClaveSegura123!",
    )
    usuario.rol = Rol.objects.get(nombre=rol)
    for campo, valor in cambios.items():
        setattr(usuario, campo, valor)
    usuario.save()
    return usuario


def crear_material(**cambios):
    datos = {
        "nombre": "Osciloscopio Digital",
        "codigo_material": "EQ-OSC-01",
        "tipo": "equipo",
        "stock": 1,
        "precio": 150,
        "tier_minimo_requerido": "estandar",
        "tiempo_maximo_prestamo": 1440,
    }
    datos.update(cambios)
    return registrar_material(**datos)


def registrar_prestamo(**datos):
    datos.setdefault(
        "fotos_checklist",
        [crear_foto_checklist() for _ in datos.get("checklist_inicial", [])],
    )
    with storage_garantias_temporal():
        return registrar_prestamo_real(**datos)


class ReservasServiceTestCase(TestCase):
    def setUp(self):
        self.gestor = crear_usuario("gestor.res@unsa.edu.pe", "20000001", rol="gestor")
        self.prestatario_estandar = crear_usuario(
            "estandar.res@unsa.edu.pe",
            "20000002",
            reputacion_puntaje=50,
            reputacion_tier="estandar",
        )
        self.prestatario_avanzado = crear_usuario(
            "avanzado.res@unsa.edu.pe",
            "20000003",
            reputacion_puntaje=300,
            reputacion_tier="avanzado",
        )
        self.prestatario_restringido = crear_usuario(
            "restringido.res@unsa.edu.pe",
            "20000004",
            reputacion_puntaje=-120,
            reputacion_tier="restringido",
        )

    def test_crear_reserva_normal_con_instancia_disponible_confirma_24h(self):
        material = crear_material(codigo_material="EQ-RES-01", stock=1)
        ahora = timezone.now()

        reserva = crear_reserva(
            usuario=self.prestatario_estandar,
            material_id=material.id,
            prioridad="alta",
            justificacion="Práctica de laboratorio",
            ahora=ahora,
        )

        self.assertEqual(reserva.estado, "reservada")
        self.assertIsNotNone(reserva.instancia_id)
        self.assertEqual(reserva.instancia.estado, "reservado")
        self.assertEqual(reserva.fecha_limite_recojo, ahora + timedelta(hours=24))
        material.refresh_from_db()
        self.assertEqual(material.estado, "reservado")

    def test_crear_reserva_normal_sin_instancia_queda_en_espera_72h_sin_consumir_stock(self):
        material = crear_material(codigo_material="EQ-RES-02", stock=1)
        crear_reserva(
            usuario=self.prestatario_estandar,
            material_id=material.id,
            prioridad="media",
            justificacion="Primera reserva",
        )
        ahora = timezone.now()

        en_espera = crear_reserva(
            usuario=self.prestatario_avanzado,
            material_id=material.id,
            prioridad="alta",
            justificacion="Segunda solicitud",
            ahora=ahora,
        )

        self.assertEqual(en_espera.estado, "en_espera")
        self.assertIsNone(en_espera.instancia_id)
        self.assertEqual(en_espera.fecha_limite_espera, ahora + timedelta(hours=72))

    def test_orden_autopromocion_respeta_prioridad_antiguedad_y_tier(self):
        material = crear_material(
            codigo_material="EQ-RES-03",
            stock=1,
            estado_inicial_ejemplares="en_mantenimiento",
            estado="en_mantenimiento",
        )
        base = timezone.now()
        otro_estandar = crear_usuario(
            "estandar2.res@unsa.edu.pe",
            "20000005",
            reputacion_puntaje=40,
            reputacion_tier="estandar",
        )

        r_baja = crear_reserva(
            usuario=self.prestatario_avanzado,
            material_id=material.id,
            prioridad="baja",
            justificacion="Prioridad baja",
            ahora=base,
        )
        r_alta_estandar = crear_reserva(
            usuario=otro_estandar,
            material_id=material.id,
            prioridad="alta",
            justificacion="Misma fecha, tier estándar",
            ahora=base + timedelta(minutes=5),
        )
        r_alta_avanzado = crear_reserva(
            usuario=self.prestatario_avanzado,
            material_id=material.id,
            prioridad="alta",
            justificacion="Misma fecha, tier avanzado",
            ahora=base + timedelta(minutes=5),
        )

        instancia = material.instancias.first()
        instancia.estado = "disponible"
        instancia.save(update_fields=["estado", "updated_at"])

        promovidas = autopromover_material(material.id)

        self.assertEqual(len(promovidas), 1)
        self.assertEqual(promovidas[0].id, r_alta_avanzado.id)
        r_alta_avanzado.refresh_from_db()
        r_alta_estandar.refresh_from_db()
        r_baja.refresh_from_db()
        self.assertEqual(r_alta_avanzado.estado, "reservada")
        self.assertEqual(r_alta_estandar.estado, "en_espera")
        self.assertEqual(r_baja.estado, "en_espera")

    def test_autopromocion_tras_devolucion_cancelacion_vencimiento_mantenimiento_y_alta(self):
        material = crear_material(codigo_material="EQ-RES-04", stock=1)
        prestamo = registrar_prestamo(
            dni_prestatario=self.prestatario_estandar.dni,
            material_id=material.id,
            tiempo_prestamo_dias=1,
            checklist_inicial=CHECKLIST,
            registrado_por=self.gestor,
        )

        reserva_1 = crear_reserva(
            usuario=self.prestatario_avanzado,
            material_id=material.id,
            prioridad="alta",
            justificacion="Espera tras préstamo",
        )
        self.assertEqual(reserva_1.estado, "en_espera")

        # 1. Devolución sin daños -> libera instancia -> autopromueve reserva_1
        with self.captureOnCommitCallbacks(execute=True):
            registrar_devolucion(
                prestamo_id=prestamo.id,
                checklist_devolucion=[
                    {"elemento": "Carcasa", "estado": "sin_cambios", "observacion": ""},
                    {"elemento": "Cable", "estado": "sin_cambios", "observacion": ""},
                ],
                realizado_por=self.gestor,
            )

        reserva_1.refresh_from_db()
        self.assertEqual(reserva_1.estado, "reservada")

        # 2. Cancelación manual del gestor -> autopromueve reserva_2
        reserva_2 = crear_reserva(
            usuario=self.prestatario_estandar,
            material_id=material.id,
            prioridad="media",
            justificacion="Espera tras reserva 1",
        )
        self.assertEqual(reserva_2.estado, "en_espera")

        cancelar_reserva(
            reserva_id=reserva_1.id,
            motivo="Solicitada cancelación en ventanilla",
            realizado_por=self.gestor,
        )
        reserva_1.refresh_from_db()
        reserva_2.refresh_from_db()
        self.assertEqual(reserva_1.estado, "cancelada")
        self.assertEqual(reserva_2.estado, "reservada")

        # 3. Vencimiento de reserva_2 -> autopromueve reserva_3 y penaliza a prestatario_estandar
        self.prestatario_estandar.refresh_from_db()
        puntaje_antes = self.prestatario_estandar.reputacion_puntaje
        reserva_3 = crear_reserva(
            usuario=self.prestatario_avanzado,
            material_id=material.id,
            prioridad="baja",
            justificacion="Espera tras reserva 2",
        )
        futuro = reserva_2.fecha_limite_recojo + timedelta(minutes=5)
        resumen = expirar_reservas(ahora=futuro)
        self.assertEqual(resumen["reservas_vencidas"], 1)
        self.assertEqual(resumen["reservas_promovidas"], 1)

        reserva_2.refresh_from_db()
        reserva_3.refresh_from_db()
        self.prestatario_estandar.refresh_from_db()
        self.assertEqual(reserva_2.estado, "cancelada_por_vencimiento")
        self.assertEqual(reserva_3.estado, "reservada")
        self.assertEqual(self.prestatario_estandar.reputacion_puntaje, puntaje_antes - 20)

        # 4. Alta de ejemplar nuevo -> autopromueve reserva_4
        reserva_4 = crear_reserva(
            usuario=self.prestatario_estandar,
            material_id=material.id,
            prioridad="alta",
            justificacion="Espera de nuevo ejemplar",
        )
        self.assertEqual(reserva_4.estado, "en_espera")
        with self.captureOnCommitCallbacks(execute=True):
            crear_instancia_material(
                material.id,
                codigo_ejemplar="EQ-RES-04-02",
                estado="disponible",
            )
        reserva_4.refresh_from_db()
        self.assertEqual(reserva_4.estado, "reservada")

        # 5. Mantenimiento -> disponible autopromueve reserva_5
        instancia_mant = crear_instancia_material(
            material.id,
            codigo_ejemplar="EQ-RES-04-03",
            estado="en_mantenimiento",
        )
        otro = crear_usuario("otro.res@unsa.edu.pe", "20000006", reputacion_tier="estandar")
        reserva_5 = crear_reserva(
            usuario=otro,
            material_id=material.id,
            prioridad="alta",
            justificacion="Espera de salida de mantenimiento",
        )
        self.assertEqual(reserva_5.estado, "en_espera")
        with self.captureOnCommitCallbacks(execute=True):
            actualizar_instancia_material(instancia_mant.id, estado="disponible")
        reserva_5.refresh_from_db()
        self.assertEqual(reserva_5.estado, "reservada")

    def test_expiracion_de_espera_sin_penalizacion_y_rechazo_manual(self):
        material = crear_material(
            codigo_material="EQ-RES-05",
            stock=1,
            estado_inicial_ejemplares="en_mantenimiento",
            estado="en_mantenimiento",
        )
        ahora = timezone.now()
        r1 = crear_reserva(
            usuario=self.prestatario_estandar,
            material_id=material.id,
            prioridad="media",
            justificacion="Espera que vencerá",
            ahora=ahora,
        )
        r2 = crear_reserva(
            usuario=self.prestatario_avanzado,
            material_id=material.id,
            prioridad="alta",
            justificacion="Espera que será rechazada",
            ahora=ahora,
        )

        rechazar_reserva(reserva_id=r2.id, motivo="Justificación insuficiente")
        r2.refresh_from_db()
        self.assertEqual(r2.estado, "rechazada")

        puntaje_antes = self.prestatario_estandar.reputacion_puntaje
        resumen = expirar_reservas(ahora=ahora + timedelta(hours=73))
        self.assertEqual(resumen["solicitudes_expiradas"], 1)
        r1.refresh_from_db()
        self.prestatario_estandar.refresh_from_db()
        self.assertEqual(r1.estado, "expirada")
        self.assertEqual(self.prestatario_estandar.reputacion_puntaje, puntaje_antes)

    @override_settings(MAXIMO_RESERVAS_ACTIVAS=2)
    def test_maximo_reservas_activas_bloquea_exceso(self):
        m1 = crear_material(codigo_material="EQ-MAX-01", stock=1)
        m2 = crear_material(codigo_material="EQ-MAX-02", stock=1)
        m3 = crear_material(codigo_material="EQ-MAX-03", stock=1)

        crear_reserva(
            usuario=self.prestatario_estandar,
            material_id=m1.id,
            prioridad="media",
            justificacion="Uno",
        )
        crear_reserva(
            usuario=self.prestatario_estandar,
            material_id=m2.id,
            prioridad="media",
            justificacion="Dos",
        )

        with self.assertRaises(ReservaError) as ctx:
            crear_reserva(
                usuario=self.prestatario_estandar,
                material_id=m3.id,
                prioridad="media",
                justificacion="Tres",
            )
        self.assertEqual(ctx.exception.status_code, 409)

    def test_reserva_excepcional_no_autopromueve_aprueba_y_convierte_reutilizando_garantia(self):
        material = crear_material(
            codigo_material="EQ-EXC-01",
            stock=1,
            tier_minimo_requerido="estandar",
        )

        # Rechaza reserva normal de usuario restringido
        with self.assertRaises(ReservaError) as ctx:
            crear_reserva(
                usuario=self.prestatario_restringido,
                material_id=material.id,
                prioridad="alta",
                justificacion="Intento normal",
            )
        self.assertIn("excepcional", ctx.exception.mensaje)

        with storage_garantias_temporal():
            reserva_exc = crear_reserva_excepcional(
                usuario=self.prestatario_restringido,
                material_id=material.id,
                prioridad="alta",
                justificacion="Tesis de grado urgente",
                documento_identidad=crear_pdf("dni.pdf"),
                compromiso_responsabilidad=crear_pdf("compromiso.pdf"),
            )
            self.assertEqual(reserva_exc.estado, "en_espera")
            self.assertTrue(reserva_exc.es_excepcion)
            self.assertTrue(reserva_exc.garantia_completa)

            # No participa en autopromoción automática
            promovidas = autopromover_material(material.id)
            self.assertEqual(promovidas, [])
            reserva_exc.refresh_from_db()
            self.assertEqual(reserva_exc.estado, "en_espera")

            # El gestor aprueba la excepción -> pasa a reservada con ejemplar asignado
            aprobada = aprobar_excepcion(
                reserva_id=reserva_exc.id,
                realizado_por=self.gestor,
            )
            self.assertEqual(aprobada.estado, "reservada")
            self.assertIsNotNone(aprobada.instancia_id)
            self.assertEqual(aprobada.instancia.estado, "reservado")

            # Préstamo directo sobre instancia reservada sin reserva_id es rechazado
            with self.assertRaises(PrestamoError) as err_directo:
                registrar_prestamo_real(
                    dni_prestatario=self.prestatario_estandar.dni,
                    material_id=material.id,
                    instancia_id=aprobada.instancia_id,
                    tiempo_prestamo_dias=1,
                    checklist_inicial=CHECKLIST,
                    fotos_checklist=[crear_foto_checklist() for _ in CHECKLIST],
                    registrado_por=self.gestor,
                )
            self.assertEqual(err_directo.exception.status_code, 409)

            # Conversión válida con reserva_id reutilizando la garantía sin volver a subir PDFs
            prestamo = registrar_prestamo_real(
                dni_prestatario=self.prestatario_restringido.dni,
                material_id=material.id,
                reserva_id=aprobada.id,
                tiempo_prestamo_dias=1,
                checklist_inicial=CHECKLIST,
                fotos_checklist=[crear_foto_checklist() for _ in CHECKLIST],
                registrado_por=self.gestor,
            )
            self.assertTrue(prestamo.es_excepcion)
            self.assertTrue(prestamo.garantia_completa)
            aprobada.refresh_from_db()
            self.assertEqual(aprobada.estado, "convertida_en_prestamo")
            self.assertEqual(aprobada.prestamo_id, prestamo.id)
            self.assertEqual(aprobada.instancia.estado, "prestado")

            # Devolución con daño parcial duplica solo puntos de daño
            devolucion = registrar_devolucion(
                prestamo_id=prestamo.id,
                checklist_devolucion=[
                    {"elemento": "Carcasa", "estado": "dano_parcial", "observacion": "Rayadura"},
                    {"elemento": "Cable", "estado": "sin_cambios", "observacion": ""},
                ],
                fotos_checklist=[crear_foto_checklist(), None],
                realizado_por=self.gestor,
            )
            self.assertEqual(
                devolucion.resultado["deduccion_dano"],
                material.deduccion_dano_parcial * 2,
            )


class ReservasAPITestCase(APITestCase):
    def setUp(self):
        self.gestor = crear_usuario("gestor.api.res@unsa.edu.pe", "30000001", rol="gestor")
        self.prestatario = crear_usuario(
            "prest.api.res@unsa.edu.pe",
            "30000002",
            reputacion_puntaje=60,
            reputacion_tier="estandar",
        )
        self.restringido = crear_usuario(
            "rest.api.res@unsa.edu.pe",
            "30000003",
            reputacion_puntaje=-100,
            reputacion_tier="restringido",
        )
        self.material = crear_material(codigo_material="EQ-API-RES-01", stock=1)

    def _autenticar(self, usuario):
        sesion = self.client.session
        sesion[CLAVE_SESION_USUARIO_ID] = usuario.id
        sesion[CLAVE_SESION_ULTIMA_ACTIVIDAD] = timezone.now().isoformat()
        sesion.save()

    def test_flujo_api_reserva_normal_cola_confirmadas_y_cancelacion(self):
        self._autenticar(self.prestatario)
        respuesta = self.client.post(
            "/api/reservas/",
            {
                "material_id": str(self.material.id),
                "prioridad": "alta",
                "justificacion": "Uso en proyecto final",
            },
            format="json",
        )
        self.assertEqual(respuesta.status_code, 201)
        reserva_id = respuesta.data["id"]
        self.assertEqual(respuesta.data["estado"], "reservada")

        mis_res = self.client.get("/api/reservas/mis-reservas/")
        self.assertEqual(mis_res.status_code, 200)
        self.assertEqual(len(mis_res.data), 1)

        # Gestor consulta cola y confirmadas
        self._autenticar(self.gestor)
        cola = self.client.get(f"/api/reservas/cola/{self.material.id}/")
        self.assertEqual(cola.status_code, 200)
        self.assertEqual(len(cola.data["reservas_confirmadas"]), 1)

        confirmadas = self.client.get(
            f"/api/reservas/confirmadas/?dni={self.prestatario.dni}"
        )
        self.assertEqual(confirmadas.status_code, 200)
        self.assertEqual(len(confirmadas.data), 1)

        cancelada = self.client.post(
            f"/api/reservas/{reserva_id}/cancelar/",
            {"motivo": "Cancelado a solicitud"},
            format="json",
        )
        self.assertEqual(cancelada.status_code, 200)
        self.assertEqual(cancelada.data["estado"], "cancelada")

    def test_flujo_api_reserva_excepcional_aprobacion_y_descarga_garantia(self):
        with storage_garantias_temporal():
            self._autenticar(self.restringido)
            respuesta = self.client.post(
                "/api/reservas/excepcion/",
                {
                    "material_id": str(self.material.id),
                    "prioridad": "alta",
                    "justificacion": "Excepción académica laboratorio",
                    "documento_identidad": crear_pdf("dni.pdf"),
                    "compromiso_responsabilidad": crear_pdf("compromiso.pdf"),
                },
                format="multipart",
            )
            self.assertEqual(respuesta.status_code, 201)
            reserva_id = respuesta.data["id"]
            self.assertTrue(respuesta.data["es_excepcion"])
            self.assertEqual(respuesta.data["estado"], "en_espera")

            # Descarga de garantía por titular
            descarga = self.client.get(
                f"/api/reservas/{reserva_id}/garantia/documento-identidad/"
            )
            self.assertEqual(descarga.status_code, 200)

            # Gestor aprueba mediante PUT
            self._autenticar(self.gestor)
            aprobada = self.client.put(
                f"/api/reservas/{reserva_id}/aprobar-excepcion/",
                format="json",
            )
            self.assertEqual(aprobada.status_code, 200)
            self.assertEqual(aprobada.data["estado"], "reservada")

    def test_comando_procesar_reservas_ejecuta_correctamente(self):
        salida = call_command("procesar_reservas")
        self.assertIn("reservas_vencidas=", salida)


class ReservasConcurrenciaTestCase(TransactionTestCase):
    def setUp(self):
        self.u1 = crear_usuario("conc1@unsa.edu.pe", "40000001", reputacion_tier="estandar")
        self.u2 = crear_usuario("conc2@unsa.edu.pe", "40000002", reputacion_tier="estandar")
        self.material = crear_material(codigo_material="EQ-CONC-01", stock=1)

    def test_dos_reservas_simultaneas_por_una_instancia_confirman_una_y_dejan_otra_en_espera(self):
        barrera = Barrier(2)

        def solicitar(usuario):
            close_old_connections()
            try:
                barrera.wait(timeout=5)
                return crear_reserva(
                    usuario=usuario,
                    material_id=self.material.id,
                    prioridad="alta",
                    justificacion="Solicitud concurrente",
                )
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=2) as pool:
            resultados = list(pool.map(solicitar, [self.u1, self.u2]))

        estados = sorted(r.estado for r in resultados)
        self.assertEqual(estados, ["en_espera", "reservada"])
        instancia = InstanciaMaterial.objects.get(material=self.material)
        self.assertEqual(instancia.estado, "reservado")
