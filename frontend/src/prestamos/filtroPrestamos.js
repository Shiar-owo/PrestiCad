import { obtenerEstadoVisible } from './estadoPrestamo'

export function filtrarPrestamos(prestamos, estado, ahora = new Date()) {
  if (!estado || estado === 'todos') return [...prestamos]

  return prestamos.filter((prestamo) => {
    const estadoVisible = prestamo.estado_visible ?? obtenerEstadoVisible(prestamo, ahora)
    return estadoVisible === estado
  })
}
