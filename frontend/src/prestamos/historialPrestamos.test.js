import { describe, expect, it } from 'vitest'

import {
  construirRutaHistorial,
  iniciarCargaHistorial,
  obtenerPrestamoAdyacente,
  validarRespuestaHistorial,
} from './historialPrestamos'

describe('iniciarCargaHistorial', () => {
  it('conserva los resultados actuales mientras carga un nuevo filtro', () => {
    const datos = { count: 1, next: null, previous: null, results: [{ id: 8 }] }

    expect(iniciarCargaHistorial({ datos, error: 'error previo' })).toEqual({
      cargando: true,
      error: '',
      datos,
    })
  })

  it('inicia la carga sin datos cuando el historial aún no respondió', () => {
    expect(iniciarCargaHistorial(null)).toEqual({
      cargando: true,
      error: '',
      datos: null,
    })
  })
})

describe('obtenerPrestamoAdyacente', () => {
  const prestamos = [{ id: 10 }, { id: 11 }, { id: 12 }]

  it('obtiene el préstamo anterior dentro de la página', () => {
    expect(obtenerPrestamoAdyacente(prestamos, 11, 'anterior')).toEqual({ id: 10 })
  })

  it('obtiene el préstamo siguiente dentro de la página', () => {
    expect(obtenerPrestamoAdyacente(prestamos, 11, 'siguiente')).toEqual({ id: 12 })
  })

  it('devuelve null cuando el préstamo está en un extremo o no existe', () => {
    expect(obtenerPrestamoAdyacente(prestamos, 10, 'anterior')).toBeNull()
    expect(obtenerPrestamoAdyacente(prestamos, 12, 'siguiente')).toBeNull()
    expect(obtenerPrestamoAdyacente(prestamos, 99, 'anterior')).toBeNull()
  })

  it('rechaza listas o direcciones inválidas', () => {
    expect(obtenerPrestamoAdyacente(null, 11, 'anterior')).toBeNull()
    expect(obtenerPrestamoAdyacente(prestamos, 11, 'otra')).toBeNull()
  })
})

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

  it('incluye el DNI del prestatario al filtrar el historial', () => {
    expect(construirRutaHistorial({ estado: 'activo', pagina: 2, dni: '12345678' })).toBe(
      '/prestamos/historial/?page=2&page_size=25&estado=activo&dni=12345678',
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
