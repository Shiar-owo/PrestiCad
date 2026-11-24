export const ESTADOS_DEVOLUBLES = ['activo', 'vencido']

export const ESTADOS_CHECKLIST_DEVOLUCION = [
  'sin_cambios',
  'dano_parcial',
  'dano_total',
]

export const ETIQUETAS_ESTADO_DEVOLUCION = {
  sin_cambios: 'Sin cambios',
  dano_parcial: 'Daño parcial',
  dano_total: 'Daño total',
}

export const ETIQUETAS_DANO = {
  sin_cambios: 'Sin daños',
  dano_parcial: 'Daño parcial',
  dano_total: 'Daño total',
}

export function esDevoluble(estado) {
  return ESTADOS_DEVOLUBLES.includes(estado)
}
