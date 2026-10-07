import { useContext } from 'react'
import { Navigate, useLocation } from 'react-router'

import SesionContext from '../contextos/SesionContext'
import Skeleton from '../components/ui/Skeleton'

function PantallaCargaSesion() {
  return (
    <div role="status" aria-live="polite" className="mx-auto w-full max-w-6xl space-y-4 px-4 py-8">
      <Skeleton className="h-7 w-64" />
      <Skeleton className="h-4 w-96" />
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  )
}

export function RequerirSesion({ children }) {
  const { usuario, cargandoSesion } = useContext(SesionContext)
  const ubicacion = useLocation()

  if (cargandoSesion) {
    return <PantallaCargaSesion />
  }

  if (!usuario) {
    return <Navigate to="/login" replace state={{ desde: ubicacion }} />
  }

  return children
}

export function RequerirRol({ roles, children }) {
  const { usuario } = useContext(SesionContext)

  if (!usuario || !roles.includes(usuario.rol)) {
    return <Navigate to="/panel" replace />
  }

  return children
}

export function RedirigirAutenticado({ children }) {
  const { usuario, cargandoSesion } = useContext(SesionContext)

  if (cargandoSesion) {
    return null
  }

  if (usuario) {
    return <Navigate to="/panel" replace />
  }

  return children
}