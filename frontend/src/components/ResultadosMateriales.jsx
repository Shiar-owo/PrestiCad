import Skeleton from './ui/Skeleton'
import ErrorAlerta from './ui/ErrorAlerta'
import EstadoVacio from './ui/EstadoVacio'
import TarjetaMaterial from './TarjetaMaterial'

function ResultadosMateriales({
  materiales = [],
  cargando = false,
  error = '',
  onSeleccionarMaterial,
}) {
  if (cargando) {
    return (
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-live="polite">
        {Array.from({ length: 6 }).map((_, indice) => (
          <Skeleton key={indice} className="h-72 rounded-xl" />
        ))}
      </div>
    )
  }

  if (error) {
    return <ErrorAlerta mensaje={error} className="mt-6" />
  }

  if (materiales.length === 0) {
    return (
      <div className="mt-6">
        <EstadoVacio
          titulo="No se encontraron materiales"
          mensaje="Prueba ajustando los términos de búsqueda o los filtros de categoría y estado."
        />
      </div>
    )
  }

  return (
    <section className="mt-6" aria-label="Resultados de materiales">
      <p className="mb-4 text-sm text-texto-suave">
        Mostrando <strong className="text-texto">{materiales.length}</strong>{' '}
        {materiales.length === 1 ? 'material encontrado' : 'materiales encontrados'}
      </p>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {materiales.map((material) => (
          <TarjetaMaterial
            key={material.id}
            material={material}
            onSeleccionar={onSeleccionarMaterial}
          />
        ))}
      </div>
    </section>
  )
}

export default ResultadosMateriales