import { useEffect, useState } from 'react'

import './estilos.css'
import { api } from './api/client'
import IniciarSesion from './pages/IniciarSesion'
import RegistroUsuario from './pages/RegistroUsuario'
import UsuariosRoles from './pages/UsuariosRoles'

function App() {
  const [pagina, setPagina] = useState(window.location.pathname)
  const [usuario, setUsuario] = useState(null)
  const [cargandoSesion, setCargandoSesion] = useState(true)

  useEffect(() => {
    const actualizarRuta = () => setPagina(window.location.pathname)
    window.addEventListener('popstate', actualizarRuta)
    api.get('/auth/me/')
      .then(setUsuario)
      .catch(() => setUsuario(null))
      .finally(() => setCargandoSesion(false))
    return () => window.removeEventListener('popstate', actualizarRuta)
  }, [])

  function navegar(ruta) {
    window.history.pushState({}, '', ruta)
    setPagina(ruta)
  }

  async function cerrarSesion() {
    try {
      await api.get('/auth/csrf/')
      await api.post('/auth/logout/', {})
    } finally {
      setUsuario(null)
      navegar('/')
    }
  }

  const ruta = pagina.replace(/\/$/, '') || '/'

  return (
    <main>
      <header>
        <h1>PrestiCad</h1>
        <p>Sistema de Préstamos Académicos</p>
        <nav aria-label="Navegación principal">
          <a href="/" onClick={(evento) => { evento.preventDefault(); navegar('/') }}>Inicio</a>{' · '}
          <a href="/registro" onClick={(evento) => { evento.preventDefault(); navegar('/registro') }}>Registro</a>{' · '}
          {usuario ? (
            <>
              <span>Sesión: {usuario.nombre} {usuario.apellido}</span>
              {usuario.rol === 'administrador' && (
                <> · <a href="/usuarios/roles" onClick={(evento) => { evento.preventDefault(); navegar('/usuarios/roles') }}>Gestionar roles</a></>
              )}
              {' · '}
              <button type="button" onClick={cerrarSesion}>Cerrar sesión</button>
            </>
          ) : (
            <a href="/login" onClick={(evento) => { evento.preventDefault(); navegar('/login') }}>Iniciar sesión</a>
          )}
        </nav>
      </header>

      {cargandoSesion ? <p>Comprobando sesión…</p> : (
        <>
          {ruta === '/registro' && <RegistroUsuario />}
          {ruta === '/login' && (
            <IniciarSesion onIniciarSesion={(sesion) => {
              setUsuario(sesion)
              navegar(sesion.rol === 'administrador' ? '/usuarios/roles' : '/')
            }} />
          )}
          {ruta === '/usuarios/roles' && (
            usuario?.rol === 'administrador'
              ? <UsuariosRoles />
              : <p role="alert">Debes iniciar sesión como administrador para gestionar roles.</p>
          )}
          {ruta === '/' && (
            <section>
              <h2>Bienvenido a PrestiCad</h2>
              <p>Registra una cuenta o inicia sesión para continuar.</p>
            </section>
          )}
        </>
      )}
    </main>
  )
}

export default App
