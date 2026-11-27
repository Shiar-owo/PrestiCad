import {
  TAMANO_MAXIMO_GARANTIA_BYTES,
  TAMANO_MAXIMO_GARANTIA_MB,
} from './constantes/garantia'
import {
  DURACION_MAXIMA_PRESTAMO_DIAS,
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
import { buscarDiaNoLaborable, formatearFechaCortaIso } from './reservas/diasNoLaborables'

export function obtenerMinutosMaximosMaterial(material) {
  if (material?.tiempo_maximo_prestamo) {
    return Math.min(Number(material.tiempo_maximo_prestamo), DURACION_MAXIMA_PRESTAMO_MINUTOS)
  }
  if (material?.tier_minimo_requerido) {
    const porTier =
      TIEMPO_MAXIMO_DEFAULT_POR_TIER[material.tier_minimo_requerido] ||
      TIEMPO_MAXIMO_DEFAULT_POR_TIER.estandar
    return Math.min(porTier.minutos, DURACION_MAXIMA_PRESTAMO_MINUTOS)
  }
  return DURACION_MAXIMA_PRESTAMO_MINUTOS
}

export function obtenerFechaMaximaFinPrestamo(fechaInicio, material = null) {
  if (!fechaInicio) return ''
  const inicio = new Date(fechaInicio)
  if (Number.isNaN(inicio.getTime())) return ''
  const finMaximo = new Date(
    inicio.getTime() + obtenerMinutosMaximosMaterial(material) * 60 * 1000,
  )
  const anio = finMaximo.getFullYear()
  const mes = String(finMaximo.getMonth() + 1).padStart(2, '0')
  const dia = String(finMaximo.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

export function mensajeRangoDuracion(material = null) {
  const maximoMinutos = obtenerMinutosMaximosMaterial(material)
  return `La duración del préstamo debe ser de al menos 1 hora (60 minutos) y máximo ${formatearDuracionMinutos(maximoMinutos)}; la tolerancia de 30 minutos queda dentro del máximo total de ${DURACION_MAXIMA_PRESTAMO_DIAS} días.`
}

export function ayudaRangoDuracion(material = null) {
  const maximoMinutos = obtenerMinutosMaximosMaterial(material)
  return `Mínimo 1 hora (60 minutos) · Máximo permitido para este material: ${formatearDuracionMinutos(maximoMinutos)} · La tolerancia de 30 minutos queda dentro del máximo total de ${DURACION_MAXIMA_PRESTAMO_DIAS} días.`
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
  esExcepcion = false,
  garantiaReutilizada = false,
  fechaFin = null,
  diasNoLaborables = [],
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
    errores.instancia_id = 'Selecciona un ejemplar disponible.'
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
    errores.dias = 'El tiempo mínimo de préstamo es de 1 hora (60 minutos).'
  } else if (minutos > maximoMinutos) {
    errores.dias = `El tiempo solicitado supera el máximo permitido para este material (${formatearDuracionMinutos(maximoMinutos)}); la tolerancia de 30 minutos queda dentro del máximo total de ${DURACION_MAXIMA_PRESTAMO_DIAS} días.`
  }

  if (fechaFin) {
    const fin = new Date(fechaFin)
    if (!Number.isNaN(fin.getTime())) {
      const diaInhabilitado = buscarDiaNoLaborable(fin, diasNoLaborables)
      if (fin.getDay() === 0 || fin.getDay() === 6) {
        errores.dias = 'La fecha de devolución debe ser un día laborable (lunes a viernes).'
      } else if (diaInhabilitado) {
        errores.dias = `El día ${formatearFechaCortaIso(fin)} está inhabilitado (${diaInhabilitado.motivo}). La devolución debe ser un día laborable.`
      } else {
        const minutosFin = fin.getHours() * 60 + fin.getMinutes()
        if (minutosFin < 8 * 60 || minutosFin > 17 * 60 + 30) {
          errores.dias = 'La devolución debe realizarse dentro del horario de atención, de lunes a viernes entre 08:00 y 17:30.'
        }
      }
    }
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
  if ((esExcepcion || esMaterialAltoValor(material)) && !garantiaReutilizada) {
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
      error: 'El tiempo mínimo de préstamo es de 1 hora (60 minutos).',
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
