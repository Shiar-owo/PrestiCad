import { describe, expect, it } from 'vitest'

import { TAMANO_MAXIMO_SOLICITUD_BYTES } from '../prestamos/tamanoSolicitud'
import {
  construirFormularioReservaExcepcional,
  contarReservasActivas,
  esElegiblePorTier,
  esReservaActiva,
  formatearFechaReserva,
  obtenerMotivoVisibleReserva,
  ordenarColaReservas,
  presentarEstadoReserva,
  requiereExcepcionAcademica,
  textoEstadoReserva,
  validarFormularioReserva,
} from './estadoReserva'

describe('helpers de estado y elegibilidad de reserva', () => {
  it('presenta cada estado de reserva y agrega el sufijo de excepción', () => {
    expect(presentarEstadoReserva('en_espera').texto).toBe('En espera')
    expect(presentarEstadoReserva('reservada').texto).toBe('Reservada')
    expect(presentarEstadoReserva('cancelada_por_vencimiento').texto).toBe(
      'Cancelada por vencimiento',
    )
    expect(presentarEstadoReserva('inexistente').texto).toBe('Estado desconocido')

    expect(textoEstadoReserva({ estado: 'reservada', es_excepcion: true })).toBe(
      'Reservada - Excepción',
    )
    expect(textoEstadoReserva({ estado: 'en_espera', es_excepcion: true })).toBe(
      'En espera - Excepción',
    )
    expect(
      textoEstadoReserva({
        estado: 'en_espera',
        es_excepcion: true,
        excepcion_aprobada: true,
      }),
    ).toBe('En espera (Excepción aprobada)')
    expect(textoEstadoReserva({ estado: 'reservada', es_excepcion: false })).toBe(
      'Reservada',
    )
  })

  it('cuenta solo solicitudes en_espera y reservada como activas', () => {
    const reservas = [
      { id: '1', estado: 'en_espera' },
      { id: '2', estado: 'reservada' },
      { id: '3', estado: 'expirada' },
      { id: '4', estado: 'rechazada' },
      { id: '5', estado: 'cancelada' },
      { id: '6', estado: 'cancelada_por_vencimiento' },
      { id: '7', estado: 'convertida_en_prestamo' },
    ]
    expect(esReservaActiva(reservas[0])).toBe(true)
    expect(esReservaActiva(reservas[2])).toBe(false)
    expect(contarReservasActivas(reservas)).toBe(2)
  })

  it('evalúa elegibilidad por Tier y detección de excepción académica', () => {
    expect(esElegiblePorTier('avanzado', 'avanzado')).toBe(true)
    expect(esElegiblePorTier('avanzado', 'estandar')).toBe(true)
    expect(esElegiblePorTier('estandar', 'avanzado')).toBe(false)
    expect(esElegiblePorTier('restringido', 'estandar')).toBe(false)

    expect(requiereExcepcionAcademica('restringido', 'estandar')).toBe(true)
    expect(requiereExcepcionAcademica('restringido', 'avanzado')).toBe(true)
    expect(requiereExcepcionAcademica('restringido', 'restringido')).toBe(false)
    expect(requiereExcepcionAcademica('estandar', 'avanzado')).toBe(true)
    expect(requiereExcepcionAcademica('estandar', 'estandar')).toBe(false)
    expect(requiereExcepcionAcademica('avanzado', 'avanzado')).toBe(false)
  })
})

describe('ordenarColaReservas', () => {
  it('ordena por antigüedad FIFO y desempata por Tier descendente', () => {
    const desordenadas = [
      {
        id: 'temprana-restringido',
        fecha_creacion: '2026-04-10T08:00:00Z',
        usuario: { reputacion_tier: 'restringido' },
      },
      {
        id: 'tardia-avanzado',
        fecha_creacion: '2026-04-10T10:00:00Z',
        usuario: { reputacion_tier: 'avanzado' },
      },
      {
        id: 'intermedia-estandar',
        fecha_creacion: '2026-04-10T09:00:00Z',
        usuario: { reputacion_tier: 'estandar' },
      },
      {
        id: 'intermedia-avanzado',
        fecha_creacion: '2026-04-10T09:00:00Z',
        usuario: { reputacion_tier: 'avanzado' },
      },
    ]

    const ordenadas = ordenarColaReservas(desordenadas)
    expect(ordenadas.map((r) => r.id)).toEqual([
      'temprana-restringido',
      'intermedia-avanzado',
      'intermedia-estandar',
      'tardia-avanzado',
    ])
  })
})

describe('construirFormularioReservaExcepcional y validarFormularioReserva', () => {
  it('construye FormData con material_id, justificacion y ambos PDFs', () => {
    const dniPdf = new File(['%PDF-1.4'], 'dni.pdf', { type: 'application/pdf' })
    const compromisoPdf = new File(['%PDF-1.4'], 'compromiso.pdf', {
      type: 'application/pdf',
    })

    const form = construirFormularioReservaExcepcional({
      materialId: 'mat-uuid-1',
      justificacion: ' Práctica de laboratorio final ',
      documentoIdentidad: dniPdf,
      compromisoResponsabilidad: compromisoPdf,
    })

    expect(form).toBeInstanceOf(FormData)
    expect(form.get('material_id')).toBe('mat-uuid-1')
    expect(form.get('justificacion')).toBe('Práctica de laboratorio final')
    expect(form.get('documento_identidad')).toBe(dniPdf)
    expect(form.get('compromiso_responsabilidad')).toBe(compromisoPdf)
  })

  it('valida campos obligatorios y límite total de 4 MB en excepción académica', () => {
    const erroresVacio = validarFormularioReserva({
      materialId: '',
      justificacion: '   ',
      esExcepcion: true,
    })
    expect(erroresVacio).toHaveProperty('materialId')
    expect(erroresVacio).toHaveProperty('justificacion')
    expect(erroresVacio).toHaveProperty('documentoIdentidad')
    expect(erroresVacio).toHaveProperty('compromisoResponsabilidad')

    const archivoPesado = new Blob(
      [new Uint8Array(Math.floor(TAMANO_MAXIMO_SOLICITUD_BYTES / 2) + 1024)],
      { type: 'application/pdf' },
    )
    const erroresPeso = validarFormularioReserva({
      materialId: 'mat-1',
      justificacion: 'Tesis',
      esExcepcion: true,
      documentoIdentidad: archivoPesado,
      compromisoResponsabilidad: archivoPesado,
    })
    expect(erroresPeso.archivos).toMatch(/4 MB/)
  })
})

describe('presentación de motivos y fechas', () => {
  it('devuelve el motivo correspondiente según el estado de la reserva', () => {
    expect(
      obtenerMotivoVisibleReserva({
        estado: 'rechazada',
        motivo_rechazo: 'Documentación ilegible',
      }),
    ).toBe('Documentación ilegible')
    expect(
      obtenerMotivoVisibleReserva({
        estado: 'cancelada',
        motivo_cancelacion: 'Mantenimiento urgente del equipo',
      }),
    ).toBe('Mantenimiento urgente del equipo')
    expect(obtenerMotivoVisibleReserva(null)).toBe('')
  })

  it('formatea fechas válidas y maneja valores vacíos', () => {
    expect(formatearFechaReserva(null)).toBe('No disponible')
    expect(formatearFechaReserva('2026-04-12T15:30:00Z')).toEqual(expect.any(String))
  })
})
