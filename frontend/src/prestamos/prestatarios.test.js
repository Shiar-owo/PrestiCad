import { describe, expect, it } from 'vitest'

import {
  construirRutaBusquedaPrestatarios,
  crearEtiquetaPrestatario,
  crearSeleccionPrestatario,
  debeBuscarPrestatarios,
  normalizarDniPrestatario,
} from './prestatarios'

describe('normalizarDniPrestatario', () => {
  it('conserva solo los primeros ocho dígitos', () => {
    expect(normalizarDniPrestatario('12a 3456789')).toBe('12345678')
  })
})

describe('búsqueda de prestatarios', () => {
  it('espera tres dígitos antes de buscar y no busca al prestatario ya seleccionado', () => {
    expect(debeBuscarPrestatarios('12')).toBe(false)
    expect(debeBuscarPrestatarios('123')).toBe(true)
    expect(debeBuscarPrestatarios('12345678', { dni: '12345678' })).toBe(false)
  })

  it('construye la ruta de consulta para el prefijo del DNI', () => {
    expect(construirRutaBusquedaPrestatarios('123')).toBe(
      '/prestamos/prestatarios/?dni=123',
    )
  })

  it('prepara la selección con DNI y nombre completo', () => {
    expect(crearSeleccionPrestatario({
      dni: '12345678',
      nombre_completo: ' Ana Torres ',
      email: 'ana@unsa.edu.pe',
    })).toEqual({
      dni: '12345678',
      nombre_completo: 'Ana Torres',
    })
  })

  it('ignora sugerencias sin DNI o nombre completo', () => {
    expect(crearSeleccionPrestatario({ dni: '12345678' })).toBeNull()
    expect(crearSeleccionPrestatario(null)).toBeNull()
  })

  it('construye la etiqueta accesible con DNI y nombre separados por guion', () => {
    expect(crearEtiquetaPrestatario({
      dni: '12345678',
      nombre_completo: 'Ana Torres',
    })).toBe('12345678 - Ana Torres')
    expect(crearEtiquetaPrestatario({ dni: '12345678' })).toBe('')
  })
})
