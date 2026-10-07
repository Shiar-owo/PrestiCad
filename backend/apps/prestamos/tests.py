"""Pruebas de reglas y API para HU09 — registrar la entrega de un préstamo."""
from datetime import timedelta

from django.test import SimpleTestCase, TestCase
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from apps.inventario.models import Material
from apps.inventario.serializers import MaterialSerializer
from apps.inventario.services import registrar_material
from apps.prestamos.models import Prestamo
from apps.prestamos.services import PrestamoError, registrar_prestamo
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
