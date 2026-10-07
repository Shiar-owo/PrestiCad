import { describe, expect, it } from 'vitest'

import {
  construirRutaHistorial,
  validarRespuestaHistorial,
} from './historialPrestamos'

describe('construirRutaHistorial', () => {
  it('solicita la primera página con el tamaño acordado', () => {
    expect(construirRutaHistorial()).toBe(
      '/prestamos/historial/?page=1&page_size=25',
    )
  })

  it('incluye página y estado cuando se filtra', () => {
    expect(construirRutaHistorial({ estado: 'devuelto', pagina: 2 })).toBe(
      '/prestamos/historial/?page=2&page_size=25&estado=devuelto',
    )
  })

  it('omite el filtro para todos los estados', () => {
    expect(construirRutaHistorial({ estado: 'todos' })).toBe(
      '/prestamos/historial/?page=1&page_size=25',
    )
  })
})

describe('validarRespuestaHistorial', () => {
  it('conserva la respuesta paginada válida', () => {
    const respuesta = {
      count: 1,
      next: null,
      previous: null,
      results: [{ id: 1, estado: 'activo' }],
    }

    expect(validarRespuestaHistorial(respuesta)).toBe(respuesta)
  })

  it('rechaza una respuesta que no incluye lista o conteo válido', () => {
    expect(() => validarRespuestaHistorial([])).toThrow(
      'La respuesta del historial de préstamos no tiene el formato esperado.',
    )
    expect(() => validarRespuestaHistorial({ count: -1, results: [] })).toThrow()
  })
})
