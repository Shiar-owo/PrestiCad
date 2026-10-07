export const TAMANO_PAGINA_HISTORIAL = 25

export function construirRutaHistorial({ estado = 'todos', pagina = 1 } = {}) {
  const parametros = new URLSearchParams({
    page: String(pagina),
    page_size: String(TAMANO_PAGINA_HISTORIAL),
  })

  if (estado && estado !== 'todos') parametros.set('estado', estado)

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
