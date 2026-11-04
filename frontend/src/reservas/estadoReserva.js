import { validarTamanoSolicitud } from '../prestamos/tamanoSolicitud'

export const MAXIMO_RESERVAS_ACTIVAS = 3

export const ESTADOS_ACTIVOS_RESERVA = ['en_espera', 'reservada']

export const HORARIO_ATENCION_INICIO = 8
export const HORARIO_ATENCION_FIN = 18
export const HORA_RESERVA_MINIMO_INICIO = 9
export const HORA_RESERVA_MAXIMO_FIN = 17
export const DIAS_LABORABLES = [0, 1, 2, 3, 4]
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

export const ETIQUETAS_PRIORIDAD = {
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
}

export const OPCIONES_PRIORIDAD = [
  { valor: 'alta', etiqueta: 'Alta (necesidad urgente)' },
  { valor: 'media', etiqueta: 'Media (uso académico regular)' },
  { valor: 'baja', etiqueta: 'Baja (consulta flexible)' },
]

const ORDEN_PRIORIDAD = {
  alta: 3,
  media: 2,
  baja: 1,
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
    return 'En espera - Excepción'
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
    const prioA = ORDEN_PRIORIDAD[a.prioridad] || 0
    const prioB = ORDEN_PRIORIDAD[b.prioridad] || 0
    if (prioA !== prioB) return prioB - prioA

    const fechaA = new Date(a.fecha_creacion).getTime()
    const fechaB = new Date(b.fecha_creacion).getTime()
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
  prioridad,
  justificacion,
  documentoIdentidad,
  compromisoResponsabilidad,
}) {
  const formulario = new FormData()
  formulario.append('material_id', String(materialId || '').trim())
  formulario.append('prioridad', String(prioridad || '').trim())
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
  fechaInicio,
  fechaFin,
  prioridad,
  justificacion,
  esExcepcion = false,
  documentoIdentidad = null,
  compromisoResponsabilidad = null,
}) {
  const errores = {}

  if (!String(materialId || '').trim()) {
    errores.materialId = 'Debes seleccionar un material.'
  }

  const erroresHorario = validarHorarioReserva(fechaInicio, fechaFin)
  if (Object.keys(erroresHorario).length > 0) {
    Object.assign(errores, erroresHorario)
  }

  if (!['alta', 'media', 'baja'].includes(prioridad)) {
    errores.prioridad = 'Selecciona una prioridad válida (alta, media o baja).'
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
        prioridad,
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

export function validarHorarioReserva(fechaInicio, fechaFin) {
  const errores = {}
  if (!fechaInicio) {
    errores.fechaInicio = 'Debe indicar la fecha y hora de inicio de la reserva.'
    return errores
  }
  if (!fechaFin) {
    errores.fechaFin = 'Debe indicar la fecha y hora de fin de la reserva.'
    return errores
  }
  const inicio = new Date(fechaInicio)
  const fin = new Date(fechaFin)
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) {
    errores.fechaInicio = 'La fecha y hora de inicio no es válida.'
    errores.fechaFin = 'La fecha y hora de fin no es válida.'
    return errores
  }
  if (fin <= inicio) {
    errores.fechaFin = 'La fecha y hora de fin debe ser posterior a la de inicio.'
  }
  const validarDiaYHora = (valor, campo) => {
    if (!DIAS_LABORABLES.includes(valor.getDay())) {
      errores[campo] = 'La reserva solo puede realizarse de lunes a viernes (días laborables).'
      return
    }
    const minutos = valor.getHours() * 60 + valor.getMinutes()
    if (minutos < HORA_RESERVA_MINIMO_INICIO * 60 || minutos > HORA_RESERVA_MAXIMO_FIN * 60) {
      errores[campo] = `La reserva debe estar dentro del horario de atención (${HORA_RESERVA_MINIMO_INICIO}:00 a ${HORA_RESERVA_MAXIMO_FIN}:00).`
    }
  }
  validarDiaYHora(inicio, 'fechaInicio')
  validarDiaYHora(fin, 'fechaFin')
  return errores
}
