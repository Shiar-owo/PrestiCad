"""Tests del módulo usuarios."""
from datetime import timedelta

from django.contrib.sessions.middleware import SessionMiddleware
from django.http import HttpResponse
from django.test import RequestFactory
from django.test import SimpleTestCase, TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.usuarios.models import Credencial, Usuario
from apps.usuarios.middleware import (
    ExpiracionSesionInactividadMiddleware,
    SesionAutenticadaMiddleware,
)
from apps.usuarios.serializers import ActualizarPerfilSerializer, PerfilUsuarioSerializer
from apps.usuarios.services import (
    UsuariosError,
    autenticar_usuario,
    actualizar_perfil,
    obtener_perfil,
    registrar_usuario,
)
from apps.usuarios.sesiones import CLAVE_SESION_USUARIO_ID, CLAVE_SESION_ULTIMA_ACTIVIDAD


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


class RegistroUsuarioAPITestCase(APITestCase):
    """Tests del endpoint POST /api/usuarios (T01.05)."""

    URL = "/api/usuarios/"

    def _post(self, **extra):
        datos = dict(
            nombre="Juan",
            apellido="Pérez",
            email="juan.perez@unsa.edu.pe",
            dni="76543210",
            telefono="987654321",
            tipo="alumno",
            facultad="Ingeniería de Producción y Servicios",
            departamento_carrera="Ingeniería de Sistemas",
            password="ClaveSegura123",
        )
        datos.update(extra)
        return self.client.post(self.URL, datos, format="json")

    def test_registro_exitoso_devuelve_201(self):
        respuesta = self._post()

        self.assertEqual(respuesta.status_code, status.HTTP_201_CREATED)
        cuerpo = respuesta.json()
        self.assertEqual(cuerpo["email"], "juan.perez@unsa.edu.pe")
        self.assertEqual(cuerpo["facultad"], "Ingeniería de Producción y Servicios")
        self.assertEqual(cuerpo["departamento_carrera"], "Ingeniería de Sistemas")
        self.assertEqual(cuerpo["tipo"], "alumno")
        self.assertEqual(cuerpo["estado"], "activo")
        self.assertEqual(cuerpo["reputacion_puntaje"], 0)
        self.assertNotIn("password", cuerpo)

        credencial = Credencial.objects.get()
        self.assertNotEqual(credencial.password_hash, "ClaveSegura123")

    def test_email_duplicado_devuelve_409(self):
        self._post()

        respuesta = self._post(email="JUAN.PEREZ@unsa.edu.pe", dni="12345678")

        self.assertEqual(respuesta.status_code, status.HTTP_409_CONFLICT)
        cuerpo = respuesta.json()
        self.assertIn("email", cuerpo)
        self.assertEqual(cuerpo["email"], ["El email ya está registrado."])
        self.assertEqual(Usuario.objects.count(), 1)

    def test_dni_duplicado_devuelve_409(self):
        self._post()

        respuesta = self._post(dni="76543210", email="otro@unsa.edu.pe")

        self.assertEqual(respuesta.status_code, status.HTTP_409_CONFLICT)
        self.assertIn("dni", respuesta.json())
        self.assertEqual(Usuario.objects.count(), 1)

    def test_datos_invalidos_devuelven_400(self):
        respuesta = self._post(password="123", dni="abc", tipo="invalido")

        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        cuerpo = respuesta.json()
        self.assertIn("password", cuerpo)
        self.assertIn("dni", cuerpo)
        self.assertIn("tipo", cuerpo)
        self.assertEqual(Usuario.objects.count(), 0)

    def test_facultad_obligatoria_devuelve_400(self):
        respuesta = self._post(facultad="")

        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("facultad", respuesta.json())
        self.assertEqual(Usuario.objects.count(), 0)

    def test_reputacion_no_es_sobrescribible_por_http(self):
        """Enviar reputación en el POST produce 400: no es parte del contrato."""
        respuesta = self._post(reputacion_puntaje=500, reputacion_tier="avanzado")

        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("reputacion_puntaje", respuesta.json())
        self.assertEqual(Usuario.objects.count(), 0)


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


class AuthEndpointsAPITestCase(APITestCase):
    def setUp(self):
        self.usuario = registrar_usuario(
            nombre="Luis",
            apellido="Ramos",
            email="luis.ramos@unsa.edu.pe",
            dni="11223344",
            telefono="999888777",
            tipo="alumno",
            facultad="Ingeniería de Producción y Servicios",
            departamento_carrera="Ingeniería de Sistemas",
            password="ClaveSegura123",
        )
        self.login_url = "/api/auth/login/"
        self.logout_url = "/api/auth/logout/"

    def test_login_exitoso_crea_sesion_y_devuelve_usuario(self):
        respuesta = self.client.post(
            self.login_url,
            {"email": "LUIS.RAMOS@UNSA.EDU.PE", "password": "ClaveSegura123"},
            format="json",
        )

        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        cuerpo = respuesta.json()
        self.assertEqual(cuerpo["mensaje"], "Sesión iniciada correctamente.")
        self.assertEqual(cuerpo["usuario"]["email"], "luis.ramos@unsa.edu.pe")
        self.assertEqual(cuerpo["usuario"]["rol"], "prestatario")

        session = self.client.session
        self.assertEqual(session[CLAVE_SESION_USUARIO_ID], self.usuario.id)
        self.assertIn(CLAVE_SESION_ULTIMA_ACTIVIDAD, session)

    def test_login_con_credenciales_invalidas_devuelve_401(self):
        respuesta = self.client.post(
            self.login_url,
            {"email": "luis.ramos@unsa.edu.pe", "password": "incorrecta"},
            format="json",
        )

        self.assertEqual(respuesta.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(respuesta.json()["detail"], "Email o contraseña incorrectos")

    def test_logout_cierra_la_sesion(self):
        self.client.post(
            self.login_url,
            {"email": "luis.ramos@unsa.edu.pe", "password": "ClaveSegura123"},
            format="json",
        )

        respuesta = self.client.post(self.logout_url, format="json")

        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual(respuesta.json()["mensaje"], "Sesión cerrada correctamente.")

        session = self.client.session
        self.assertNotIn(CLAVE_SESION_USUARIO_ID, session)
        self.assertNotIn(CLAVE_SESION_ULTIMA_ACTIVIDAD, session)

    def test_login_con_cuenta_bloqueada_devuelve_423(self):
        credencial = Credencial.objects.get(usuario=self.usuario)
        credencial.failed_attempts = 5
        credencial.locked_until = timezone.now() + timezone.timedelta(minutes=15)
        credencial.save(update_fields=["failed_attempts", "locked_until"])

        respuesta = self.client.post(
            self.login_url,
            {"email": "luis.ramos@unsa.edu.pe", "password": "ClaveSegura123"},
            format="json",
        )

        self.assertEqual(respuesta.status_code, status.HTTP_423_LOCKED)
        self.assertEqual(respuesta.json()["detail"], "La cuenta está bloqueada temporalmente.")

    def test_login_con_datos_invalidos_devuelve_400(self):
        respuesta = self.client.post(
            self.login_url,
            {"email": "correo-no-valido", "password": "123"},
            format="json",
        )

        self.assertEqual(respuesta.status_code, status.HTTP_400_BAD_REQUEST)
        errores = respuesta.json()
        self.assertIn("email", errores)
        self.assertIn("password", errores)


class AutenticacionServiceTestCase(TestCase):
    """Pruebas del servicio base de autenticación de HU03."""

    def setUp(self):
        self.usuario = registrar_usuario(
            nombre="Luis",
            apellido="Ramos",
            email="luis.ramos@unsa.edu.pe",
            dni="11223344",
            telefono="999888777",
            tipo="alumno",
            facultad="Ingeniería de Producción y Servicios",
            departamento_carrera="Ingeniería de Sistemas",
            password="ClaveSegura123",
        )

    def test_autenticar_usuario_exitoso_reinicia_intentos(self):
        credencial = Credencial.objects.get(usuario=self.usuario)
        credencial.failed_attempts = 3
        credencial.locked_until = None
        credencial.save(update_fields=["failed_attempts", "locked_until"])

        usuario = autenticar_usuario(email="  LUIS.RAMOS@UNSA.EDU.PE ", password="ClaveSegura123")
        credencial.refresh_from_db()

        self.assertEqual(usuario.pk, self.usuario.pk)
        self.assertEqual(credencial.failed_attempts, 0)
        self.assertIsNone(credencial.locked_until)

    def test_autenticar_usuario_con_password_incorrecta_incrementa_intentos(self):
        with self.assertRaises(UsuariosError) as ctx:
            autenticar_usuario(email="luis.ramos@unsa.edu.pe", password="clave-incorrecta")

        credencial = Credencial.objects.get(usuario=self.usuario)

        self.assertEqual(ctx.exception.campo, "password")
        self.assertEqual(credencial.failed_attempts, 1)
        self.assertIsNone(credencial.locked_until)

    def test_autenticar_usuario_bloquea_al_quinto_intento_fallido(self):
        for _ in range(4):
            with self.assertRaises(UsuariosError):
                autenticar_usuario(email="luis.ramos@unsa.edu.pe", password="12345678")

        credencial = Credencial.objects.get(usuario=self.usuario)
        self.assertEqual(credencial.failed_attempts, 4)
        self.assertIsNone(credencial.locked_until)

        with self.assertRaises(UsuariosError) as ctx:
            autenticar_usuario(email="luis.ramos@unsa.edu.pe", password="12345678")

        credencial.refresh_from_db()
        self.assertEqual(ctx.exception.mensaje, "El email o la contraseña son incorrectos.")
        self.assertEqual(credencial.failed_attempts, 5)
        self.assertIsNotNone(credencial.locked_until)
        self.assertGreater(credencial.locked_until, timezone.now())

    def test_autenticar_usuario_rechaza_cuenta_bloqueada(self):
        credencial = Credencial.objects.get(usuario=self.usuario)
        credencial.failed_attempts = 5
        credencial.locked_until = timezone.now() + timezone.timedelta(minutes=10)
        credencial.save(update_fields=["failed_attempts", "locked_until"])

        with self.assertRaises(UsuariosError) as ctx:
            autenticar_usuario(email="luis.ramos@unsa.edu.pe", password="ClaveSegura123")

        credencial.refresh_from_db()
        self.assertEqual(ctx.exception.mensaje, "La cuenta está bloqueada temporalmente.")
        self.assertEqual(credencial.failed_attempts, 5)

    def test_autenticar_usuario_reanuda_si_el_bloqueo_vencio(self):
        credencial = Credencial.objects.get(usuario=self.usuario)
        credencial.failed_attempts = 5
        credencial.locked_until = timezone.now() - timezone.timedelta(minutes=1)
        credencial.save(update_fields=["failed_attempts", "locked_until"])

        usuario = autenticar_usuario(email="luis.ramos@unsa.edu.pe", password="ClaveSegura123")
        credencial.refresh_from_db()

        self.assertEqual(usuario.pk, self.usuario.pk)
        self.assertEqual(credencial.failed_attempts, 0)
        self.assertIsNone(credencial.locked_until)


class PerfilUsuarioServiceTestCase(TestCase):
    """Pruebas de perfil que no dependen del flujo de autenticación."""

    def setUp(self):
        self.usuario = Usuario.objects.create(
            nombre="Ana",
            apellido="García",
            email="ana.garcia@unsa.edu.pe",
            dni="12345678",
            telefono="987654321",
            tipo="alumno",
            facultad="Ciencias de la Computación",
            reputacion_puntaje=225,
            reputacion_tier="avanzado",
        )

    def test_obtener_perfil_devuelve_datos_disponibles_del_usuario(self):
        datos = obtener_perfil(self.usuario)

        self.assertEqual(
            datos,
            {
                "nombre": "Ana",
                "apellido": "García",
                "email": "ana.garcia@unsa.edu.pe",
                "dni": "12345678",
                "telefono": "987654321",
                "tipo": "alumno",
                "reputacion_puntaje": 225,
                "reputacion_tier": "avanzado",
            },
        )

    def test_actualizar_perfil_modifica_solo_nombre_y_telefono(self):
        actualizar_perfil(self.usuario, nombre=" Ana María ", telefono=" 912345678 ")
        self.usuario.refresh_from_db()

        self.assertEqual(self.usuario.nombre, "Ana María")
        self.assertEqual(self.usuario.telefono, "912345678")
        self.assertEqual(self.usuario.apellido, "García")
        self.assertEqual(self.usuario.email, "ana.garcia@unsa.edu.pe")
        self.assertEqual(self.usuario.dni, "12345678")
        self.assertEqual(self.usuario.tipo, "alumno")
        self.assertEqual(self.usuario.reputacion_puntaje, 225)
        self.assertEqual(self.usuario.reputacion_tier, "avanzado")

    def test_actualizar_perfil_sin_telefono_conserva_el_actual(self):
        actualizar_perfil(self.usuario, nombre="Ana Sofía")
        self.usuario.refresh_from_db()

        self.assertEqual(self.usuario.nombre, "Ana Sofía")
        self.assertEqual(self.usuario.telefono, "987654321")

    def test_serializer_de_perfil_expone_solo_datos_del_perfil(self):
        serializer = PerfilUsuarioSerializer(instance=obtener_perfil(self.usuario))

        self.assertEqual(serializer.data["nombre"], "Ana")
        self.assertEqual(serializer.data["reputacion_puntaje"], 225)
        self.assertEqual(serializer.data["reputacion_tier"], "avanzado")
        self.assertNotIn("id", serializer.data)
        self.assertNotIn("password", serializer.data)

    def test_serializer_de_actualizacion_acepta_nombre_y_telefono(self):
        serializer = ActualizarPerfilSerializer(
            data={"nombre": "Ana María", "telefono": "912345678"}
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(
            serializer.validated_data,
            {"nombre": "Ana María", "telefono": "912345678"},
        )

    def test_serializer_de_actualizacion_requiere_nombre(self):
        serializer = ActualizarPerfilSerializer(data={"telefono": ""})

        self.assertFalse(serializer.is_valid())
        self.assertIn("nombre", serializer.errors)

    def test_serializer_de_actualizacion_rechaza_campos_no_editables(self):
        serializer = ActualizarPerfilSerializer(
            data={"nombre": "Ana", "email": "otra@unsa.edu.pe", "dni": "87654321"}
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("email", serializer.errors)
        self.assertIn("dni", serializer.errors)


class ExpiracionSesionInactividadMiddlewareTestCase(TestCase):
    """Pruebas del middleware de expiración por inactividad (T03.03)."""

    def setUp(self):
        self.factory = RequestFactory()
        self.middleware = ExpiracionSesionInactividadMiddleware(lambda request: HttpResponse("ok"))

    def _crear_request_con_sesion(self):
        request = self.factory.get("/")
        SessionMiddleware(lambda request: None).process_request(request)
        request.session.save()
        request.session[CLAVE_SESION_USUARIO_ID] = 1
        return request

    def test_actualiza_ultima_actividad_si_la_sesion_sigue_activa(self):
        request = self._crear_request_con_sesion()
        request.session[CLAVE_SESION_ULTIMA_ACTIVIDAD] = (
            timezone.now() - timedelta(minutes=5)
        ).isoformat()

        self.middleware(request)

        self.assertIn(CLAVE_SESION_USUARIO_ID, request.session)
        self.assertIn(CLAVE_SESION_ULTIMA_ACTIVIDAD, request.session)
        ultima_actividad = timezone.datetime.fromisoformat(
            request.session[CLAVE_SESION_ULTIMA_ACTIVIDAD]
        )
        if timezone.is_naive(ultima_actividad):
            ultima_actividad = timezone.make_aware(
                ultima_actividad,
                timezone.get_current_timezone(),
            )
        self.assertLess((timezone.now() - ultima_actividad).total_seconds(), 5)

    def test_expira_la_sesion_si_supera_el_limite_de_inactividad(self):
        request = self._crear_request_con_sesion()
        request.session[CLAVE_SESION_ULTIMA_ACTIVIDAD] = (
            timezone.now() - timedelta(minutes=31)
        ).isoformat()

        self.middleware(request)

        self.assertIsNone(request.session.session_key)
        self.assertNotIn(CLAVE_SESION_USUARIO_ID, request.session)
        self.assertNotIn(CLAVE_SESION_ULTIMA_ACTIVIDAD, request.session)


class SesionAutenticadaMiddlewareTestCase(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.middleware = SesionAutenticadaMiddleware(lambda request: HttpResponse("ok"))
        self.usuario = registrar_usuario(
            nombre="Luis",
            apellido="Ramos",
            email="luis.ramos@unsa.edu.pe",
            dni="11223344",
            telefono="999888777",
            tipo="alumno",
            facultad="Ingeniería de Producción y Servicios",
            departamento_carrera="Ingeniería de Sistemas",
            password="ClaveSegura123",
        )

    def _crear_request(self, usuario_id=None):
        request = self.factory.get("/")
        SessionMiddleware(lambda req: None).process_request(request)
        request.session.save()
        if usuario_id is not None:
            request.session[CLAVE_SESION_USUARIO_ID] = usuario_id
        return request

    def test_asigna_usuario_autenticado_si_la_sesion_es_valida(self):
        request = self._crear_request(usuario_id=self.usuario.id)
        self.middleware(request)

        self.assertIsNotNone(request.usuario_autenticado)
        self.assertEqual(request.usuario_autenticado.id, self.usuario.id)

    def test_usuario_autenticado_es_none_si_no_hay_sesion(self):
        request = self._crear_request()
        self.middleware(request)

        self.assertIsNone(request.usuario_autenticado)

    def test_usuario_autenticado_es_none_si_usuario_no_existe(self):
        request = self._crear_request(usuario_id=99999)
        self.middleware(request)

        self.assertIsNone(request.usuario_autenticado)

