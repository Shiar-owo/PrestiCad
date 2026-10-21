import {
  TAMANO_MAXIMO_GARANTIA_BYTES,
  TAMANO_MAXIMO_GARANTIA_MB,
} from './constantes/garantia'
import {
  DURACION_MAXIMA_PRESTAMO_DIAS,
  EXTENSIONES_FOTO_CHECKLIST,
  TAMANO_MAXIMO_FOTO_CHECKLIST_MB,
  TAMANO_MAXIMO_FOTO_CHECKLIST_BYTES,
  TIPOS_FOTO_CHECKLIST,
} from './constantes/checklistPrestamo'

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
  const erroresFotos = {}
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
  if (!Number.isInteger(Number(dias)) || Number(dias) < 1 || Number(dias) > DURACION_MAXIMA_PRESTAMO_DIAS) {
    errores.dias = `La duración debe ser de 1 a ${DURACION_MAXIMA_PRESTAMO_DIAS} días.`
  }
  if (!Array.isArray(checklist) || checklist.length === 0) {
    errores.checklist = 'Registra al menos un elemento del material.'
  } else {
    if (checklist.some((item) => !String(item.elemento ?? '').trim())) {
      errores.checklist = 'Completa el elemento en cada fila del checklist.'
    }
    checklist.forEach((item, indice) => {
      const errorFoto = validarFoto(item.foto)
      if (errorFoto) erroresFotos[indice] = errorFoto || 'Adjunta una foto para este elemento.'
    })
    if (Object.keys(erroresFotos).length > 0) errores.fotosChecklist = erroresFotos
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

export function validarFoto(archivo) {
  if (!archivo) return 'Adjunta una foto para este elemento.'
  const nombre = String(archivo.name || '').toLowerCase()
  const extensionValida = EXTENSIONES_FOTO_CHECKLIST.some((extension) => nombre.endsWith(extension))
  if (!extensionValida) return 'La foto debe tener extensión JPG, PNG o WEBP.'
  if (!TIPOS_FOTO_CHECKLIST.includes(archivo.type)) {
    return 'La foto debe ser de tipo JPG, PNG o WEBP.'
  }
  if (archivo.size > TAMANO_MAXIMO_FOTO_CHECKLIST_BYTES) {
    return `La foto no debe superar ${TAMANO_MAXIMO_FOTO_CHECKLIST_MB} MB.`
  }
  return ''
}

export function obtenerElementosSinFoto(checklist) {
  if (!Array.isArray(checklist)) return []
  return checklist
    .map((item, indice) => ({ indice, elemento: String(item?.elemento ?? '').trim() || `Elemento ${indice + 1}` }))
    .filter(({ indice }) => !checklist[indice]?.foto)
}

export function mapearErroresFotoChecklist(erroresBackend) {
  if (!erroresBackend || typeof erroresBackend !== 'object' || Array.isArray(erroresBackend)) return {}
  return Object.fromEntries(
    Object.entries(erroresBackend).map(([indice, mensajes]) => [
      indice,
      Array.isArray(mensajes) ? mensajes.join(' ') : String(mensajes),
    ]),
  )
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
  if (
    !Number.isInteger(cantidad)
    || cantidad < 1
    || cantidad > DURACION_MAXIMA_PRESTAMO_DIAS
  ) return null
  const fecha = new Date()
  fecha.setDate(fecha.getDate() + cantidad)
  return fecha
}
