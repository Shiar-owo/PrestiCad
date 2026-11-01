import { describe, expect, it } from 'vitest'

import {
  construirCuerpoAltaInstancias,
  mapearErroresAltaInstancias,
  redimensionarFilasAlta,
  validarFilasAlta,
} from './agregarEjemplares'

describe('redimensionarFilasAlta', () => {
  it('sugiere códigos siguientes, conserva filas y genera identificadores nuevos una sola vez', () => {
    const material = {
      codigo_material: 'TAB-01',
      stock: 3,
      instancias: [{ codigo_ejemplar: 'TAB-01-04' }],
    }
    const ids = ['nueva-1', 'nueva-2', 'nueva-3']
    const generarId = () => ids.shift()
    const iniciales = redimensionarFilasAlta([], 2, material, generarId)
    iniciales[0].numero_serie = 'SERIE-5'

    const ampliadas = redimensionarFilasAlta(iniciales, 3, material, generarId)
    const reducidas = redimensionarFilasAlta(ampliadas, 1, material, generarId)

    expect(ampliadas.map((fila) => [fila.id, fila.codigo_ejemplar])).toEqual([
      ['nueva-1', 'TAB-01-05'],
      ['nueva-2', 'TAB-01-06'],
      ['nueva-3', 'TAB-01-07'],
    ])
    expect(ampliadas[0].numero_serie).toBe('SERIE-5')
    expect(reducidas).toEqual([ampliadas[0]])
    expect(generarId()).toBeUndefined()
  })

  it('limita la cantidad al máximo y evita códigos ya registrados ignorando mayúsculas', () => {
    let siguienteId = 0
    const material = {
      codigo_material: 'KIT',
      stock: 1,
      instancias: [{ codigo_ejemplar: 'kit-02' }],
    }

    const filas = redimensionarFilasAlta([], 51, material, () => `id-${++siguienteId}`)

    expect(filas).toHaveLength(50)
    expect(filas[0].codigo_ejemplar).toBe('KIT-03')
    expect(new Set(filas.map((fila) => fila.codigo_ejemplar.toLowerCase())).size).toBe(50)
  })
})

describe('validarFilasAlta', () => {
  it('marca códigos vacíos, existentes y duplicados dentro del alta sin distinguir mayúsculas', () => {
    const errores = validarFilasAlta([
      { codigo_ejemplar: ' ' },
      { codigo_ejemplar: 'tab-01-01' },
      { codigo_ejemplar: 'Nuevo-01' },
      { codigo_ejemplar: ' nuevo-01 ' },
    ], {
      instancias: [{ codigo_ejemplar: 'TAB-01-01' }],
    })

    expect(errores).toEqual([
      { indice: 0, campo: 'codigo_ejemplar', mensaje: 'El código del ejemplar es obligatorio.' },
      { indice: 1, campo: 'codigo_ejemplar', mensaje: 'El código ya pertenece a un ejemplar de este material.' },
      { indice: 3, campo: 'codigo_ejemplar', mensaje: 'El código está repetido (fila 3).' },
    ])
  })

  it('valida el formato de foto y asocia el error con su fila', () => {
    const fotoValida = new File(['imagen'], 'foto.png', { type: 'image/png' })
    const fotoInvalida = new File(['imagen'], 'foto.gif', { type: 'image/gif' })

    expect(validarFilasAlta([
      { codigo_ejemplar: 'EQ-01', foto: fotoValida },
      { codigo_ejemplar: 'EQ-02', foto: fotoInvalida },
    ], {})).toEqual([
      { indice: 1, campo: 'foto', mensaje: 'La foto debe estar en formato JPG, PNG o WEBP.' },
    ])
  })
})

describe('construirCuerpoAltaInstancias', () => {
  const filas = [
    {
      codigo_ejemplar: ' EQ-01 ',
      numero_serie: 'SER-01',
      color: 'Azul',
      estado: 'en_mantenimiento',
      observaciones: 'Sin marcas',
      foto: null,
    },
    {
      codigo_ejemplar: 'EQ-02',
      numero_serie: '',
      color: '',
      ubicacion: '',
      observaciones: '',
      foto: null,
    },
  ]

  it('construye una lista JSON con datos normalizados cuando no hay fotos', () => {
    expect(construirCuerpoAltaInstancias(filas)).toEqual({
      instancias: [
        {
          codigo_ejemplar: 'EQ-01',
          numero_serie: 'SER-01',
          color: 'Azul',
          estado: 'en_mantenimiento',
          observaciones: 'Sin marcas',
        },
        {
          codigo_ejemplar: 'EQ-02',
          numero_serie: '',
          color: '',
          estado: 'disponible',
          ubicacion: '',
          observaciones: '',
        },
      ],
    })
  })

  it('construye multipart y asigna las fotos al índice de cada fila', () => {
    const foto = new File(['imagen'], 'ejemplar.jpg', { type: 'image/jpeg' })
    const cuerpo = construirCuerpoAltaInstancias([
      filas[0],
      { ...filas[1], foto },
    ])

    expect(cuerpo).toBeInstanceOf(FormData)
    expect(JSON.parse(cuerpo.get('instancias'))[1].codigo_ejemplar).toBe('EQ-02')
    expect(cuerpo.get('instancia_foto_0')).toBeNull()
    expect(cuerpo.get('instancia_foto_1').name).toBe('ejemplar.jpg')
  })
})

describe('mapearErroresAltaInstancias', () => {
  it('mapea errores de servicio con índice y campo', () => {
    expect(mapearErroresAltaInstancias({
      datos: { indice: 1, campo: 'codigo_ejemplar', mensaje: 'El código ya está registrado.' },
    })).toEqual({
      1: { codigo_ejemplar: 'El código ya está registrado.' },
    })
  })

  it('mapea los errores de validación del serializador por fila', () => {
    expect(mapearErroresAltaInstancias({
      response: {
        data: {
          instancias: [
            {},
            { foto: ['La foto no es válida.'], codigo_ejemplar: ['Este campo es obligatorio.'] },
          ],
        },
      },
    })).toEqual({
      1: { foto: 'La foto no es válida.', codigo_ejemplar: 'Este campo es obligatorio.' },
    })
  })
})
