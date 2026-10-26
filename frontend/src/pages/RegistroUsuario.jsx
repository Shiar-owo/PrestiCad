import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'

import { api, ErrorApi } from '../api/client'
import { validarNombre, validarTelefono } from '../validaciones'
import useTituloPagina from '../hooks/useTituloPagina'
import Tarjeta from '../components/ui/Tarjeta'
import Campo from '../components/ui/Campo'
import Boton from '../components/ui/Boton'
import ErrorAlerta from '../components/ui/ErrorAlerta'

export const CAMPOS_OBLIGATORIOS_REGISTRO = [
  'nombre',
  'apellido',
  'email',
  'dni',
  'tipo',
  'facultad',
  'password',
  'confirmarPassword',
]

export const AVISO_CAMPOS_OBLIGATORIOS =
  'Los campos marcados con * son obligatorios.'

const TIPOS_USUARIO = [
  { valor: 'alumno', etiqueta: 'Alumno' },
  { valor: 'docente', etiqueta: 'Docente' },
  { valor: 'administrativo', etiqueta: 'Administrativo' },
]

const NOMBRES_CAMPOS_API = {
  departamento_carrera: 'departamentoCarrera',
}

const DATOS_INICIALES = {
  nombre: '',
  apellido: '',
  email: '',
  dni: '',
  telefono: '',
  tipo: 'alumno',
  facultad: '',
  departamentoCarrera: '',
  password: '',
  confirmarPassword: '',
}

function validar(datos) {
  const errores = {}

  const errorNombre = validarNombre(datos.nombre)
  if (errorNombre) {
    errores.nombre = errorNombre
  }

  if (!datos.apellido.trim()) {
    errores.apellido = 'El apellido es obligatorio.'
  }

  if (!datos.email.trim()) {
    errores.email = 'El email es obligatorio.'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.email.trim())) {
    errores.email = 'Ingresa un correo electrónico válido.'
  }

  if (!/^\d{8}$/.test(datos.dni)) {
    errores.dni = 'El DNI debe tener exactamente 8 dígitos numéricos.'
  }

  const errorTelefono = validarTelefono(datos.telefono)
  if (errorTelefono) {
    errores.telefono = errorTelefono
  }

  if (!datos.facultad.trim()) {
    errores.facultad = 'La facultad es obligatoria.'
  }

  if (datos.password.length < 8) {
    errores.password = 'La contraseña debe tener al menos 8 caracteres.'
  }

  if (datos.confirmarPassword !== datos.password) {
    errores.confirmarPassword = 'Las contraseñas no coinciden.'
  }

  return errores
}

function ModalRegistroExitoso({ onIrALogin }) {
  const botonRef = useRef(null)

  useEffect(() => {
    botonRef.current?.focus()
  }, [])

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
      role="presentation"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="registro-exitoso-titulo"
        aria-describedby="registro-exitoso-descripcion"
        className="w-full max-w-md rounded-xl border border-marca-300 bg-superficie p-6 shadow-2xl dark:border-marca-700"
      >
        <h2
          id="registro-exitoso-titulo"
          className="text-lg font-bold text-marca-800 dark:text-marca-300"
        >
          Registro completado satisfactoriamente
        </h2>
        <p id="registro-exitoso-descripcion" className="mt-2 text-sm text-texto-suave">
          Tu cuenta ha sido creada correctamente. Ahora puedes iniciar sesión con tu correo
          institucional y tu contraseña.
        </p>
        <div className="mt-5 flex justify-end">
          <button
            ref={botonRef}
            type="button"
            onClick={onIrALogin}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-marca-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-marca-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento-600"
          >
            Ir a iniciar sesión
          </button>
        </div>
      </section>
    </div>
  )
}

function RegistroUsuario() {
  useTituloPagina('Crear cuenta')
  const navigate = useNavigate()
  const [datos, setDatos] = useState(DATOS_INICIALES)
  const [errores, setErrores] = useState({})
  const [enviando, setEnviando] = useState(false)
  const [registroExitoso, setRegistroExitoso] = useState(false)

  function actualizar(campo, valor) {
    setDatos((previos) => ({ ...previos, [campo]: valor }))
    setErrores((previos) => ({ ...previos, [campo]: undefined, formulario: undefined }))
  }

  function construirDatosParaApi() {
    return {
      nombre: datos.nombre.trim(),
      apellido: datos.apellido.trim(),
      email: datos.email.trim(),
      dni: datos.dni.trim(),
      telefono: datos.telefono.trim(),
      tipo: datos.tipo,
      facultad: datos.facultad.trim(),
      departamento_carrera: datos.departamentoCarrera.trim(),
      password: datos.password,
    }
  }

  function mostrarErroresDelBackend(datosError) {
    const erroresApi = {}
    for (const campo of Object.keys(datosError)) {
      const clave = NOMBRES_CAMPOS_API[campo] || campo
      erroresApi[clave] = Array.isArray(datosError[campo])
        ? datosError[campo][0]
        : String(datosError[campo])
    }
    setErrores(erroresApi)
  }

  async function manejarEnvio(evento) {
    evento.preventDefault()
    const erroresDelFormulario = validar(datos)
    setErrores(erroresDelFormulario)
    if (Object.keys(erroresDelFormulario).length > 0) {
      return
    }

    setEnviando(true)
    setRegistroExitoso(false)
    try {
      await api.post('/usuarios/', construirDatosParaApi())
      setDatos(DATOS_INICIALES)
      setErrores({})
      setRegistroExitoso(true)
    } catch (error) {
      if (error instanceof ErrorApi && error.datos) {
        mostrarErroresDelBackend(error.datos)
      } else {
        setErrores({
          formulario: 'No se pudo conectar con el servidor. Inténtalo de nuevo.',
        })
      }
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12">
      <header className="mb-5">
        <h2 className="text-xl font-bold text-texto">Registrar usuario</h2>
        <p className="mt-1 text-sm text-texto-suave">
          Crea tu cuenta de prestatario con tu correo institucional.
        </p>
        <p className="mt-1.5 text-xs text-texto-suave">
          <span className="font-bold text-error" aria-hidden="true">*</span>{' '}
          Los campos marcados con <span className="font-semibold text-error">*</span> son obligatorios.
        </p>
      </header>

      <Tarjeta className="p-6">
        <form onSubmit={manejarEnvio} noValidate className="grid gap-4">
          {errores.formulario && <ErrorAlerta mensaje={errores.formulario} />}

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              etiqueta="Nombre"
              valor={datos.nombre}
              onCambio={(evento) => actualizar('nombre', evento.target.value)}
              error={errores.nombre}
              requerido
            />
            <Campo
              etiqueta="Apellido"
              valor={datos.apellido}
              onCambio={(evento) => actualizar('apellido', evento.target.value)}
              error={errores.apellido}
              requerido
            />
            <Campo
              etiqueta="Email institucional"
              tipo="email"
              valor={datos.email}
              onCambio={(evento) => actualizar('email', evento.target.value)}
              error={errores.email}
              placeholder="ejemplo@unsa.edu.pe"
              requerido
            />
            <Campo
              etiqueta="DNI"
              valor={datos.dni}
              onCambio={(evento) => actualizar('dni', evento.target.value)}
              error={errores.dni}
              maxLength={8}
              inputMode="numeric"
              ayuda="8 dígitos numéricos."
              requerido
            />
            <Campo
              etiqueta="Teléfono (opcional)"
              tipo="tel"
              valor={datos.telefono}
              onCambio={(evento) => actualizar('telefono', evento.target.value)}
              error={errores.telefono}
            />
            <Campo
              etiqueta="Tipo de usuario"
              opciones={TIPOS_USUARIO}
              valor={datos.tipo}
              onCambio={(evento) => actualizar('tipo', evento.target.value)}
              requerido
            />
            <Campo
              etiqueta="Facultad"
              valor={datos.facultad}
              onCambio={(evento) => actualizar('facultad', evento.target.value)}
              error={errores.facultad}
              requerido
            />
            <Campo
              etiqueta="Departamento / Carrera (opcional)"
              valor={datos.departamentoCarrera}
              onCambio={(evento) => actualizar('departamentoCarrera', evento.target.value)}
              error={errores.departamentoCarrera}
            />
            <Campo
              etiqueta="Contraseña inicial"
              tipo="password"
              valor={datos.password}
              onCambio={(evento) => actualizar('password', evento.target.value)}
              error={errores.password}
              ayuda="Mínimo 8 caracteres."
              requerido
            />
            <Campo
              etiqueta="Confirmar contraseña"
              tipo="password"
              valor={datos.confirmarPassword}
              onCambio={(evento) => actualizar('confirmarPassword', evento.target.value)}
              error={errores.confirmarPassword}
              ayuda="Repite la contraseña inicial."
              requerido
            />
          </div>

          <Boton tipo="submit" cargando={enviando} className="w-full">
            Registrar
          </Boton>
        </form>
      </Tarjeta>

      {registroExitoso && (
        <ModalRegistroExitoso onIrALogin={() => navigate('/login')} />
      )}
    </div>
  )
}

export default RegistroUsuario