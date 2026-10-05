import { useState } from 'react'

import { api, ErrorApi } from '../api/client'

function IniciarSesion({ onIniciarSesion }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function manejarEnvio(evento) {
    evento.preventDefault()
    setError('')
    setEnviando(true)
    try {
      await api.get('/auth/csrf/')
      const resultado = await api.post('/auth/login/', { email, password })
      onIniciarSesion(resultado.usuario)
    } catch (fallo) {
      setError(
        fallo instanceof ErrorApi && fallo.datos?.detail
          ? fallo.datos.detail
          : 'No se pudo iniciar sesión. Inténtalo nuevamente.',
      )
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section>
      <h2>Iniciar sesión</h2>
      <form onSubmit={manejarEnvio}>
        {error && <p className="error" role="alert">{error}</p>}
        <label>
          <span>Email</span>
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(evento) => setEmail(evento.target.value)}
          />
        </label>
        <label>
          <span>Contraseña</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(evento) => setPassword(evento.target.value)}
          />
        </label>
        <button type="submit" disabled={enviando}>
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </section>
  )
}

export default IniciarSesion
