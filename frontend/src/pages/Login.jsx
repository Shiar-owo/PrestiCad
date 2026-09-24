import { useState } from 'react'

import { validarEmail, validarPassword } from '../validaciones'

function Campo({ etiqueta, error, children }) {
  return (
    <label>
      <span>{etiqueta}</span>
      {children}
      {error && <span className="error">{error}</span>}
    </label>
  )
}

function Login({ onSubmit, cargando = false, errorGeneral = '' }) {
  const [datos, setDatos] = useState({ email: '', password: '' })
  const [errores, setErrores] = useState({})

  function actualizar(campo, valor) {
    setDatos((previos) => ({ ...previos, [campo]: valor }))
    if (errores[campo]) {
      setErrores((previos) => ({ ...previos, [campo]: '' }))
    }
  }

  function manejarEnvio(evento) {
    evento.preventDefault()

    const nuevosErrores = {}
    const errorEmail = validarEmail(datos.email)
    const errorPassword = validarPassword(datos.password)

    if (errorEmail) nuevosErrores.email = errorEmail
    if (errorPassword) nuevosErrores.password = errorPassword

    setErrores(nuevosErrores)

    if (Object.keys(nuevosErrores).length > 0) {
      return
    }

    if (onSubmit) {
      onSubmit({
        email: datos.email.trim(),
        password: datos.password,
      })
    }
  }

  return (
    <section className="login">
      <h2>Iniciar sesión</h2>

      {errorGeneral && (
        <div className="error-general" role="alert">
          {errorGeneral}
        </div>
      )}

      <form onSubmit={manejarEnvio} noValidate>
        <Campo etiqueta="Correo electrónico" error={errores.email}>
          <input
            type="email"
            value={datos.email}
            onChange={(e) => actualizar('email', e.target.value)}
            placeholder="ejemplo@unsa.edu.pe"
            aria-invalid={Boolean(errores.email)}
            disabled={cargando}
            autoComplete="email"
          />
        </Campo>

        <Campo etiqueta="Contraseña" error={errores.password}>
          <input
            type="password"
            value={datos.password}
            onChange={(e) => actualizar('password', e.target.value)}
            placeholder="Mínimo 8 caracteres"
            aria-invalid={Boolean(errores.password)}
            disabled={cargando}
            autoComplete="current-password"
          />
        </Campo>

        <button type="submit" disabled={cargando}>
          {cargando ? 'Iniciando sesión...' : 'Iniciar sesión'}
        </button>
      </form>
    </section>
  )
}

export default Login
