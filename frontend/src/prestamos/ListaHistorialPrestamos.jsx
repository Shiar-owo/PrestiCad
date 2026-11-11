import BadgeEstado from '../components/ui/BadgeEstado'
import DetallePrestamo from '../components/prestamos/DetallePrestamo'
import { esDevoluble } from '../constantes/devolucion'
import { textoEstadoPrestamo } from './estadoPrestamo'
import { obtenerPrestamoAdyacente } from './historialPrestamos'

export default function ListaHistorialPrestamos({
  prestamos,
  seleccionado = null,
  onSeleccionar = () => {},
  onAnteriorPagina = null,
  onSiguientePagina = null,
  hayPaginaAnterior = false,
  hayPaginaSiguiente = false,
  onDevolucion = null,
  puedeEditarGarantia = false,
}) {
  if (seleccionado) {
    const puedeDevolver =
      Boolean(onDevolucion) && esDevoluble(seleccionado.estado)
    const anterior = obtenerPrestamoAdyacente(prestamos, seleccionado.id, 'anterior')
    const siguiente = obtenerPrestamoAdyacente(prestamos, seleccionado.id, 'siguiente')

    return (
      <DetallePrestamo
        etiquetaVolver="Volver al historial"
        onVolver={() => onSeleccionar(null)}
        prestamo={seleccionado}
        puedeEditarGarantia={puedeEditarGarantia}
        onAnterior={anterior ? () => onSeleccionar(anterior) : onAnteriorPagina}
        onSiguiente={siguiente ? () => onSeleccionar(siguiente) : onSiguientePagina}
        hayAnterior={Boolean(anterior) || hayPaginaAnterior}
        haySiguiente={Boolean(siguiente) || hayPaginaSiguiente}
        onDevolucion={
          puedeDevolver ? () => onDevolucion(seleccionado.id) : undefined
        }
      />
    )
  }

  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {prestamos.map((prestamo) => (
        <article
          key={prestamo.id}
          className="rounded-xl border border-borde bg-white dark:bg-superficie p-5 hover:shadow-md hover:border-acento-200 transition-all cursor-pointer group"
          onClick={() => onSeleccionar(prestamo)}
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <h4 className="font-bold text-texto text-sm leading-tight group-hover:text-acento-700 dark:group-hover:text-acento-300">
                {prestamo.material_nombre}
              </h4>
              <p className="text-xs text-texto-suave font-mono mt-0.5">
                {prestamo.material_codigo}
              </p>
            </div>
            <BadgeEstado
              estado={prestamo.estado}
              texto={textoEstadoPrestamo(prestamo)}
              className="text-[10px]"
            />
          </div>

          <div className="space-y-2 mb-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-texto-suave">Prestatario</span>
              <span className="font-medium text-texto">{prestamo.prestatario_nombre}</span>
            </div>
            {prestamo.codigo_ejemplar && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-texto-suave">Código Ejemplar</span>
                <span className="font-medium text-texto-suave font-mono">
                  {prestamo.codigo_ejemplar}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between text-xs">
              <span className="text-texto-suave">Fecha entrega</span>
              <span className="font-medium text-texto-suave">
                {prestamo.fecha_entrega
                  ? new Intl.DateTimeFormat('es-PE', { dateStyle: 'short' }).format(new Date(prestamo.fecha_entrega))
                  : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-texto-suave">Fecha límite</span>
              <span className="font-medium text-texto-suave">
                {prestamo.fecha_limite
                  ? new Intl.DateTimeFormat('es-PE', { dateStyle: 'short' }).format(new Date(prestamo.fecha_limite))
                  : '—'}
              </span>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-borde flex items-center justify-between gap-2">
            <button
              type="button"
              className="flex-1 text-sm font-medium text-acento-700 hover:text-acento-900 dark:text-acento-300 dark:hover:text-acento-100 underline underline-offset-4 px-3 py-2 rounded-lg hover:bg-acento-50 dark:hover:bg-acento-900/20 transition-colors"
              onClick={() => onSeleccionar(prestamo)}
            >
              Ver detalle
            </button>
            {esDevoluble(prestamo.estado) && onDevolucion && (
              <button
                type="button"
                className="flex-1 text-sm font-medium text-marca-700 hover:text-marca-900 dark:text-marca-300 dark:hover:text-marca-100 px-3 py-2 rounded-lg hover:bg-marca-50 dark:hover:bg-marca-900/20 transition-colors border border-marca-200 dark:border-marca-800"
                onClick={() => onDevolucion(prestamo.id)}
              >
                Devolver
              </button>
            )}
          </div>
        </article>
      ))}
    </div>
  )
}
