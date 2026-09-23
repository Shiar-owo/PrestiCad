"""Validacion de que los modulos estan correctamente reconocidos por Django."""
from django.apps import apps
from django.test import SimpleTestCase

from apps.usuarios.apps import UsuariosConfig


class ModuloUsuariosTestCase(SimpleTestCase):
    def test_config_del_modulo(self):
        """La app `usuarios` existe y su config es la esperada."""
        conf = apps.get_app_config("usuarios")
        self.assertIsInstance(conf, UsuariosConfig)

    def test_urls_montadas_en_api(self):
        """Las urls del modulo estan incluidas bajo /api/usuarios/."""
        from config.urls import urlpatterns

        rutas = {str(p.pattern) for p in urlpatterns}
        self.assertIn("api/usuarios/", rutas)