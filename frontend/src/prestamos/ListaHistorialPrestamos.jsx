import { useState } from 'react'

import BadgeEstado from '../components/ui/BadgeEstado'
import DetallePrestamo from '../components/prestamos/DetallePrestamo'

export default function ListaHistorialPrestamos({ prestamos }) {
  const [seleccionado, setSeleccionado] = useState(null)

  if (seleccionado) {
    return (
      <DetallePrestamo
        etiquetaVolver="Volver al historial"
        onVolver={() => setSeleccionado(null)}
        prestamo={seleccionado}
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