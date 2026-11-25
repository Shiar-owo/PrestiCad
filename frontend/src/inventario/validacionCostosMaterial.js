export const CAMPOS_COSTO_MATERIAL = ['costo_reparacion', 'costo_reposicion']

export function validarCostoMaterial(valor) {
  if (valor === '' || valor === null || valor === undefined) return ''
  if (!Number.isFinite(Number(valor))) return 'Ingresa un monto o déjalo vacío.'
  if (Number(valor) < 0) return 'El costo no puede ser negativo.'
  return ''
}

export function validarCostosMaterial(datos) {
  return Object.fromEntries(
    CAMPOS_COSTO_MATERIAL
      .map((campo) => [campo, validarCostoMaterial(datos[campo])])
      .filter(([, error]) => error),
  )
}
