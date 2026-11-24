export const TAMANO_PAGINA_REPORTES = 25

export function construirRutaReportes({
  dano = 'todos',
  fechaDesde = '',
  fechaHasta = '',
  pagina = 1,
} = {}) {
  const parametros = new URLSearchParams({
    page: String(pagina),
    page_size: String(TAMANO_PAGINA_REPORTES),
  })

  if (dano && dano !== 'todos') parametros.set('dano', dano)
  if (fechaDesde) parametros.set('fecha_desde', fechaDesde)
  if (fechaHasta) parametros.set('fecha_hasta', fechaHasta)

  return `/prestamos/devoluciones/reportes/?${parametros.toString()}`
}

export function validarRespuestaReportes(datos) {
  const esListaValida = datos && Array.isArray(datos.results)
  const esConteoValido = Number.isInteger(datos?.count) && datos.count >= 0
  const esEnlaceValido = (enlace) => enlace === null || typeof enlace === 'string'

  if (
    !esListaValida
    || !esConteoValido
    || !esEnlaceValido(datos.next)
    || !esEnlaceValido(datos.previous)
  ) {
    throw new Error('La respuesta del listado de reportes no tiene el formato esperado.')
  }

  return datos
}
