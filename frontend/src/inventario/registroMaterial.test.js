import { describe, expect, it } from 'vitest'

import {
  construirCuerpoRegistroMaterial,
  crearEjemplares,
  mapearErroresPorFila,
  redimensionarEjemplares,
  validarCodigosDuplicados,
  validarFotosEjemplares,
} from './registroMaterial'

describe('crear y redimensionar ejemplares', () => {
  it('crea filas con identificadores estables y limita la cantidad', () => {
    const ids = ['fila-a', 'fila-b', 'fila-c']
    const filas = crearEjemplares(60, () => ids.shift())

    expect(filas).toHaveLength(50)
    expect(filas.slice(0, 3).map((fila) => fila.id)).toEqual(['fila-a', 'fila-b', 'fila-c'])
  })

  it('conserva datos al crecer y mantiene solo las primeras filas al reducir', () => {
    const iniciales = crearEjemplares(2, (() => {
      let id = 0
      return () => `fila-${++id}`
    })())
    iniciales[0].numero_serie = 'SER-01'
    const ampliadas = redimensionarEjemplares(iniciales, 3, () => 'fila-3')
    const reducidas = redimensionarEjemplares(ampliadas, 1, () => 'no-usado')

    expect(ampliadas.map((fila) => fila.id)).toEqual(['fila-1', 'fila-2', 'fila-3'])
    expect(ampliadas[0].numero_serie).toBe('SER-01')
    expect(reducidas).toEqual([ampliadas[0]])
  })
})

describe('validaciones de ejemplares', () => {
  it('detecta códigos duplicados ignorando mayúsculas y espacios', () => {
    const errores = validarCodigosDuplicados([
      { codigo_ejemplar: ' caja-01 ' },
      { codigo_ejemplar: 'CAJA-01' },
      { codigo_ejemplar: '' },
    ])

    expect(errores).toEqual([
      { indice: 1, mensaje: 'El código del ejemplar está repetido (fila 1).' },
    ])
  })

  it('valida fotos con las reglas compartidas de inventario', () => {
    const valida = new File(['imagen'], 'foto.jpg', { type: 'image/jpeg' })
    const invalida = new File(['imagen'], 'foto.gif', { type: 'image/gif' })

    expect(validarFotosEjemplares([{ foto: valida }, { foto: invalida }, {}])).toEqual([
      { indice: 1, campo: 'foto', mensaje: 'La foto debe estar en formato JPG, PNG o WEBP.' },
    ])
  })
})

describe('construirCuerpoRegistroMaterial', () => {
  it('construye JSON único con los campos del ejemplar', () => {
    const cuerpo = construirCuerpoRegistroMaterial({
      modo: 'unico',
      datos: { nombre: 'Proyector', codigo_inventario: 'EQ-1', numero_serie: 'SER-1', ubicacion: 'A1' },
      ejemplares: [],
    })

    expect(cuerpo).toMatchObject({ modo: 'unico', stock: 1, numero_serie: 'SER-1', ubicacion: 'A1' })
    expect(cuerpo).not.toHaveProperty('instancias')
  })

  it('construye FormData para lote con fila JSON y foto indexada', () => {
    const foto = new File(['imagen'], 'ejemplar.png', { type: 'image/png' })
    const cuerpo = construirCuerpoRegistroMaterial({
      modo: 'lote',
      datos: { nombre: 'Cámara', codigo_inventario: 'EQ-2', ubicacion: 'Estante A', numero_serie: 'no-compartir' },
      ejemplares: [
        { id: 'a', numero_serie: 'SER-A', foto: null, observaciones: 'ok' },
        { id: 'b', numero_serie: 'SER-B', foto, ubicacion: 'Estante B' },
      ],
    })

    expect(cuerpo).toBeInstanceOf(FormData)
    expect(cuerpo.get('stock')).toBe('2')
    expect(cuerpo.get('numero_serie')).toBeNull()
    expect(JSON.parse(cuerpo.get('instancias'))[1]).toMatchObject({ numero_serie: 'SER-B', ubicacion: 'Estante B' })
    expect(cuerpo.get('instancia_foto_1').name).toBe('ejemplar.png')
  })

  it('construye detalle JSON con códigos y condiciones por fila', () => {
    const cuerpo = construirCuerpoRegistroMaterial({
      modo: 'detalle',
      datos: { nombre: 'Libro', codigo_inventario: 'LIB-1', estado_fisico: 'no-compartir' },
      ejemplares: [{
        codigo_ejemplar: 'LIB-A', estado_fisico: 'Bueno', numero_serie: 'S1', ubicacion: 'A1', observaciones: 'Nota',
      }, {
        codigo_ejemplar: 'LIB-B', estado_fisico: 'Regular',
      }],
    })

    expect(cuerpo).toMatchObject({ modo: 'detalle', stock: 2 })
    expect(cuerpo.instancias[0]).toMatchObject({ codigo_ejemplar: 'LIB-A', estado_fisico: 'Bueno', observaciones: 'Nota' })
    expect(cuerpo.estado_fisico).toBeUndefined()
  })
})

describe('mapearErroresPorFila', () => {
  it('convierte la respuesta del backend en un error asociado a la fila', () => {
    expect(mapearErroresPorFila({ response: { data: { foto: ['Formato inválido.'], indice: 2 } } })).toEqual({
      2: { campo: 'foto', mensaje: 'Formato inválido.' },
    })
    expect(mapearErroresPorFila({ response: { data: { codigo_inventario: ['Duplicado.'] } } })).toEqual({})
  })
})
