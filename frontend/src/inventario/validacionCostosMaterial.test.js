import { describe, expect, it } from 'vitest'

import { validarCostosMaterial } from './validacionCostosMaterial'

describe('validación de costos de materiales', () => {
  it.each(['costo_reparacion', 'costo_reposicion'])('rechaza %s negativo', (campo) => {
    expect(validarCostosMaterial({ [campo]: '-0.01' })).toEqual({
      [campo]: 'El costo no puede ser negativo.',
    })
  })

  it.each(['', null, undefined, '0', '125.50'])('permite el costo opcional válido %s', (valor) => {
    expect(validarCostosMaterial({ costo_reparacion: valor, costo_reposicion: valor })).toEqual({})
  })

  it('mantiene el mensaje para valores que no son numéricos', () => {
    expect(validarCostosMaterial({ costo_reparacion: 'monto' })).toEqual({
      costo_reparacion: 'Ingresa un monto o déjalo vacío.',
    })
  })
})
