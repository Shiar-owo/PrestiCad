import { describe, expect, it } from 'vitest'

import { construirSolicitudPrestamo } from './solicitudPrestamo'

describe('construirSolicitudPrestamo', () => {
  it('construye multipart con instancia, fotos, checklist y ambos PDF', () => {
    const documentoIdentidad = new File(['%PDF-'], 'dni.pdf', { type: 'application/pdf' })
    const compromisoResponsabilidad = new File(['%PDF-'], 'compromiso.pdf', {
      type: 'application/pdf',
    })
    const foto = new File(['imagen'], 'pantalla.jpg', { type: 'image/jpeg' })
    const solicitud = construirSolicitudPrestamo({
      dni: ' 12345678 ',
      material: { id: 'material-1', es_alto_valor: true },
      instanciaId: 'instancia-1',
      dias: '5',
      checklist: [{ elemento: ' Equipo ', observacion: ' Revisado ', foto }],
      documentoIdentidad,
      compromisoResponsabilidad,
    })

    expect(solicitud).toBeInstanceOf(FormData)
    expect(solicitud.get('dni_prestatario')).toBe('12345678')
    expect(solicitud.get('material_id')).toBe('material-1')
    expect(solicitud.get('instancia_id')).toBe('instancia-1')
    expect(solicitud.get('tiempo_prestamo_dias')).toBe('5')
    expect(JSON.parse(solicitud.get('checklist_inicial'))).toEqual([
      { elemento: 'Equipo', observacion: 'Revisado' },
    ])
    expect(solicitud.get('foto_checklist_0')).toBe(foto)
    expect(solicitud.get('documento_identidad').name).toBe('dni.pdf')
    expect(solicitud.get('compromiso_responsabilidad').name).toBe('compromiso.pdf')
  })

  it('omite los campos PDF cuando el material no requiere garantía', () => {
    const solicitud = construirSolicitudPrestamo({
      dni: '12345678',
      material: { id: 'material-1', es_alto_valor: false },
      instanciaId: 'instancia-1',
      dias: '5',
      checklist: [{ elemento: 'Equipo', observacion: '', foto: new File(['foto'], 'equipo.png', { type: 'image/png' }) }],
      documentoIdentidad: new File(['%PDF-'], 'dni.pdf', { type: 'application/pdf' }),
      compromisoResponsabilidad: new File(['%PDF-'], 'compromiso.pdf', {
        type: 'application/pdf',
      }),
    })

    expect(solicitud.has('documento_identidad')).toBe(false)
    expect(solicitud.has('compromiso_responsabilidad')).toBe(false)
  })
})
