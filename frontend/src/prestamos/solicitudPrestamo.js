import { esMaterialAltoValor } from '../constantes/catalogo'

export function construirSolicitudPrestamo({
  dni,
  material,
  instanciaId,
  minutos,
  dias,
  checklist,
  fotosChecklist = checklist.map((item) => item.foto),
  documentoIdentidad,
  compromisoResponsabilidad,
}) {
  const solicitud = new FormData()
  solicitud.append('dni_prestatario', dni.trim())
  solicitud.append('material_id', material.id)
  solicitud.append('instancia_id', instanciaId)
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

  const materialAltoValor = esMaterialAltoValor(material)
  if (materialAltoValor && documentoIdentidad) {
    solicitud.append('documento_identidad', documentoIdentidad)
  }
  if (materialAltoValor && compromisoResponsabilidad) {
    solicitud.append('compromiso_responsabilidad', compromisoResponsabilidad)
  }

  return solicitud
}
