import {
  TAMANO_MAXIMO_GARANTIA_BYTES,
  TAMANO_MAXIMO_GARANTIA_MB,
} from './constantes/garantia'

export function validarFormularioPrestamo({
  dni,
  material,
  instanciaId,
  dias,
  checklist,
  documentoIdentidad,
  compromisoResponsabilidad,
}) {
  const errores = {}
  const dniLimpio = String(dni ?? '').trim()

  if (!/^\d{8}$/.test(dniLimpio)) {
    errores.dni = 'El DNI debe tener exactamente 8 dígitos.'
  }
  if (!material) {
    errores.material = 'Selecciona un material disponible.'
  }
  if (!instanciaId) {
    errores.instancia_id = 'Selecciona una instancia disponible.'
  }
  if (!Number.isInteger(Number(dias)) || Number(dias) < 1) {
    errores.dias = 'El tiempo de préstamo debe ser al menos un día.'
  }
  if (!Array.isArray(checklist) || checklist.length === 0) {
    errores.checklist = 'Registra al menos una condición del material.'
  } else if (checklist.some((item) => !item.elemento.trim() || !item.condicion.trim())) {
    errores.checklist = 'Completa el elemento y su condición en cada fila.'
  }
  if (material?.es_alto_valor) {
    const errorDocumentoIdentidad = validarArchivoGarantia(
      documentoIdentidad,
      'Adjunta el documento de identidad en PDF.',
    )
    const errorCompromiso = validarArchivoGarantia(
      compromisoResponsabilidad,
      'Adjunta el compromiso de responsabilidad en PDF.',
    )
    if (errorDocumentoIdentidad) errores.documento_identidad = errorDocumentoIdentidad
    if (errorCompromiso) errores.compromiso_responsabilidad = errorCompromiso
  }

  return errores
}

function validarArchivoGarantia(archivo, mensajeRequerido) {
  if (!archivo) return mensajeRequerido
  if (!String(archivo.name || '').toLowerCase().endsWith('.pdf')) {
    return 'El archivo debe tener extensión .pdf.'
  }
  if (archivo.type !== 'application/pdf') {
    return 'El archivo debe ser de tipo PDF (application/pdf).'
  }
  if (archivo.size > TAMANO_MAXIMO_GARANTIA_BYTES) {
    return `El archivo no debe superar ${TAMANO_MAXIMO_GARANTIA_MB} MB.`
  }
  return ''
}

export function calcularFechaLimiteEstimada(dias) {
  const cantidad = Number(dias)
  if (!Number.isInteger(cantidad) || cantidad < 1) return null
  const fecha = new Date()
  fecha.setDate(fecha.getDate() + cantidad)
  return fecha
}
