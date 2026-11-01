import { describe, expect, it } from 'vitest'

import {
  obtenerEstadoGeneralInicial,
  obtenerInstanciasElegiblesEstadoGeneral,
  puedeCambiarEstadoGeneral,
} from './MaterialForm'

describe('estado general al editar material', () => {
  it.each(['prestado', 'reservado'])(
    'bloquea el cambio cuando todas las instancias están %s y conserva el estado actual',
    (estado) => {
      const material = {
        estado,
        instancias: [{ estado }],
      }

      expect(puedeCambiarEstadoGeneral(material)).toBe(false)
      expect(obtenerEstadoGeneralInicial(material)).toBe(estado)
    },
  )

  it('permite cambiar el estado si la única instancia está en mantenimiento', () => {
    const material = {
      estado: 'en_mantenimiento',
      instancias: [{ estado: 'en_mantenimiento' }],
    }

    expect(puedeCambiarEstadoGeneral(material)).toBe(true)
    expect(obtenerEstadoGeneralInicial(material)).toBe('en_mantenimiento')
  })

  it('considera elegibles solo las instancias disponibles o en mantenimiento', () => {
    const material = {
      estado: 'disponible',
      instancias: [
        { estado: 'disponible' },
        { estado: 'en_mantenimiento' },
        { estado: 'prestado' },
        { estado: 'reservado' },
      ],
    }

    expect(obtenerInstanciasElegiblesEstadoGeneral(material)).toEqual([
      { estado: 'disponible' },
      { estado: 'en_mantenimiento' },
    ])
    expect(puedeCambiarEstadoGeneral(material)).toBe(true)
  })
})
