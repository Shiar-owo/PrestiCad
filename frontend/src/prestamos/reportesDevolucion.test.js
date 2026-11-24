import { describe, expect, it } from 'vitest'

import {
  construirRutaReportes,
  validarRespuestaReportes,
} from './reportesDevolucion'

describe('construirRutaReportes', () => {
  it('solicita la primera página con el tamaño acordado', () => {
    expect(construirRutaReportes()).toBe(
      '/prestamos/devoluciones/reportes/?page=1&page_size=25',
    )
  })

  it('incluye el tipo de daño cuando se filtra', () => {
    expect(construirRutaReportes({ dano: 'dano_parcial', pagina: 2 })).toBe(
      '/prestamos/devoluciones/reportes/?page=2&page_size=25&dano=dano_parcial',
    )
  })

  it('omite el filtro para todos los daños', () => {
    expect(construirRutaReportes({ dano: 'todos' })).toBe(
      '/prestamos/devoluciones/reportes/?page=1&page_size=25',
    )
  })

  it('incluye el rango de fechas solo cuando hay valores', () => {
    expect(
      construirRutaReportes({ fechaDesde: '2026-01-01', fechaHasta: '2026-01-31' }),
    ).toBe(
      '/prestamos/devoluciones/reportes/?page=1&page_size=25&fecha_desde=2026-01-01&fecha_hasta=2026-01-31',
    )
  })
})

describe('validarRespuestaReportes', () => {
  it('conserva la respuesta paginada válida', () => {
    const respuesta = {
      count: 1,
      next: null,
      previous: null,
      results: [{ devolucion_id: 1, dano: 'dano_parcial' }],
    }

    expect(validarRespuestaReportes(respuesta)).toBe(respuesta)
  })

  it('rechaza una respuesta que no incluye lista o conteo válido', () => {
    expect(() => validarRespuestaReportes([])).toThrow(
      'La respuesta del listado de reportes no tiene el formato esperado.',
    )
    expect(() => validarRespuestaReportes({ count: -1, results: [] })).toThrow()
  })
})
