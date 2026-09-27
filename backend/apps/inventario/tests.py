"""Tests del módulo inventario."""
from django.test import SimpleTestCase, TestCase

from apps.inventario.models import Material
from apps.inventario.services import (
    InventarioError,
    MaterialNoEncontradoError,
    actualizar_material,
    cambiar_estado_material,
    listar_materiales,
    normalizar_codigo,
    obtener_material,
    registrar_material,
)


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
