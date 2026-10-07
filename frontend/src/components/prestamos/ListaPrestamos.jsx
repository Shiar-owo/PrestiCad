import '../../prestamos/prestamos.css'
import { ordenarPrestamos, presentarEstadoPrestamo } from '../../prestamos/estadoPrestamo'

export default function ListaPrestamos({ prestamos, onSeleccionar }) {
  const ordenados = ordenarPrestamos(prestamos)

  return (
    <section className="prestamos-lista" aria-label="Mis préstamos">
      <h3>Mis préstamos</h3>
      {ordenados.length === 0 ? (
        <p className="prestamos-lista__vacio">Aún no tienes préstamos registrados.</p>
      ) : (
        <ul className="prestamos-lista__items">
          {ordenados.map((prestamo) => {
            const estado = presentarEstadoPrestamo(prestamo.estado_visible)
            return (
              <li className="prestamos-lista__item" key={prestamo.id}>
                <button
                  className="prestamos-lista__seleccion"
                  onClick={() => onSeleccionar?.(prestamo)}
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
