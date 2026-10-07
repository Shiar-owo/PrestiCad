import { useContext, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ChevronDown, LogOut, UserCircle } from 'lucide-react'

import SesionContext from '../../contextos/SesionContext'

function MenuUsuario() {
  const { usuario, cerrarSesion } = useContext(SesionContext)
  const [abierto, setAbierto] = useState(false)
  const caja = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    function manejarClickFuera(evento) {
      if (caja.current && !caja.current.contains(evento.target)) {
        setAbierto(false)
      }
    }
    function manejarTecla(evento) {
      if (evento.key === 'Escape') setAbierto(false)
    }
    document.addEventListener('mousedown', manejarClickFuera)
    document.addEventListener('keydown', manejarTecla)
    return () => {
      document.removeEventListener('mousedown', manejarClickFuera)
      document.removeEventListener('keydown', manejarTecla)
    }
  }, [])

  if (!usuario) {
    return null
  }

  const iniciales =
    `${usuario.nombre ? usuario.nombre[0] : ''}${usuario.apellido ? usuario.apellido[0] : ''}`.toUpperCase()

  async function manejarCierreSesion() {
    setAbierto(false)
    await cerrarSesion()
    navigate('/login', { replace: true })
  }

  return (
    <div className="relative" ref={caja}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={abierto}
        onClick={() => setAbierto((actual) => !actual)}
        className="flex items-center gap-2 rounded-lg border border-borde bg-superficie px-2 py-1.5 text-sm font-semibold text-texto transition-colors hover:bg-superficie-alta"
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-marca-600 text-xs font-bold text-white">
          {iniciales}
        </span>
        <span className="hidden sm:inline">{usuario.nombre}</span>
        <ChevronDown
          aria-hidden="true"
          className={`size-4 text-texto-suave transition-transform ${abierto ? 'rotate-180' : ''}`}
        />
      </button>

      {abierto && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-lg border border-borde bg-superficie shadow-lg"
        >
          <div className="border-b border-borde px-4 py-3">
            <p className="truncate text-sm font-semibold text-texto">
              {usuario.nombre} {usuario.apellido}
            </p>
            <p className="truncate text-xs text-texto-suave">{usuario.email}</p>
          </div>
          <Link
            role="menuitem"
            to="/panel/perfil"
            onClick={() => setAbierto(false)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm text-texto transition-colors hover:bg-superficie-alta"
          >
            <UserCircle aria-hidden="true" className="size-4 text-texto-suave" />
            Mi perfil
          </Link>
          <button
            role="menuitem"
            type="button"
            onClick={manejarCierreSesion}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-texto transition-colors hover:bg-superficie-alta"
          >
            <LogOut aria-hidden="true" className="size-4 text-texto-suave" />
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  )
}

export default MenuUsuario