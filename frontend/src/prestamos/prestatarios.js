export const MINIMO_DIGITOS_BUSQUEDA_PRESTATARIO = 3

export function normalizarDniPrestatario(valor) {
  return String(valor || '').replace(/\D/g, '').slice(0, 8)
}

export function debeBuscarPrestatarios(valor, seleccionado = null) {
  const dni = String(valor || '').trim()
  return dni.length >= MINIMO_DIGITOS_BUSQUEDA_PRESTATARIO && seleccionado?.dni !== dni
}

export function construirRutaBusquedaPrestatarios(dni) {
  const parametros = new URLSearchParams({ dni: String(dni || '').trim() })
  return `/prestamos/prestatarios/?${parametros.toString()}`
}

export function crearSeleccionPrestatario(prestatario) {
  if (!prestatario?.dni || !prestatario?.nombre_completo) return null
  return {
    dni: String(prestatario.dni),
    nombre_completo: String(prestatario.nombre_completo).trim(),
  }
}

export function crearEtiquetaPrestatario(prestatario) {
  const seleccion = crearSeleccionPrestatario(prestatario)
  if (!seleccion) return ''
  return `${seleccion.dni} - ${seleccion.nombre_completo}`
}
