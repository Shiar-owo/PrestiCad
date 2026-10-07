import { useState } from 'react'

import '../../prestamos/prestamos.css'
import { ordenarPrestamos, presentarEstadoPrestamo } from '../../prestamos/estadoPrestamo'
import { filtrarPrestamos } from '../../prestamos/filtroPrestamos'
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
    <section className="prestamos-lista" aria-label="Mis préstamos">
      <h3>Mis préstamos</h3>
      <FiltroPrestamos estado={filtro} onCambiar={setFiltro} />
      {visibles.length === 0 ? (
        <p className="prestamos-lista__vacio">
          {ordenados.length === 0
            ? 'Aún no tienes préstamos registrados.'
            : 'No hay préstamos con este estado.'}
        </p>
      ) : (
        <ul className="prestamos-lista__items">
          {visibles.map((prestamo) => {
            const estado = presentarEstadoPrestamo(prestamo.estado_visible)
            return (
              <li className="prestamos-lista__item" key={prestamo.id}>
                <button
                  className="prestamos-lista__seleccion"
                  onClick={() => {
                    setSeleccionado(prestamo)
                    onSeleccionar?.(prestamo)
                  }}
                  type="button"
                >
                  <span className="prestamos-lista__material">
                    {prestamo.material_nombre}
                  </span>
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
      )}
    </section>
  )
}
