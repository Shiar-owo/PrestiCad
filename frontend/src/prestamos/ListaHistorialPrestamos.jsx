import { useState } from 'react'

import BadgeEstado from '../components/ui/BadgeEstado'
import DetallePrestamo from '../components/prestamos/DetallePrestamo'
import { esDevoluble } from '../constantes/devolucion'

export default function ListaHistorialPrestamos({ prestamos, onDevolucion = null }) {
  const [seleccionado, setSeleccionado] = useState(null)

  if (seleccionado) {
    const puedeDevolver =
      Boolean(onDevolucion) && esDevoluble(seleccionado.estado)

    return (
      <DetallePrestamo
        etiquetaVolver="Volver al historial"
        onVolver={() => setSeleccionado(null)}
        prestamo={seleccionado}
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
            onClick={() => setSeleccionado(prestamo)}
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