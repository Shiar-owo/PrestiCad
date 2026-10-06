import { useEffect, useState } from 'react'

import { api } from '../api/client'
import BarraBusqueda from '../components/BarraBusqueda'
import ResultadosMateriales from '../components/ResultadosMateriales'

function CatalogoMateriales({ onSeleccionarMaterial }) {
  const [materiales, setMateriales] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [filtros, setFiltros] = useState({ q: '', categoria: '', estado: '' })

  useEffect(() => {
    buscarMateriales(filtros)
  }, [])

  async function buscarMateriales(nuevosFiltros) {
    setCargando(true)
    setError('')
    setFiltros(nuevosFiltros)

    try {
      const params = new URLSearchParams()
      if (nuevosFiltros.q) params.set('q', nuevosFiltros.q)
      if (nuevosFiltros.categoria) params.set('categoria', nuevosFiltros.categoria)
      if (nuevosFiltros.estado) params.set('estado', nuevosFiltros.estado)

      const queryString = params.toString() ? `?${params.toString()}` : ''
      const datos = await api.get(`/materiales/buscar/${queryString}`)
      setMateriales(datos)
    } catch {
      setError('No se pudo cargar la lista de materiales. Por favor, inténtalo nuevamente.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <section className="catalogo-materiales">
      <header className="catalogo-materiales__cabecera">
        <h2>Catálogo de Materiales</h2>
        <p>Busca y consulta los materiales disponibles para préstamo y reserva.</p>
      </header>

      <BarraBusqueda
        cargando={cargando}
        valoresIniciales={filtros}
        onBuscar={buscarMateriales}
      />

      <ResultadosMateriales
        materiales={materiales}
        cargando={cargando}
        error={error}
        onSeleccionarMaterial={onSeleccionarMaterial}
      />
    </section>
  )
}

export default CatalogoMateriales
