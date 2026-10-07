import { describe, expect, it } from 'vitest'

import {
  obtenerEstadoVisible,
  ordenarPrestamos,
  presentarEstadoPrestamo,
} from './estadoPrestamo'

describe('presentarEstadoPrestamo', () => {
  it.each([
    ['activo', 'Activo', 'prestamo-estado--activo'],
    ['reservado', 'Reservado', 'prestamo-estado--reservado'],
    ['vencido', 'Vencido', 'prestamo-estado--vencido'],
    ['devuelto', 'Devuelto', 'prestamo-estado--devuelto'],
  ])('presenta %s con texto y clase visibles', (estado, texto, clase) => {
    expect(presentarEstadoPrestamo(estado)).toEqual({ texto, clase })
  })
})

describe('obtenerEstadoVisible', () => {
  const ahora = new Date('2026-10-07T12:00:00Z')

  it('deriva vencido si un préstamo activo superó su fecha límite', () => {
    expect(obtenerEstadoVisible({
      estado: 'activo',
      fecha_limite: '2026-10-07T11:59:59Z',
    }, ahora)).toBe('vencido')
  })

  it('conserva activo mientras la fecha límite no haya pasado', () => {
    expect(obtenerEstadoVisible({
      estado: 'activo',
      fecha_limite: '2026-10-07T12:00:00Z',
    }, ahora)).toBe('activo')
  })

  it('no reemplaza estados persistidos reservado o devuelto', () => {
    expect(obtenerEstadoVisible({ estado: 'reservado', fecha_limite: '2020-01-01' }, ahora))
      .toBe('reservado')
    expect(obtenerEstadoVisible({ estado: 'devuelto', fecha_limite: '2020-01-01' }, ahora))
      .toBe('devuelto')
  })
})

describe('ordenarPrestamos', () => {
  const ahora = new Date('2026-10-07T12:00:00Z')
  const prestamos = [
    { id: 1, estado: 'activo', fecha_limite: '2026-10-10T00:00:00Z', fecha_entrega: '2026-10-01T00:00:00Z' },
    { id: 2, estado: 'activo', fecha_limite: '2026-10-05T00:00:00Z', fecha_entrega: '2026-10-02T00:00:00Z' },
    { id: 3, estado: 'activo', fecha_limite: '2026-10-06T00:00:00Z', fecha_entrega: '2026-10-03T00:00:00Z' },
    { id: 4, estado: 'devuelto', fecha_limite: '2026-09-01T00:00:00Z', fecha_entrega: '2026-10-04T00:00:00Z' },
  ]

  it('prioriza vencidos por fecha límite ascendente y luego ordena el resto por entrega descendente', () => {
    const resultado = ordenarPrestamos(prestamos, ahora)

    expect(resultado.map(({ id }) => id)).toEqual([2, 3, 4, 1])
    expect(resultado.map(({ estado_visible }) => estado_visible)).toEqual([
      'vencido',
      'vencido',
      'devuelto',
      'activo',
    ])
    expect(prestamos[0]).not.toHaveProperty('estado_visible')
  })
})
