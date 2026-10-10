export function construirSolicitudPrestamo({
  dni,
  material,
  instanciaId,
  dias,
  checklist,
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
    condicion: item.condicion.trim(),
    observacion: item.observacion.trim(),
  }))))

  if (material.es_alto_valor && documentoIdentidad) {
    solicitud.append('documento_identidad', documentoIdentidad)
  }
  if (material.es_alto_valor && compromisoResponsabilidad) {
    solicitud.append('compromiso_responsabilidad', compromisoResponsabilidad)
  }

  return solicitud
}
