import { Box } from 'lucide-react'

import { ETIQUETAS_TIER, ETIQUETAS_TIPO } from '../constantes/catalogo'
import Boton from './ui/Boton'
import Tarjeta from './ui/Tarjeta'
import BadgeEstado from './ui/BadgeEstado'

function TarjetaMaterial({ material, onSeleccionar }) {
  const tipoLegible = ETIQUETAS_TIPO[material.tipo] || material.tipo
  const tierLegible = ETIQUETAS_TIER[material.tier_minimo_requerido] || material.tier_minimo_requerido

  const unidades = material.unidades_disponibles ?? material.stock ?? 0
  const hayDisponibilidad = material.estado === 'disponible' && unidades > 0

  return (
    <Tarjeta className="flex flex-col overflow-hidden" data-id={material.id}>
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

        {onSeleccionar && (
          <div className="mt-3">
            <Boton
              variante="secundario"
              tipo="button"
              className="w-full"
              onClick={() => onSeleccionar(material)}
            >
              Ver detalle
            </Boton>
          </div>
        )}
      </div>
    </Tarjeta>
  )
}

export default TarjetaMaterial