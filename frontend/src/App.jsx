import { useState } from 'react'

import './estilos.css'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import RegistroUsuario from './pages/RegistroUsuario'

function App() {
  const [usuarioActual, setUsuarioActual] = useState(null)
  const [vista, setVista] = useState('login')

  function manejarLoginExitoso(usuario) {
    setUsuarioActual(usuario)
  }

  function manejarCierreSesion() {
    setUsuarioActual(null)
  }

  if (usuarioActual) {
    return (
      <main>
        <h1>PrestiCad</h1>
        <p>Sistema de Préstamos Académicos</p>
        <Dashboard usuario={usuarioActual} onCerrarSesion={manejarCierreSesion} />
      </main>
    )
  }

  return (
    <main>
      <h1>PrestiCad</h1>
      <p>Sistema de Préstamos Académicos</p>

      <nav className="navegacion-auth">
        <button
          type="button"
          className={vista === 'login' ? 'activo' : 'boton-secundario'}
          onClick={() => setVista('login')}
        >
          Iniciar sesión
        </button>
        <button
          type="button"
          className={vista === 'registro' ? 'activo' : 'boton-secundario'}
          onClick={() => setVista('registro')}
        >
          Registrarse
        </button>
      </nav>

      {vista === 'login' ? (
        <Login onLoginExitoso={manejarLoginExitoso} />
      ) : (
        <RegistroUsuario />
      )}
    </main>
  )
}

export default App