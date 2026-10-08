"""Pruebas de reglas y API para HU09 — registrar la entrega de un préstamo."""
from datetime import timedelta

from django.test import SimpleTestCase, TestCase
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from apps.inventario.models import Material
from apps.inventario.serializers import MaterialSerializer
from apps.inventario.services import registrar_material
from apps.prestamos.models import Devolucion, Prestamo
from apps.prestamos.services import (
    PrestamoError,
    consultar_historial_prestamos,
    consultar_prestamos_usuario,
    estimar_devolucion,
    registrar_devolucion,
    registrar_prestamo,
)
from apps.usuarios.models import Rol
from apps.usuarios.services import registrar_usuario, usuario_tiene_prestamos_activos
from apps.usuarios.sesiones import (
    CLAVE_SESION_ULTIMA_ACTIVIDAD,
    CLAVE_SESION_USUARIO_ID,
)


CHECKLIST = [
    {"elemento": "Carcasa", "condicion": "Sin daños visibles", "observacion": ""},
    {"elemento": "Cable", "condicion": "Completo", "observacion": ""},
]


def crear_usuario(email, dni, rol="prestatario", **cambios):
    usuario = registrar_usuario(
        nombre="Ana",
        apellido="Torres",
        email=email,
        dni=dni,
        tipo="docente",
        facultad="Ingeniería",
        password="ClaveSegura123",
    )
    usuario.rol = Rol.objects.get(nombre=rol)
    for campo, valor in cambios.items():
        setattr(usuario, campo, valor)
    usuario.save()
    return usuario


def crear_material(**cambios):
    estado = cambios.pop("estado", None)
    datos = {
        "nombre": "Proyector",
        "codigo_inventario": "EQ-001",
        "tipo": "equipo",
        "stock": 1,
    }
    datos.update(cambios)
    material = registrar_material(**datos)
    if estado:
        material.estado = estado
        material.save(update_fields=["estado", "updated_at"])
    return material


class ModuloPrestamosTestCase(SimpleTestCase):
    def test_urls_del_modulo_estan_montadas(self):
        from config.urls import urlpatterns

        rutas = {str(ruta.pattern) for ruta in urlpatterns}
        self.assertIn("api/", rutas)


class RegistrarPrestamoServiceTestCase(TestCase):
    def setUp(self):
        self.gestor = crear_usuario("gestor@unsa.edu.pe", "10000001", rol="gestor")
        self.prestatario = crear_usuario("ana@unsa.edu.pe", "10000002")
        self.material = crear_material()

    def _registrar(self, **cambios):
        datos = {
            "dni_prestatario": self.prestatario.dni,
            "material_id": self.material.id,
            "tiempo_prestamo_dias": 7,
            "checklist_inicial": CHECKLIST,
            "registrado_por": self.gestor,
        }
        datos.update(cambios)
        return registrar_prestamo(**datos)

    def test_registra_prestamo_activo_con_fecha_limite_y_checklist(self):
        antes = timezone.now()

        prestamo = self._registrar()

        self.assertEqual(prestamo.estado, "activo")
        self.assertEqual(prestamo.usuario, self.prestatario)
        self.assertEqual(prestamo.registrado_por, self.gestor)
        self.assertEqual(prestamo.checklist_inicial, CHECKLIST)
        self.assertEqual(prestamo.fecha_limite - prestamo.fecha_entrega, timedelta(days=7))
        self.assertGreaterEqual(prestamo.fecha_entrega, antes)
        self.assertEqual(Material.objects.get(pk=self.material.pk).estado, "prestado")

    def test_agota_y_restaura_disponibilidad_segun_stock_de_unidades(self):
        material = crear_material(
            nombre="Cables",
            codigo_inventario="OBJ-002",
            tipo="objeto",
            stock=2,
        )

        self._registrar(material_id=material.id)
        material.refresh_from_db()
        self.assertEqual(material.stock, 2)
        self.assertEqual(material.estado, "disponible")
        self.assertEqual(MaterialSerializer(material).data["unidades_disponibles"], 1)

        otro = crear_usuario("otro@unsa.edu.pe", "10000003")
        registrar_prestamo(
            dni_prestatario=otro.dni,
            material_id=material.id,
            tiempo_prestamo_dias=3,
            checklist_inicial=CHECKLIST,
            registrado_por=self.gestor,
        )
        material.refresh_from_db()
        self.assertEqual(material.estado, "prestado")
        self.assertEqual(MaterialSerializer(material).data["unidades_disponibles"], 0)

    def test_rechaza_sin_unidades_y_no_crea_prestamo(self):
        self._registrar()
        segundo = crear_usuario("segundo@unsa.edu.pe", "10000004")

        with self.assertRaises(PrestamoError) as contexto:
            self._registrar(dni_prestatario=segundo.dni)

        self.assertEqual(contexto.exception.status_code, 409)
        self.assertEqual(Prestamo.objects.count(), 1)

    def test_rechaza_tier_insuficiente_sin_cambiar_inventario(self):
        material = crear_material(
            codigo_inventario="EQ-002",
            tier_minimo_requerido="avanzado",
        )

        with self.assertRaises(PrestamoError) as contexto:
            self._registrar(material_id=material.id)

        self.assertIn("Tier", contexto.exception.mensaje)
        self.assertEqual(Prestamo.objects.count(), 0)
        material.refresh_from_db()
        self.assertEqual(material.estado, "disponible")

    def test_rechaza_usuario_suspendido(self):
        self.prestatario.estado = "suspendido"
        self.prestatario.save(update_fields=["estado"])

        with self.assertRaises(PrestamoError) as contexto:
            self._registrar()

        self.assertIn("habilitado", contexto.exception.mensaje)
        self.assertEqual(Prestamo.objects.count(), 0)

    def test_exige_los_dos_elementos_de_garantia_para_material_de_alto_valor(self):
        material = crear_material(codigo_inventario="EQ-003", es_alto_valor=True)

        with self.assertRaises(PrestamoError) as contexto:
            self._registrar(material_id=material.id)
        self.assertEqual(contexto.exception.campo, "garantia_documento_identidad_recibido")
        self.assertEqual(Prestamo.objects.count(), 0)

        with self.assertRaises(PrestamoError) as contexto:
            self._registrar(
                material_id=material.id,
                garantia_documento_identidad_recibido=True,
            )
        self.assertEqual(contexto.exception.campo, "garantia_compromiso_firmado_recibido")
        self.assertEqual(Prestamo.objects.count(), 0)

        prestamo = self._registrar(
            material_id=material.id,
            garantia_documento_identidad_recibido=True,
            garantia_compromiso_firmado_recibido=True,
        )
        self.assertTrue(prestamo.garantia_completa)

    def test_rechaza_material_en_mantenimiento_o_reservado(self):
        for estado in ("en_mantenimiento", "reservado"):
            with self.subTest(estado=estado):
                material = crear_material(
                    nombre=f"Material {estado}",
                    codigo_inventario=f"EQ-{estado}",
                    estado=estado,
                )
                with self.assertRaises(PrestamoError) as contexto:
                    self._registrar(material_id=material.id)
                self.assertEqual(contexto.exception.status_code, 409)

    def test_rechaza_duracion_o_checklist_invalidos(self):
        with self.assertRaises(PrestamoError):
            self._registrar(tiempo_prestamo_dias=0)
        with self.assertRaises(PrestamoError):
            self._registrar(checklist_inicial=[])
        self.assertEqual(Prestamo.objects.count(), 0)

    def test_expone_contrato_de_prestamos_activos_para_usuarios(self):
        self.assertFalse(usuario_tiene_prestamos_activos(self.prestatario.id))
        prestamo = self._registrar()
        self.assertTrue(usuario_tiene_prestamos_activos(self.prestatario.id))

        prestamo.estado = "devuelto"
        prestamo.save(update_fields=["estado"])

        self.assertFalse(usuario_tiene_prestamos_activos(self.prestatario.id))


class ConsultarPrestamosServiceTestCase(TestCase):
    def setUp(self):
        self.gestor = crear_usuario("gestor-consulta@unsa.edu.pe", "10000101", rol="gestor")
        self.prestatario = crear_usuario("consulta@unsa.edu.pe", "10000102")
        self.otro_prestatario = crear_usuario("otro-consulta@unsa.edu.pe", "10000103")

    def _registrar(self, prestatario, codigo):
        material = crear_material(codigo_inventario=codigo)
        return registrar_prestamo(
            dni_prestatario=prestatario.dni,
            material_id=material.id,
            tiempo_prestamo_dias=7,
            checklist_inicial=CHECKLIST,
            registrado_por=self.gestor,
        )

    def test_lista_vacia_y_aisla_por_usuario(self):
        self.assertEqual(list(consultar_prestamos_usuario(self.prestatario.id)), [])
        propio = self._registrar(self.prestatario, "CONS-001")
        self._registrar(self.otro_prestatario, "CONS-002")

        resultado = list(consultar_prestamos_usuario(self.prestatario.id))

        self.assertEqual([prestamo.id for prestamo in resultado], [propio.id])

    def test_deriva_vencido_sin_mutar_estado_y_ordena_vencidos_primero(self):
        ahora = timezone.now()
        vencido_antiguo = self._registrar(self.prestatario, "CONS-011")
        vencido_reciente = self._registrar(self.prestatario, "CONS-012")
        activo = self._registrar(self.prestatario, "CONS-013")
        vencido_antiguo.fecha_entrega = ahora - timedelta(days=30)
        vencido_antiguo.fecha_limite = ahora - timedelta(days=23)
        vencido_antiguo.save(update_fields=["fecha_entrega", "fecha_limite"])
        vencido_reciente.fecha_entrega = ahora - timedelta(days=10)
        vencido_reciente.fecha_limite = ahora - timedelta(days=3)
        vencido_reciente.save(update_fields=["fecha_entrega", "fecha_limite"])
        activo.fecha_entrega = ahora - timedelta(days=1)
        activo.fecha_limite = ahora + timedelta(days=6)
        activo.save(update_fields=["fecha_entrega", "fecha_limite"])

        resultado = list(consultar_prestamos_usuario(self.prestatario.id, ahora=ahora))

        self.assertEqual(
            [prestamo.id for prestamo in resultado],
            [vencido_antiguo.id, vencido_reciente.id, activo.id],
        )
        self.assertEqual(
            [prestamo.estado_consulta for prestamo in resultado],
            ["vencido", "vencido", "activo"],
        )
        vencido_antiguo.refresh_from_db()
        self.assertEqual(vencido_antiguo.estado, "activo")


class HistorialPrestamosServiceTestCase(TestCase):
    def setUp(self):
        self.gestor = crear_usuario("gestor-historial@unsa.edu.pe", "10000201", rol="gestor")
        self.prestatario = crear_usuario("historial@unsa.edu.pe", "10000202")
        self.otro_prestatario = crear_usuario("otro-historial@unsa.edu.pe", "10000203")

    def _registrar(self, prestatario, codigo):
        material = crear_material(codigo_inventario=codigo)
        return registrar_prestamo(
            dni_prestatario=prestatario.dni,
            material_id=material.id,
            tiempo_prestamo_dias=7,
            checklist_inicial=CHECKLIST,
            registrado_por=self.gestor,
        )

    def test_lista_vacia_y_consulta_prestamos_de_todos_los_usuarios(self):
        self.assertEqual(list(consultar_historial_prestamos()), [])
        primero = self._registrar(self.prestatario, "HIST-001")
        segundo = self._registrar(self.otro_prestatario, "HIST-002")

        resultado = list(consultar_historial_prestamos())

        self.assertCountEqual(
            [(prestamo.id, prestamo.usuario_id) for prestamo in resultado],
            [(primero.id, self.prestatario.id), (segundo.id, self.otro_prestatario.id)],
        )

    def test_deriva_vencido_y_ordena_sin_mutar_estado_persistido(self):
        ahora = timezone.now()
        vencido_antiguo = self._registrar(self.prestatario, "HIST-011")
        vencido_reciente = self._registrar(self.otro_prestatario, "HIST-012")
        activo = self._registrar(self.prestatario, "HIST-013")
        devuelto = self._registrar(self.otro_prestatario, "HIST-014")
        vencido_antiguo.fecha_entrega = ahora - timedelta(days=30)
        vencido_antiguo.fecha_limite = ahora - timedelta(days=23)
        vencido_antiguo.save(update_fields=["fecha_entrega", "fecha_limite"])
        vencido_reciente.fecha_entrega = ahora - timedelta(days=10)
        vencido_reciente.fecha_limite = ahora - timedelta(days=3)
        vencido_reciente.save(update_fields=["fecha_entrega", "fecha_limite"])
        activo.fecha_entrega = ahora - timedelta(days=1)
        activo.fecha_limite = ahora + timedelta(days=6)
        activo.save(update_fields=["fecha_entrega", "fecha_limite"])
        devuelto.estado = "devuelto"
        devuelto.fecha_entrega = ahora - timedelta(days=5)
        devuelto.save(update_fields=["estado", "fecha_entrega"])

        resultado = list(consultar_historial_prestamos(ahora=ahora))

        self.assertEqual(
            [prestamo.id for prestamo in resultado],
            [vencido_antiguo.id, vencido_reciente.id, activo.id, devuelto.id],
        )
        self.assertEqual(
            [prestamo.estado_consulta for prestamo in resultado],
            ["vencido", "vencido", "activo", "devuelto"],
        )
        vencido_antiguo.refresh_from_db()
        self.assertEqual(vencido_antiguo.estado, "activo")


class MisPrestamosAPITestCase(APITestCase):
    URL = "/api/prestamos/mis-prestamos/"
    CAMPOS_PUBLICOS = {
        "id",
        "material_id",
        "material_nombre",
        "material_codigo",
        "fecha_entrega",
        "fecha_limite",
        "tiempo_prestamo_dias",
        "estado",
    }

    def setUp(self):
        self.prestatario = crear_usuario("mis-prestamos@unsa.edu.pe", "20000101")
        self.otro_prestatario = crear_usuario("otro-mis-prestamos@unsa.edu.pe", "20000102")
        self.gestor = crear_usuario("gestor-mis-prestamos@unsa.edu.pe", "20000103", rol="gestor")
        self.administrador = crear_usuario(
            "admin-mis-prestamos@unsa.edu.pe",
            "20000104",
            rol="administrador",
        )
        self.registrado_por = self.gestor

    def _iniciar_sesion(self, usuario):
        sesion = self.client.session
        sesion[CLAVE_SESION_USUARIO_ID] = usuario.id
        sesion[CLAVE_SESION_ULTIMA_ACTIVIDAD] = timezone.now().isoformat()
        sesion.save()

    def _crear_prestamo(self, usuario, codigo):
        material = crear_material(codigo_inventario=codigo)
        return registrar_prestamo(
            dni_prestatario=usuario.dni,
            material_id=material.id,
            tiempo_prestamo_dias=5,
            checklist_inicial=CHECKLIST,
            registrado_por=self.registrado_por,
        )

    def test_get_sin_sesion_responde_403(self):
        respuesta = self.client.get(self.URL)

        self.assertEqual(respuesta.status_code, 403)

    def test_get_solo_permite_rol_prestatario(self):
        for usuario in (self.gestor, self.administrador):
            with self.subTest(rol=usuario.rol.nombre):
                self._iniciar_sesion(usuario)
                respuesta = self.client.get(self.URL)
                self.assertEqual(respuesta.status_code, 403)

    def test_get_devuelve_solo_prestamos_propios_y_campos_publicos(self):
        self._crear_prestamo(self.prestatario, "MIS-001")
        self._crear_prestamo(self.otro_prestatario, "MIS-002")
        self._iniciar_sesion(self.prestatario)

        respuesta = self.client.get(self.URL)

        self.assertEqual(respuesta.status_code, 200)
        datos = respuesta.json()
        self.assertEqual(len(datos), 1)
        self.assertEqual(set(datos[0]), self.CAMPOS_PUBLICOS)
        self.assertEqual(datos[0]["material_codigo"], "MIS-001")
        self.assertEqual(datos[0]["estado"], "activo")

    def test_get_sin_prestamos_devuelve_lista_vacia(self):
        self._iniciar_sesion(self.prestatario)

        respuesta = self.client.get(self.URL)

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.json(), [])

    def test_get_expone_vencido_derivado_sin_mutar_estado(self):
        prestamo = self._crear_prestamo(self.prestatario, "MIS-003")
        prestamo.fecha_limite = timezone.now() - timedelta(days=1)
        prestamo.save(update_fields=["fecha_limite"])
        self._iniciar_sesion(self.prestatario)

        respuesta = self.client.get(self.URL)

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.json()[0]["estado"], "vencido")
        prestamo.refresh_from_db()
        self.assertEqual(prestamo.estado, "activo")


class HistorialPrestamosAPITestCase(APITestCase):
    URL = "/api/prestamos/historial/"
    CAMPOS_HISTORIAL = {
        "id",
        "prestatario_nombre",
        "material_id",
        "material_nombre",
        "material_codigo",
        "fecha_entrega",
        "fecha_limite",
        "tiempo_prestamo_dias",
        "estado",
    }

    def setUp(self):
        self.gestor = crear_usuario("gestor-historial-api@unsa.edu.pe", "20000201", rol="gestor")
        self.administrador = crear_usuario(
            "admin-historial-api@unsa.edu.pe", "20000202", rol="administrador"
        )
        self.prestatario = crear_usuario("prestatario-historial-api@unsa.edu.pe", "20000203")
        self.otro_prestatario = crear_usuario("otro-historial-api@unsa.edu.pe", "20000204")

    def _iniciar_sesion(self, usuario):
        sesion = self.client.session
        sesion[CLAVE_SESION_USUARIO_ID] = usuario.id
        sesion[CLAVE_SESION_ULTIMA_ACTIVIDAD] = timezone.now().isoformat()
        sesion.save()

    def _crear_prestamo(self, usuario, codigo):
        material = crear_material(codigo_inventario=codigo)
        return registrar_prestamo(
            dni_prestatario=usuario.dni,
            material_id=material.id,
            tiempo_prestamo_dias=5,
            checklist_inicial=CHECKLIST,
            registrado_por=self.gestor,
        )

    def test_get_sin_sesion_responde_403(self):
        respuesta = self.client.get(self.URL)

        self.assertEqual(respuesta.status_code, 403)

    def test_get_solo_permite_administrador_y_gestor(self):
        for usuario in (self.gestor, self.administrador):
            with self.subTest(rol=usuario.rol.nombre):
                self._iniciar_sesion(usuario)
                respuesta = self.client.get(self.URL)
                self.assertEqual(respuesta.status_code, 200)

        for usuario in (self.prestatario, self.otro_prestatario):
            with self.subTest(rol=usuario.rol.nombre):
                self._iniciar_sesion(usuario)
                respuesta = self.client.get(self.URL)
                self.assertEqual(respuesta.status_code, 403)

    def test_get_lista_global_paginada_y_sin_datos_privados(self):
        self._crear_prestamo(self.prestatario, "HIST-API-001")
        self._crear_prestamo(self.otro_prestatario, "HIST-API-002")
        self._iniciar_sesion(self.gestor)

        respuesta = self.client.get(self.URL, {"page_size": 1})

        self.assertEqual(respuesta.status_code, 200)
        datos = respuesta.json()
        self.assertEqual(datos["count"], 2)
        self.assertIsNotNone(datos["next"])
        self.assertEqual(len(datos["results"]), 1)
        prestamo = datos["results"][0]
        self.assertEqual(set(prestamo), self.CAMPOS_HISTORIAL)
        self.assertIn(prestamo["prestatario_nombre"], {
            f"{self.prestatario.nombre} {self.prestatario.apellido}",
            f"{self.otro_prestatario.nombre} {self.otro_prestatario.apellido}",
        })
        self.assertNotIn("dni", prestamo)
        self.assertNotIn("email", prestamo)
        self.assertNotIn("checklist_inicial", prestamo)

        segunda_pagina = self.client.get(self.URL, {"page_size": 1, "page": 2})
        self.assertEqual(segunda_pagina.status_code, 200)
        self.assertNotEqual(
            prestamo["id"],
            segunda_pagina.json()["results"][0]["id"],
        )

    def test_get_filtra_estado_visible_y_rechaza_estado_invalido(self):
        vencido = self._crear_prestamo(self.prestatario, "HIST-API-011")
        self._crear_prestamo(self.otro_prestatario, "HIST-API-012")
        vencido.fecha_limite = timezone.now() - timedelta(days=1)
        vencido.save(update_fields=["fecha_limite"])
        self._iniciar_sesion(self.administrador)

        respuesta = self.client.get(self.URL, {"estado": "vencido"})

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.json()["count"], 1)
        self.assertEqual(respuesta.json()["results"][0]["estado"], "vencido")
        vencido.refresh_from_db()
        self.assertEqual(vencido.estado, "activo")

        invalida = self.client.get(self.URL, {"estado": "inexistente"})
        self.assertEqual(invalida.status_code, 400)


class RegistrarPrestamoAPITestCase(APITestCase):
    URL = "/api/prestamos/"

    def setUp(self):
        self.gestor = crear_usuario("gestor-api@unsa.edu.pe", "20000001", rol="gestor")
        self.prestatario = crear_usuario("prestatario-api@unsa.edu.pe", "20000002")
        self.material = crear_material(codigo_inventario="API-001")

    def _iniciar_sesion(self, usuario):
        sesion = self.client.session
        sesion[CLAVE_SESION_USUARIO_ID] = usuario.id
        sesion[CLAVE_SESION_ULTIMA_ACTIVIDAD] = timezone.now().isoformat()
        sesion.save()

    def _payload(self, **cambios):
        datos = {
            "dni_prestatario": self.prestatario.dni,
            "material_id": str(self.material.id),
            "tiempo_prestamo_dias": 5,
            "checklist_inicial": CHECKLIST,
        }
        datos.update(cambios)
        return datos

    def test_post_sin_sesion_responde_403(self):
        respuesta = self.client.post(self.URL, self._payload(), format="json")

        self.assertEqual(respuesta.status_code, 403)
        self.assertEqual(Prestamo.objects.count(), 0)

    def test_post_como_prestatario_responde_403(self):
        self._iniciar_sesion(self.prestatario)

        respuesta = self.client.post(self.URL, self._payload(), format="json")

        self.assertEqual(respuesta.status_code, 403)
        self.assertEqual(Prestamo.objects.count(), 0)

    def test_post_como_gestor_devuelve_201_y_datos_de_entrega(self):
        self._iniciar_sesion(self.gestor)

        respuesta = self.client.post(self.URL, self._payload(), format="json")

        self.assertEqual(respuesta.status_code, 201, respuesta.content)
        datos = respuesta.json()
        self.assertEqual(datos["usuario_id"], self.prestatario.id)
        self.assertEqual(datos["usuario_nombre"], "Ana Torres")
        self.assertEqual(datos["estado"], "activo")
        self.assertEqual(datos["tiempo_prestamo_dias"], 5)
        self.assertEqual(datos["checklist_inicial"], CHECKLIST)
        self.assertFalse(datos["requiere_garantia"])
        self.assertEqual(Prestamo.objects.count(), 1)

    def test_listado_inventario_devuelve_unidades_libres_actualizadas(self):
        material = crear_material(
            nombre="Cables HDMI",
            codigo_inventario="API-002",
            tipo="objeto",
            stock=2,
        )
        registrar_prestamo(
            dni_prestatario=self.prestatario.dni,
            material_id=material.id,
            tiempo_prestamo_dias=5,
            checklist_inicial=CHECKLIST,
            registrado_por=self.gestor,
        )

        respuesta = self.client.get("/api/materiales/")

        self.assertEqual(respuesta.status_code, 200)
        cables = next(item for item in respuesta.json() if item["id"] == str(material.id))
        self.assertEqual(cables["stock"], 2)
        self.assertEqual(cables["unidades_disponibles"], 1)
        self.assertEqual(cables["estado"], "disponible")

    def test_post_como_administrador_responde_403(self):
        administrador = crear_usuario(
            "admin-api@unsa.edu.pe",
            "20000003",
            rol="administrador",
        )
        self._iniciar_sesion(administrador)

        respuesta = self.client.post(self.URL, self._payload(), format="json")

        self.assertEqual(respuesta.status_code, 403)

    def test_post_datos_invalidos_responde_400(self):
        self._iniciar_sesion(self.gestor)

        respuesta = self.client.post(
            self.URL,
            self._payload(tiempo_prestamo_dias=0, checklist_inicial=[]),
            format="json",
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn("tiempo_prestamo_dias", respuesta.json())
        self.assertIn("checklist_inicial", respuesta.json())
        self.assertEqual(Prestamo.objects.count(), 0)

    def test_post_rechaza_campos_no_autorizados(self):
        self._iniciar_sesion(self.gestor)

        respuesta = self.client.post(
            self.URL,
            self._payload(usuario_id=999, estado="devuelto"),
            format="json",
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn("usuario_id", respuesta.json())
        self.assertIn("estado", respuesta.json())
        self.assertEqual(Prestamo.objects.count(), 0)

    def test_post_dni_inexistente_responde_404(self):
        self._iniciar_sesion(self.gestor)

        respuesta = self.client.post(
            self.URL,
            self._payload(dni_prestatario="29999999"),
            format="json",
        )

        self.assertEqual(respuesta.status_code, 404)
        self.assertEqual(Prestamo.objects.count(), 0)

    def test_post_requiere_token_csrf_con_sesion(self):
        gestor = self.gestor
        cliente = APIClient(enforce_csrf_checks=True)
        sesion = cliente.session
        sesion[CLAVE_SESION_USUARIO_ID] = gestor.id
        sesion[CLAVE_SESION_ULTIMA_ACTIVIDAD] = timezone.now().isoformat()
        sesion.save()

        respuesta = cliente.post(self.URL, self._payload(), format="json")

        self.assertEqual(respuesta.status_code, 403)
        self.assertEqual(Prestamo.objects.count(), 0)


class DevolucionBaseTestCase(TestCase):
    """Escenario compartido HU11: préstamo vigente con checklist de entrega."""

    def setUp(self):
        self.gestor = crear_usuario("gestor-dev@unsa.edu.pe", "10000021", rol="gestor")
        self.prestatario = crear_usuario("ana-dev@unsa.edu.pe", "10000022")
        self.material = crear_material(
            nombre="Proyector Dev",
            codigo_inventario="EQ-101",
            costo_reparacion="40.00",
            costo_reposicion="200.00",
        )
        self.prestamo = registrar_prestamo(
            dni_prestatario=self.prestatario.dni,
            material_id=self.material.id,
            tiempo_prestamo_dias=7,
            checklist_inicial=CHECKLIST,
            registrado_por=self.gestor,
        )
        self.checklist_ok = [
            {"elemento": "Carcasa", "estado": "sin_cambios", "observacion": ""},
            {"elemento": "Cable", "estado": "sin_cambios", "observacion": ""},
        ]

    def _devolver(self, fecha_devolucion=None, checklist=None):
        return registrar_devolucion(
            prestamo_id=self.prestamo.id,
            checklist_devolucion=self.checklist_ok if checklist is None else checklist,
            realizado_por=self.gestor,
            fecha_devolucion=fecha_devolucion,
        )

    def _marcar_prestatario(self, puntaje, tier):
        self.prestatario.reputacion_puntaje = puntaje
        self.prestatario.reputacion_tier = tier
        self.prestatario.save(
            update_fields=["reputacion_puntaje", "reputacion_tier", "updated_at"],
        )


class EstimarDevolucionServiceTestCase(DevolucionBaseTestCase):
    def test_estimar_devuelve_resultado_sin_persistir_nada(self):
        resultado = estimar_devolucion(
            prestamo_id=self.prestamo.id,
            checklist_devolucion=self.checklist_ok,
            fecha_devolucion=self.prestamo.fecha_limite,
        )

        self.assertTrue(resultado["a_tiempo"])
        self.assertEqual(resultado["bonificacion"], 5)
        self.assertEqual(resultado["dano"], "sin_cambios")
        self.assertEqual(resultado["puntos_delta"], 5)
        self.assertEqual(resultado["reputacion_despues"], 5)
        self.assertEqual(Devolucion.objects.count(), 0)
        self.prestamo.refresh_from_db()
        self.assertEqual(self.prestamo.estado, "activo")
        self.prestatario.refresh_from_db()
        self.assertEqual(self.prestatario.reputacion_puntaje, 0)

    def test_estimar_coincide_con_lo_que_luego_registra(self):
        checklist = [
            {"elemento": "Carcasa", "estado": "dano_parcial", "observacion": "Rasguño"},
        ]
        estimado = estimar_devolucion(
            prestamo_id=self.prestamo.id,
            checklist_devolucion=checklist,
            fecha_devolucion=self.prestamo.fecha_limite,
        )

        devolucion = self._devolver(
            fecha_devolucion=self.prestamo.fecha_limite,
            checklist=checklist,
        )

        self.assertEqual(devolucion.resultado, estimado)

    def test_estimar_rechaza_checklist_invalido(self):
        with self.assertRaises(PrestamoError) as contexto:
            estimar_devolucion(prestamo_id=self.prestamo.id, checklist_devolucion=[])

        self.assertEqual(contexto.exception.status_code, 400)

    def test_estimar_rechaza_prestamo_inexistente(self):
        with self.assertRaises(PrestamoError) as contexto:
            estimar_devolucion(
                prestamo_id=99999,
                checklist_devolucion=self.checklist_ok,
            )

        self.assertEqual(contexto.exception.status_code, 404)

    def test_estimar_rechaza_prestamo_ya_devuelto(self):
        self._devolver()

        with self.assertRaises(PrestamoError) as contexto:
            estimar_devolucion(
                prestamo_id=self.prestamo.id,
                checklist_devolucion=self.checklist_ok,
            )

        self.assertEqual(contexto.exception.status_code, 409)


class RegistrarDevolucionServiceTestCase(DevolucionBaseTestCase):
    def test_devolucion_a_tiempo_aplica_bonificacion_y_actualiza_estados(self):
        antes = timezone.now()

        devolucion = self._devolver(fecha_devolucion=self.prestamo.fecha_limite)

        self.assertEqual(devolucion.prestamo, self.prestamo)
        self.assertEqual(devolucion.realizado_por, self.gestor)
        self.assertEqual(devolucion.resultado["bonificacion"], 5)
        self.assertEqual(devolucion.resultado["puntos_delta"], 5)
        self.assertEqual(devolucion.resultado["reputacion_antes"], 0)
        self.assertEqual(devolucion.resultado["reputacion_despues"], 5)
        self.assertFalse(devolucion.resultado["hay_dano"])
        self.assertGreaterEqual(devolucion.fecha_devolucion, antes)

        self.prestamo.refresh_from_db()
        self.assertEqual(self.prestamo.estado, "devuelto")
        self.prestatario.refresh_from_db()
        self.assertEqual(self.prestatario.reputacion_puntaje, 5)
        self.material.refresh_from_db()
        self.assertEqual(self.material.estado, "disponible")

    def test_tardanza_descuenta_proporcional_sin_bonificacion(self):
        devolucion = self._devolver(
            fecha_devolucion=self.prestamo.fecha_limite + timedelta(days=1, hours=1),
        )

        resultado = devolucion.resultado
        self.assertFalse(resultado["a_tiempo"])
        self.assertEqual(resultado["dias_tardanza"], 2)
        self.assertEqual(resultado["bonificacion"], 0)
        self.assertEqual(resultado["deduccion_tardanza"], 20)
        self.assertEqual(resultado["puntos_delta"], -20)
        self.assertEqual(resultado["reputacion_despues"], -20)

    def test_dano_parcial_aplica_deduccion_y_cobro_de_reparacion(self):
        checklist = [
            {"elemento": "Carcasa", "estado": "dano_parcial", "observacion": "Rasguño"},
            {"elemento": "Cable", "estado": "sin_cambios", "observacion": ""},
        ]

        devolucion = self._devolver(
            fecha_devolucion=self.prestamo.fecha_limite,
            checklist=checklist,
        )

        resultado = devolucion.resultado
        self.assertEqual(resultado["dano"], "dano_parcial")
        self.assertEqual(resultado["deduccion_dano"], 30)
        self.assertEqual(resultado["cobro_economico"], "40.00")
        self.assertEqual(resultado["puntos_delta"], -25)
        self.assertEqual(devolucion.checklist_devolucion[0]["condicion"], "Sin daños visibles")

    def test_dano_total_aplica_deduccion_y_cobro_de_reposicion(self):
        checklist = [
            {"elemento": "Carcasa", "estado": "dano_total", "observacion": "Roto"},
        ]

        devolucion = self._devolver(
            fecha_devolucion=self.prestamo.fecha_limite,
            checklist=checklist,
        )

        resultado = devolucion.resultado
        self.assertEqual(resultado["dano"], "dano_total")
        self.assertEqual(resultado["deduccion_dano"], 60)
        self.assertEqual(resultado["cobro_economico"], "200.00")
        self.assertEqual(resultado["puntos_delta"], -55)

    def test_cobro_nulo_cuando_el_material_no_tiene_costo_parametrizado(self):
        self.material.costo_reparacion = None
        self.material.costo_reposicion = None
        self.material.save(update_fields=["costo_reparacion", "costo_reposicion"])
        checklist = [
            {"elemento": "Carcasa", "estado": "dano_parcial", "observacion": "Leve"},
        ]

        devolucion = self._devolver(fecha_devolucion=self.prestamo.fecha_limite, checklist=checklist)

        self.assertEqual(devolucion.resultado["dano"], "dano_parcial")
        self.assertIsNone(devolucion.resultado["cobro_economico"])

    def test_el_peor_dano_prevalece_entre_elementos(self):
        checklist = [
            {"elemento": "Carcasa", "estado": "dano_parcial", "observacion": ""},
            {"elemento": "Cable", "estado": "dano_total", "observacion": ""},
        ]

        devolucion = self._devolver(checklist=checklist)

        self.assertEqual(devolucion.resultado["dano"], "dano_total")
        self.assertEqual(devolucion.resultado["deduccion_dano"], 60)

    def test_puntaje_se_encoge_en_el_limite_inferior(self):
        self._marcar_prestatario(-480, "restringido")
        checklist = [
            {"elemento": "Carcasa", "estado": "dano_total", "observacion": ""},
        ]

        devolucion = self._devolver(checklist=checklist)

        self.assertEqual(devolucion.resultado["reputacion_despues"], -500)
        self.prestatario.refresh_from_db()
        self.assertEqual(self.prestatario.reputacion_puntaje, -500)

    def test_puntaje_se_encoge_en_el_limite_superior(self):
        self._marcar_prestatario(498, "avanzado")

        devolucion = self._devolver(fecha_devolucion=self.prestamo.fecha_limite)

        self.assertEqual(devolucion.resultado["reputacion_despues"], 500)

    def test_recalcula_el_tier_al_atravesar_un_rango(self):
        self._marcar_prestatario(210, "avanzado")
        checklist = [
            {"elemento": "Carcasa", "estado": "dano_total", "observacion": ""},
        ]

        devolucion = self._devolver(
            fecha_devolucion=self.prestamo.fecha_limite,
            checklist=checklist,
        )

        self.assertEqual(devolucion.resultado["tier_antes"], "avanzado")
        self.assertEqual(devolucion.resultado["tier_despues"], "estandar")
        self.prestatario.refresh_from_db()
        self.assertEqual(self.prestatario.reputacion_tier, "estandar")

    def test_doble_devolucion_se_rechaza_y_no_duplica_registro(self):
        self._devolver()

        with self.assertRaises(PrestamoError) as contexto:
            self._devolver()

        self.assertEqual(contexto.exception.status_code, 409)
        self.assertEqual(Devolucion.objects.count(), 1)

    def test_rechaza_prestamo_reservado(self):
        self.prestamo.estado = "reservado"
        self.prestamo.save(update_fields=["estado"])

        with self.assertRaises(PrestamoError) as contexto:
            self._devolver()

        self.assertEqual(contexto.exception.status_code, 409)
        self.assertEqual(Devolucion.objects.count(), 0)

    def test_no_libera_la_unidad_si_quedan_prestamos_activos(self):
        material = crear_material(
            nombre="Laptops",
            codigo_inventario="EQ-102",
            stock=2,
        )
        segundo = crear_usuario("segundo-dev@unsa.edu.pe", "10000023")
        primero = registrar_prestamo(
            dni_prestatario=self.prestatario.dni,
            material_id=material.id,
            tiempo_prestamo_dias=3,
            checklist_inicial=CHECKLIST,
            registrado_por=self.gestor,
        )
        registrar_prestamo(
            dni_prestatario=segundo.dni,
            material_id=material.id,
            tiempo_prestamo_dias=3,
            checklist_inicial=CHECKLIST,
            registrado_por=self.gestor,
        )

        registrar_devolucion(
            prestamo_id=primero.id,
            checklist_devolucion=self.checklist_ok,
            realizado_por=self.gestor,
        )

        material.refresh_from_db()
        self.assertEqual(material.estado, "prestado")

    def test_rechaza_checklist_con_estado_no_valido(self):
        checklist = [{"elemento": "Carcasa", "estado": "regular", "observacion": ""}]

        with self.assertRaises(PrestamoError) as contexto:
            self._devolver(checklist=checklist)

        self.assertEqual(contexto.exception.status_code, 400)
        self.assertEqual(Devolucion.objects.count(), 0)

    def test_rechaza_checklist_vacio(self):
        with self.assertRaises(PrestamoError) as contexto:
            self._devolver(checklist=[])

        self.assertEqual(contexto.exception.status_code, 400)

    def test_rechaza_prestamo_inexistente(self):
        with self.assertRaises(PrestamoError) as contexto:
            registrar_devolucion(
                prestamo_id=99999,
                checklist_devolucion=self.checklist_ok,
                realizado_por=self.gestor,
            )

        self.assertEqual(contexto.exception.status_code, 404)
