import {
  TAMANO_MAXIMO_GARANTIA_BYTES,
  TAMANO_MAXIMO_GARANTIA_MB,
} from './constantes/garantia'
import {
  DURACION_MAXIMA_PRESTAMO_MINUTOS,
  DURACION_MINIMA_PRESTAMO_MINUTOS,
  EXTENSIONES_FOTO_CHECKLIST,
  TAMANO_MAXIMO_FOTO_CHECKLIST_MB,
  TAMANO_MAXIMO_FOTO_CHECKLIST_BYTES,
  TIEMPO_MAXIMO_DEFAULT_POR_TIER,
  TIPOS_FOTO_CHECKLIST,
  convertirTiempoAMinutos,
  formatearDuracionMinutos,
} from './constantes/checklistPrestamo'
import { esMaterialAltoValor } from './constantes/catalogo'

export function obtenerMinutosMaximosMaterial(material) {
  if (material?.tiempo_maximo_prestamo) {
    return Number(material.tiempo_maximo_prestamo)
  }
  if (material?.tier_minimo_requerido) {
    const porTier =
      TIEMPO_MAXIMO_DEFAULT_POR_TIER[material.tier_minimo_requerido] ||
      TIEMPO_MAXIMO_DEFAULT_POR_TIER.estandar
    return porTier.minutos
  }
  return DURACION_MAXIMA_PRESTAMO_MINUTOS
}

export function mensajeRangoDuracion(material = null) {
  const maximoMinutos = obtenerMinutosMaximosMaterial(material)
  return `La duración debe ser de al menos ${DURACION_MINIMA_PRESTAMO_MINUTOS} minutos y máximo ${formatearDuracionMinutos(maximoMinutos)}.`
}

export function ayudaRangoDuracion(material = null) {
  const maximoMinutos = obtenerMinutosMaximosMaterial(material)
  return `Mínimo ${DURACION_MINIMA_PRESTAMO_MINUTOS} minutos · Máximo para este material: ${formatearDuracionMinutos(maximoMinutos)} · Incluye 30 min de tiempo de gracia en la devolución.`
}

export function validarFormularioPrestamo({
  dni,
  material,
  instanciaId,
  duracionValor,
  duracionUnidad,
  dias,
  checklist,
  documentoIdentidad,
  compromisoResponsabilidad,
}) {
  const errores = {}
  const erroresFotos = {}
  const dniLimpio = String(dni ?? '').trim()
  const valorTiempo = duracionValor !== undefined ? duracionValor : dias
  const unidadTiempo = duracionUnidad || (duracionValor !== undefined ? 'horas' : 'dias')
  const cantidad = Number(valorTiempo)
  const minutos = convertirTiempoAMinutos(valorTiempo, unidadTiempo)
  const maximoMinutos = obtenerMinutosMaximosMaterial(material)

  if (!/^\d{8}$/.test(dniLimpio)) {
    errores.dni = 'El DNI debe tener exactamente 8 dígitos.'
  }
  if (!material) {
    errores.material = 'Selecciona un material disponible.'
  }
  if (!instanciaId) {
    errores.instancia_id = 'Selecciona una instancia disponible.'
  }
  if (
    valorTiempo === ''
    || valorTiempo === null
    || valorTiempo === undefined
    || !Number.isInteger(cantidad)
    || cantidad <= 0
    || !Number.isInteger(minutos)
  ) {
    errores.dias = mensajeRangoDuracion(material)
  } else if (minutos < DURACION_MINIMA_PRESTAMO_MINUTOS) {
    errores.dias = `El tiempo mínimo de préstamo es de ${DURACION_MINIMA_PRESTAMO_MINUTOS} minutos.`
  } else if (minutos > maximoMinutos) {
    errores.dias = `El tiempo solicitado supera el máximo permitido para este material (${formatearDuracionMinutos(maximoMinutos)}).`
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
  if (esMaterialAltoValor(material)) {
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

export function evaluarCambioDuracion(duracion, duracionAnterior, unidad = 'horas', material = null) {
  if (duracion === '') return { valor: '', error: '' }
  const cantidad = Number(duracion)
  const minutos = convertirTiempoAMinutos(duracion, unidad)
  const maximoMinutos = obtenerMinutosMaximosMaterial(material)
  if (!Number.isFinite(cantidad) || !Number.isInteger(cantidad) || cantidad <= 0) {
    return {
      valor: String(duracionAnterior),
      error: mensajeRangoDuracion(material),
    }
  }
  if (minutos < DURACION_MINIMA_PRESTAMO_MINUTOS) {
    return {
      valor: String(duracionAnterior),
      error: `El tiempo mínimo de préstamo es de ${DURACION_MINIMA_PRESTAMO_MINUTOS} minutos.`,
    }
  }
  if (minutos > maximoMinutos) {
    return {
      valor: String(duracionAnterior),
      error: `El tiempo solicitado supera el máximo permitido para este material (${formatearDuracionMinutos(maximoMinutos)}).`,
    }
  }
  return { valor: duracion, error: '' }
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

export function calcularFechaLimiteEstimada(duracionValor, unidad = 'horas', material = null) {
  const cantidad = Number(duracionValor)
  const minutos = convertirTiempoAMinutos(duracionValor, unidad)
  const maximoMinutos = obtenerMinutosMaximosMaterial(material)
  if (
    duracionValor === ''
    || !Number.isInteger(cantidad)
    || cantidad <= 0
    || !Number.isInteger(minutos)
    || minutos < DURACION_MINIMA_PRESTAMO_MINUTOS
    || minutos > maximoMinutos
  ) return null
  return new Date(Date.now() + minutos * 60 * 1000)
}
