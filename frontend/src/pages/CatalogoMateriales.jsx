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
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <header className="mb-6">
        <h2 className="text-xl font-bold text-texto">Catálogo de Materiales</h2>
        <p className="mt-1 text-sm text-texto-suave">
          Busca y consulta los materiales disponibles para préstamo y reserva.
        </p>
      </header>

      <BarraBusqueda cargando={cargando} valoresIniciales={filtros} onBuscar={buscarMateriales} />

      <ResultadosMateriales
        materiales={materiales}
        cargando={cargando}
        error={error}
        onSeleccionarMaterial={onSeleccionarMaterial}
      />
    </div>
  )
}

export default CatalogoMateriales