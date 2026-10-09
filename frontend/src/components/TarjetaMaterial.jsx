import { Box, FileText } from 'lucide-react'

import { ETIQUETAS_TIER, ETIQUETAS_TIPO } from '../constantes/catalogo'
import Boton from './ui/Boton'
import Tarjeta from './ui/Tarjeta'
import BadgeEstado from './ui/BadgeEstado'

function TarjetaMaterial({ material, onSeleccionar }) {
  const tipoLegible = ETIQUETAS_TIPO[material.tipo] || material.tipo
  const tierLegible = ETIQUETAS_TIER[material.tier_minimo_requerido] || material.tier_minimo_requerido

  const unidades = material.unidades_disponibles ?? material.stock ?? 0
  const hayDisponibilidad = material.estado === 'disponible' && unidades > 0
  const especificacionesBreves = [material.marca, material.modelo].filter(Boolean).join(' • ')

  function manejarClick() {
    if (onSeleccionar) {
      onSeleccionar(material)
    }
  }

  function manejarKeyDown(evento) {
    if (evento.key === 'Enter' || evento.key === ' ') {
      evento.preventDefault()
      manejarClick()
    }
  }

  return (
    <Tarjeta
      className="flex flex-col overflow-hidden cursor-pointer transition-all hover:border-marca-400 hover:shadow-md dark:hover:border-marca-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento-600"
      data-id={material.id}
      tabIndex={0}
      role="button"
      onClick={manejarClick}
      onKeyDown={manejarKeyDown}
      aria-label={`Ver ficha técnica de ${material.nombre}`}
    >
      <div className="relative flex h-40 items-center justify-center bg-superficie-alta">
        {material.foto ? (
          <img
            src={material.foto}
            alt={material.nombre}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <Box aria-hidden="true" className="size-12 text-texto-suave" />
        )}
        {material.estado && (
          <span className="absolute right-2 top-2">
            <BadgeEstado estado={material.estado} />
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="font-semibold uppercase tracking-wide text-acento-700 dark:text-acento-300">
            {tipoLegible}
          </span>
          {material.codigo_inventario && (
            <span className="text-texto-suave">{material.codigo_inventario}</span>
          )}
        </div>

        <h4 className="mt-2 text-base font-semibold text-texto">{material.nombre}</h4>

        {especificacionesBreves && (
          <p className="mt-0.5 text-xs font-medium text-acento-700 dark:text-acento-300">
            {especificacionesBreves}
          </p>
        )}

        {material.descripcion && (
          <p className="mt-1 line-clamp-2 text-sm text-texto-suave">{material.descripcion}</p>
        )}

        <div className="mt-3 border-t border-borde pt-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-texto">Disponibilidad:</span>
            <span
              className={`font-semibold ${hayDisponibilidad ? 'text-marca-700 dark:text-marca-400' : 'text-error'}`}
            >
              {unidades} {unidades === 1 ? 'unidad' : 'unidades'}
            </span>
          </div>

          {tierLegible && (
            <p className="mt-1 text-xs text-texto-suave">Tier mínimo: {tierLegible}</p>
          )}
        </div>

        <div className="mt-4">
          <Boton
            variante="secundario"
            tipo="button"
            className="w-full"
            icono={FileText}
            onClick={(e) => {
              e.stopPropagation()
              manejarClick()
            }}
          >
            Ver ficha técnica
          </Boton>
        </div>
      </div>
    </Tarjeta>
  )
}

export default TarjetaMaterial