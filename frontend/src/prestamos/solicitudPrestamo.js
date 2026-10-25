export function construirSolicitudPrestamo({
  dni,
  material,
  instanciaId,
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
  solicitud.append('tiempo_prestamo_dias', String(Number(dias)))
  solicitud.append('checklist_inicial', JSON.stringify(checklist.map((item) => ({
    elemento: item.elemento.trim(),
    observacion: item.observacion.trim(),
  }))))
  fotosChecklist.forEach((foto, indice) => {
    if (foto) solicitud.append(`foto_checklist_${indice}`, foto)
  })

  if (material.es_alto_valor && documentoIdentidad) {
    solicitud.append('documento_identidad', documentoIdentidad)
  }
  if (material.es_alto_valor && compromisoResponsabilidad) {
    solicitud.append('compromiso_responsabilidad', compromisoResponsabilidad)
  }

  return solicitud
}
