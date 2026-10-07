import { useEffect, useState } from 'react'

import { api } from './api/client'
import './estilos.css'
import CatalogoMateriales from './pages/CatalogoMateriales'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import RegistroUsuario from './pages/RegistroUsuario'
import UsuariosRoles from './pages/UsuariosRoles'

function App() {
  const [usuarioActual, setUsuarioActual] = useState(null)
  const [vista, setVista] = useState('login')
  const [cargandoSesion, setCargandoSesion] = useState(true)

  useEffect(() => {
    api.get('/auth/me/')
      .then(setUsuarioActual)
      .catch(() => setUsuarioActual(null))
      .finally(() => setCargandoSesion(false))
  }, [])

  function manejarLoginExitoso(usuario) {
    setUsuarioActual(usuario)
    setVista('dashboard')
  }

  function manejarPerfilActualizado(perfil) {
    setUsuarioActual((usuario) => (usuario ? { ...usuario, ...perfil } : usuario))
  }

  async function manejarCierreSesion() {
    try {
      await api.post('/auth/logout/', {})
    } catch {
      // Se limpia la vista local aunque falle la conexión.
    }
    setUsuarioActual(null)
    setVista('login')
  }

  if (cargandoSesion) {
    return <main><h1>PrestiCad</h1><p>Comprobando sesión…</p></main>
  }

  return (
    <main>
      <h1>PrestiCad</h1>
      <p>Sistema de Préstamos Académicos</p>
      {usuarioActual ? (
        <>
          <nav className="navegacion-auth" aria-label="Navegación principal">
            <button
              type="button"
              className={vista === 'dashboard' ? 'activo' : 'boton-secundario'}
              onClick={() => setVista('dashboard')}
            >Panel principal</button>
            <button
              type="button"
              className={vista === 'catalogo' ? 'activo' : 'boton-secundario'}
              onClick={() => setVista('catalogo')}
            >Catálogo</button>
            {usuarioActual.rol === 'administrador' && (
              <button
                type="button"
                className={vista === 'roles' ? 'activo' : 'boton-secundario'}
                onClick={() => setVista('roles')}
              >Gestionar roles</button>
            )}
            <button type="button" className="boton-secundario" onClick={manejarCierreSesion}>
              Cerrar sesión
            </button>
          </nav>
          {vista === 'roles' && usuarioActual.rol === 'administrador' ? (
            <UsuariosRoles />
          ) : vista === 'catalogo' ? (
            <CatalogoMateriales />
          ) : (
            <Dashboard
              usuario={usuarioActual}
              onPerfilActualizado={manejarPerfilActualizado}
            />
          )}
        </>
      ) : (
        <>
          <nav className="navegacion-auth" aria-label="Acceso">
            <button
              type="button"
              className={vista === 'catalogo' ? 'activo' : 'boton-secundario'}
              onClick={() => setVista('catalogo')}
            >Catálogo</button>
            <button
              type="button"
              className={vista === 'login' ? 'activo' : 'boton-secundario'}
              onClick={() => setVista('login')}
            >Iniciar sesión</button>
            <button
              type="button"
              className={vista === 'registro' ? 'activo' : 'boton-secundario'}
              onClick={() => setVista('registro')}
            >Registrarse</button>
          </nav>
          {vista === 'catalogo' && <CatalogoMateriales />}
          {vista === 'login' && <Login onLoginExitoso={manejarLoginExitoso} />}
          {vista === 'registro' && <RegistroUsuario />}
        </>
      )}
    </main>
  )
}

export default App
