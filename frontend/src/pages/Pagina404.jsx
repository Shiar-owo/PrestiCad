import { Link } from 'react-router'

import Contenido from '../components/layout/Contenido'

function Pagina404() {
  return (
    <Contenido>
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <p className="text-6xl font-black text-marca-600">404</p>
        <h1 className="text-2xl font-bold text-texto">Página no encontrada</h1>
        <p className="text-texto-suave">La dirección que buscas no existe o fue movida.</p>
        <Link
          to="/"
          className="rounded-lg bg-marca-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-marca-800"
        >
          Volver al inicio
        </Link>
      </div>
    </Contenido>
  )
}

export default Pagina404