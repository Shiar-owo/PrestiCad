import BadgeEstado from '../components/ui/BadgeEstado'
import DetallePrestamo from '../components/prestamos/DetallePrestamo'
import { esDevoluble } from '../constantes/devolucion'
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
    <ul className="mt-4 grid gap-3">
      {prestamos.map((prestamo) => (
        <li key={prestamo.id}>
          <button
            type="button"
            className="w-full rounded-xl border border-borde bg-white p-4 text-left transition-colors hover:border-acento-400 hover:bg-superficie-alta dark:bg-superficie"
            onClick={() => onSeleccionar(prestamo)}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold text-texto">{prestamo.material_nombre}</span>
              <BadgeEstado estado={prestamo.estado} />
            </div>
            <p className="mt-1 text-sm text-texto-suave">
              Prestatario: {prestamo.prestatario_nombre} · Código: {prestamo.material_codigo}
            </p>
          </button>
        </li>
      ))}
    </ul>
  )
}
