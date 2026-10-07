export function validarFormularioPrestamo({
  dni,
  material,
  dias,
  checklist,
  documentoIdentidadRecibido,
  compromisoFirmadoRecibido,
}) {
  const errores = {}
  const dniLimpio = String(dni ?? '').trim()

  if (!/^\d{8}$/.test(dniLimpio)) {
    errores.dni = 'El DNI debe tener exactamente 8 dígitos.'
  }
  if (!material) {
    errores.material = 'Selecciona un material disponible.'
  }
  if (!Number.isInteger(Number(dias)) || Number(dias) < 1) {
    errores.dias = 'El tiempo de préstamo debe ser al menos un día.'
  }
  if (!Array.isArray(checklist) || checklist.length === 0) {
    errores.checklist = 'Registra al menos una condición del material.'
  } else if (checklist.some((item) => !item.elemento.trim() || !item.condicion.trim())) {
    errores.checklist = 'Completa el elemento y su condición en cada fila.'
  }
  if (material?.es_alto_valor && !documentoIdentidadRecibido) {
    errores.garantia_documento_identidad_recibido =
      'Confirma la recepción y revisión del documento de identidad.'
  }
  if (material?.es_alto_valor && !compromisoFirmadoRecibido) {
    errores.garantia_compromiso_firmado_recibido =
      'Confirma la recepción del compromiso firmado.'
  }

  return errores
}

export function calcularFechaLimiteEstimada(dias) {
  const cantidad = Number(dias)
  if (!Number.isInteger(cantidad) || cantidad < 1) return null
  const fecha = new Date()
  fecha.setDate(fecha.getDate() + cantidad)
  return fecha
}
