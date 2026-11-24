import { describe, expect, it } from 'vitest'

import {
  ESTADO_CONSULTA_INICIAL,
  reducirConsultaPrestamos,
} from './consultaPrestamos'

describe('reducirConsultaPrestamos', () => {
  it('inicia en carga con una lista vacía', () => {
    expect(ESTADO_CONSULTA_INICIAL).toEqual({
      cargando: true,
      prestamos: [],
      error: '',
    })
  })

  it('acepta una respuesta con préstamos', () => {
    const prestamos = [{ id: 1, estado: 'activo' }]

    expect(reducirConsultaPrestamos(ESTADO_CONSULTA_INICIAL, {
      tipo: 'exito',
      prestamos,
    })).toEqual({ cargando: false, prestamos, error: '' })
  })

  it('representa una respuesta exitosa vacía', () => {
    expect(reducirConsultaPrestamos(ESTADO_CONSULTA_INICIAL, {
      tipo: 'exito',
      prestamos: [],
    })).toEqual({ cargando: false, prestamos: [], error: '' })
  })

  it('presenta error y permite iniciar un reintento', () => {
    const conError = reducirConsultaPrestamos(ESTADO_CONSULTA_INICIAL, {
      tipo: 'error',
      mensaje: 'No fue posible consultar tus préstamos.',
    })

    expect(conError).toEqual({
      cargando: false,
      prestamos: [],
      error: 'No fue posible consultar tus préstamos.',
    })
    expect(reducirConsultaPrestamos(conError, { tipo: 'iniciar' })).toEqual({
      cargando: true,
      prestamos: [],
      error: '',
    })
  })
})
