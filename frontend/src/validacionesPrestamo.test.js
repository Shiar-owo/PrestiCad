import { describe, expect, it } from 'vitest'

import {
  calcularFechaLimiteEstimada,
  validarFormularioPrestamo,
} from './validacionesPrestamo'

const formularioValido = {
  dni: '12345678',
  material: { id: 'mat-1', es_alto_valor: false },
  dias: '5',
  checklist: [{ elemento: 'Pantalla', condicion: 'Sin daños' }],
  documentoIdentidadRecibido: false,
  compromisoFirmadoRecibido: false,
}

describe('validarFormularioPrestamo', () => {
  it('acepta una entrega regular válida', () => {
    expect(validarFormularioPrestamo(formularioValido)).toEqual({})
  })

  it('requiere DNI de ocho dígitos, material, duración y checklist completos', () => {
    const errores = validarFormularioPrestamo({
      ...formularioValido,
      dni: 'abc',
      material: null,
      dias: 0,
      checklist: [{ elemento: '', condicion: '' }],
    })

    expect(errores).toHaveProperty('dni')
    expect(errores).toHaveProperty('material')
    expect(errores).toHaveProperty('dias')
    expect(errores).toHaveProperty('checklist')
  })

  it('exige confirmar ambos documentos para un material de alto valor', () => {
    const errores = validarFormularioPrestamo({
      ...formularioValido,
      material: { id: 'mat-2', es_alto_valor: true },
    })

    expect(errores).toHaveProperty('garantia_documento_identidad_recibido')
    expect(errores).toHaveProperty('garantia_compromiso_firmado_recibido')
  })

  it('calcula la fecha estimada y rechaza duraciones inválidas', () => {
    const ahora = new Date()
    const fechaLimite = calcularFechaLimiteEstimada(3)

    expect(fechaLimite.getDate()).toBe(new Date(ahora.setDate(ahora.getDate() + 3)).getDate())
    expect(calcularFechaLimiteEstimada(0)).toBeNull()
  })
})
