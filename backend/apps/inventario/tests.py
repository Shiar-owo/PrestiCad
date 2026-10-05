"""Tests del módulo inventario."""
import os
import tempfile
from io import BytesIO
from pathlib import Path

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase, TestCase, override_settings
from django.utils import timezone
from PIL import Image
from rest_framework.test import APITestCase

from apps.inventario.models import Material
from apps.inventario.serializers import (
    FotoMaterial,
    MaterialActualizacionSerializer,
    MaterialRegistroSerializer,
    MaterialSerializer,
)
from apps.inventario.validators import TAMANIO_MAXIMO, validar_foto
from apps.usuarios.models import Rol
from apps.usuarios.services import registrar_usuario
from apps.usuarios.sesiones import CLAVE_SESION_ULTIMA_ACTIVIDAD, CLAVE_SESION_USUARIO_ID
from apps.inventario.services import (
    InventarioError,
    MaterialNoEncontradoError,
    actualizar_material,
    cambiar_estado_material,
    listar_materiales,
    normalizar_codigo,
    obtener_material,
    parametros_reputacion_por_defecto,
    registrar_material,
)

# Formatos que acepta la foto, con su `content_type` y su extensión.
FORMATOS_FOTO = {
    "JPEG": ("image/jpeg", ".jpg"),
    "PNG": ("image/png", ".png"),
    "WEBP": ("image/webp", ".webp"),
    "GIF": ("image/gif", ".gif"),
}


def imagen_en_memoria(formato="JPEG", nombre=None):
    """Crea un archivo de imagen real, como el que enviaría un formulario.

    No sirve un archivo con bytes inventados: `ImageField` lo abre con Pillow
    para confirmar que de verdad es una imagen.
    """
    content_type, extension = FORMATOS_FOTO[formato]
    buffer = BytesIO()
    Image.new("RGB", (20, 20), (200, 30, 30)).save(buffer, format=formato)
    return SimpleUploadedFile(
        nombre or f"foto{extension}", buffer.getvalue(), content_type=content_type
    )


def imagen_sobre_el_limite():
    """Imagen que supera los 5 MB.

    Se rellena de bytes aleatorios porque no comprimen: un PNG de 1400x1400
    ocupa más de 5 MB y se genera en un instante.
    """
    lado = 1400
    imagen = Image.frombytes("RGB", (lado, lado), os.urandom(lado * lado * 3))
    buffer = BytesIO()
    imagen.save(buffer, format="PNG")
    return SimpleUploadedFile("enorme.png", buffer.getvalue(), content_type="image/png")


class ConMediaTemporal(TestCase):
    """Apunta `MEDIA_ROOT` a un directorio temporal.

    Sin esto la suite escribiría en `backend/media/` y los archivos de una
    prueba quedarían ahí para la siguiente.
    """

    def setUp(self):
        super().setUp()
        temporal = tempfile.TemporaryDirectory()
        self.addCleanup(temporal.cleanup)
        override = override_settings(MEDIA_ROOT=Path(temporal.name))
        override.enable()
        self.addCleanup(override.disable)


class ModuloInventarioTestCase(SimpleTestCase):
    def test_config_del_modulo(self):
        """La app `inventario` existe y su config es la esperada."""
        from django.apps import apps

        from apps.inventario.apps import InventarioConfig

        conf = apps.get_app_config("inventario")
        self.assertIsInstance(conf, InventarioConfig)


class RegistrarMaterialServiceTestCase(TestCase):
    """Tests del servicio de alta de materiales (T04.03)."""

    def _datos_validos(self, **extra):
        datos = dict(nombre="Proyector Epson", codigo_inventario="INV-001", tipo="equipo")
        datos.update(extra)
        return datos

    def test_registra_material_con_valores_minimos(self):
        material = registrar_material(**self._datos_validos())

        self.assertIsNotNone(material.pk)
        self.assertEqual(material.nombre, "Proyector Epson")
        self.assertEqual(material.codigo_inventario, "INV-001")
        self.assertEqual(material.tipo, "equipo")
        self.assertEqual(Material.objects.count(), 1)

    def test_estado_inicial_es_disponible(self):
        """HU04 criterio 6: el estado inicial siempre es 'Disponible'."""
        material = registrar_material(**self._datos_validos())

        self.assertEqual(material.estado, "disponible")
        self.assertTrue(material.esta_disponible())

    def test_stock_por_defecto_es_una_unidad(self):
        material = registrar_material(**self._datos_validos())

        self.assertEqual(material.stock, 1)

    def test_registra_multiples_unidades_del_mismo_material(self):
        """HU04 criterio 5: se pueden registrar varias unidades."""
        material = registrar_material(**self._datos_validos(stock=12))

        self.assertEqual(material.stock, 12)

    def test_normaliza_el_codigo_a_mayusculas_sin_espacios(self):
        material = registrar_material(**self._datos_validos(codigo_inventario="  inv-001 "))

        self.assertEqual(material.codigo_inventario, "INV-001")

    def test_codigo_duplicado_devuelve_error_de_negocio(self):
        """HU04 criterio 4: el código de inventario es único."""
        registrar_material(**self._datos_validos())

        with self.assertRaises(InventarioError) as contexto:
            registrar_material(**self._datos_validos(nombre="Otro proyector"))

        self.assertEqual(contexto.exception.campo, "codigo_inventario")
        self.assertEqual(
            contexto.exception.mensaje,
            "El código de inventario ya está registrado.",
        )
        self.assertEqual(Material.objects.count(), 1)

    def test_codigo_duplicado_ignora_diferencias_de_mayusculas(self):
        registrar_material(**self._datos_validos())

        with self.assertRaises(InventarioError):
            registrar_material(**self._datos_validos(nombre="Otro", codigo_inventario="inv-001"))

        self.assertEqual(Material.objects.count(), 1)

    def test_recorta_espacios_del_nombre_y_descripcion(self):
        material = registrar_material(
            **self._datos_validos(nombre="  Proyector Epson  ", descripcion="  HD  ")
        )

        self.assertEqual(material.nombre, "Proyector Epson")
        self.assertEqual(material.descripcion, "HD")

    def test_nombre_vacio_devuelve_error_de_negocio(self):
        with self.assertRaises(InventarioError) as contexto:
            registrar_material(**self._datos_validos(nombre="   "))

        self.assertEqual(contexto.exception.campo, "nombre")

    def test_stock_inferior_a_uno_devuelve_error_de_negocio(self):
        with self.assertRaises(InventarioError) as contexto:
            registrar_material(**self._datos_validos(stock=0))

        self.assertEqual(contexto.exception.campo, "stock")

    def test_guarda_los_parametros_de_reputacion_informados(self):
        """HU04 criterio 2: los parámetros de reputación se parametrizan por objeto."""
        material = registrar_material(
            **self._datos_validos(
                tier_minimo_requerido="avanzado",
                bonificacion_tiempo=20,
                deduccion_tardanza=15,
                deduccion_dano_parcial=40,
                deduccion_dano_total=80,
            )
        )

        self.assertEqual(material.tier_minimo_requerido, "avanzado")
        self.assertEqual(material.bonificacion_tiempo, 20)
        self.assertEqual(material.deduccion_tardanza, 15)
        self.assertEqual(material.deduccion_dano_parcial, 40)
        self.assertEqual(material.deduccion_dano_total, 80)

    def test_guarda_la_ficha_tecnica(self):
        material = registrar_material(
            **self._datos_validos(
                marca="Epson", modelo="EB-X05", numero_serie="XPS123", es_alto_valor=True
            )
        )

        self.assertEqual(material.marca, "Epson")
        self.assertEqual(material.modelo, "EB-X05")
        self.assertEqual(material.numero_serie, "XPS123")
        self.assertTrue(material.requiere_garantia())


class ActualizarMaterialServiceTestCase(TestCase):
    """Tests de edición y cambio de estado de materiales (T04.03, HU04 criterio 7 y 8)."""

    def setUp(self):
        self.material = registrar_material(
            nombre="Proyector Epson",
            codigo_inventario="INV-001",
            tipo="equipo",
        )

    def test_actualiza_datos_basicos(self):
        actualizado = actualizar_material(
            self.material.id, nombre="Proyector Epson 4K", descripcion="Proyector de sala", stock=4
        )

        self.assertEqual(actualizado.nombre, "Proyector Epson 4K")
        self.assertEqual(actualizado.descripcion, "Proyector de sala")
        self.assertEqual(actualizado.stock, 4)

    def test_actualiza_el_codigo_y_lo_normaliza(self):
        actualizado = actualizar_material(self.material.id, codigo_inventario=" inv-009 ")

        self.assertEqual(actualizado.codigo_inventario, "INV-009")

    def test_no_permite_ceder_el_codigo_a_otro_material(self):
        otro = registrar_material(
            nombre="Libro de álgebra",
            codigo_inventario="LIB-001",
            tipo="libro",
        )

        with self.assertRaises(InventarioError) as contexto:
            actualizar_material(self.material.id, codigo_inventario=otro.codigo_inventario)

        self.assertEqual(contexto.exception.campo, "codigo_inventario")
        otro.refresh_from_db()
        self.assertEqual(otro.codigo_inventario, "LIB-001")

    def test_permite_mantener_el_mismo_codigo_al_editar_el_material(self):
        actualizado = actualizar_material(
            self.material.id, codigo_inventario=self.material.codigo_inventario, nombre="Proyector X"
        )

        self.assertEqual(actualizado.codigo_inventario, "INV-001")
        self.assertEqual(actualizado.nombre, "Proyector X")

    def test_rechaza_estado_invalido(self):
        with self.assertRaises(InventarioError) as contexto:
            cambiar_estado_material(self.material.id, "perdido")

        self.assertEqual(contexto.exception.campo, "estado")
        self.material.refresh_from_db()
        self.assertEqual(self.material.estado, "disponible")

    def test_cambia_el_estado_a_en_mantenimiento(self):
        """HU04 criterio 8: el Gestor puede poner el material en mantenimiento."""
        actualizado = cambiar_estado_material(self.material.id, "en_mantenimiento")

        self.assertEqual(actualizado.estado, "en_mantenimiento")
        self.assertFalse(actualizado.esta_disponible())

    def test_rechaza_campos_no_editables(self):
        with self.assertRaises(InventarioError) as contexto:
            actualizar_material(self.material.id, created_at="2020-01-01T00:00:00Z")

        self.assertIn("created_at", contexto.exception.mensaje)

    def test_material_inexistente_devuelve_error(self):
        with self.assertRaises(MaterialNoEncontradoError):
            actualizar_material(
                "00000000-0000-0000-0000-000000000000", nombre="Material fantasma"
            )

    def test_obtener_material_por_id(self):
        material = obtener_material(self.material.id)

        self.assertEqual(material, self.material)

    def test_listar_materiales_devuelve_todos_ordenados_por_nombre(self):
        registrar_material(nombre="Cable HDMI", codigo_inventario="OBJ-001", tipo="objeto")
        registrar_material(nombre="Libro de álgebra", codigo_inventario="LIB-001", tipo="libro")

        nombres = [material.nombre for material in listar_materiales()]

        self.assertEqual(nombres, sorted(nombres))
        self.assertEqual(len(nombres), 3)

    def test_normalizar_codigo(self):
        self.assertEqual(normalizar_codigo("  inv-001  "), "INV-001")


class ParametrosReputacionPorDefectoTestCase(TestCase):
    """Tests de los valores por defecto configurables (T04.04, HU04 criterio 3)."""

    def test_aplica_los_defaults_configurados(self):
        material = registrar_material(
            nombre="Cable HDMI", codigo_inventario="OBJ-001", tipo="objeto"
        )

        defaults = settings.MATERIALES_REPUTACION_DEFAULTS
        self.assertEqual(material.tier_minimo_requerido, defaults["tier_minimo_requerido"])
        self.assertEqual(material.bonificacion_tiempo, defaults["bonificacion_tiempo"])
        self.assertEqual(material.deduccion_tardanza, defaults["deduccion_tardanza"])
        self.assertEqual(material.deduccion_dano_parcial, defaults["deduccion_dano_parcial"])
        self.assertEqual(material.deduccion_dano_total, defaults["deduccion_dano_total"])

    @override_settings(
        MATERIALES_REPUTACION_DEFAULTS={
            "tier_minimo_requerido": "restringido",
            "bonificacion_tiempo": 1,
            "deduccion_tardanza": 2,
            "deduccion_dano_parcial": 3,
            "deduccion_dano_total": 4,
        }
    )
    def test_los_defaults_son_configurables(self):
        material = registrar_material(
            nombre="Cable HDMI", codigo_inventario="OBJ-001", tipo="objeto"
        )

        self.assertEqual(material.tier_minimo_requerido, "restringido")
        self.assertEqual(material.bonificacion_tiempo, 1)
        self.assertEqual(material.deduccion_tardanza, 2)
        self.assertEqual(material.deduccion_dano_parcial, 3)
        self.assertEqual(material.deduccion_dano_total, 4)

    def test_lo_parametrizado_gana_sobre_el_default(self):
        material = registrar_material(
            nombre="Microscopio",
            codigo_inventario="EQ-002",
            tipo="equipo",
            bonificacion_tiempo=25,
            deduccion_dano_total=90,
        )

        self.assertEqual(material.bonificacion_tiempo, 25)
        self.assertEqual(material.deduccion_dano_total, 90)
        # lo no parametrizado sigue con el default configurado
        self.assertEqual(
            material.deduccion_tardanza, settings.MATERIALES_REPUTACION_DEFAULTS["deduccion_tardanza"]
        )

    def test_los_costos_no_tienen_default(self):
        material = registrar_material(
            nombre="Cable HDMI", codigo_inventario="OBJ-001", tipo="objeto"
        )

        self.assertIsNone(material.costo_reparacion)
        self.assertIsNone(material.costo_reposicion)

    def test_parametros_por_defecto_devuelve_una_copia(self):
        defaults = parametros_reputacion_por_defecto()
        defaults["bonificacion_tiempo"] = 999

        self.assertNotEqual(
            settings.MATERIALES_REPUTACION_DEFAULTS["bonificacion_tiempo"],
            999,
        )

    def test_los_defaults_del_modelo_coinciden_con_la_configuracion(self):
        """Evita que la configuración y los `default` del modelo se desincronicen."""
        defaults = settings.MATERIALES_REPUTACION_DEFAULTS

        for campo, valor in defaults.items():
            default_del_modelo = Material._meta.get_field(campo).get_default()
            self.assertEqual(
                default_del_modelo,
                valor,
                f"El default del modelo '{campo}' no coincide con la configuración.",
            )


class MaterialSerializerContratoTestCase(SimpleTestCase):
    """Tests de los contratos JSON del módulo inventario (T04.05)."""

    def test_salida_incluye_unidades_disponibles(self):
        data = MaterialSerializer(Material(stock=4)).data

        self.assertEqual(data["unidades_disponibles"], 4)
        for campo in ("id", "nombre", "codigo_inventario", "estado", "created_at"):
            self.assertIn(campo, data)

    def test_alta_rechaza_estado(self):
        serializer = MaterialRegistroSerializer(
            data={"nombre": "Cable", "codigo_inventario": "OBJ-1", "tipo": "objeto", "estado": "prestado"}
        )

        self.assertFalse(serializer.is_valid())
        self.assertEqual(serializer.errors["estado"], ["Este campo no está permitido."])

    def test_alta_exige_nombre_codigo_y_tipo(self):
        serializer = MaterialRegistroSerializer(data={})

        self.assertFalse(serializer.is_valid())
        self.assertEqual(
            sorted(serializer.errors), ["codigo_inventario", "nombre", "tipo"]
        )

    def test_alta_rechaza_stock_cero(self):
        serializer = MaterialRegistroSerializer(
            data={"nombre": "Cable", "codigo_inventario": "OBJ-1", "tipo": "objeto", "stock": 0}
        )

        self.assertFalse(serializer.is_valid())
        self.assertEqual(serializer.errors["stock"], ["El stock debe ser al menos 1 unidad."])

    def test_alta_rechaza_tipo_invalido(self):
        serializer = MaterialRegistroSerializer(
            data={"nombre": "Cable", "codigo_inventario": "OBJ-1", "tipo": "edificio"}
        )

        self.assertFalse(serializer.is_valid())
        self.assertEqual(serializer.errors["tipo"], ["Tipo de material inválido."])

    def test_alta_rechaza_tier_invalido(self):
        serializer = MaterialRegistroSerializer(
            data={
                "nombre": "Cable",
                "codigo_inventario": "OBJ-1",
                "tipo": "objeto",
                "tier_minimo_requerido": "basico",
            }
        )

        self.assertFalse(serializer.is_valid())
        self.assertEqual(serializer.errors["tier_minimo_requerido"], ["Tier mínimo inválido."])

    def test_alta_rechaza_limite_de_puntos(self):
        serializer = MaterialRegistroSerializer(
            data={
                "nombre": "Cable",
                "codigo_inventario": "OBJ-1",
                "tipo": "objeto",
                "bonificacion_tiempo": 600,
            }
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("bonificacion_tiempo", serializer.errors)

    def test_alta_rechaza_campos_no_permitidos(self):
        serializer = MaterialRegistroSerializer(
            data={"nombre": "Cable", "codigo_inventario": "OBJ-1", "tipo": "objeto", "id": "1"}
        )

        self.assertFalse(serializer.is_valid())
        self.assertEqual(serializer.errors["id"], ["Este campo no está permitido."])

    def test_alta_admite_campos_opcionales(self):
        serializer = MaterialRegistroSerializer(
            data={
                "nombre": "Cable",
                "codigo_inventario": "OBJ-1",
                "tipo": "objeto",
                "stock": 3,
                "bonificacion_tiempo": 20,
                "costo_reparacion": None,
            }
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        # el estado y las marcas de tiempo no viajan en la entrada
        self.assertNotIn("estado", serializer.validated_data)
        self.assertNotIn("unidades_disponibles", serializer.validated_data)

    def test_edicion_acepta_estado(self):
        serializer = MaterialActualizacionSerializer(data={"estado": "en_mantenimiento"})

        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data["estado"], "en_mantenimiento")

    def test_edicion_acepta_payload_parcial(self):
        """Un PATCH puede cambiar solo el estado (HU04 criterio 8)."""
        self.assertTrue(MaterialActualizacionSerializer(data={}).is_valid())
        self.assertTrue(MaterialActualizacionSerializer(data={"stock": 5}).is_valid())

    def test_edicion_rechaza_estado_invalido(self):
        serializer = MaterialActualizacionSerializer(data={"estado": "perdido"})

        self.assertFalse(serializer.is_valid())
        self.assertEqual(serializer.errors["estado"], ["Estado de material inválido."])

    def test_edicion_rechaza_campos_no_permitidos(self):
        serializer = MaterialActualizacionSerializer(data={"created_at": "2026-01-01T00:00:00Z"})

        self.assertFalse(serializer.is_valid())
        self.assertEqual(serializer.errors["created_at"], ["Este campo no está permitido."])

    def test_edicion_admite_limpiar_costos(self):
        serializer = MaterialActualizacionSerializer(
            data={"costo_reparacion": None, "costo_reposicion": None}
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertIsNone(serializer.validated_data["costo_reparacion"])


class ModuloInventarioTestCase(SimpleTestCase):
    def test_urls_montadas_en_api(self):
        """Las urls del módulo están incluidas bajo /api/materiales/."""
        from config.urls import urlpatterns

        rutas = {str(p.pattern) for p in urlpatterns}
        self.assertIn("api/", rutas)


class EscenariosDeMaterialApi(ConMediaTemporal, APITestCase):
    """Sesión de gestor y utilidades compartidas por los tests de la API.

    Además de la sesión, mueve `MEDIA_ROOT` a un directorio temporal: los tests
    que suben archivos no deben dejar rastro en `backend/media/`.
    """

    LIST_URL = "/api/materiales/"

    def _crear_usuario(self, email, rol):
        usuario = registrar_usuario(
            nombre="Ana",
            apellido="Torres",
            email=email,
            dni=email.split("@")[0][-8:],
            tipo="docente",
            facultad="Ingeniería de Producción y Servicios",
            password="ClaveSegura123",
        )
        usuario.rol = Rol.objects.get(nombre=rol)
        usuario.save()
        return usuario

    def _autenticar(self, email, rol):
        """Deja una sesión activa con el usuario indicado."""
        usuario = self._crear_usuario(email, rol)
        sesion = self.client.session
        sesion[CLAVE_SESION_USUARIO_ID] = usuario.id
        sesion[CLAVE_SESION_ULTIMA_ACTIVIDAD] = timezone.now().isoformat()
        sesion.save()
        return usuario

    def _url_detalle(self, material):
        return f"{self.LIST_URL}{material.id}/"

    def _payload_valido(self, **extra):
        datos = {"nombre": "Cable HDMI", "codigo_inventario": "OBJ-001", "tipo": "objeto"}
        datos.update(extra)
        return datos


class MaterialesAPITestCase(EscenariosDeMaterialApi):
    """Tests de los endpoints de materiales (T04.05, HU04)."""

    # --- Listado y consulta: públicos ---

    def test_listar_materiales_es_publico(self):
        registrar_material(nombre="Cable HDMI", codigo_inventario="OBJ-001", tipo="objeto")

        respuesta = self.client.get(self.LIST_URL)

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(len(respuesta.json()), 1)
        self.assertEqual(respuesta.json()[0]["codigo_inventario"], "OBJ-001")

    def test_consultar_material_es_publico(self):
        material = registrar_material(
            nombre="Cable HDMI", codigo_inventario="OBJ-001", tipo="objeto", stock=3
        )

        respuesta = self.client.get(self._url_detalle(material))

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.json()["unidades_disponibles"], 3)

    # --- Registro: requiere gestor o administrador ---

    def test_registrar_sin_sesion_responde_403(self):
        respuesta = self.client.post(self.LIST_URL, self._payload_valido(), format="json")

        self.assertEqual(respuesta.status_code, 403)
        self.assertEqual(
            respuesta.json()["detail"], "Inicia sesión para gestionar el inventario."
        )
        self.assertEqual(Material.objects.count(), 0)

    def test_registrar_como_prestatario_responde_403(self):
        """El rol `prestatario` no gestiona el inventario (criterio 5)."""
        self._autenticar("prestatario@unsa.edu.pe", "prestatario")

        respuesta = self.client.post(self.LIST_URL, self._payload_valido(), format="json")

        self.assertEqual(respuesta.status_code, 403)
        self.assertEqual(
            respuesta.json()["detail"],
            "Solo un gestor o un administrador puede gestionar el inventario.",
        )
        self.assertEqual(Material.objects.count(), 0)

    def test_registrar_como_gestor_responde_201(self):
        self._autenticar("gestor@unsa.edu.pe", "gestor")

        respuesta = self.client.post(self.LIST_URL, self._payload_valido(), format="json")

        self.assertEqual(respuesta.status_code, 201, respuesta.content)
        cuerpo = respuesta.json()
        self.assertEqual(cuerpo["estado"], "disponible")
        self.assertEqual(cuerpo["unidades_disponibles"], 1)
        self.assertEqual(cuerpo["bonificacion_tiempo"], 5)
        self.assertEqual(Material.objects.count(), 1)

    def test_registrar_como_administrador_responde_201(self):
        self._autenticar("admin@unsa.edu.pe", "administrador")

        respuesta = self.client.post(self.LIST_URL, self._payload_valido(), format="json")

        self.assertEqual(respuesta.status_code, 201, respuesta.content)

    def test_registrar_con_codigo_duplicado_responde_409(self):
        self._autenticar("gestor@unsa.edu.pe", "gestor")
        registrar_material(nombre="Otro", codigo_inventario="OBJ-001", tipo="objeto")

        respuesta = self.client.post(self.LIST_URL, self._payload_valido(), format="json")

        self.assertEqual(respuesta.status_code, 409)
        self.assertEqual(Material.objects.count(), 1)

    def test_registrar_con_datos_invalidos_responde_400(self):
        self._autenticar("gestor@unsa.edu.pe", "gestor")

        respuesta = self.client.post(
            self.LIST_URL, {"nombre": "", "codigo_inventario": "", "tipo": "x"}, format="json"
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn("tipo", respuesta.json())
        self.assertEqual(Material.objects.count(), 0)

    def test_registrar_con_estado_responde_400(self):
        """`estado` no forma parte del contrato de alta (criterio 6)."""
        self._autenticar("gestor@unsa.edu.pe", "gestor")

        respuesta = self.client.post(
            self.LIST_URL, self._payload_valido(estado="prestado"), format="json"
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertEqual(Material.objects.count(), 0)

    # --- Edición: requiere gestor o administrador ---

    def test_editar_sin_sesion_responde_403(self):
        material = registrar_material(
            nombre="Cable HDMI", codigo_inventario="OBJ-001", tipo="objeto"
        )

        respuesta = self.client.patch(
            self._url_detalle(material), {"nombre": "Otro"}, format="json"
        )

        self.assertEqual(respuesta.status_code, 403)
        material.refresh_from_db()
        self.assertEqual(material.nombre, "Cable HDMI")

    def test_patch_cambia_estado_a_en_mantenimiento(self):
        material = registrar_material(
            nombre="Cable HDMI", codigo_inventario="OBJ-001", tipo="objeto"
        )
        self._autenticar("gestor@unsa.edu.pe", "gestor")

        respuesta = self.client.patch(
            self._url_detalle(material), {"estado": "en_mantenimiento"}, format="json"
        )

        self.assertEqual(respuesta.status_code, 200, respuesta.content)
        material.refresh_from_db()
        self.assertEqual(material.estado, "en_mantenimiento")

    def test_put_actualiza_los_campos_enviados(self):
        material = registrar_material(
            nombre="Cable HDMI", codigo_inventario="OBJ-001", tipo="objeto", stock=1
        )
        self._autenticar("gestor@unsa.edu.pe", "gestor")

        respuesta = self.client.put(
            self._url_detalle(material),
            {
                "nombre": "Cable HDMI 2m",
                "codigo_inventario": "OBJ-002",
                "tipo": "objeto",
                "stock": 5,
            },
            format="json",
        )

        self.assertEqual(respuesta.status_code, 200, respuesta.content)
        material.refresh_from_db()
        self.assertEqual(material.nombre, "Cable HDMI 2m")
        self.assertEqual(material.codigo_inventario, "OBJ-002")
        self.assertEqual(material.stock, 5)
        self.assertEqual(respuesta.json()["unidades_disponibles"], 5)

    def test_editar_con_codigo_duplicado_responde_409(self):
        registrar_material(nombre="Libro", codigo_inventario="LIB-001", tipo="libro")
        material = registrar_material(
            nombre="Cable", codigo_inventario="OBJ-001", tipo="objeto"
        )
        self._autenticar("gestor@unsa.edu.pe", "gestor")

        respuesta = self.client.patch(
            self._url_detalle(material), {"codigo_inventario": "LIB-001"}, format="json"
        )

        self.assertEqual(respuesta.status_code, 409)
        material.refresh_from_db()
        self.assertEqual(material.codigo_inventario, "OBJ-001")

    def test_editar_con_stock_cero_responde_400(self):
        material = registrar_material(
            nombre="Cable", codigo_inventario="OBJ-001", tipo="objeto"
        )
        self._autenticar("gestor@unsa.edu.pe", "gestor")

        respuesta = self.client.patch(
            self._url_detalle(material), {"stock": 0}, format="json"
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn("stock", respuesta.json())

    def test_editar_material_inexistente_responde_404(self):
        self._autenticar("gestor@unsa.edu.pe", "gestor")
        url_inexistente = f"{self.LIST_URL}11111111-1111-1111-1111-111111111111/"

        respuesta = self.client.patch(url_inexistente, {"stock": 2}, format="json")

        self.assertEqual(respuesta.status_code, 404)


class FotoMaterialServiceTestCase(ConMediaTemporal):
    """Tests de la foto en la capa de servicios (HU04, criterio 1)."""

    def _ruta(self, nombre):
        return Path(settings.MEDIA_ROOT) / nombre

    def test_registra_material_con_foto(self):
        material = registrar_material(
            nombre="Proyector Epson",
            codigo_inventario="INV-001",
            tipo="equipo",
            foto=imagen_en_memoria(),
        )

        self.assertTrue(material.foto)
        self.assertTrue(self._ruta(material.foto.name).exists())

    def test_la_foto_es_opcional(self):
        material = registrar_material(
            nombre="Cable HDMI", codigo_inventario="OBJ-001", tipo="objeto"
        )

        self.assertFalse(material.foto)

    def test_la_foto_se_guarda_bajo_materiales_con_fecha_y_token(self):
        material = registrar_material(
            nombre="Cable HDMI",
            codigo_inventario="OBJ-001",
            tipo="objeto",
            foto=imagen_en_memoria("JPEG", "proyector.jpg"),
        )

        partes = material.foto.name.split("/")
        self.assertEqual(partes[0], "materiales")
        self.assertRegex(partes[1], r"^\d{4}$")
        self.assertRegex(partes[2], r"^\d{2}$")
        self.assertTrue(partes[3].endswith(".jpg"), material.foto.name)
        # El token reemplaza al nombre original del archivo.
        self.assertNotIn("proyector", partes[3])

    def test_el_nombre_del_archivo_no_depende_del_original(self):
        """Dos materiales con el mismo archivo no pueden pisarse (criterio 9)."""
        primero = registrar_material(
            nombre="Cable",
            codigo_inventario="OBJ-001",
            tipo="objeto",
            foto=imagen_en_memoria("JPEG", "foto.jpg"),
        )
        segundo = registrar_material(
            nombre="Cable de repuesto",
            codigo_inventario="OBJ-002",
            tipo="objeto",
            foto=imagen_en_memoria("JPEG", "foto.jpg"),
        )

        self.assertNotEqual(primero.foto.name, segundo.foto.name)
        self.assertTrue(self._ruta(primero.foto.name).exists())
        self.assertTrue(self._ruta(segundo.foto.name).exists())

    def test_acepta_jpg_png_y_webp(self):
        for indice, formato in enumerate(["JPEG", "PNG", "WEBP"], start=1):
            with self.subTest(formato=formato):
                material = registrar_material(
                    nombre=f"Material {formato}",
                    codigo_inventario=f"OBJ-{indice:03d}",
                    tipo="objeto",
                    foto=imagen_en_memoria(formato),
                )
                self.assertTrue(material.foto)

    def test_rechaza_foto_sobre_el_limite(self):
        with self.assertRaises(ValidationError) as contexto:
            registrar_material(
                nombre="Foto pesada",
                codigo_inventario="OBJ-001",
                tipo="objeto",
                foto=imagen_sobre_el_limite(),
            )

        self.assertIn("5 MB", str(contexto.exception))
        self.assertEqual(Material.objects.count(), 0)

    def test_rechaza_formato_no_permitido(self):
        with self.assertRaises(ValidationError) as contexto:
            registrar_material(
                nombre="Foto gif",
                codigo_inventario="OBJ-001",
                tipo="objeto",
                foto=imagen_en_memoria("GIF"),
            )

        self.assertIn("JPG, PNG o WEBP", str(contexto.exception))
        self.assertEqual(Material.objects.count(), 0)

    def test_reemplazar_la_foto_borra_la_anterior(self):
        material = registrar_material(
            nombre="Proyector",
            codigo_inventario="INV-001",
            tipo="equipo",
            foto=imagen_en_memoria(),
        )
        nombre_anterior = material.foto.name
        ruta_anterior = self._ruta(nombre_anterior)
        self.assertTrue(ruta_anterior.exists())

        with self.captureOnCommitCallbacks(execute=True):
            actualizado = actualizar_material(
                material.id, foto=imagen_en_memoria("PNG", "nueva.png")
            )

        self.assertNotEqual(actualizado.foto.name, nombre_anterior)
        self.assertFalse(ruta_anterior.exists(), "La foto reemplazada debe borrarse.")
        self.assertTrue(self._ruta(actualizado.foto.name).exists())

    def test_editar_sin_tocar_la_foto_no_la_borra(self):
        material = registrar_material(
            nombre="Proyector",
            codigo_inventario="INV-001",
            tipo="equipo",
            foto=imagen_en_memoria(),
        )
        ruta = self._ruta(material.foto.name)

        with self.captureOnCommitCallbacks(execute=True):
            actualizado = actualizar_material(material.id, nombre="Proyector 4K")

        self.assertEqual(actualizado.foto.name, material.foto.name)
        self.assertTrue(ruta.exists())

    def test_quitar_la_foto_deja_el_material_sin_imagen(self):
        material = registrar_material(
            nombre="Proyector",
            codigo_inventario="INV-001",
            tipo="equipo",
            foto=imagen_en_memoria(),
        )
        ruta = self._ruta(material.foto.name)

        with self.captureOnCommitCallbacks(execute=True):
            actualizado = actualizar_material(material.id, foto=None)

        self.assertFalse(actualizado.foto)
        self.assertFalse(ruta.exists())


class ValidarFotoTestCase(SimpleTestCase):
    """Tests del validador de la foto, aislado del modelo."""

    def test_acepta_un_archivo_dentro_de_los_limites(self):
        validar_foto(imagen_en_memoria())

    def test_el_limite_es_de_5_mb(self):
        self.assertEqual(TAMANIO_MAXIMO, 5 * 1024 * 1024)

    def test_rechaza_lo_que_pesa_mas(self):
        with self.assertRaises(ValidationError):
            validar_foto(imagen_sobre_el_limite())


class FotoSerializadorTestCase(ConMediaTemporal):
    """Tests de la URL de la foto que viaja en el JSON (HU04, criterio 2)."""

    class FotoConUrlFija:
        """Imita un `FieldFile` que ya devuelve una URL absoluta."""

        def __init__(self, url):
            self.url = url

        def __bool__(self):
            return True

    def test_antepone_el_origen_publico_a_la_ruta_local(self):
        material = registrar_material(
            nombre="Proyector",
            codigo_inventario="INV-001",
            tipo="equipo",
            foto=imagen_en_memoria(),
        )

        url = MaterialSerializer(material).data["foto"]

        self.assertTrue(
            url.startswith(f"{settings.MEDIA_URL_PUBLICA}/{settings.MEDIA_URL.lstrip('/')}"),
            url,
        )

    def test_sin_foto_devuelve_cadena_vacia(self):
        """El frontend distingue 'no hay foto' con una cadena, no con null."""
        material = registrar_material(
            nombre="Cable", codigo_inventario="OBJ-001", tipo="objeto"
        )

        self.assertEqual(MaterialSerializer(material).data["foto"], "")

    def test_una_url_absoluta_se_devuelve_sin_anteponer_nada(self):
        """En producción Cloudinary ya entrega una URL completa."""
        url_cloudinary = (
            "https://res.cloudinary.com/demo/image/upload/v1/materiales/2026/09/abc123.jpg"
        )

        self.assertEqual(
            FotoMaterial().to_representation(self.FotoConUrlFija(url_cloudinary)),
            url_cloudinary,
        )


class FotoContratoEntradaTestCase(SimpleTestCase):
    """Tests de la validación de la foto en los contratos de entrada."""

    def test_alta_admite_cada_formato_permitido(self):
        for formato in ["JPEG", "PNG", "WEBP"]:
            with self.subTest(formato=formato):
                serializer = MaterialRegistroSerializer(
                    data={
                        "nombre": "Cable",
                        "codigo_inventario": "OBJ-1",
                        "tipo": "objeto",
                        "foto": imagen_en_memoria(formato),
                    }
                )
                self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_alta_rechaza_foto_sobre_el_limite(self):
        serializer = MaterialRegistroSerializer(
            data={
                "nombre": "Cable",
                "codigo_inventario": "OBJ-1",
                "tipo": "objeto",
                "foto": imagen_sobre_el_limite(),
            }
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("5 MB", str(serializer.errors["foto"]))

    def test_alta_rechaza_formato_no_permitido(self):
        serializer = MaterialRegistroSerializer(
            data={
                "nombre": "Cable",
                "codigo_inventario": "OBJ-1",
                "tipo": "objeto",
                "foto": imagen_en_memoria("GIF"),
            }
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("JPG, PNG o WEBP", str(serializer.errors["foto"]))

    def test_alta_rechaza_un_archivo_vacio(self):
        serializer = MaterialRegistroSerializer(
            data={
                "nombre": "Cable",
                "codigo_inventario": "OBJ-1",
                "tipo": "objeto",
                "foto": SimpleUploadedFile("vacio.jpg", b"", content_type="image/jpeg"),
            }
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("foto", serializer.errors)

    def test_alta_rechaza_un_archivo_que_no_es_imagen(self):
        serializer = MaterialRegistroSerializer(
            data={
                "nombre": "Cable",
                "codigo_inventario": "OBJ-1",
                "tipo": "objeto",
                "foto": SimpleUploadedFile(
                    "falso.jpg", b"esto no es una imagen", content_type="image/jpeg"
                ),
            }
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("foto", serializer.errors)

    def test_la_foto_no_es_obligatoria_en_el_alta(self):
        serializer = MaterialRegistroSerializer(
            data={"nombre": "Cable", "codigo_inventario": "OBJ-1", "tipo": "objeto"}
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertNotIn("foto", serializer.validated_data)

    def test_la_edicion_tambien_valida_la_foto(self):
        serializer = MaterialActualizacionSerializer(
            data={"foto": imagen_en_memoria("GIF")}
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("JPG, PNG o WEBP", str(serializer.errors["foto"]))


class MaterialesFotoApiTestCase(EscenariosDeMaterialApi):
    """Tests de la subida de fotos por la API (HU04, criterios 1 y 2)."""

    def test_registrar_con_foto_responde_201(self):
        self._autenticar("gestor@unsa.edu.pe", "gestor")

        respuesta = self.client.post(
            self.LIST_URL,
            self._payload_valido(foto=imagen_en_memoria()),
            format="multipart",
        )

        self.assertEqual(respuesta.status_code, 201, respuesta.content)
        self.assertTrue(respuesta.json()["foto"])
        self.assertEqual(Material.objects.count(), 1)

    def test_la_url_de_la_foto_apunta_al_archivo_guardado(self):
        """La URL del JSON tiene que corresponder al archivo del disco.

        No se pide la URL por HTTP: `django.views.static.serve` captura el
        `MEDIA_ROOT` del momento en que se importa `config.urls`, así que
        con el directorio temporal apuntaría al lugar equivocado. Lo que se
        comprueba es el contrato: la URL pública y el archivo coinciden.
        """
        self._autenticar("gestor@unsa.edu.pe", "gestor")
        self.client.post(
            self.LIST_URL, self._payload_valido(foto=imagen_en_memoria()), format="multipart"
        )

        url_publica = self.client.get(self.LIST_URL).json()[0]["foto"]
        # Se quita solo el origen: `MEDIA_URL` ya empieza por `/`.
        ruta_relativa = url_publica.replace(settings.MEDIA_URL_PUBLICA, "", 1)

        self.assertEqual(ruta_relativa, f"/media/{Material.objects.get().foto.name}")
        self.assertTrue((Path(settings.MEDIA_ROOT) / Material.objects.get().foto.name).exists())

    def test_registrar_sin_foto_sigue_funcionando(self):
        self._autenticar("gestor@unsa.edu.pe", "gestor")

        respuesta = self.client.post(self.LIST_URL, self._payload_valido(), format="multipart")

        self.assertEqual(respuesta.status_code, 201, respuesta.content)
        self.assertEqual(respuesta.json()["foto"], "")

    def test_registrar_foto_sobre_el_limite_responde_400(self):
        self._autenticar("gestor@unsa.edu.pe", "gestor")

        respuesta = self.client.post(
            self.LIST_URL,
            self._payload_valido(foto=imagen_sobre_el_limite()),
            format="multipart",
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn("foto", respuesta.json())
        self.assertEqual(Material.objects.count(), 0)

    def test_registrar_formato_no_permitido_responde_400(self):
        self._autenticar("gestor@unsa.edu.pe", "gestor")

        respuesta = self.client.post(
            self.LIST_URL,
            self._payload_valido(foto=imagen_en_memoria("GIF")),
            format="multipart",
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn("foto", respuesta.json())
        self.assertEqual(Material.objects.count(), 0)

    def test_patch_reemplaza_la_foto(self):
        material = registrar_material(
            nombre="Proyector",
            codigo_inventario="INV-001",
            tipo="equipo",
            foto=imagen_en_memoria(),
        )
        nombre_anterior = material.foto.name
        self._autenticar("gestor@unsa.edu.pe", "gestor")

        with self.captureOnCommitCallbacks(execute=True):
            respuesta = self.client.patch(
                self._url_detalle(material),
                {"foto": imagen_en_memoria("PNG", "nueva.png")},
                format="multipart",
            )

        self.assertEqual(respuesta.status_code, 200, respuesta.content)
        material.refresh_from_db()
        self.assertNotEqual(material.foto.name, nombre_anterior)
        self.assertFalse((Path(settings.MEDIA_ROOT) / nombre_anterior).exists())

    def test_el_json_ya_no_expone_foto_url(self):
        self._autenticar("gestor@unsa.edu.pe", "gestor")
        self.client.post(
            self.LIST_URL, self._payload_valido(foto=imagen_en_memoria()), format="multipart"
        )

        cuerpo = self.client.get(self.LIST_URL).json()[0]

        self.assertNotIn("foto_url", cuerpo)
        self.assertIn("foto", cuerpo)
