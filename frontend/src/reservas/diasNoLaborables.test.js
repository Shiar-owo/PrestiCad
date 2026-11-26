import { describe, expect, it } from 'vitest'

import {
  buscarDiaNoLaborable,
  crearMapaDiasNoLaborables,
  extraerFechaIso,
  formatearFechaCortaIso,
} from './diasNoLaborables'
import { validarHorarioReserva } from './estadoReserva'
import { validarFormularioPrestamo } from '../validacionesPrestamo'

describe('diasNoLaborables', () => {
  const feriados = [
    { id: 1, fecha: '2026-12-25', motivo: 'Navidad' },
    { id: 2, fecha: '2027-01-01', motivo: 'Año Nuevo' },
  ]

  it('extrae fecha ISO y busca coincidencias con motivo', () => {
    expect(extraerFechaIso('2026-12-25T10:30')).toBe('2026-12-25')
    expect(buscarDiaNoLaborable('2026-12-25T10:30', feriados)).toEqual({
      id: 1,
      fecha: '2026-12-25',
      motivo: 'Navidad',
      creado_por_nombre: '',
      created_at: null,
    })
    expect(buscarDiaNoLaborable('2026-12-28T10:30', feriados)).toBeNull()
    expect(crearMapaDiasNoLaborables(feriados).get('2027-01-01')?.motivo).toBe('Año Nuevo')
    expect(formatearFechaCortaIso('2026-12-25')).toBe('25/12/2026')
  })

  it('rechaza reservas que inician o terminan en un día inhabilitado', () => {
    const errores = validarHorarioReserva(
      undefined,
      undefined,
      undefined,
      false,
      '2026-12-25T10:00',
      '2026-12-25T13:00',
      null,
      feriados,
    )
    expect(errores.fechaInicio).toContain('Navidad')
    expect(errores.fechaFin).toContain('Navidad')
  })

  it('rechaza préstamos cuya devolución cae en un día inhabilitado', () => {
    const errores = validarFormularioPrestamo({
      dni: '12345678',
      material: { id: 'm1', tiempo_maximo_prestamo: 1440 },
      instanciaId: 'i1',
      duracionValor: 120,
      duracionUnidad: 'minutos',
      checklist: [{ elemento: 'Equipo', foto: { name: 'a.jpg', type: 'image/jpeg', size: 1000 } }],
      fechaFin: '2026-12-25T14:00',
      diasNoLaborables: feriados,
    })
    expect(errores.dias).toContain('Navidad')
  })
})
