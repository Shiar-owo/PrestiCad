import { useState } from 'react'

export const OPCIONES_CATEGORIA = [
  { valor: '', etiqueta: 'Todas las categorías' },
  { valor: 'equipo', etiqueta: 'Equipo' },
  { valor: 'libro', etiqueta: 'Libro' },
  { valor: 'objeto', etiqueta: 'Objeto' },
]

export const OPCIONES_ESTADO = [
  { valor: '', etiqueta: 'Todos los estados' },
  { valor: 'disponible', etiqueta: 'Disponible' },
  { valor: 'prestado', etiqueta: 'Prestado' },
  { valor: 'reservado', etiqueta: 'Reservado' },
  { valor: 'en_mantenimiento', etiqueta: 'En Mantenimiento' },
]

function BarraBusqueda({ onBuscar, cargando = false, valoresIniciales = {} }) {
  const [q, setQ] = useState(valoresIniciales.q || '')
  const [categoria, setCategoria] = useState(valoresIniciales.categoria || '')
  const [estado, setEstado] = useState(valoresIniciales.estado || '')

  function manejarEnvio(evento) {
    evento.preventDefault()
    if (onBuscar) {
      onBuscar({
        q: q.trim(),
        categoria,
        estado,
      })
    }
  }

  function manejarLimpiar() {
    setQ('')
    setCategoria('')
    setEstado('')
    if (onBuscar) {
      onBuscar({
        q: '',
        categoria: '',
        estado: '',
      })
    }
  }

  const hayFiltrosActivos = q.trim() !== '' || categoria !== '' || estado !== ''

  return (
    <form className="barra-busqueda" role="search" onSubmit={manejarEnvio}>
      <div className="barra-busqueda__campo barra-busqueda__campo--texto">
        <label htmlFor="busqueda-nombre">Buscar por nombre</label>
        <input
          id="busqueda-nombre"
          type="search"
          placeholder="Ej. Laptop, Proyector, Libro..."
          value={q}
          disabled={cargando}
          onChange={(evento) => setQ(evento.target.value)}
        />
      </div>

      <div className="barra-busqueda__campo">
        <label htmlFor="busqueda-categoria">Categoría</label>
        <select
          id="busqueda-categoria"
          value={categoria}
          disabled={cargando}
          onChange={(evento) => setCategoria(evento.target.value)}
        >
          {OPCIONES_CATEGORIA.map((opcion) => (
            <option key={opcion.valor} value={opcion.valor}>
              {opcion.etiqueta}
            </option>
          ))}
        </select>
      </div>

      <div className="barra-busqueda__campo">
        <label htmlFor="busqueda-estado">Estado</label>
        <select
          id="busqueda-estado"
          value={estado}
          disabled={cargando}
          onChange={(evento) => setEstado(evento.target.value)}
        >
          {OPCIONES_ESTADO.map((opcion) => (
            <option key={opcion.valor} value={opcion.valor}>
              {opcion.etiqueta}
            </option>
          ))}
        </select>
      </div>

      <div className="barra-busqueda__acciones">
        <button type="submit" disabled={cargando}>
          {cargando ? 'Buscando…' : 'Buscar'}
        </button>
        {hayFiltrosActivos && (
          <button
            type="button"
            className="boton-secundario"
            disabled={cargando}
            onClick={manejarLimpiar}
          >
            Limpiar
          </button>
        )}
      </div>
    </form>
  )
}

export default BarraBusqueda
