import { useState } from 'react'

import { presentarEstadoPrestamo } from './estadoPrestamo'
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
    <ul className="prestamos-lista__items">
      {prestamos.map((prestamo) => {
        const estado = presentarEstadoPrestamo(prestamo.estado)
        return (
          <li className="prestamos-lista__item" key={prestamo.id}>
            <button
              className="prestamos-lista__seleccion"
              onClick={() => setSeleccionado(prestamo)}
              type="button"
            >
              <span className="prestamos-lista__prestatario">
                Prestatario: {prestamo.prestatario_nombre}
              </span>
              <span className="prestamos-lista__material">{prestamo.material_nombre}</span>
              <span className="prestamos-lista__codigo">
                Código: {prestamo.material_codigo}
              </span>
              <span className={`prestamo-estado ${estado.clase}`}>
                {estado.texto}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
