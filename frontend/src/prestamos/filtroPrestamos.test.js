import { describe, expect, it } from 'vitest'

import { filtrarPrestamos } from './filtroPrestamos'

const prestamos = [
  { id: 1, estado: 'activo', estado_visible: 'activo' },
  { id: 2, estado: 'activo', estado_visible: 'vencido' },
  { id: 3, estado: 'reservado', estado_visible: 'reservado' },
  { id: 4, estado: 'devuelto', estado_visible: 'devuelto' },
]

describe('filtrarPrestamos', () => {
  it('devuelve todos los préstamos para el filtro Todos sin mutar la lista', () => {
    const resultado = filtrarPrestamos(prestamos, 'todos')

    expect(resultado).toEqual(prestamos)
    expect(resultado).not.toBe(prestamos)
  })

  it.each(['activo', 'reservado', 'vencido', 'devuelto'])(
    'filtra por estado visible %s',
    (estado) => {
      expect(filtrarPrestamos(prestamos, estado).map(({ id }) => id)).toEqual([
        { activo: 1, reservado: 3, vencido: 2, devuelto: 4 }[estado],
      ])
    },
  )

  it('deriva vencido al filtrar préstamos sin estado visible precalculado', () => {
    const resultado = filtrarPrestamos(
      [{ id: 5, estado: 'activo', fecha_limite: '2026-10-06T00:00:00Z' }],
      'vencido',
      new Date('2026-10-07T00:00:00Z'),
    )

    expect(resultado.map(({ id }) => id)).toEqual([5])
  })

  it('devuelve lista vacía si el filtro no tiene coincidencias', () => {
    expect(filtrarPrestamos([prestamos[0]], 'devuelto')).toEqual([])
  })
})
