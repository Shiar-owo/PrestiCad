import { describe, expect, it } from 'vitest'

import { obtenerCodigoInstancia } from './eliminacionMaterial'

describe('obtenerCodigoInstancia', () => {
  it('obtiene el código transformado que entrega la ficha técnica', () => {
    expect(obtenerCodigoInstancia({ codigoEjemplar: 'TAB-01' })).toBe('TAB-01')
  })

  it('acepta también la forma del API', () => {
    expect(obtenerCodigoInstancia({ codigo_ejemplar: 'TAB-02' })).toBe('TAB-02')
  })

  it('devuelve una cadena segura si falta la instancia o su código', () => {
    expect(obtenerCodigoInstancia()).toBe('')
    expect(obtenerCodigoInstancia({})).toBe('')
  })
})
