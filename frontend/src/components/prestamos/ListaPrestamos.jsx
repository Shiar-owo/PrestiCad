import { useState } from 'react'

import { ordenarPrestamos, textoEstadoPrestamo } from '../../prestamos/estadoPrestamo'
import { filtrarPrestamos } from '../../prestamos/filtroPrestamos'
import BadgeEstado from '../ui/BadgeEstado'
import EstadoVacio from '../ui/EstadoVacio'
import DetallePrestamo from './DetallePrestamo'
import FiltroPrestamos from './FiltroPrestamos'

export default function ListaPrestamos({ prestamos, onSeleccionar }) {
  const [filtro, setFiltro] = useState('todos')
  const [seleccionado, setSeleccionado] = useState(null)
  const ordenados = ordenarPrestamos(prestamos)
  const visibles = filtrarPrestamos(ordenados, filtro)

  if (seleccionado) {
    return (
      <DetallePrestamo
        onVolver={() => setSeleccionado(null)}
        prestamo={seleccionado}
      />
    )
  }

  return (
    <section aria-label="Mis préstamos">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h3 className="text-lg font-bold text-texto">Mis préstamos</h3>
        <FiltroPrestamos estado={filtro} onCambiar={setFiltro} />
      </div>

      {visibles.length === 0 ? (
        <div className="mt-4">
          <EstadoVacio
            titulo={ordenados.length === 0 ? 'Aún no tienes préstamos' : 'Sin préstamos con este estado'}
            mensaje={
              ordenados.length === 0
                ? 'Tus préstamos aparecerán aquí cuando el gestor registre una entrega.'
                : 'Prueba con otro filtro de estado.'
            }
          />
        </div>
      ) : (
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
              {visibles.map((prestamo) => (
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
                  <td className="px-4 py-3">
                    <BadgeEstado
                      estado={prestamo.estado_visible}
                      texto={textoEstadoPrestamo(prestamo, prestamo.estado_visible)}
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
                      onClick={() => {
                        setSeleccionado(prestamo)
                        onSeleccionar?.(prestamo)
                      }}
                      className="text-sm font-medium text-acento-700 hover:text-acento-900 dark:text-acento-300 dark:hover:text-acento-100 underline underline-offset-4"
                    >
                      Ver detalle
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
