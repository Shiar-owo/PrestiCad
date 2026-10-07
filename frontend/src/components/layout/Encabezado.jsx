import { useContext, useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router'
import { Menu, Moon, Sun, X } from 'lucide-react'

import SesionContext from '../../contextos/SesionContext'
import MenuUsuario from './MenuUsuario'

function claseEnlace({ isActive }) {
  return `inline-flex items-center rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
    isActive
      ? 'bg-marca-600/15 text-marca-800 dark:bg-marca-500/15 dark:text-marca-300'
      : 'text-texto hover:bg-superficie-alta'
  }`
}

function EnlaceMovil({ to, activo, children }) {
  return (
    <Link
      to={to}
      className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
        activo
          ? 'bg-marca-600/15 text-marca-800 dark:bg-marca-500/15 dark:text-marca-300'
          : 'text-texto hover:bg-superficie-alta'
      }`}
    >
      {children}
    </Link>
  )
}

function Encabezado({ tema, onAlternarTema }) {
  const { usuario } = useContext(SesionContext)
  const [menuAbierto, setMenuAbierto] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => {
    setMenuAbierto(false)
  }, [pathname])

  const claseBotonIcono =
    'flex size-9 items-center justify-center rounded-lg text-texto transition-colors hover:bg-superficie-alta'

  return (
    <header className="sticky top-0 z-40 border-b border-borde bg-fondo/95 backdrop-blur dark:bg-fondo/95">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <Link to="/" className="flex items-center gap-2.5">
          <img src="/favicon.svg" alt="Icono de PrestiCad" className="size-8" />
          <span className="text-lg font-bold text-texto">PrestiCad</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Navegación principal">
          <NavLink to="/catalogo" className={claseEnlace}>
            Catálogo
          </NavLink>
          {usuario && (
            <>
              <NavLink to="/panel" end className={claseEnlace}>
                Inicio
              </NavLink>
              {usuario.rol === 'administrador' && (
                <NavLink to="/admin/roles" className={claseEnlace}>
                  Gestionar roles
                </NavLink>
              )}
            </>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onAlternarTema}
            aria-label={tema === 'oscuro' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
            title={tema === 'oscuro' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
            className={claseBotonIcono}
          >
            {tema === 'oscuro' ? (
              <Sun aria-hidden="true" className="size-5" />
            ) : (
              <Moon aria-hidden="true" className="size-5" />
            )}
          </button>

          {usuario ? (
            <MenuUsuario />
          ) : (
            <div className="hidden items-center gap-2 md:flex">
              <Link
                to="/login"
                className="rounded-lg border border-borde px-3 py-2 text-sm font-semibold text-texto transition-colors hover:bg-superficie-alta"
              >
                Iniciar sesión
              </Link>
              <Link
                to="/registro"
                className="rounded-lg bg-marca-700 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-marca-800"
              >
                Registrarse
              </Link>
            </div>
          )}

          <button
            type="button"
            className={`${claseBotonIcono} md:hidden`}
            aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={menuAbierto}
            onClick={() => setMenuAbierto((actual) => !actual)}
          >
            {menuAbierto ? (
              <X aria-hidden="true" className="size-5" />
            ) : (
              <Menu aria-hidden="true" className="size-5" />
            )}
          </button>
        </div>
      </div>

      {menuAbierto && (
        <nav
          className="border-t border-borde bg-fondo px-4 py-3 md:hidden"
          aria-label="Menú móvil"
        >
          <div className="flex flex-col gap-1">
            <EnlaceMovil to="/catalogo" activo={pathname === '/catalogo'}>
              Catálogo
            </EnlaceMovil>
            {usuario && (
              <>
                <EnlaceMovil to="/panel" activo={pathname === '/panel'}>
                  Inicio
                </EnlaceMovil>
                {usuario.rol === 'administrador' && (
                  <EnlaceMovil to="/admin/roles" activo={pathname === '/admin/roles'}>
                    Gestionar roles
                  </EnlaceMovil>
                )}
              </>
            )}
            {!usuario && (
              <>
                <EnlaceMovil to="/login" activo={pathname === '/login'}>
                  Iniciar sesión
                </EnlaceMovil>
                <EnlaceMovil to="/registro" activo={pathname === '/registro'}>
                  Registrarse
                </EnlaceMovil>
              </>
            )}
          </div>
        </nav>
      )}
    </header>
  )
}

export default Encabezado