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
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-full divide-y divide-borde bg-white dark:bg-superficie">
        <thead className="bg-superficie/50">
          <tr>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-texto-suave uppercase tracking-wider">
              Material
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-texto-suave uppercase tracking-wider">
              Código Material
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-texto-suave uppercase tracking-wider">
              Código Ejemplar
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-texto-suave uppercase tracking-wider">
              Prestatario
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-texto-suave uppercase tracking-wider">
              Estado
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-texto-suave uppercase tracking-wider">
              Fecha Entrega
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-texto-suave uppercase tracking-wider">
              Fecha Límite
            </th>
            <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-texto-suave uppercase tracking-wider">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-borde">
          {prestamos.map((prestamo) => (
            <tr key={prestamo.id} className="hover:bg-superficie-alta/50 transition-colors">
              <td className="px-4 py-3 text-sm font-medium text-texto">
                {prestamo.material_nombre}
              </td>
              <td className="px-4 py-3 text-sm text-texto-suave font-mono">
                {prestamo.material_codigo}
              </td>
              <td className="px-4 py-3 text-sm text-texto-suave font-mono">
                {prestamo.codigo_ejemplar || '—'}
              </td>
              <td className="px-4 py-3 text-sm text-texto">
                {prestamo.prestatario_nombre}
              </td>
              <td className="px-4 py-3">
                <BadgeEstado
                  estado={prestamo.estado}
                  texto={textoEstadoPrestamo(prestamo)}
                  className="text-xs"
                />
              </td>
              <td className="px-4 py-3 text-sm text-texto-suave">
                {prestamo.fecha_entrega
                  ? new Intl.DateTimeFormat('es-PE', { dateStyle: 'short' }).format(new Date(prestamo.fecha_entrega))
                  : '—'}
              </td>
              <td className="px-4 py-3 text-sm text-texto-suave">
                {prestamo.fecha_limite
                  ? new Intl.DateTimeFormat('es-PE', { dateStyle: 'short' }).format(new Date(prestamo.fecha_limite))
                  : '—'}
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  type="button"
                  onClick={() => onSeleccionar(prestamo)}
                  className="text-sm font-medium text-acento-700 hover:text-acento-900 dark:text-acento-300 dark:hover:text-acento-100 underline underline-offset-4"
                >
                  Ver detalle
                </button>
                {esDevoluble(prestamo.estado) && onDevolucion && (
                  <button
                    type="button"
                    onClick={() => onDevolucion(prestamo.id)}
                    className="ml-2 text-sm font-medium text-marca-700 hover:text-marca-900 dark:text-marca-300 dark:hover:text-marca-100 underline underline-offset-4"
                  >
                    Devolver
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
