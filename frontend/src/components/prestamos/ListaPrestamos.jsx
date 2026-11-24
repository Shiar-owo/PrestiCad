import { useState } from 'react'

import { ordenarPrestamos, textoEstadoPrestamo } from '../../prestamos/estadoPrestamo'
import { filtrarPrestamos } from '../../prestamos/filtroPrestamos'
import BadgeEstado from '../ui/BadgeEstado'
import EstadoVacio from '../ui/EstadoVacio'
import DetallePrestamo from './DetallePrestamo'
import FiltroPrestamos from './FiltroPrestamos'
import { esDevoluble } from '../../constantes/devolucion'

export default function ListaPrestamos({ prestamos, onSeleccionar, onDevolucion }) {
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
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibles.map((prestamo) => {
            const materialNombre = prestamo.material_snapshot?.nombre || prestamo.material_nombre
            const materialCodigo = prestamo.material_snapshot?.codigo_material || prestamo.material_codigo
            const codigoEjemplar = prestamo.instancia_snapshot?.codigo_ejemplar || prestamo.codigo_ejemplar

            return (
              <article
                key={prestamo.id}
                className="rounded-xl border border-borde bg-white dark:bg-superficie p-5 hover:shadow-md hover:border-acento-200 transition-all cursor-pointer group"
                onClick={() => {
                  setSeleccionado(prestamo)
                  onSeleccionar?.(prestamo)
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-bold text-texto text-sm leading-tight group-hover:text-acento-700 dark:group-hover:text-acento-300">
                      {materialNombre}
                    </h4>
                    <p className="text-xs text-texto-suave font-mono mt-0.5">
                      {materialCodigo}
                    </p>
                  </div>
                  <BadgeEstado
                    estado={prestamo.estado_visible}
                    texto={textoEstadoPrestamo(prestamo, prestamo.estado_visible)}
                    className="text-[10px]"
                  />
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-texto-suave">Código Material</span>
                    <span className="font-medium text-texto-suave font-mono">
                      {materialCodigo}
                    </span>
                  </div>
                  {codigoEjemplar && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-texto-suave">Código Ejemplar</span>
                      <span className="font-medium text-texto-suave font-mono">
                        {codigoEjemplar}
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
                  onClick={() => {
                    setSeleccionado(prestamo)
                    onSeleccionar?.(prestamo)
                  }}
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
          )})}
        </div>
      )}
    </section>
  )
}
