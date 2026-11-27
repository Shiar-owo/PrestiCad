import { useState } from 'react'

import { ordenarPrestamos, textoEstadoPrestamo } from '../../prestamos/estadoPrestamo'
import { filtrarPrestamos } from '../../prestamos/filtroPrestamos'
import BadgeEstado from '../ui/BadgeEstado'
import Boton from '../ui/Boton'
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
    <section aria-label="Mis Préstamos">
      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-borde bg-superficie p-4 shadow-sm sm:flex-row sm:items-end sm:justify-between sm:p-5">
        <div>
          <h3 className="text-lg font-bold text-texto">Tus registros</h3>
          <p className="mt-0.5 text-xs text-texto-suave">{visibles.length} de {ordenados.length} préstamos</p>
        </div>
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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibles.map((prestamo) => {
            const materialNombre = prestamo.material_snapshot?.nombre || prestamo.material_nombre
            const materialCodigo = prestamo.material_snapshot?.codigo_material || prestamo.material_codigo
            const codigoEjemplar = prestamo.instancia_snapshot?.codigo_ejemplar || prestamo.codigo_ejemplar

            return (
              <article
                key={prestamo.id}
                className="group flex min-h-64 flex-col rounded-2xl border border-borde bg-superficie p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-acento-400 hover:shadow-md"
                onClick={() => {
                  setSeleccionado(prestamo)
                  onSeleccionar?.(prestamo)
                }}
              >
                <div className="mb-4 flex items-start justify-between gap-3 border-b border-borde pb-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-texto-suave">Préstamo #{prestamo.id}</p>
                    <h4 className="mt-1 break-words text-base font-bold leading-tight text-texto group-hover:text-acento-700 dark:group-hover:text-acento-300">
                      {materialNombre}
                    </h4>
                    <p className="mt-1 break-all font-mono text-xs text-texto-suave">
                      {materialCodigo}
                    </p>
                  </div>
                  <BadgeEstado
                    estado={prestamo.estado_visible}
                    texto={textoEstadoPrestamo(prestamo, prestamo.estado_visible)}
                  />
                </div>

                <dl className="grid flex-1 content-start gap-2 sm:grid-cols-2">
                  <div className="rounded-xl bg-superficie-alta/50 p-3">
                    <dt className="text-xs font-semibold text-texto-suave">Código de Material</dt>
                    <dd className="mt-1 break-all font-mono text-sm font-semibold text-texto">{materialCodigo}</dd>
                  </div>
                  {codigoEjemplar && (
                    <div className="rounded-xl bg-superficie-alta/50 p-3">
                      <dt className="text-xs font-semibold text-texto-suave">Código de ejemplar</dt>
                      <dd className="mt-1 break-all font-mono text-sm font-semibold text-texto">{codigoEjemplar}</dd>
                    </div>
                  )}
                  <div className="rounded-xl bg-superficie-alta/50 p-3">
                    <dt className="text-xs font-semibold text-texto-suave">Fecha de entrega</dt>
                    <dd className="mt-1 text-sm text-texto">
                      {prestamo.fecha_entrega
                        ? new Intl.DateTimeFormat('es-PE', { dateStyle: 'short' }).format(new Date(prestamo.fecha_entrega))
                        : '—'}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-acento-50 p-3 dark:bg-acento-500/10">
                    <dt className="text-xs font-semibold text-acento-800 dark:text-acento-300">Fecha límite</dt>
                    <dd className="mt-1 text-sm font-semibold text-acento-900 dark:text-acento-200">
                      {prestamo.fecha_limite
                        ? new Intl.DateTimeFormat('es-PE', { dateStyle: 'short' }).format(new Date(prestamo.fecha_limite))
                        : '—'}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4 flex items-center justify-between gap-2 border-t border-borde pt-4">
                  <Boton
                    tipo="button"
                    variante="accion"
                    tamanio="pequeno"
                    className="flex-1"
                    onClick={(evento) => {
                      evento.stopPropagation()
                      setSeleccionado(prestamo)
                      onSeleccionar?.(prestamo)
                    }}
                  >
                    Ver detalle
                  </Boton>
                  {esDevoluble(prestamo.estado) && onDevolucion && (
                    <Boton
                      tipo="button"
                      variante="primario"
                      tamanio="pequeno"
                      className="flex-1"
                      onClick={(evento) => {
                        evento.stopPropagation()
                        onDevolucion(prestamo.id)
                      }}
                    >
                      Devolver
                    </Boton>
                  )}
                </div>
            </article>
          )})}
        </div>
      )}
    </section>
  )
}
