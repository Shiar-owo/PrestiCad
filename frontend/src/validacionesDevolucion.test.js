import { describe, expect, it } from 'vitest'

import {
  armarChecklistDevolucion,
  validarChecklistDevolucion,
} from './validacionesDevolucion'

const checklistValido = [
  { elemento: 'Carcasa', estado: 'sin_cambios', observacion: '' },
  {
    elemento: 'Cable',
    estado: 'dano_parcial',
    observacion: 'Cortado',
    foto: { name: 'cable.png', type: 'image/png', size: 100 },
  },
]

describe('validarChecklistDevolucion', () => {
  it('acepta un checklist con estados válidos, incluso con daño', () => {
    expect(validarChecklistDevolucion(checklistValido)).toEqual({})
  })

  it('rechaza listas vacías o ausentes', () => {
    expect(validarChecklistDevolucion([])).toHaveProperty('checklist')
    expect(validarChecklistDevolucion(undefined)).toHaveProperty('checklist')
  })

  it('marca la fila que no tiene elemento descrito', () => {
    const errores = validarChecklistDevolucion([
      { elemento: '   ', estado: 'sin_cambios', observacion: '' },
    ])

    expect(errores.filas[0].elemento).toContain('elemento')
  })

  it('marca la fila que tiene un estado fuera de la taxonomía', () => {
    const errores = validarChecklistDevolucion([
      { elemento: 'Carcasa', estado: 'regular', observacion: '' },
    ])

    expect(errores.filas[0].estado).toContain('estado')
  })
})

describe('armarChecklistDevolucion', () => {
  it('prellena las filas del checklist inicial en estado sin_cambios', () => {
    const filas = armarChecklistDevolucion([
      {
        elemento: ' Pantalla ',
        observacion: 'ok',
        foto_url: '/api/prestamos/fotos/1/',
      },
    ])

    expect(filas).toEqual([
      {
        elemento: 'Pantalla',
        observacionInicial: 'ok',
        fotoInicialUrl: '/api/prestamos/fotos/1/',
        estado: 'sin_cambios',
        observacion: '',
        foto: null,
        fotoPrevia: '',
      },
    ])
  })

  it('devuelve una lista vacía si no hay checklist inicial', () => {
    expect(armarChecklistDevolucion(null)).toEqual([])
    expect(armarChecklistDevolucion(undefined)).toEqual([])
  })
})
