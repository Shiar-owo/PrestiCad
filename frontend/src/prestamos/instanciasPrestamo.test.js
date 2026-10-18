import { describe, expect, it } from 'vitest'

import {
  crearOpcionesInstancia,
  obtenerInstanciaSeleccionada,
} from './instanciasPrestamo'

describe('obtenerInstanciaSeleccionada', () => {
  const instancias = [
    { id: 17, codigo_ejemplar: 'EQ-17' },
    { id: 18, codigo_ejemplar: 'EQ-18' },
  ]

  it('encuentra la ficha individual por identificador numérico o textual', () => {
    expect(obtenerInstanciaSeleccionada(instancias, '18')).toEqual(instancias[1])
    expect(obtenerInstanciaSeleccionada(instancias, 17)).toEqual(instancias[0])
  })

  it('devuelve null si todavía no hay una selección válida', () => {
    expect(obtenerInstanciaSeleccionada(instancias, '')).toBeNull()
    expect(obtenerInstanciaSeleccionada(instancias, 99)).toBeNull()
    expect(obtenerInstanciaSeleccionada(null, 17)).toBeNull()
  })
})

describe('crearOpcionesInstancia', () => {
  it('muestra el código, el número de serie y el estado físico si están disponibles', () => {
    expect(
      crearOpcionesInstancia([
        {
          id: 'unidad-1',
          codigo_ejemplar: 'EQ-01-01',
          numero_serie: 'SERIE-01',
          estado_fisico: 'Desgaste leve',
        },
      ]),
    ).toEqual([
      { valor: '', etiqueta: 'Selecciona una instancia' },
      {
        valor: 'unidad-1',
        etiqueta: 'EQ-01-01 · Serie: SERIE-01 · Estado físico: Desgaste leve',
      },
    ])
  })

  it('muestra solo el código cuando faltan los datos físicos opcionales', () => {
    expect(
      crearOpcionesInstancia([
        { id: 'unidad-2', codigo_ejemplar: 'EQ-01-02', numero_serie: '', estado_fisico: '' },
      ])[1],
    ).toEqual({ valor: 'unidad-2', etiqueta: 'EQ-01-02' })
  })

  it('mantiene el mensaje de carga y el identificador de la unidad', () => {
    expect(crearOpcionesInstancia([{ id: 17, codigo_ejemplar: 'EQ-17' }], true)).toEqual([
      { valor: '', etiqueta: 'Cargando instancias…' },
      { valor: '17', etiqueta: 'EQ-17' },
    ])
  })
})
