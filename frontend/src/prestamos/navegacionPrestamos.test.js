import { describe, expect, it } from 'vitest'

import {
  esRutaGestionPrestamos,
  obtenerOpcionesGestionPrestamos,
} from './navegacionPrestamos'

describe('obtenerOpcionesGestionPrestamos', () => {
  it('incluye las cuatro opciones para el gestor de almacén', () => {
    const opciones = obtenerOpcionesGestionPrestamos('gestor')

    expect(opciones.map((opcion) => opcion.etiqueta)).toEqual([
      'Registrar Préstamo',
      'Registrar Devolución',
      'Historial de Préstamos',
      'Reportes',
    ])
  })

  it('conserva solo historial y reportes para el administrador', () => {
    const opciones = obtenerOpcionesGestionPrestamos('administrador')

    expect(opciones.map((opcion) => opcion.etiqueta)).toEqual([
      'Historial de Préstamos',
      'Reportes',
    ])
  })

  it('devuelve lista vacía para prestatarios o roles vacíos', () => {
    expect(obtenerOpcionesGestionPrestamos('prestatario')).toEqual([])
    expect(obtenerOpcionesGestionPrestamos('')).toEqual([])
  })
})

describe('esRutaGestionPrestamos', () => {
  it('identifica las rutas pertenecientes a Gestionar Préstamos', () => {
    expect(esRutaGestionPrestamos('/panel/gestion-prestamos')).toBe(true)
    expect(esRutaGestionPrestamos('/panel/prestamo')).toBe(true)
    expect(esRutaGestionPrestamos('/panel/devolucion')).toBe(true)
    expect(esRutaGestionPrestamos('/panel/devolucion/42')).toBe(true)
    expect(esRutaGestionPrestamos('/panel/historial')).toBe(true)
    expect(esRutaGestionPrestamos('/panel/reportes')).toBe(true)
  })

  it('descarta otras rutas del panel o públicas', () => {
    expect(esRutaGestionPrestamos('/panel')).toBe(false)
    expect(esRutaGestionPrestamos('/panel/prestamos')).toBe(false)
    expect(esRutaGestionPrestamos('/panel/inventario')).toBe(false)
  })
})
