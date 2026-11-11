import { validarTamanoSolicitud } from '../prestamos/tamanoSolicitud'

export const MAXIMO_RESERVAS_ACTIVAS = 3

export const ESTADOS_ACTIVOS_RESERVA = ['en_espera', 'reservada']

export const HORARIO_ATENCION_INICIO = 8
export const HORARIO_ATENCION_FIN = 18
export const HORA_RESERVA_MINIMO_INICIO = 9
export const HORA_RESERVA_MAXIMO_FIN = 17
// getDay() en JS: 0=Domingo, 1=Lunes, 2=Martes, 3=Miercoles, 4=Jueves, 5=Viernes, 6=Sabado
// weekday() en Python: 0=Lunes ... 4=Viernes. No copiar ese valor directamente aqui.
export const DIAS_LABORABLES = [1, 2, 3, 4, 5]
export const TOLERANCIA_RECOJO_MINUTOS = 30

export const ETIQUETAS_ESTADO_RESERVA = {
  en_espera: 'En espera',
  reservada: 'Reservada',
  expirada: 'Expirada',
  rechazada: 'Rechazada',
  cancelada: 'Cancelada',
  cancelada_por_vencimiento: 'Cancelada por vencimiento',
  convertida_en_prestamo: 'Convertida en préstamo',
}

export const PRESENTACION_ESTADOS_RESERVA = {
  en_espera: { texto: 'En espera', clase: 'reserva-estado--en-espera' },
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
    return reserva.excepcion_aprobada
      ? 'En espera (Excepción aprobada)'
      : 'En espera - Excepción'
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
  documentoIdentidad,
  compromisoResponsabilidad,
}) {
  const formulario = new FormData()
  formulario.append('material_id', String(materialId || '').trim())
  formulario.append('justificacion', String(justificacion || '').trim())

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
  documentoIdentidad = null,
  compromisoResponsabilidad = null,
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
    fechaFin
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

export function obtenerLunesSemana(fecha) {
  const d = new Date(fecha)
  if (Number.isNaN(d.getTime())) return null
  const dia = d.getDay()
  const diasAlLunes = dia === 0 ? 6 : dia - 1
  d.setDate(d.getDate() - diasAlLunes)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function validarHorarioReserva(
  fechaSeleccionada,
  horaInicio,
  horaFin,
  esAvanzado = false,
  fechaInicio = null,
  fechaFin = null
) {
  const errores = {}
  if (esAvanzado) {
    // Validar fecha de forma independiente
    if (!fechaSeleccionada) {
      errores.fecha = 'La fecha es obligatoria.'
    } else {
      const soloFecha = new Date(`${fechaSeleccionada}T00:00:00`)
      if (Number.isNaN(soloFecha.getTime())) {
        errores.fecha = 'La fecha no es válida.'
      } else if (!DIAS_LABORABLES.includes(soloFecha.getDay())) {
        errores.fecha = 'Solo se permite reservar de lunes a viernes (días laborables).'
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
      if (minutosInicio < HORA_RESERVA_MINIMO_INICIO * 60 || minutosInicio > HORA_RESERVA_MAXIMO_FIN * 60) {
        errores.horaInicio = `El horario de atención es de ${HORA_RESERVA_MINIMO_INICIO}:00 a ${HORA_RESERVA_MAXIMO_FIN}:00.`
      }
    }

    // Validar horaFin de forma independiente
    if (!horaFin) {
      errores.horaFin = 'La hora de fin es obligatoria.'
    } else if (!regexHora.test(horaFin)) {
      errores.horaFin = 'La hora de fin no es válida.'
    } else {
      const minutosFin = parseInt(horaFin.split(':')[0], 10) * 60 + parseInt(horaFin.split(':')[1], 10)
      if (minutosFin < HORA_RESERVA_MINIMO_INICIO * 60 || minutosFin > HORA_RESERVA_MAXIMO_FIN * 60) {
        errores.horaFin = `El horario de atención es de ${HORA_RESERVA_MINIMO_INICIO}:00 a ${HORA_RESERVA_MAXIMO_FIN}:00.`
      }
    }

    // Validacion cruzada: solo si fecha y ambas horas son validas
    if (fechaSeleccionada && horaInicio && horaFin && !errores.fecha && !errores.horaInicio && !errores.horaFin) {
      const inicio = new Date(`${fechaSeleccionada}T${horaInicio}:00`)
      const fin = new Date(`${fechaSeleccionada}T${horaFin}:00`)
      if (fin <= inicio) {
        errores.horaFin = 'La hora de fin debe ser posterior a la de inicio.'
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
        if (!DIAS_LABORABLES.includes(inicio.getDay())) {
          errores.fechaInicio = 'Solo se permite reservar de lunes a viernes (días laborables).'
        }
        const minutosInicio = inicio.getHours() * 60 + inicio.getMinutes()
        if (minutosInicio < HORA_RESERVA_MINIMO_INICIO * 60 || minutosInicio > HORA_RESERVA_MAXIMO_FIN * 60) {
          errores.fechaInicio =
            (errores.fechaInicio ? errores.fechaInicio + ' ' : '') +
            `El horario de atención es de ${HORA_RESERVA_MINIMO_INICIO}:00 a ${HORA_RESERVA_MAXIMO_FIN}:00.`
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
        if (!DIAS_LABORABLES.includes(fin.getDay())) {
          errores.fechaFin = 'Solo se permite reservar de lunes a viernes (días laborables).'
        }
        const minutosFin = fin.getHours() * 60 + fin.getMinutes()
        if (minutosFin < HORA_RESERVA_MINIMO_INICIO * 60 || minutosFin > HORA_RESERVA_MAXIMO_FIN * 60) {
          errores.fechaFin =
            (errores.fechaFin ? errores.fechaFin + ' ' : '') +
            `El horario de atención es de ${HORA_RESERVA_MINIMO_INICIO}:00 a ${HORA_RESERVA_MAXIMO_FIN}:00.`
        }
      }
    }

    // Validacion cruzada: solo si ambas fechas son validas
    if (fechaInicio && fechaFin) {
      const inicio = new Date(fechaInicio)
      const fin = new Date(fechaFin)
      if (!Number.isNaN(inicio.getTime()) && !Number.isNaN(fin.getTime())) {
        if (fin <= inicio) {
          errores.fechaFin =
            (errores.fechaFin ? errores.fechaFin + ' ' : '') +
            'La fecha y hora de fin debe ser posterior a la de inicio.'
        } else if (obtenerLunesSemana(inicio) !== obtenerLunesSemana(fin)) {
          errores.fechaFin =
            (errores.fechaFin ? errores.fechaFin + ' ' : '') +
            'La reserva debe realizarse dentro de la misma semana (lunes a viernes) sin cruzar el fin de semana.'
        }
      }
    }
  }
  return errores
}
