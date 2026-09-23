import { useState } from 'react'

import { api, ErrorApi } from '../api/client'
import { validarNombre, validarTelefono } from '../validaciones'

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

function Campo({ etiqueta, error, children }) {
  return (
    <label>
      <span>{etiqueta}</span>
      {children}
      {error && <span className="error">{error}</span>}
    </label>
  )
}

function RegistroUsuario() {
  const [datos, setDatos] = useState(DATOS_INICIALES)
  const [errores, setErrores] = useState({})
  const [enviando, setEnviando] = useState(false)
  const [mensajeExito, setMensajeExito] = useState('')

  function actualizar(campo, valor) {
    setDatos((previos) => ({ ...previos, [campo]: valor }))
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
    setMensajeExito('')
    try {
      await api.post('/usuarios/', construirDatosParaApi())
      setMensajeExito('Usuario registrado correctamente.')
      setDatos(DATOS_INICIALES)
      setErrores({})
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
    <section>
      <h2>Registrar usuario</h2>
      <form onSubmit={manejarEnvio} noValidate>
        {mensajeExito && <p className="exito">{mensajeExito}</p>}
        {errores.formulario && <p className="error">{errores.formulario}</p>}

        <Campo etiqueta="Nombre" error={errores.nombre}>
          <input
            type="text"
            value={datos.nombre}
            aria-invalid={Boolean(errores.nombre)}
            onChange={(e) => actualizar('nombre', e.target.value)}
          />
        </Campo>

        <Campo etiqueta="Apellido" error={errores.apellido}>
          <input
            type="text"
            value={datos.apellido}
            aria-invalid={Boolean(errores.apellido)}
            onChange={(e) => actualizar('apellido', e.target.value)}
          />
        </Campo>

        <Campo etiqueta="Email institucional" error={errores.email}>
          <input
            type="email"
            value={datos.email}
            aria-invalid={Boolean(errores.email)}
            onChange={(e) => actualizar('email', e.target.value)}
          />
        </Campo>

        <Campo etiqueta="DNI" error={errores.dni}>
          <input
            type="text"
            maxLength={8}
            value={datos.dni}
            aria-invalid={Boolean(errores.dni)}
            onChange={(e) => actualizar('dni', e.target.value)}
          />
        </Campo>

        <Campo etiqueta="Teléfono (opcional)" error={errores.telefono}>
          <input
            type="tel"
            value={datos.telefono}
            aria-invalid={Boolean(errores.telefono)}
            onChange={(e) => actualizar('telefono', e.target.value)}
          />
        </Campo>

        <Campo etiqueta="Tipo de usuario">
          <select
            value={datos.tipo}
            onChange={(e) => actualizar('tipo', e.target.value)}
          >
            {TIPOS_USUARIO.map((tipo) => (
              <option key={tipo.valor} value={tipo.valor}>
                {tipo.etiqueta}
              </option>
            ))}
          </select>
        </Campo>

        <Campo etiqueta="Facultad" error={errores.facultad}>
          <input
            type="text"
            value={datos.facultad}
            aria-invalid={Boolean(errores.facultad)}
            onChange={(e) => actualizar('facultad', e.target.value)}
          />
        </Campo>

        <Campo etiqueta="Departamento / Carrera" error={errores.departamentoCarrera}>
          <input
            type="text"
            value={datos.departamentoCarrera}
            aria-invalid={Boolean(errores.departamentoCarrera)}
            onChange={(e) => actualizar('departamentoCarrera', e.target.value)}
          />
        </Campo>

        <Campo etiqueta="Contraseña inicial" error={errores.password}>
          <input
            type="password"
            value={datos.password}
            aria-invalid={Boolean(errores.password)}
            onChange={(e) => actualizar('password', e.target.value)}
          />
        </Campo>

        <Campo etiqueta="Confirmar contraseña" error={errores.confirmarPassword}>
          <input
            type="password"
            value={datos.confirmarPassword}
            aria-invalid={Boolean(errores.confirmarPassword)}
            onChange={(e) => actualizar('confirmarPassword', e.target.value)}
          />
        </Campo>

        <button type="submit" disabled={enviando}>
          {enviando ? 'Registrando…' : 'Registrar'}
        </button>
      </form>
    </section>
  )
}

export default RegistroUsuario
