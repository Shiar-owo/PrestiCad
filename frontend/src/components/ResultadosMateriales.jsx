import TarjetaMaterial from './TarjetaMaterial'

function ResultadosMateriales({
  materiales = [],
  cargando = false,
  error = '',
  onSeleccionarMaterial,
}) {
  if (cargando) {
    return (
      <div className="material-resultados__estado" role="status">
        <p>Buscando materiales…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="material-resultados__estado error-general" role="alert">
        <p>{error}</p>
      </div>
    )
  }

  if (materiales.length === 0) {
    return (
      <div className="material-resultados__vacio" role="status">
        <p>No se encontraron materiales que coincidan con la búsqueda.</p>
        <small>Prueba ajustando los términos de búsqueda o los filtros de categoría y estado.</small>
      </div>
    )
  }

  return (
    <section className="material-resultados" aria-label="Resultados de materiales">
      <div className="material-resultados__conteo">
        <p>
          Mostrando <strong>{materiales.length}</strong>{' '}
          {materiales.length === 1 ? 'material encontrado' : 'materiales encontrados'}
        </p>
      </div>

      <div className="material-tarjetas-grid">
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
