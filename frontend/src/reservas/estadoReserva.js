import { validarTamanoSolicitud } from '../prestamos/tamanoSolicitud'
import {
  DURACION_MAXIMA_RESERVA_MINUTOS,
  formatearDuracionMinutos,
} from '../constantes/checklistPrestamo'
import {
  buscarDiaNoLaborable,
  extraerFechaIso,
  formatearFechaCortaIso,
} from './diasNoLaborables'

export const MAXIMO_RESERVAS_ACTIVAS = 3

export const ESTADOS_ACTIVOS_RESERVA = ['en_espera', 'reservada']

export const HORARIO_ATENCION_INICIO = 8
export const HORARIO_ATENCION_FIN = 18
export const HORA_RESERVA_MINIMO_INICIO = 8
export const HORA_RESERVA_MAXIMO_FIN = 17
export const MINUTO_RESERVA_MAXIMO_FIN = 30
export const TEXTO_HORA_RESERVA_MAXIMO_FIN = '17:30'
// getDay() en JS: 0=Domingo, 1=Lunes, 2=Martes, 3=Miercoles, 4=Jueves, 5=Viernes, 6=Sabado
// weekday() en Python: 0=Lunes ... 4=Viernes. No copiar ese valor directamente aqui.
export const DIAS_LABORABLES = [1, 2, 3, 4, 5]
export const TOLERANCIA_RECOJO_MINUTOS = 30
export const MINIMO_MINUTOS_RESERVA = 60
export const MINIMO_RANGO_RESERVA_MINUTOS = MINIMO_MINUTOS_RESERVA

export const ETIQUETAS_ESTADO_RESERVA = {
  en_espera: 'Pendiente de revisión',
  reservada: 'Reservada',
  expirada: 'Expirada',
  rechazada: 'Rechazada',
  cancelada: 'Cancelada',
  cancelada_por_vencimiento: 'Cancelada por vencimiento',
  convertida_en_prestamo: 'Convertida en préstamo',
}

export const PRESENTACION_ESTADOS_RESERVA = {
  en_espera: { texto: 'Pendiente de revisión', clase: 'reserva-estado--en-espera' },
  reservada: { texto: 'Reservada', clase: 'reserva-estado--reservada' },
  expirada: { texto: 'Expirada', clase: 'reserva-estado--expirada' },
  rechazada: { texto: 'Rechazada', clase: 'reserva-estado--rechazada' },
  cancelada: { texto: 'Cancelada', clase: 'reserva-estado--cancelada' },
  cancelada_por_vencimiento: {
    texto: 'Cancelada por vencimiento',
    clase: 'reserva-estado--vencida',
  },
  convertida_en_prestamo: {
    texto: 'Convertida en préstamo',
    clase: 'reserva-estado--convertida',
  },
}

const ORDEN_TIER = {
  avanzado: 3,
  estandar: 2,
  restringido: 1,
}

export function presentarEstadoReserva(estado) {
  return (
    PRESENTACION_ESTADOS_RESERVA[estado] || {
      texto: 'Estado desconocido',
      clase: 'reserva-estado--desconocido',
    }
  )
}

export function textoEstadoReserva(reserva, estado = reserva?.estado) {
  if (!reserva && !estado) return 'Estado desconocido'
  if (reserva?.es_excepcion && estado === 'reservada') {
    return 'Reservada - Excepción'
  }
  if (reserva?.es_excepcion && estado === 'en_espera') {
    return reserva.excepcion_aprobada ? 'Excepción aprobada' : 'Pendiente de revisión'
  }
  return presentarEstadoReserva(estado).texto
}

export function esReservaActiva(reserva) {
  return ESTADOS_ACTIVOS_RESERVA.includes(reserva?.estado)
}

export function contarReservasActivas(reservas = []) {
  if (!Array.isArray(reservas)) return 0
  return reservas.filter(esReservaActiva).length
}

export function esElegiblePorTier(tierUsuario, tierMaterial) {
  const nivelUsuario = ORDEN_TIER[tierUsuario] || 0
  const nivelMaterial = ORDEN_TIER[tierMaterial] || 0
  if (!nivelUsuario || !nivelMaterial) return false
  return nivelUsuario >= nivelMaterial
}

export function requiereExcepcionAcademica(tierUsuario, tierMaterial) {
  return (
    ['restringido', 'estandar'].includes(tierUsuario)
    && !esElegiblePorTier(tierUsuario, tierMaterial)
  )
}

export function ordenarColaReservas(reservas = []) {
  if (!Array.isArray(reservas)) return []
  return [...reservas].sort((a, b) => {
    const fechaA = new Date(a.fecha_solicitud || a.fecha_creacion || a.created_at).getTime()
    const fechaB = new Date(b.fecha_solicitud || b.fecha_creacion || b.created_at).getTime()
    if (!Number.isNaN(fechaA) && !Number.isNaN(fechaB) && fechaA !== fechaB) {
      return fechaA - fechaB
    }

    const tierA = ORDEN_TIER[a.usuario?.reputacion_tier || a.reputacion_tier] || 0
    const tierB = ORDEN_TIER[b.usuario?.reputacion_tier || b.reputacion_tier] || 0
    if (tierA !== tierB) return tierB - tierA

    return String(a.id || '').localeCompare(String(b.id || ''))
  })
}

export function construirFormularioReservaExcepcional({
  materialId,
  justificacion,
  fechaInicio,
  fechaFin,
  documentoIdentidad,
  compromisoResponsabilidad,
}) {
  const formulario = new FormData()
  formulario.append('material_id', String(materialId || '').trim())
  formulario.append('justificacion', String(justificacion || '').trim())
  formulario.append('fecha_inicio', String(fechaInicio || ''))
  formulario.append('fecha_fin', String(fechaFin || ''))

  if (documentoIdentidad) {
    formulario.append('documento_identidad', documentoIdentidad)
  }
  if (compromisoResponsabilidad) {
    formulario.append('compromiso_responsabilidad', compromisoResponsabilidad)
  }

  return formulario
}

export function validarFormularioReserva({
  materialId,
  instanciaId,
  fechaSeleccionada,
  horaInicio,
  horaFin,
  fechaInicio,
  fechaFin,
  justificacion,
  esExcepcion = false,
  esAvanzado = false,
  material = null,
  documentoIdentidad = null,
  compromisoResponsabilidad = null,
  diasNoLaborables = [],
}) {
  const errores = {}

  if (!String(materialId || '').trim()) {
    errores.materialId = 'Debes seleccionar un material.'
  }

  const erroresHorario = validarHorarioReserva(
    fechaSeleccionada,
    horaInicio,
    horaFin,
    esAvanzado,
    fechaInicio,
    fechaFin,
    material,
    diasNoLaborables,
  )
  if (Object.keys(erroresHorario).length > 0) {
    Object.assign(errores, erroresHorario)
  }

  if (!String(justificacion || '').trim()) {
    errores.justificacion = 'La justificación de la reserva es obligatoria.'
  }

  if (esExcepcion) {
    if (!documentoIdentidad) {
      errores.documentoIdentidad =
        'El documento de identidad (PDF) es obligatorio para solicitar una excepción académica.'
    }
    if (!compromisoResponsabilidad) {
      errores.compromisoResponsabilidad =
        'El compromiso de responsabilidad firmado (PDF) es obligatorio para solicitar una excepción académica.'
    }

    if (documentoIdentidad || compromisoResponsabilidad) {
      const formTemp = construirFormularioReservaExcepcional({
        materialId,
        justificacion,
        documentoIdentidad,
        compromisoResponsabilidad,
      })
      const errorTamano = validarTamanoSolicitud(formTemp)
      if (errorTamano) {
        errores.archivos = errorTamano
      }
    }
  }

  return errores
}

export function formatearFechaReserva(fecha) {
  if (!fecha) return 'No disponible'
  const valor = new Date(fecha)
  if (Number.isNaN(valor.getTime())) return String(fecha)

  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
    hourCycle: 'h23',
    timeZone: 'America/Lima',
  }).format(valor)
}

export function obtenerMotivoVisibleReserva(reserva) {
  if (!reserva) return ''
  if (reserva.estado === 'rechazada' && reserva.motivo_rechazo) {
    return reserva.motivo_rechazo
  }
  if (
    ['cancelada', 'cancelada_por_vencimiento'].includes(reserva.estado) &&
    reserva.motivo_cancelacion
  ) {
    return reserva.motivo_cancelacion
  }
  return reserva.motivo_rechazo || reserva.motivo_cancelacion || ''
}

export function formatearFechaHoraInput(fecha) {
  if (!fecha) return ''
  const valor = new Date(fecha)
  if (Number.isNaN(valor.getTime())) return ''
  const offset = valor.getTimezoneOffset()
  const local = new Date(valor.getTime() - offset * 60 * 1000)
  return local.toISOString().slice(0, 16)
}

export function obtenerMinimoInicioReserva(ahora = new Date()) {
  const minimo = new Date(ahora)
  minimo.setSeconds(0, 0)
  minimo.setMinutes(minimo.getMinutes() + 1)
  return formatearFechaHoraInput(minimo)
}

export function obtenerMinimoFinReserva(fechaInicio) {
  if (!fechaInicio) return ''
  const minimo = new Date(fechaInicio)
  if (Number.isNaN(minimo.getTime())) return ''
  minimo.setMinutes(minimo.getMinutes() + MINIMO_RANGO_RESERVA_MINUTOS)
  return formatearFechaHoraInput(minimo)
}

export function contarDiasFinDeSemanaIntermedios(fechaInicio, fechaFin) {
  if (!fechaInicio || !fechaFin) return 0
  const inicio = new Date(fechaInicio)
  const fin = new Date(fechaFin)
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime()) || fin <= inicio) {
    return 0
  }
  if (!DIAS_LABORABLES.includes(inicio.getDay()) || !DIAS_LABORABLES.includes(fin.getDay())) {
    return 0
  }
  const cursor = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + 1)
  const limite = new Date(fin.getFullYear(), fin.getMonth(), fin.getDate())
  let diasFinDeSemana = 0
  while (cursor < limite) {
    const dia = cursor.getDay()
    if (dia === 0 || dia === 6) {
      diasFinDeSemana += 1
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return diasFinDeSemana
}

export function cruzaFinDeSemana(fechaInicio, fechaFin) {
  return contarDiasFinDeSemanaIntermedios(fechaInicio, fechaFin) > 0
}

export function calcularMinutosHabilesReserva(fechaInicio, fechaFin) {
  if (!fechaInicio || !fechaFin) return NaN
  const inicio = new Date(fechaInicio)
  const fin = new Date(fechaFin)
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) return NaN
  return Math.max(0, (fin.getTime() - inicio.getTime()) / 60000)
}

export function obtenerMaximoFinReserva(fechaInicio, material = null) {
  if (!fechaInicio) return ''
  const inicio = new Date(fechaInicio)
  if (Number.isNaN(inicio.getTime())) return ''
  const maximoMinutos = obtenerMaximoMinutosReserva(material)

  const maximo = new Date(inicio.getTime() + maximoMinutos * 60000)
  // Si maximo cae en fin de semana, ajustar al viernes anterior a las 17:00
  if (maximo.getDay() === 6) {
    maximo.setDate(maximo.getDate() - 1)
    maximo.setHours(HORA_RESERVA_MAXIMO_FIN, MINUTO_RESERVA_MAXIMO_FIN, 0, 0)
  } else if (maximo.getDay() === 0) {
    maximo.setDate(maximo.getDate() - 2)
    maximo.setHours(HORA_RESERVA_MAXIMO_FIN, MINUTO_RESERVA_MAXIMO_FIN, 0, 0)
  }
  const minutosDia = maximo.getHours() * 60 + maximo.getMinutes()
  if (minutosDia > HORA_RESERVA_MAXIMO_FIN * 60 + MINUTO_RESERVA_MAXIMO_FIN) {
    maximo.setHours(HORA_RESERVA_MAXIMO_FIN, MINUTO_RESERVA_MAXIMO_FIN, 0, 0)
  } else if (minutosDia < HORA_RESERVA_MINIMO_INICIO * 60) {
    maximo.setHours(HORA_RESERVA_MINIMO_INICIO, 0, 0, 0)
  }
  return formatearFechaHoraInput(maximo)
}

export function obtenerMaximoMinutosReserva(material = null) {
  const maximoConfigurado = Number(material?.tiempo_maximo_prestamo)
  return maximoConfigurado > 0
    ? Math.min(maximoConfigurado, DURACION_MAXIMA_RESERVA_MINUTOS)
    : DURACION_MAXIMA_RESERVA_MINUTOS
}

export function obtenerFechaLocal(fecha = new Date()) {
  const valor = new Date(fecha)
  if (Number.isNaN(valor.getTime())) return ''
  const local = new Date(valor.getTime() - valor.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

export function obtenerMinimaHoraInicioReserva(fecha, ahora = new Date()) {
  const minimoAtencion = HORA_RESERVA_MINIMO_INICIO * 60
  let minutos = minimoAtencion
  if (fecha && fecha === obtenerFechaLocal(ahora)) {
    minutos = Math.max(minimoAtencion, ahora.getHours() * 60 + ahora.getMinutes() + 1)
  }
  return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`
}

export function obtenerMinimaHoraFinReserva(horaInicio) {
  if (!horaInicio) {
    const minimo = HORA_RESERVA_MINIMO_INICIO * 60 + MINIMO_RANGO_RESERVA_MINUTOS
    return `${String(Math.floor(minimo / 60)).padStart(2, '0')}:${String(minimo % 60).padStart(2, '0')}`
  }
  const [hora, minuto] = horaInicio.split(':').map(Number)
  const minutos = Math.max(
    (HORA_RESERVA_MINIMO_INICIO * 60) + MINIMO_RANGO_RESERVA_MINUTOS,
    hora * 60 + minuto + MINIMO_RANGO_RESERVA_MINUTOS,
  )
  return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`
}

export function puedeEntregarseReservaAhora(fechaInicio, ahora = new Date(), fechaLimiteRecojo = null) {
  if (!fechaInicio) return false
  const inicio = new Date(fechaInicio)
  if (Number.isNaN(inicio.getTime())) return false
  const mismoDia = inicio.getFullYear() === ahora.getFullYear()
    && inicio.getMonth() === ahora.getMonth()
    && inicio.getDate() === ahora.getDate()
  const limite = fechaLimiteRecojo ? new Date(fechaLimiteRecojo) : null
  return mismoDia && ahora >= inicio && (!limite || ahora <= limite)
}

export function obtenerLunesSemana(fecha) {
  const d = new Date(fecha)
  if (Number.isNaN(d.getTime())) return null
  const dia = d.getDay()
  const diasAlLunes = dia === 0 ? 6 : dia - 1
  d.setDate(d.getDate() - diasAlLunes)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function obtenerSiguienteDiaLaborable(fechaBase, diasNoLaborables = []) {
  if (!fechaBase) return ''
  const fechaStr = typeof fechaBase === 'string' && !fechaBase.includes('T') ? `${fechaBase}T00:00:00` : fechaBase
  const base = new Date(fechaStr)
  if (Number.isNaN(base.getTime())) return ''
  const cursor = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1, 0, 0, 0)
  for (let i = 0; i < 30; i += 1) {
    const diaSemana = cursor.getDay()
    const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
    const inhabilitado = buscarDiaNoLaborable(iso, diasNoLaborables)
    if (diaSemana !== 0 && diaSemana !== 6 && !inhabilitado) {
      return iso
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return ''
}

export function calcularSugerenciaSiguienteDia(
  fechaInicioOFecha,
  horaInicioOpcional = null,
  material = null,
  diasNoLaborables = [],
) {
  if (!fechaInicioOFecha) return null

  let inicio
  let fechaInicioIso
  if (horaInicioOpcional) {
    fechaInicioIso = fechaInicioOFecha
    inicio = new Date(`${fechaInicioOFecha}T${horaInicioOpcional}:00`)
  } else {
    inicio = new Date(fechaInicioOFecha)
    fechaInicioIso = extraerFechaIso(fechaInicioOFecha)
  }

  if (Number.isNaN(inicio.getTime())) return null

  const minutosDia = inicio.getHours() * 60 + inicio.getMinutes()
  // Si la reserva empieza después de las 16:30, no cabe 1 hora mínima de duración antes de las 17:30
  if (minutosDia <= 16 * 60 + 30) {
    return null
  }

  const siguienteDiaIso = obtenerSiguienteDiaLaborable(fechaInicioIso, diasNoLaborables)
  if (!siguienteDiaIso) return null

  const finSugerido = new Date(`${siguienteDiaIso}T08:00:00`)
  const minutosTotales = Math.round((finSugerido.getTime() - inicio.getTime()) / 60000)
  const maximoMinutosMaterial = material ? obtenerMaximoMinutosReserva(material) : 4320

  if (minutosTotales <= maximoMinutosMaterial) {
    return {
      aplica: true,
      esPosible: true,
      fechaFinIso: siguienteDiaIso,
      horaFin: '08:00',
      fechaFinCompleta: `${siguienteDiaIso}T08:00`,
      minutosTotales,
      mensaje: `No es posible devolver hoy antes del cierre de atención (18:00). Puedes programar la devolución para el siguiente día hábil (${formatearFechaCortaIso(siguienteDiaIso)}) a las 08:00 (${formatearDuracionMinutos(minutosTotales)} de préstamo).`,
    }
  }

  return {
    aplica: true,
    esPosible: false,
    minutosTotales,
    maximoMinutosMaterial,
    mensaje: `Este material permite como máximo ${formatearDuracionMinutos(maximoMinutosMaterial)}. No es posible extender la devolución hasta el siguiente día hábil (${formatearDuracionMinutos(minutosTotales)}). Por favor programa el recojo más temprano dentro del horario de atención (08:00 a 18:00).`,
  }
}

export function validarHorarioReserva(
  fechaSeleccionada,
  horaInicio,
  horaFin,
  esAvanzado = false,
  fechaInicio = null,
  fechaFin = null,
  material = null,
  diasNoLaborables = [],
  fechaFinAvanzada = null,
) {
  const errores = {}
  const maximoMinutosMaterial = material ? obtenerMaximoMinutosReserva(material) : null
  if (esAvanzado) {
    const fechaFinEfectiva = fechaFinAvanzada || fechaSeleccionada

    // Validar fecha de forma independiente
    if (!fechaSeleccionada) {
      errores.fecha = 'La fecha es obligatoria.'
    } else {
      const soloFecha = new Date(`${fechaSeleccionada}T00:00:00`)
      const diaInhabilitado = buscarDiaNoLaborable(fechaSeleccionada, diasNoLaborables)
      if (Number.isNaN(soloFecha.getTime())) {
        errores.fecha = 'La fecha no es válida.'
      } else if (!DIAS_LABORABLES.includes(soloFecha.getDay())) {
        errores.fecha = 'Solo se permite reservar de lunes a viernes (días laborables).'
      } else if (diaInhabilitado) {
        errores.fecha = `El día ${formatearFechaCortaIso(fechaSeleccionada)} está inhabilitado (${diaInhabilitado.motivo}). Selecciona otro día laborable.`
      } else if (horaInicio && new Date(`${fechaSeleccionada}T${horaInicio}:00`) <= new Date()) {
        errores.fecha = 'La fecha de inicio debe ser posterior al momento actual.'
      }
    }

    // Validar fechaFinEfectiva si es distinta
    if (fechaFinAvanzada && fechaFinAvanzada !== fechaSeleccionada) {
      const soloFechaFin = new Date(`${fechaFinAvanzada}T00:00:00`)
      const diaFinInhabilitado = buscarDiaNoLaborable(fechaFinAvanzada, diasNoLaborables)
      if (!DIAS_LABORABLES.includes(soloFechaFin.getDay()) || diaFinInhabilitado) {
        errores.horaFin = 'La fecha de devolución sugerida no es un día laborable válido.'
      }
    }

    // Validar horaInicio de forma independiente
    const regexHora = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
    if (!horaInicio) {
      errores.horaInicio = 'La hora de inicio es obligatoria.'
    } else if (!regexHora.test(horaInicio)) {
      errores.horaInicio = 'La hora de inicio no es válida.'
    } else {
      const minutosInicio = parseInt(horaInicio.split(':')[0], 10) * 60 + parseInt(horaInicio.split(':')[1], 10)
      if (minutosInicio < HORA_RESERVA_MINIMO_INICIO * 60 || minutosInicio > HORA_RESERVA_MAXIMO_FIN * 60 + MINUTO_RESERVA_MAXIMO_FIN) {
        errores.horaInicio = `El horario permitido para recojo y devolución es de 08:00 a ${TEXTO_HORA_RESERVA_MAXIMO_FIN}.`
      }
    }

    // Validar horaFin de forma independiente
    if (!horaFin) {
      errores.horaFin = 'La hora de fin es obligatoria.'
    } else if (!regexHora.test(horaFin)) {
      errores.horaFin = 'La hora de fin no es válida.'
    } else {
      const minutosFin = parseInt(horaFin.split(':')[0], 10) * 60 + parseInt(horaFin.split(':')[1], 10)
      if (minutosFin < HORA_RESERVA_MINIMO_INICIO * 60 || minutosFin > HORA_RESERVA_MAXIMO_FIN * 60 + MINUTO_RESERVA_MAXIMO_FIN) {
        errores.horaFin = `El horario permitido para recojo y devolución es de 08:00 a ${TEXTO_HORA_RESERVA_MAXIMO_FIN}.`
      }
    }

    // Validacion cruzada: solo si fecha y ambas horas son validas
    if (fechaSeleccionada && horaInicio && horaFin && !errores.fecha && !errores.horaInicio && !errores.horaFin) {
      const inicio = new Date(`${fechaSeleccionada}T${horaInicio}:00`)
      const fin = new Date(`${fechaFinEfectiva}T${horaFin}:00`)
      const minutosReserva = (fin.getTime() - inicio.getTime()) / 60000
      if (fin <= inicio) {
        errores.horaFin = 'La hora de fin debe ser posterior a la de inicio.'
      } else if (minutosReserva < MINIMO_MINUTOS_RESERVA) {
        errores.horaFin = 'La reserva debe tener una duración mínima de 1 hora (60 minutos).'
      } else if (maximoMinutosMaterial && minutosReserva > maximoMinutosMaterial) {
        errores.horaFin = `La duración de la reserva supera el tiempo máximo permitido para este material (${formatearDuracionMinutos(maximoMinutosMaterial)}).`
      }
    }
  } else {
    // Validar fechaInicio de forma independiente
    if (!fechaInicio) {
      errores.fechaInicio = 'La fecha y hora de inicio son obligatorias.'
    } else {
      const inicio = new Date(fechaInicio)
      if (Number.isNaN(inicio.getTime())) {
        errores.fechaInicio = 'La fecha u hora de inicio no es válida.'
      } else {
        const diaInicioInhabilitado = buscarDiaNoLaborable(inicio, diasNoLaborables)
        if (inicio <= new Date()) errores.fechaInicio = 'La fecha de inicio debe ser posterior al momento actual.'
        if (!DIAS_LABORABLES.includes(inicio.getDay())) {
          errores.fechaInicio = 'Solo se permite reservar de lunes a viernes (días laborables).'
        } else if (diaInicioInhabilitado) {
          errores.fechaInicio = `El día ${formatearFechaCortaIso(inicio)} está inhabilitado (${diaInicioInhabilitado.motivo}). Selecciona otro día laborable.`
        }
        const minutosInicio = inicio.getHours() * 60 + inicio.getMinutes()
        if (minutosInicio < HORA_RESERVA_MINIMO_INICIO * 60 || minutosInicio > HORA_RESERVA_MAXIMO_FIN * 60 + MINUTO_RESERVA_MAXIMO_FIN) {
          errores.fechaInicio =
            (errores.fechaInicio ? errores.fechaInicio + ' ' : '') +
            `El horario permitido para recojo y devolución es de 08:00 a ${TEXTO_HORA_RESERVA_MAXIMO_FIN}.`
        }
      }
    }

    // Validar fechaFin de forma independiente
    if (!fechaFin) {
      errores.fechaFin = 'La fecha y hora de fin son obligatorias.'
    } else {
      const fin = new Date(fechaFin)
      if (Number.isNaN(fin.getTime())) {
        errores.fechaFin = 'La fecha u hora de fin no es válida.'
      } else {
        const diaFinInhabilitado = buscarDiaNoLaborable(fin, diasNoLaborables)
        if (fin <= new Date()) errores.fechaFin = 'La fecha de fin debe ser futura.'
        if (!DIAS_LABORABLES.includes(fin.getDay())) {
          errores.fechaFin = 'Solo se permite reservar de lunes a viernes (días laborables).'
        } else if (diaFinInhabilitado) {
          errores.fechaFin = `El día ${formatearFechaCortaIso(fin)} está inhabilitado (${diaFinInhabilitado.motivo}). Selecciona otro día laborable.`
        }
        const minutosFin = fin.getHours() * 60 + fin.getMinutes()
        if (minutosFin < HORA_RESERVA_MINIMO_INICIO * 60 || minutosFin > HORA_RESERVA_MAXIMO_FIN * 60 + MINUTO_RESERVA_MAXIMO_FIN) {
          errores.fechaFin =
            (errores.fechaFin ? errores.fechaFin + ' ' : '') +
            `El horario permitido para recojo y devolución es de 08:00 a ${TEXTO_HORA_RESERVA_MAXIMO_FIN}.`
        }
      }
    }

    // Validacion cruzada: solo si ambas fechas son validas
    if (fechaInicio && fechaFin) {
      const inicio = new Date(fechaInicio)
      const fin = new Date(fechaFin)
      if (!Number.isNaN(inicio.getTime()) && !Number.isNaN(fin.getTime())) {
        const minutosHabiles = calcularMinutosHabilesReserva(inicio, fin)
        if (fin <= inicio) {
          errores.fechaFin =
            (errores.fechaFin ? errores.fechaFin + ' ' : '') +
            'La fecha y hora de fin debe ser posterior a la de inicio.'
        } else if (minutosHabiles < MINIMO_MINUTOS_RESERVA) {
          errores.fechaFin =
            (errores.fechaFin ? errores.fechaFin + ' ' : '') +
            'La reserva debe tener una duración mínima de 1 hora (60 minutos).'
        } else if (maximoMinutosMaterial && minutosHabiles > maximoMinutosMaterial) {
          errores.fechaFin =
            (errores.fechaFin ? errores.fechaFin + ' ' : '') +
            `La duración de la reserva supera el tiempo máximo permitido para este material (${formatearDuracionMinutos(maximoMinutosMaterial)}).`
        }
      }
    }
  }
  return errores
}
