import { useContext } from 'react'
import { Outlet } from 'react-router'

import SesionContext from '../../contextos/SesionContext'
import { ETIQUETAS_ROL } from '../../constantes/roles'

function PanelPrivado() {
  const { usuario } = useContext(SesionContext)

  if (!usuario) {
    return null
  }

  const nombreRol = ETIQUETAS_ROL[usuario.rol] || usuario.rol

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-texto">
          Bienvenido, {usuario.nombre} {usuario.apellido}
        </h1>
        <p className="mt-1 text-texto-suave">
          Sesión iniciada como <strong className="font-semibold text-texto">{nombreRol}</strong> (
          {usuario.email})
        </p>
      </header>
      <Outlet />
    </main>
  )
}

export default PanelPrivado