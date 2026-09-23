import { useState } from 'react'

const TIPOS_USUARIO = [
  { valor: 'alumno', etiqueta: 'Alumno' },
  { valor: 'docente', etiqueta: 'Docente' },
  { valor: 'administrativo', etiqueta: 'Administrativo' },
]

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

  if (!datos.nombre.trim()) {
    errores.nombre = 'El nombre es obligatorio.'
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

  if (datos.telefono.trim() && !/^[\d+\s-]+$/.test(datos.telefono.trim())) {
    errores.telefono = 'El teléfono solo puede contener dígitos.'
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

  function actualizar(campo, valor) {
    setDatos((previos) => ({ ...previos, [campo]: valor }))
  }

  function manejarEnvio(evento) {
    evento.preventDefault()
    const erroresDelFormulario = validar(datos)
    setErrores(erroresDelFormulario)
    if (Object.keys(erroresDelFormulario).length > 0) {
      return
    }
    // TODO (T01.08): enviar al endpoint POST /api/usuarios.
  }

  return (
    <section>
      <h2>Registrar usuario</h2>
      <form onSubmit={manejarEnvio} noValidate>
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

        <Campo etiqueta="Departamento / Carrera">
          <input
            type="text"
            value={datos.departamentoCarrera}
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

        <button type="submit">Registrar</button>
      </form>
    </section>
  )
}

export default RegistroUsuario