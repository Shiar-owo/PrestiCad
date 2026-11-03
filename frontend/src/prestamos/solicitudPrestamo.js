import { esMaterialAltoValor } from '../constantes/catalogo'

export function construirSolicitudPrestamo({
  dni,
  material,
  instanciaId,
  reservaId = '',
  minutos,
  dias,
  checklist,
  fotosChecklist = checklist.map((item) => item.foto),
  documentoIdentidad,
  compromisoResponsabilidad,
  esExcepcion = false,
}) {
  const solicitud = new FormData()
  solicitud.append('dni_prestatario', dni.trim())
  solicitud.append('material_id', material.id)
  solicitud.append('instancia_id', instanciaId)
  if (reservaId) {
    solicitud.append('reserva_id', String(reservaId).trim())
  }
  if (minutos !== undefined && minutos !== null && minutos !== '') {
    solicitud.append('tiempo_prestamo_minutos', String(Number(minutos)))
  } else {
    solicitud.append('tiempo_prestamo_dias', String(Number(dias)))
  }
  solicitud.append('checklist_inicial', JSON.stringify(checklist.map((item) => ({
    elemento: item.elemento.trim(),
    observacion: item.observacion.trim(),
  }))))
  fotosChecklist.forEach((foto, indice) => {
    if (foto) solicitud.append(`foto_checklist_${indice}`, foto)
  })

  const requiereGarantia = esExcepcion || esMaterialAltoValor(material)
  if (requiereGarantia && documentoIdentidad) {
    solicitud.append('documento_identidad', documentoIdentidad)
  }
  if (requiereGarantia && compromisoResponsabilidad) {
    solicitud.append('compromiso_responsabilidad', compromisoResponsabilidad)
  }

  return solicitud
}
