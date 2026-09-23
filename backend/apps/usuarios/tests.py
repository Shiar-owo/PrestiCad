"""Tests del módulo usuarios."""
from django.test import SimpleTestCase, TestCase

from apps.usuarios.models import Credencial, Usuario
from apps.usuarios.services import UsuariosError, registrar_usuario


class ModuloUsuariosTestCase(SimpleTestCase):
    def test_config_del_modulo(self):
        """La app `usuarios` existe y su config es la esperada."""
        from django.apps import apps

        from apps.usuarios.apps import UsuariosConfig

        conf = apps.get_app_config("usuarios")
        self.assertIsInstance(conf, UsuariosConfig)

    def test_urls_montadas_en_api(self):
        """Las urls del modulo estan incluidas bajo /api/usuarios/."""
        from config.urls import urlpatterns

        rutas = {str(p.pattern) for p in urlpatterns}
        self.assertIn("api/usuarios/", rutas)


class ReputacionInicialTestCase(TestCase):
    """Tests del Tier inicial Neutral (T01.04).

    Al registrar un usuario la reputación inicia en Neutral: 0 puntos y
    Tier Estándar. El servicio no recibe ni permite sobrescribir estos
    valores, por lo que quedarán siempre en sus valores por defecto.
    """

    def _registrar(self, **extra):
        datos = dict(
            nombre="María",
            apellido="López",
            email="maria.lopez@unsa.edu.pe",
            dni="87654321",
            tipo="docente",
            facultad="Ingeniería de Producción y Servicios",
            password="ClaveSegura123",
        )
        datos.update(extra)
        return registrar_usuario(**datos)

    def test_reputacion_inicia_en_neutral_al_registrar(self):
        """Puntaje 0 y tier Estándar (Neutral) al crear el usuario."""
        usuario = self._registrar()

        self.assertEqual(usuario.reputacion_puntaje, 0)
        self.assertEqual(usuario.reputacion_tier, "estandar")

    def test_el_servicio_no_expone_campos_de_reputacion(self):
        """`registrar_usuario` no acepta parámetros de reputación.

        La reputación no se puede sobrescribir al registrar: el contrato del
        servicio no los recibe (el rechazo por HTTP se cubre en T01.05).
        """
        import inspect

        firmados = inspect.signature(registrar_usuario).parameters
        self.assertNotIn("reputacion_puntaje", firmados)
        self.assertNotIn("reputacion_tier", firmados)


class RegistrarUsuarioServiceTestCase(TestCase):
    """Tests del servicio `registrar_usuario` (T01.03)."""

    def _registrar(self, email="juan.perez@unsa.edu.pe", dni="76543210", **extra):
        datos = dict(
            nombre="Juan",
            apellido="Pérez",
            email=email,
            dni=dni,
            telefono="987654321",
            tipo="alumno",
            facultad="Ingeniería de Producción y Servicios",
            departamento_carrera="Ingeniería de Sistemas",
            password="ClaveSegura123",
        )
        datos.update(extra)
        return registrar_usuario(**datos)

    def test_registro_exitoso_crea_usuario_y_credencial(self):
        usuario = self._registrar()

        self.assertIsNotNone(usuario.pk)
        self.assertEqual(Usuario.objects.count(), 1)

        credencial = Credencial.objects.get(usuario=usuario)
        self.assertEqual(credencial.email, "juan.perez@unsa.edu.pe")
        self.assertEqual(usuario.estado, "activo")
        self.assertEqual(usuario.tipo, "alumno")
        self.assertEqual(usuario.facultad, "Ingeniería de Producción y Servicios")
        self.assertEqual(usuario.departamento_carrera, "Ingeniería de Sistemas")

    def test_password_se_almacena_hasheada(self):
        self._registrar(password="ClaveSegura123")

        credencial = Credencial.objects.get()
        self.assertNotEqual(credencial.password_hash, "ClaveSegura123")
        self.assertTrue(credencial.password_hash.startswith(("pbkdf2_", "bcrypt", "scrypt_")))
        self.assertTrue(credencial.password_hash.startswith("pbkdf2_"))

    def test_email_normalizado_a_minusculas_y_sin_espacios(self):
        usuario = self._registrar(email="  Juan.Perez@UNSA.EDU.PE  ")

        self.assertEqual(usuario.email, "juan.perez@unsa.edu.pe")
        self.assertEqual(Credencial.objects.get().email, "juan.perez@unsa.edu.pe")

    def test_email_duplicado_eleva_error(self):
        self._registrar(email="juan.perez@unsa.edu.pe")

        with self.assertRaises(UsuariosError) as ctx:
            self._registrar(email="JUAN.PEREZ@unsa.edu.pe", dni="12345678")

        self.assertEqual(ctx.exception.campo, "email")
        self.assertEqual(Usuario.objects.count(), 1)

    def test_dni_duplicado_eleva_error(self):
        self._registrar(dni="76543210")

        with self.assertRaises(UsuariosError) as ctx:
            self._registrar(dni="76543210", email="otro@unsa.edu.pe")

        self.assertEqual(ctx.exception.campo, "dni")
        self.assertEqual(ctx.exception.mensaje, "El DNI ya está registrado.")
        self.assertEqual(Usuario.objects.count(), 1)

    def test_registro_duplicado_no_deja_restos(self):
        """La creación es transaccional: no quedan usuarios ni credenciales."""
        self._registrar(email="juan.perez@unsa.edu.pe")
        with self.assertRaises(UsuariosError):
            self._registrar(email="juan.perez@unsa.edu.pe", dni="12345678")

        self.assertEqual(Usuario.objects.count(), 1)
        self.assertEqual(Credencial.objects.count(), 1)