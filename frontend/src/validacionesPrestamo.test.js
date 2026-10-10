import { describe, expect, it } from 'vitest'

import {
  calcularFechaLimiteEstimada,
  validarFormularioPrestamo,
} from './validacionesPrestamo'
import { TAMANO_MAXIMO_GARANTIA_BYTES } from './constantes/garantia'

const formularioValido = {
  dni: '12345678',
  material: { id: 'mat-1', es_alto_valor: false },
  instanciaId: 'instancia-1',
  dias: '5',
  checklist: [{ elemento: 'Pantalla', condicion: 'Sin daños' }],
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
      instanciaId: '',
      dias: 0,
      checklist: [{ elemento: '', condicion: '' }],
    })

    expect(errores).toHaveProperty('dni')
    expect(errores).toHaveProperty('material')
    expect(errores).toHaveProperty('instancia_id')
    expect(errores).toHaveProperty('dias')
    expect(errores).toHaveProperty('checklist')
  })

  it('requiere seleccionar una instancia específica del material', () => {
    const errores = validarFormularioPrestamo({
      ...formularioValido,
      instanciaId: '',
    })

    expect(errores).toHaveProperty('instancia_id')
  })

  it('exige ambos PDF para un material de alto valor', () => {
    const errores = validarFormularioPrestamo({
      ...formularioValido,
      material: { id: 'mat-2', es_alto_valor: true },
    })

    expect(errores).toHaveProperty('documento_identidad')
    expect(errores).toHaveProperty('compromiso_responsabilidad')
  })

  it('rechaza extensión, tipo MIME y tamaño incorrectos en los PDF', () => {
    const errores = validarFormularioPrestamo({
      ...formularioValido,
      material: { id: 'mat-2', es_alto_valor: true },
      documentoIdentidad: { name: 'dni.txt', type: 'application/pdf', size: 100 },
      compromisoResponsabilidad: {
        name: 'compromiso.pdf',
        type: 'text/plain',
        size: TAMANO_MAXIMO_GARANTIA_BYTES + 1,
      },
    })

    expect(errores.documento_identidad).toMatch(/extensión \.pdf/)
    expect(errores.compromiso_responsabilidad).toMatch(/application\/pdf/)
  })

  it('rechaza un PDF que supera el tamaño máximo configurado', () => {
    const errores = validarFormularioPrestamo({
      ...formularioValido,
      material: { id: 'mat-2', es_alto_valor: true },
      documentoIdentidad: {
        name: 'dni.pdf',
        type: 'application/pdf',
        size: TAMANO_MAXIMO_GARANTIA_BYTES + 1,
      },
      compromisoResponsabilidad: {
        name: 'compromiso.pdf',
        type: 'application/pdf',
        size: 100,
      },
    })

    expect(errores.documento_identidad).toMatch(/no debe superar/)
    expect(errores).not.toHaveProperty('compromiso_responsabilidad')
  })

  it('calcula la fecha estimada y rechaza duraciones inválidas', () => {
    const ahora = new Date()
    const fechaLimite = calcularFechaLimiteEstimada(3)

    expect(fechaLimite.getDate()).toBe(new Date(ahora.setDate(ahora.getDate() + 3)).getDate())
    expect(calcularFechaLimiteEstimada(0)).toBeNull()
  })
})
