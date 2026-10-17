export const TAMANO_PAGINA_HISTORIAL = 25

export function obtenerPrestamoAdyacente(prestamos, prestamoId, direccion) {
  if (!Array.isArray(prestamos) || !['anterior', 'siguiente'].includes(direccion)) return null
  const indice = prestamos.findIndex((prestamo) => prestamo.id === prestamoId)
  if (indice < 0) return null

  const indiceAdyacente = indice + (direccion === 'anterior' ? -1 : 1)
  return prestamos[indiceAdyacente] || null
}

export function construirRutaHistorial({ estado = 'todos', pagina = 1, dni = '' } = {}) {
  const parametros = new URLSearchParams({
    page: String(pagina),
    page_size: String(TAMANO_PAGINA_HISTORIAL),
  })

  if (estado && estado !== 'todos') parametros.set('estado', estado)
  if (dni) parametros.set('dni', dni)

  return `/prestamos/historial/?${parametros.toString()}`
}

export function validarRespuestaHistorial(datos) {
  const esListaValida = datos && Array.isArray(datos.results)
  const esConteoValido = Number.isInteger(datos?.count) && datos.count >= 0
  const esEnlaceValido = (enlace) => enlace === null || typeof enlace === 'string'

  if (
    !esListaValida
    || !esConteoValido
    || !esEnlaceValido(datos.next)
    || !esEnlaceValido(datos.previous)
  ) {
    throw new Error('La respuesta del historial de préstamos no tiene el formato esperado.')
  }

  return datos
}
