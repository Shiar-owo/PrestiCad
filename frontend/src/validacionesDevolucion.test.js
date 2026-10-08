import { describe, expect, it } from 'vitest'

import {
  armarChecklistDevolucion,
  validarChecklistDevolucion,
} from './validacionesDevolucion'

const checklistValido = [
  { elemento: 'Carcasa', condicion: 'Sin daños', estado: 'sin_cambios', observacion: '' },
  { elemento: 'Cable', condicion: 'Completo', estado: 'dano_parcial', observacion: 'Cortado' },
]

describe('validarChecklistDevolucion', () => {
  it('acepta un checklist con estados válidos, incluso con daño', () => {
    expect(validarChecklistDevolucion(checklistValido)).toEqual({})
  })

  it('rechaza listas vacías o ausentes', () => {
    expect(validarChecklistDevolucion([])).toHaveProperty('checklist')
    expect(validarChecklistDevolucion(undefined)).toHaveProperty('checklist')
  })

  it('rechaza filas sin elemento descripto', () => {
    const errores = validarChecklistDevolucion([
      { elemento: '   ', estado: 'sin_cambios', observacion: '' },
    ])

    expect(errores.checklist).toContain('elemento')
  })

  it('rechaza estados fuera de la taxonomía de devolución', () => {
    const errores = validarChecklistDevolucion([
      { elemento: 'Carcasa', estado: 'regular', observacion: '' },
    ])

    expect(errores.checklist).toContain('estado')
  })
})

describe('armarChecklistDevolucion', () => {
  it('prellena las filas del checklist inicial en estado sin_cambios', () => {
    const filas = armarChecklistDevolucion([
      { elemento: ' Pantalla ', condicion: 'Intacta', observacion: 'ok' },
    ])

    expect(filas).toEqual([
      {
        elemento: 'Pantalla',
        condicion: 'Intacta',
        estado: 'sin_cambios',
        observacion: '',
      },
    ])
  })

  it('devuelve una lista vacía si no hay checklist inicial', () => {
    expect(armarChecklistDevolucion(null)).toEqual([])
    expect(armarChecklistDevolucion(undefined)).toEqual([])
  })
})
