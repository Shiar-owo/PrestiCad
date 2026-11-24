export const TAMANO_MAXIMO_SOLICITUD_BYTES = 4 * 1024 * 1024

export function calcularTamanoArchivos(formulario) {
  let total = 0
  formulario.forEach((valor) => {
    if (typeof Blob !== 'undefined' && valor instanceof Blob) {
      total += valor.size
    }
  })
  return total
}

export function validarTamanoSolicitud(formulario) {
  if (calcularTamanoArchivos(formulario) > TAMANO_MAXIMO_SOLICITUD_BYTES) {
    return 'El total de archivos no debe superar 4 MB. Reduce el tamaño o la cantidad de archivos.'
  }
  return ''
}
