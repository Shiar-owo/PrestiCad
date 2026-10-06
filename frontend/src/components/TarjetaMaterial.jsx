export const ETIQUETAS_TIPO = {
  equipo: 'Equipo',
  libro: 'Libro',
  objeto: 'Objeto',
}

export const ETIQUETAS_ESTADO = {
  disponible: 'Disponible',
  en_mantenimiento: 'En Mantenimiento',
  reservado: 'Reservado',
  prestado: 'Prestado',
}

export const ETIQUETAS_TIER = {
  avanzado: 'Avanzado',
  estandar: 'Estándar',
  restringido: 'Restringido',
}

function TarjetaMaterial({ material, onSeleccionar }) {
  const tipoLegible = ETIQUETAS_TIPO[material.tipo] || material.tipo
  const estadoLegible = ETIQUETAS_ESTADO[material.estado] || material.estado
  const tierLegible = ETIQUETAS_TIER[material.tier_minimo_requerido] || material.tier_minimo_requerido

  const unidades = material.unidades_disponibles ?? material.stock ?? 0
  const hayDisponibilidad = material.estado === 'disponible' && unidades > 0

  return (
    <article className="material-tarjeta" data-id={material.id}>
      <div className="material-tarjeta__foto-contenedor">
        {material.foto ? (
          <img
            src={material.foto}
            alt={material.nombre}
            className="material-tarjeta__foto"
            loading="lazy"
          />
        ) : (
          <div className="material-tarjeta__foto-placeholder" aria-hidden="true">
            📦
          </div>
        )}
        <span className={`material-tarjeta__badge-estado badge-estado--${material.estado}`}>
          {estadoLegible}
        </span>
      </div>

      <div className="material-tarjeta__cuerpo">
        <div className="material-tarjeta__metadatos">
          <span className="material-tarjeta__categoria">{tipoLegible}</span>
          {material.codigo_inventario && (
            <span className="material-tarjeta__codigo">{material.codigo_inventario}</span>
          )}
        </div>

        <h4 className="material-tarjeta__titulo">{material.nombre}</h4>

        {material.descripcion && (
          <p className="material-tarjeta__descripcion">{material.descripcion}</p>
        )}

        <div className="material-tarjeta__ficha">
          <div className="material-tarjeta__disponibilidad">
            <strong>Disponibilidad:</strong>{' '}
            <span className={hayDisponibilidad ? 'texto-exito' : 'texto-alerta'}>
              {unidades} {unidades === 1 ? 'unidad' : 'unidades'}
            </span>
          </div>

          {tierLegible && (
            <div className="material-tarjeta__tier">
              <small>Tier mínimo: {tierLegible}</small>
            </div>
          )}
        </div>

        {onSeleccionar && (
          <div className="material-tarjeta__acciones">
            <button
              type="button"
              className="boton-secundario"
              onClick={() => onSeleccionar(material)}
            >
              Ver detalle
            </button>
          </div>
        )}
      </div>
    </article>
  )
}

export default TarjetaMaterial
