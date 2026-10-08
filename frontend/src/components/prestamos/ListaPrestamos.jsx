import { useState } from 'react'

import { ordenarPrestamos } from '../../prestamos/estadoPrestamo'
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
        <ul className="mt-4 grid gap-3">
          {visibles.map((prestamo) => (
            <li key={prestamo.id}>
              <button
                type="button"
                className="w-full rounded-xl border border-borde bg-white p-4 text-left transition-colors hover:border-acento-400 hover:bg-superficie-alta dark:bg-superficie"
                onClick={() => {
                  setSeleccionado(prestamo)
                  onSeleccionar?.(prestamo)
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-texto">{prestamo.material_nombre}</span>
                  <BadgeEstado estado={prestamo.estado_visible} />
                </div>
                <p className="mt-1 text-sm text-texto-suave">
                  Código: {prestamo.material_codigo}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}