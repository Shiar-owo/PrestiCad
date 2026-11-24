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
    consultar_cola_general,
    consultar_cola_material,
    consultar_mis_reservas,
    consultar_reservas_confirmadas,
    crear_reserva as crear_reserva_real,
    crear_reserva_excepcional as crear_reserva_excepcional_real,
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


def _rango_reserva_futuro():
    inicio = timezone.localtime(timezone.now()).replace(second=0, microsecond=0) + timedelta(days=1)
    while inicio.weekday() > 4:
        inicio += timedelta(days=1)
    inicio = inicio.replace(hour=10, minute=0)
    return inicio, inicio + timedelta(hours=1)


def crear_reserva(**datos):
    if datos.get("fecha_inicio") is None and datos.get("fecha_fin") is None:
        datos["fecha_inicio"], datos["fecha_fin"] = _rango_reserva_futuro()
    return crear_reserva_real(**datos)


def crear_reserva_excepcional(**datos):
    if datos.get("fecha_inicio") is None and datos.get("fecha_fin") is None:
        datos["fecha_inicio"], datos["fecha_fin"] = _rango_reserva_futuro()
    return crear_reserva_excepcional_real(**datos)


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
            justificacion="Práctica de laboratorio",
            ahora=ahora,
        )

        self.assertEqual(reserva.estado, "reservada")
        self.assertIsNotNone(reserva.instancia_id)
        self.assertEqual(reserva.instancia.estado, "reservado")
        self.assertEqual(reserva.fecha_limite_recojo, reserva.fecha_fin)
        material.refresh_from_db()
        self.assertEqual(material.estado, "reservado")

    def test_crear_reserva_normal_sin_instancia_rechaza_sin_entrar_en_espera(self):
        material = crear_material(codigo_material="EQ-RES-02", stock=1)
        crear_reserva(
            usuario=self.prestatario_estandar,
            material_id=material.id,
            justificacion="Primera reserva",
        )
        with self.assertRaises(ReservaError) as error:
            crear_reserva(
                usuario=self.prestatario_avanzado,
                material_id=material.id,
                justificacion="Segunda solicitud",
            )

        self.assertEqual(error.exception.status_code, 409)
        self.assertIn("No hay ejemplares disponibles", error.exception.mensaje)
        self.assertEqual(Reserva.objects.filter(material=material).count(), 1)

    def test_sin_ejemplares_no_se_crea_reserva_en_espera(self):
        material = crear_material(
            codigo_material="EQ-RES-03",
            stock=1,
            estado_inicial_ejemplares="en_mantenimiento",
            estado="en_mantenimiento",
        )
        with self.assertRaises(ReservaError):
            crear_reserva(
                usuario=self.prestatario_estandar,
                material_id=material.id,
                justificacion="No hay ejemplares libres",
            )

        self.assertFalse(Reserva.objects.filter(material=material, estado="en_espera").exists())

    def test_prestamo_activo_impide_reservar_un_rango_que_se_solapa(self):
        material = crear_material(codigo_material="EQ-RES-04", stock=1)
        prestamo = registrar_prestamo(
            dni_prestatario=self.prestatario_estandar.dni,
            material_id=material.id,
            tiempo_prestamo_dias=1,
            checklist_inicial=CHECKLIST,
            registrado_por=self.gestor,
        )

        with self.assertRaises(ReservaError) as error:
            crear_reserva(
                usuario=self.prestatario_avanzado,
                material_id=material.id,
                justificacion="Rango ocupado por un préstamo activo",
            )

        self.assertEqual(error.exception.status_code, 409)
        self.assertEqual(Reserva.objects.filter(material=material).count(), 0)
        self.assertEqual(prestamo.estado, "activo")

    def test_solicitud_sin_disponibilidad_se_rechaza_sin_penalizacion(self):
        material = crear_material(
            codigo_material="EQ-RES-05",
            stock=1,
            estado_inicial_ejemplares="en_mantenimiento",
            estado="en_mantenimiento",
        )
        puntaje_antes = self.prestatario_estandar.reputacion_puntaje
        with self.assertRaises(ReservaError) as error:
            crear_reserva(
                usuario=self.prestatario_estandar,
                material_id=material.id,
                justificacion="No hay ejemplares disponibles",
            )
        self.assertEqual(error.exception.status_code, 409)
        self.assertFalse(Reserva.objects.filter(material=material).exists())
        self.assertEqual(self.prestatario_estandar.reputacion_puntaje, puntaje_antes)

    @override_settings(MAXIMO_RESERVAS_ACTIVAS=2)
    def test_maximo_reservas_activas_bloquea_exceso(self):
        m1 = crear_material(codigo_material="EQ-MAX-01", stock=1)
        m2 = crear_material(codigo_material="EQ-MAX-02", stock=1)
        m3 = crear_material(codigo_material="EQ-MAX-03", stock=1)

        crear_reserva(
            usuario=self.prestatario_estandar,
            material_id=m1.id,
            justificacion="Uno",
        )
        crear_reserva(
            usuario=self.prestatario_estandar,
            material_id=m2.id,
            justificacion="Dos",
        )

        with self.assertRaises(ReservaError) as ctx:
            crear_reserva(
                usuario=self.prestatario_estandar,
                material_id=m3.id,
                justificacion="Tres",
            )
        self.assertEqual(ctx.exception.status_code, 409)

    def test_reserva_excepcional_permite_estandar_con_material_avanzado(self):
        material = crear_material(
            codigo_material="EQ-EXC-ESTANDAR",
            stock=1,
            tier_minimo_requerido="avanzado",
        )

        with self.assertRaises(ReservaError) as ctx:
            crear_reserva(
                usuario=self.prestatario_estandar,
                material_id=material.id,
                justificacion="Intento normal",
            )
        self.assertIn("excepcional", ctx.exception.mensaje)

        with storage_garantias_temporal():
            reserva = crear_reserva_excepcional(
                usuario=self.prestatario_estandar,
                material_id=material.id,
                justificacion="Práctica de laboratorio avanzada",
                documento_identidad=crear_pdf("dni-estandar.pdf"),
                compromiso_responsabilidad=crear_pdf("compromiso-estandar.pdf"),
            )

        self.assertEqual(reserva.estado, "en_espera")
        self.assertTrue(reserva.es_excepcion)
        self.assertTrue(reserva.garantia_completa)

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
                justificacion="Intento normal",
            )
        self.assertIn("excepcional", ctx.exception.mensaje)

        with storage_garantias_temporal():
            reserva_exc = crear_reserva_excepcional(
                usuario=self.prestatario_restringido,
                material_id=material.id,
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

            with self.assertRaises(PrestamoError) as antes_del_inicio:
                registrar_prestamo_real(
                    dni_prestatario=self.prestatario_restringido.dni,
                    material_id=material.id,
                    reserva_id=aprobada.id,
                    tiempo_prestamo_dias=1,
                    checklist_inicial=CHECKLIST,
                    fotos_checklist=[crear_foto_checklist() for _ in CHECKLIST],
                    registrado_por=self.gestor,
                )
            self.assertIn("antes de la fecha de inicio", antes_del_inicio.exception.mensaje)

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
            ahora_entrega = timezone.now()
            aprobada.fecha_inicio = ahora_entrega - timedelta(minutes=1)
            aprobada.fecha_fin = ahora_entrega + timedelta(hours=23)
            aprobada.save(update_fields=["fecha_inicio", "fecha_fin", "updated_at"])
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
            self.assertEqual(prestamo.fecha_entrega, aprobada.fecha_inicio)
            self.assertEqual(prestamo.fecha_limite, aprobada.fecha_fin)
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

    def test_solicitud_excepcional_sin_ejemplar_disponible_se_rechaza(self):
        material = crear_material(
            codigo_material="EQ-EXC-SIN-INSTANCIA",
            stock=1,
            estado_inicial_ejemplares="en_mantenimiento",
            estado="en_mantenimiento",
            tier_minimo_requerido="estandar",
        )
        with storage_garantias_temporal():
            with self.assertRaises(ReservaError) as error:
                crear_reserva_excepcional(
                    usuario=self.prestatario_restringido,
                    material_id=material.id,
                    justificacion="Tesis sin copias libres",
                    documento_identidad=crear_pdf("dni.pdf"),
                    compromiso_responsabilidad=crear_pdf("compromiso.pdf"),
                )
        self.assertEqual(error.exception.status_code, 409)
        self.assertFalse(Reserva.objects.filter(material=material).exists())

    def test_mismo_prestatario_no_reserva_ejemplar_prestado_en_rango_solapado(self):
        material = crear_material(codigo_material="EQ-RES-MISMO", stock=1)
        prestamo = registrar_prestamo(
            dni_prestatario=self.prestatario_estandar.dni,
            material_id=material.id,
            tiempo_prestamo_dias=1,
            checklist_inicial=CHECKLIST,
            registrado_por=self.gestor,
        )
        inicio, fin = _rango_reserva_futuro()
        with self.assertRaises(ReservaError) as error:
            crear_reserva(
                usuario=self.prestatario_estandar,
                material_id=material.id,
                justificacion="Quiero seguir usándolo",
                fecha_inicio=inicio,
                fecha_fin=fin,
            )

        self.assertEqual(error.exception.status_code, 409)
        self.assertEqual(prestamo.estado, "activo")
        self.assertFalse(Reserva.objects.filter(material=material).exists())


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

    def _rango_fechas(self):
        inicio, fin = _rango_reserva_futuro()
        return {"fecha_inicio": inicio.isoformat(), "fecha_fin": fin.isoformat()}

    def test_flujo_api_reserva_normal_cola_confirmadas_y_cancelacion(self):
        self._autenticar(self.prestatario)
        respuesta = self.client.post(
            "/api/reservas/",
            {
                "material_id": str(self.material.id),
                "justificacion": "Uso en proyecto final",
                **self._rango_fechas(),
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

        detalle = self.client.get(f"/api/reservas/confirmadas/{reserva_id}/")
        self.assertEqual(detalle.status_code, 200)
        self.assertEqual(detalle.data["id"], reserva_id)
        self.assertEqual(detalle.data["usuario"]["dni"], self.prestatario.dni)
        self.assertEqual(detalle.data["material"]["id"], str(self.material.id))
        self.assertTrue(detalle.data["instancia"]["id"])

        cancelada = self.client.post(
            f"/api/reservas/{reserva_id}/cancelar/",
            {"motivo": "Cancelado a solicitud"},
            format="json",
        )
        self.assertEqual(cancelada.status_code, 200)
        self.assertEqual(cancelada.data["estado"], "cancelada")

    def test_api_reserva_rechaza_fechas_ausentes_o_inicio_actual(self):
        self._autenticar(self.prestatario)
        base = {"material_id": str(self.material.id), "justificacion": "Prueba de fechas"}
        sin_fechas = self.client.post("/api/reservas/", base, format="json")
        self.assertEqual(sin_fechas.status_code, 400)
        inicio, fin = _rango_reserva_futuro()
        pasado = self.client.post(
            "/api/reservas/",
            {**base, "fecha_inicio": (timezone.now() - timedelta(minutes=1)).isoformat(), "fecha_fin": fin.isoformat()},
            format="json",
        )
        self.assertEqual(pasado.status_code, 400)
        self.assertIn("fecha_inicio", pasado.data)

        menor_1h = self.client.post(
            "/api/reservas/",
            {
                **base,
                "fecha_inicio": inicio.isoformat(),
                "fecha_fin": (inicio + timedelta(minutes=59)).isoformat(),
            },
            format="json",
        )
        self.assertEqual(menor_1h.status_code, 400)
        self.assertIn("fecha_fin", menor_1h.data)
        self.assertIn("1 hora (60 minutos)", str(menor_1h.data["fecha_fin"]))

    def test_api_reserva_permite_cruzar_fin_de_semana_y_cuenta_todos_los_dias_intermedios(self):
        self._autenticar(self.prestatario)
        # Configurar tiempo máximo de al menos 4 días (5760 min) para permitir 72h
        self.material.tiempo_maximo_prestamo = 5760
        self.material.save(update_fields=["tiempo_maximo_prestamo", "updated_at"])

        viernes = timezone.localtime(timezone.now()).replace(
            hour=14, minute=0, second=0, microsecond=0
        ) + timedelta(days=1)
        while viernes.weekday() != 4:
            viernes += timedelta(days=1)
        lunes = viernes + timedelta(days=3)

        respuesta = self.client.post(
            "/api/reservas/",
            {
                "material_id": str(self.material.id),
                "justificacion": "Reserva de viernes a lunes cruzando fin de semana",
                "fecha_inicio": viernes.isoformat(),
                "fecha_fin": lunes.isoformat(),
            },
            format="json",
        )
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        reserva_id = respuesta.data["id"]

        with patch(
            "apps.prestamos.services.timezone.now",
            return_value=viernes + timedelta(minutes=10),
        ):
            prestamo = registrar_prestamo(
                dni_prestatario=self.prestatario.dni,
                material_id=self.material.id,
                reserva_id=reserva_id,
                tiempo_prestamo_minutos=4320,
                checklist_inicial=CHECKLIST,
                registrado_por=self.gestor,
            )
        # Los días intermedios (sábado y domingo) sí cuentan en la duración total (72 h = 4320 min)
        self.assertEqual(prestamo.tiempo_prestamo_minutos, 4320)
        self.assertEqual(prestamo.fecha_entrega, viernes)
        self.assertEqual(prestamo.fecha_limite, lunes)

    def test_reserva_rechaza_inicio_o_fin_en_sabado_o_domingo(self):
        self._autenticar(self.prestatario)
        sabado = timezone.localtime(timezone.now()).replace(hour=10, minute=0, second=0, microsecond=0) + timedelta(days=1)
        while sabado.weekday() != 5:
            sabado += timedelta(days=1)
        lunes = sabado + timedelta(days=2)
        viernes = sabado - timedelta(days=1)

        # Inicio en sábado
        resp_sab_inicio = self.client.post(
            "/api/reservas/",
            {
                "material_id": str(self.material.id),
                "justificacion": "Intento de reserva sábado",
                "fecha_inicio": sabado.isoformat(),
                "fecha_fin": lunes.isoformat(),
            },
            format="json",
        )
        self.assertEqual(resp_sab_inicio.status_code, 400)
        self.assertIn("fecha_inicio", resp_sab_inicio.data)

        # Fin en domingo
        domingo = sabado + timedelta(days=1)
        resp_dom_fin = self.client.post(
            "/api/reservas/",
            {
                "material_id": str(self.material.id),
                "justificacion": "Intento fin domingo",
                "fecha_inicio": viernes.isoformat(),
                "fecha_fin": domingo.isoformat(),
            },
            format="json",
        )
        self.assertEqual(resp_dom_fin.status_code, 400)
        self.assertIn("fecha_fin", resp_dom_fin.data)

    def test_reserva_rechaza_horario_fuera_de_atencion(self):
        self._autenticar(self.prestatario)
        lunes = timezone.localtime(timezone.now()).replace(hour=8, minute=30, second=0, microsecond=0) + timedelta(days=1)
        while lunes.weekday() != 0:
            lunes += timedelta(days=1)

        # Inicio antes de las 09:00
        resp = self.client.post(
            "/api/reservas/",
            {
                "material_id": str(self.material.id),
                "justificacion": "Muy temprano",
                "fecha_inicio": lunes.isoformat(),
                "fecha_fin": lunes.replace(hour=12).isoformat(),
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("fecha_inicio", resp.data)

        # Fin después de las 17:00
        resp_tarde = self.client.post(
            "/api/reservas/",
            {
                "material_id": str(self.material.id),
                "justificacion": "Muy tarde",
                "fecha_inicio": lunes.replace(hour=10).isoformat(),
                "fecha_fin": lunes.replace(hour=17, minute=30).isoformat(),
            },
            format="json",
        )
        self.assertEqual(resp_tarde.status_code, 400)
        self.assertIn("fecha_fin", resp_tarde.data)

    def test_reserva_fines_de_semana_intermedios_cuentan_hacia_limite_maximo(self):
        self._autenticar(self.prestatario)
        # Material con tiempo máximo de 48 horas (2880 min)
        material_corto = crear_material(
            codigo_material="EQ-CORTO-01",
            stock=1,
            tiempo_maximo_prestamo=2880,
        )
        viernes = timezone.localtime(timezone.now()).replace(hour=10, minute=0, second=0, microsecond=0) + timedelta(days=1)
        while viernes.weekday() != 4:
            viernes += timedelta(days=1)
        # Viernes 10:00 a Lunes 10:00 = 72 horas corridas (4320 min) > 2880 min
        lunes = viernes + timedelta(days=3)

        resp = self.client.post(
            "/api/reservas/",
            {
                "material_id": str(material_corto.id),
                "justificacion": "Prueba duración corrida fin de semana",
                "fecha_inicio": viernes.isoformat(),
                "fecha_fin": lunes.isoformat(),
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("fecha_fin", resp.data)
        self.assertIn("supera el tiempo máximo permitido", str(resp.data["fecha_fin"]))

    def test_endpoint_conversion_rechaza_reserva_vencida_o_sin_instancia(self):
        self._autenticar(self.prestatario)
        respuesta = self.client.post(
            "/api/reservas/",
            {"material_id": str(self.material.id), "justificacion": "Prueba de vigencia", **self._rango_fechas()},
            format="json",
        )
        reserva = Reserva.objects.get(pk=respuesta.data["id"])
        self._autenticar(self.gestor)

        reserva.fecha_limite_recojo = timezone.now() - timedelta(minutes=31)
        reserva.save(update_fields=["fecha_limite_recojo", "updated_at"])
        vencida = self.client.get(f"/api/reservas/confirmadas/{reserva.id}/")
        self.assertEqual(vencida.status_code, 404)
        cola_vencida = self.client.get("/api/reservas/cola/")
        self.assertNotIn(
            str(reserva.id),
            [r["id"] for r in cola_vencida.data["reservas_confirmadas"]],
        )

        reserva.fecha_limite_recojo = timezone.now() + timedelta(hours=1)
        reserva.instancia = None
        reserva.save(update_fields=["fecha_limite_recojo", "instancia", "updated_at"])
        sin_instancia = self.client.get(f"/api/reservas/confirmadas/{reserva.id}/")
        self.assertEqual(sin_instancia.status_code, 404)
        cola_sin_instancia = self.client.get("/api/reservas/cola/")
        self.assertNotIn(
            str(reserva.id),
            [r["id"] for r in cola_sin_instancia.data["reservas_confirmadas"]],
        )

        reserva.instancia = self.material.instancias.first()
        reserva.save(update_fields=["instancia", "updated_at"])
        reserva.instancia.estado = "disponible"
        reserva.instancia.save(update_fields=["estado", "updated_at"])
        instancia_libre = self.client.get(f"/api/reservas/confirmadas/{reserva.id}/")
        self.assertEqual(instancia_libre.status_code, 404)
        cola_instancia_libre = self.client.get("/api/reservas/cola/")
        self.assertNotIn(
            str(reserva.id),
            [r["id"] for r in cola_instancia_libre.data["reservas_confirmadas"]],
        )

    def test_endpoint_conversion_conserva_tolerancia_de_recojo_de_30_minutos(self):
        self._autenticar(self.prestatario)
        respuesta = self.client.post(
            "/api/reservas/",
            {"material_id": str(self.material.id), "justificacion": "Prueba de tolerancia", **self._rango_fechas()},
            format="json",
        )
        reserva = Reserva.objects.get(pk=respuesta.data["id"])
        reserva.fecha_limite_recojo = timezone.now() - timedelta(minutes=29)
        reserva.save(update_fields=["fecha_limite_recojo", "updated_at"])
        self._autenticar(self.gestor)

        detalle = self.client.get(f"/api/reservas/confirmadas/{reserva.id}/")
        self.assertEqual(detalle.status_code, 200)
        cola = self.client.get("/api/reservas/cola/")
        self.assertIn(
            str(reserva.id),
            [r["id"] for r in cola.data["reservas_confirmadas"]],
        )

    def test_endpoint_conversion_solo_permite_acceso_al_gestor_y_administrador(self):
        self._autenticar(self.prestatario)
        respuesta = self.client.post(
            "/api/reservas/",
            {"material_id": str(self.material.id), "justificacion": "Prueba de permisos", **self._rango_fechas()},
            format="json",
        )

        denegada = self.client.get(f"/api/reservas/confirmadas/{respuesta.data['id']}/")
        self.assertEqual(denegada.status_code, 403)

        administrador = crear_usuario("admin.api.res@unsa.edu.pe", "30000009", rol="administrador")
        self._autenticar(administrador)
        permitida = self.client.get(f"/api/reservas/confirmadas/{respuesta.data['id']}/")
        self.assertEqual(permitida.status_code, 200)

    def test_flujo_api_reserva_excepcional_aprobacion_y_descarga_garantia(self):
        with storage_garantias_temporal():
            self._autenticar(self.restringido)
            respuesta = self.client.post(
                "/api/reservas/excepcion/",
                {
                    "material_id": str(self.material.id),
                    "justificacion": "Excepción académica laboratorio",
                    **self._rango_fechas(),
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

    def test_dos_reservas_simultaneas_confirman_una_y_rechazan_la_otra(self):
        barrera = Barrier(2)

        def solicitar(usuario):
            close_old_connections()
            try:
                barrera.wait(timeout=5)
                try:
                    return crear_reserva(
                        usuario=usuario,
                        material_id=self.material.id,
                        justificacion="Solicitud concurrente",
                    )
                except ReservaError:
                    return None
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=2) as pool:
            resultados = list(pool.map(solicitar, [self.u1, self.u2]))

        reservas_confirmadas = [reserva for reserva in resultados if reserva is not None]
        rechazadas = sum(reserva is None for reserva in resultados)
        self.assertEqual(len(reservas_confirmadas), 1)
        self.assertEqual(rechazadas, 1)
        self.assertEqual(reservas_confirmadas[0].estado, "reservada")
        instancia = InstanciaMaterial.objects.get(material=self.material)
        self.assertEqual(instancia.estado, "reservado")



class ReservasCalendarioTestCase(APITestCase):
    """Pruebas de disponibilidad temporal, solapamiento y reservas múltiples por calendario."""

    def setUp(self):
        self.prestatario_1 = crear_usuario("cal1@unsa.edu.pe", "45000001", reputacion_tier="estandar")
        self.prestatario_2 = crear_usuario("cal2@unsa.edu.pe", "45000002", reputacion_tier="estandar")
        self.prestatario_3 = crear_usuario("cal3@unsa.edu.pe", "45000003", reputacion_tier="estandar")
        self.gestor = crear_usuario("gestor_cal@unsa.edu.pe", "45000004", rol_nombre="gestor")
        self.material = crear_material(
            codigo_material="CAL-01",
            stock=1,
            tier_minimo_requerido="estandar",
            tiempo_maximo_prestamo=1440 * 7,
        )

    def test_multiples_reservas_en_distintas_fechas_confirman_sin_bloquearse(self):
        """Un mismo ejemplar puede reservarse en distintas fechas no solapadas."""
        hoy = timezone.localtime(timezone.now()).replace(second=0, microsecond=0)
        proximo_lunes = hoy + timedelta(days=1)
        while proximo_lunes.weekday() != 0:  # Buscar próximo lunes
            proximo_lunes += timedelta(days=1)
        proximo_lunes = proximo_lunes.replace(hour=10, minute=0)
        lunes_fin = proximo_lunes.replace(hour=14, minute=0)

        proximo_miercoles = proximo_lunes + timedelta(days=2)
        miercoles_fin = proximo_miercoles.replace(hour=14, minute=0)

        # Reserva 1 para el lunes (10:00 a 14:00)
        reserva_1 = crear_reserva(
            usuario=self.prestatario_1,
            material_id=self.material.id,
            justificacion="Proyecto lunes",
            fecha_inicio=proximo_lunes,
            fecha_fin=lunes_fin,
        )
        self.assertEqual(reserva_1.estado, "reservada")
        self.assertIsNotNone(reserva_1.instancia)

        # Reserva 2 para el miércoles (10:00 a 14:00) con otro prestatario sobre el MISMO material de stock 1
        reserva_2 = crear_reserva(
            usuario=self.prestatario_2,
            material_id=self.material.id,
            justificacion="Proyecto miércoles",
            fecha_inicio=proximo_miercoles,
            fecha_fin=miercoles_fin,
        )
        # Ambas deben quedar confirmadas sin enviarse a lista de espera
        self.assertEqual(reserva_2.estado, "reservada")
        self.assertEqual(reserva_1.instancia_id, reserva_2.instancia_id)

        # Reserva 3 para el lunes compitiendo por la misma franja (11:00 a 15:00)
        lunes_solapado_inicio = proximo_lunes.replace(hour=11, minute=0)
        lunes_solapado_fin = proximo_lunes.replace(hour=15, minute=0)
        with self.assertRaises(ReservaError) as error:
            crear_reserva(
                usuario=self.prestatario_3,
                material_id=self.material.id,
                justificacion="Intento solapado",
                fecha_inicio=lunes_solapado_inicio,
                fecha_fin=lunes_solapado_fin,
            )
        self.assertEqual(error.exception.status_code, 409)
        self.assertEqual(Reserva.objects.filter(material=self.material).count(), 2)

    def test_prestamo_directo_exitoso_si_no_choca_con_reserva_futura(self):
        """Se puede prestar hoy un ejemplar si se devuelve antes de su próxima reserva."""
        # Reserva confirmada para el próximo jueves laborable
        hoy = timezone.localtime(timezone.now()).replace(second=0, microsecond=0)
        fecha_reserva_inicio = hoy + timedelta(days=2)
        while fecha_reserva_inicio.weekday() not in (1, 2, 3):  # Martes a Jueves
            fecha_reserva_inicio += timedelta(days=1)
        fecha_reserva_inicio = fecha_reserva_inicio.replace(hour=10, minute=0)
        fecha_reserva_fin = fecha_reserva_inicio.replace(hour=14, minute=0)

        reserva = crear_reserva(
            usuario=self.prestatario_1,
            material_id=self.material.id,
            justificacion="Reserva la próxima semana",
            fecha_inicio=fecha_reserva_inicio,
            fecha_fin=fecha_reserva_fin,
        )
        self.assertEqual(reserva.estado, "reservada")

        # Préstamo directo hoy por solo 2 horas (devuelve hoy mismo, mucho antes de la reserva)
        checklist = [{"elemento": "Pantalla", "observacion": "OK"}]
        prestamo = registrar_prestamo(
            dni_prestatario=self.prestatario_2.dni,
            material_id=self.material.id,
            tiempo_prestamo_minutos=120,
            checklist_inicial=checklist,
            registrado_por=self.gestor,
        )
        self.assertEqual(prestamo.estado, "activo")
        self.assertEqual(prestamo.instancia_id, reserva.instancia_id)

    def test_prestamo_directo_rechazado_si_choca_con_reserva_futura(self):
        """Se rechaza el préstamo si su duración sobrepasa el inicio de una reserva futura."""
        from apps.prestamos.services import PrestamoError

        # Reserva confirmada para dentro de un día laborable
        hoy = timezone.localtime(timezone.now()).replace(second=0, microsecond=0)
        reserva_inicio = hoy + timedelta(days=1)
        while reserva_inicio.weekday() > 4:
            reserva_inicio += timedelta(days=1)
        reserva_inicio = reserva_inicio.replace(hour=10, minute=0)
        reserva_fin = reserva_inicio.replace(hour=14, minute=0)

        crear_reserva(
            usuario=self.prestatario_1,
            material_id=self.material.id,
            justificacion="Reserva inminente",
            fecha_inicio=reserva_inicio,
            fecha_fin=reserva_fin,
        )

        # Intento de préstamo por 5 días (sobrepasaría el inicio de la reserva)
        checklist = [{"elemento": "Pantalla", "observacion": "OK"}]
        with self.assertRaises(PrestamoError) as ctx:
            registrar_prestamo(
                dni_prestatario=self.prestatario_2.dni,
                material_id=self.material.id,
                tiempo_prestamo_minutos=1440 * 5,
                checklist_inicial=checklist,
                registrado_por=self.gestor,
            )
        self.assertIn("reserva", ctx.exception.mensaje.lower())

    def test_api_disponibilidad_calendario(self):
        """El endpoint de disponibilidad devuelve los días y franjas ocupadas correctamente."""
        url = f"/api/materiales/{self.material.id}/disponibilidad/"
        respuesta = self.client.get(url)
        self.assertEqual(respuesta.status_code, 200)
        self.assertIn("total_ejemplares", respuesta.data)
        self.assertIn("dias", respuesta.data)
        self.assertGreaterEqual(len(respuesta.data["dias"]), 1)
        primer_dia = respuesta.data["dias"][0]
        self.assertIn("fecha", primer_dia)
        self.assertIn("disponible", primer_dia)
        self.assertIn("ejemplares_libres", primer_dia)
