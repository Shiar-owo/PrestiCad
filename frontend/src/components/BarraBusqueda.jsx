import { useState } from 'react'

import {
  OPCIONES_FILTRO_CATEGORIA,
} from '../constantes/catalogo'
import Campo from './ui/Campo'
import Boton from './ui/Boton'

function BarraBusqueda({ onBuscar, cargando = false, valoresIniciales = {} }) {
  const [q, setQ] = useState(valoresIniciales.q || '')
  const [categoria, setCategoria] = useState(valoresIniciales.categoria || '')

  function manejarEnvio(evento) {
    evento.preventDefault()
    if (onBuscar) {
      onBuscar({
        q: q.trim(),
        categoria,
      })
    }
  }

  function manejarLimpiar() {
    setQ('')
    setCategoria('')
    if (onBuscar) {
      onBuscar({
        q: '',
        categoria: '',
      })
    }
  }

  const hayFiltrosActivos = q.trim() !== '' || categoria !== ''

  return (
    <form
      role="search"
      onSubmit={manejarEnvio}
      className="rounded-xl border border-borde bg-superficie p-5"
    >
      <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_1fr]">
        <Campo
          etiqueta="Buscar por nombre"
          tipo="search"
          valor={q}
          onCambio={(evento) => setQ(evento.target.value)}
          placeholder="Ej. Laptop, Proyector, Libro..."
          deshabilitado={cargando}
        />
        <Campo
          etiqueta="Categoría"
          opciones={OPCIONES_FILTRO_CATEGORIA}
          valor={categoria}
          onCambio={(evento) => setCategoria(evento.target.value)}
          deshabilitado={cargando}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Boton tipo="submit" cargando={cargando}>
          Buscar
        </Boton>
        {hayFiltrosActivos && (
          <Boton variante="secundario" tipo="button" deshabilitado={cargando} onClick={manejarLimpiar}>
            Limpiar
          </Boton>
        )}
      </div>
    </form>
  )
}

export default BarraBusqueda