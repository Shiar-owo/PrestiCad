import { useState } from 'react'

import { api } from './api/client'
import './estilos.css'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import RegistroUsuario from './pages/RegistroUsuario'
import UsuariosRoles from './pages/UsuariosRoles'

function App() {
  const [usuarioActual, setUsuarioActual] = useState(null)
  const [vista, setVista] = useState('login')

  function manejarLoginExitoso(usuario) {
    setUsuarioActual(usuario)
  }

  async function manejarCierreSesion() {
    try {
      await api.post('/auth/logout/')
    } catch {
      // Si falla la red, cerramos la sesión local de todas formas
    }
    setUsuarioActual(null)
    setVista('login')
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
        <button
          type="button"
          className={vista === 'roles' ? 'activo' : 'boton-secundario'}
          onClick={() => setVista('roles')}
        >
          Roles (Admin)
        </button>
      </nav>

      {vista === 'login' && <Login onLoginExitoso={manejarLoginExitoso} />}
      {vista === 'registro' && <RegistroUsuario />}
      {vista === 'roles' && <UsuariosRoles />}
    </main>
  )
}

export default App