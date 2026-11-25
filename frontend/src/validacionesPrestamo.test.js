import { describe, expect, it } from 'vitest'

import {
  ayudaRangoDuracion,
  calcularFechaLimiteEstimada,
  evaluarCambioDuracion,
  mapearErroresFotoChecklist,
  obtenerFechaMaximaFinPrestamo,
  obtenerMinutosMaximosMaterial,
  obtenerElementosSinFoto,
  validarFoto,
  validarFormularioPrestamo,
} from './validacionesPrestamo'
import { TAMANO_MAXIMO_GARANTIA_BYTES } from './constantes/garantia'
import {
  calcularMinutosDuracionPersonalizada,
  formatearDuracionMinutos,
  limitarValorCampoDuracion,
  TAMANO_MAXIMO_FOTO_CHECKLIST_BYTES,
} from './constantes/checklistPrestamo'

const formularioValido = {
  dni: '12345678',
  material: { id: 'mat-1', es_alto_valor: false },
  instanciaId: 'instancia-1',
  duracionValor: '4290',
  duracionUnidad: 'minutos',
  checklist: [{ elemento: 'Pantalla', observacion: '', foto: { name: 'pantalla.jpg', type: 'image/jpeg', size: 100 } }],
}

describe('validarFormularioPrestamo', () => {
  it('limita los días disponibles del préstamo según el máximo del material', () => {
    expect(
      obtenerFechaMaximaFinPrestamo('2026-10-23T09:00', { tiempo_maximo_prestamo: 60 }),
    ).toBe('2026-10-23')
    expect(
      obtenerFechaMaximaFinPrestamo('2026-10-23T09:00', { tiempo_maximo_prestamo: 1440 }),
    ).toBe('2026-10-24')
    expect(obtenerFechaMaximaFinPrestamo('', { tiempo_maximo_prestamo: 60 })).toBe('')
  })

  it('formatea duraciones combinando días, horas y minutos', () => {
    expect(formatearDuracionMinutos(45)).toBe('45 minutos')
    expect(formatearDuracionMinutos(60)).toBe('1 hora')
    expect(formatearDuracionMinutos(1500)).toBe('1 día y 1 hora')
    expect(formatearDuracionMinutos(1565)).toBe('1 día, 2 horas y 5 minutos')
  })

  it('convierte cualquier duración personalizada en horas y minutos dentro del rango', () => {
    expect(calcularMinutosDuracionPersonalizada('0', '7', '23')).toBe(443)
    expect(calcularMinutosDuracionPersonalizada('3', '0', '0')).toBe(4320)
    expect(calcularMinutosDuracionPersonalizada('4', '0', '0')).toBeNaN()
    expect(calcularMinutosDuracionPersonalizada('3', '0', '1')).toBeNaN()
    expect(calcularMinutosDuracionPersonalizada('0', '24', '0')).toBeNaN()
    expect(calcularMinutosDuracionPersonalizada('0', '1', '60')).toBeNaN()
  })

  it('limita cada campo editable a su máximo lógico al escribir', () => {
    expect(limitarValorCampoDuracion('tiempo_maximo_dias', '50')).toBe('3')
    expect(limitarValorCampoDuracion('tiempo_maximo_horas', '50')).toBe('23')
    expect(limitarValorCampoDuracion('tiempo_maximo_minutos', '60')).toBe('59')
  })

  it('acepta una entrega regular válida', () => {
    expect(validarFormularioPrestamo(formularioValido)).toEqual({})
  })

  it('requiere DNI de ocho dígitos, material, duración y checklist completos', () => {
    const errores = validarFormularioPrestamo({
      ...formularioValido,
      dni: 'abc',
      material: null,
      instanciaId: '',
      duracionValor: '',
      checklist: [{ elemento: '', observacion: '', foto: formularioValido.checklist[0].foto }],
    })

    expect(errores).toHaveProperty('dni')
    expect(errores).toHaveProperty('material')
    expect(errores).toHaveProperty('instancia_id')
    expect(errores).toHaveProperty('dias')
    expect(errores).toHaveProperty('checklist')
  })

  it('requiere seleccionar una instancia específica del material', () => {
    const errores = validarFormularioPrestamo({
      ...formularioValido,
      instanciaId: '',
    })

    expect(errores).toHaveProperty('instancia_id')
  })

  it('exige ambos PDF para un material de alto valor', () => {
    const errores = validarFormularioPrestamo({
      ...formularioValido,
      material: { id: 'mat-2', es_alto_valor: true },
    })

    expect(errores).toHaveProperty('documento_identidad')
    expect(errores).toHaveProperty('compromiso_responsabilidad')
  })

  it('exige ambos PDF cuando se registra una excepción académica', () => {
    const errores = validarFormularioPrestamo({
      ...formularioValido,
      esExcepcion: true,
    })

    expect(errores).toHaveProperty('documento_identidad')
    expect(errores).toHaveProperty('compromiso_responsabilidad')
  })

  it('no exige adjuntar PDFs de nuevo cuando la garantía de la reserva se reutiliza', () => {
    const errores = validarFormularioPrestamo({
      ...formularioValido,
      material: { id: 'mat-2', es_alto_valor: true },
      esExcepcion: true,
      garantiaReutilizada: true,
    })

    expect(errores).not.toHaveProperty('documento_identidad')
    expect(errores).not.toHaveProperty('compromiso_responsabilidad')
  })

  it('rechaza extensión, tipo MIME y tamaño incorrectos en los PDF', () => {
    const errores = validarFormularioPrestamo({
      ...formularioValido,
      material: { id: 'mat-2', es_alto_valor: true },
      documentoIdentidad: { name: 'dni.txt', type: 'application/pdf', size: 100 },
      compromisoResponsabilidad: {
        name: 'compromiso.pdf',
        type: 'text/plain',
        size: TAMANO_MAXIMO_GARANTIA_BYTES + 1,
      },
    })

    expect(errores.documento_identidad).toMatch(/extensión \.pdf/)
    expect(errores.compromiso_responsabilidad).toMatch(/application\/pdf/)
  })

  it('valida que fechaFin sea día laborable (lunes a viernes) entre 08:00 y 17:30', () => {
    // Sábado 2026-12-19
    const errSabado = validarFormularioPrestamo({
      ...formularioValido,
      fechaFin: '2026-12-19T14:00',
    })
    expect(errSabado.dias).toMatch(/día laborable/)

    // Domingo 2026-12-20
    const errDomingo = validarFormularioPrestamo({
      ...formularioValido,
      fechaFin: '2026-12-20T10:00',
    })
    expect(errDomingo.dias).toMatch(/día laborable/)

    // Lunes 2026-12-21 a las 18:30 (fuera de horario)
    const errHora = validarFormularioPrestamo({
      ...formularioValido,
      fechaFin: '2026-12-21T18:30',
    })
    expect(errHora.dias).toMatch(/08:00 y 17:30/)

    // Lunes 2026-12-21 a las 14:00 (válido)
    const valido = validarFormularioPrestamo({
      ...formularioValido,
      fechaFin: '2026-12-21T14:00',
    })
    expect(valido.dias).toBeUndefined()
  })

  it('rechaza un PDF que supera el tamaño máximo configurado', () => {
    const errores = validarFormularioPrestamo({
      ...formularioValido,
      material: { id: 'mat-2', es_alto_valor: true },
      documentoIdentidad: {
        name: 'dni.pdf',
        type: 'application/pdf',
        size: TAMANO_MAXIMO_GARANTIA_BYTES + 1,
      },
      compromisoResponsabilidad: {
        name: 'compromiso.pdf',
        type: 'application/pdf',
        size: 100,
      },
    })

    expect(errores.documento_identidad).toMatch(/no debe superar/)
    expect(errores).not.toHaveProperty('compromiso_responsabilidad')
  })

  it('calcula la fecha estimada y rechaza duraciones fuera del mínimo de 1 hora o máximo del material', () => {
    const fechaLimite = calcularFechaLimiteEstimada(3, 'horas', { tiempo_maximo_prestamo: 360 })

    expect(fechaLimite).toBeInstanceOf(Date)
    expect(calcularFechaLimiteEstimada(59, 'minutos')).toBeNull()
    expect(calcularFechaLimiteEstimada(9, 'horas', { tiempo_maximo_prestamo: 480 })).toBeNull()
    expect(calcularFechaLimiteEstimada(6, 'horas', { tier_minimo_requerido: 'avanzado' })).not.toBeNull()
  })

  it('limita la duración mínima a 1 hora y la máxima según el material (defaults por Tier)', () => {
    expect(obtenerMinutosMaximosMaterial({ tier_minimo_requerido: 'avanzado' })).toBe(4290)
    expect(obtenerMinutosMaximosMaterial({ tier_minimo_requerido: 'estandar' })).toBe(4290)
    expect(obtenerMinutosMaximosMaterial({ tier_minimo_requerido: 'restringido' })).toBe(4290)
    expect(obtenerMinutosMaximosMaterial({ tiempo_maximo_prestamo: 180 })).toBe(180)
    expect(obtenerMinutosMaximosMaterial({ tier_minimo_requerido: 'avanzado', tiempo_maximo_prestamo: 21600 })).toBe(4290)

    const excedePorTolerancia = validarFormularioPrestamo({
      ...formularioValido,
      duracionValor: '4320',
      duracionUnidad: 'minutos',
    })
    expect(excedePorTolerancia.dias).toContain('tolerancia de 30 minutos')

    const excesoSobreLimiteUniversal = validarFormularioPrestamo({
      ...formularioValido,
      material: { id: 'legado', tiempo_maximo_prestamo: 10080 },
      duracionValor: '4',
      duracionUnidad: 'dias',
    })
    expect(excesoSobreLimiteUniversal.dias).toContain('2 días, 23 horas y 30 minutos')

    expect(
      validarFormularioPrestamo({
        ...formularioValido,
        duracionValor: '59',
        duracionUnidad: 'minutos',
      }).dias,
    ).toBe('El tiempo mínimo de préstamo es de 1 hora (60 minutos).')

    expect(
      validarFormularioPrestamo({
        ...formularioValido,
        material: { id: 'vr-1', es_alto_valor: false, tier_minimo_requerido: 'avanzado', tiempo_maximo_prestamo: 21600 },
        duracionValor: '7',
        duracionUnidad: 'horas',
      }).dias,
    ).toBeUndefined()

    expect(
      validarFormularioPrestamo({
        ...formularioValido,
        material: { id: 'vr-1', es_alto_valor: false, tier_minimo_requerido: 'avanzado' },
        duracionValor: '6',
        duracionUnidad: 'horas',
      }),
    ).toEqual({})

    expect(ayudaRangoDuracion({ tier_minimo_requerido: 'avanzado' })).toMatch(/2 días, 23 horas y 30 minutos/)
    expect(ayudaRangoDuracion({ tier_minimo_requerido: 'avanzado' })).toMatch(/tolerancia de 30 minutos/)
  })

  it('conserva el último valor válido y avisa ante duraciones fuera del rango permitido', () => {
    const materialVr = { tier_minimo_requerido: 'avanzado', tiempo_maximo_prestamo: 360 }
    expect(evaluarCambioDuracion('59', '30', 'minutos', materialVr)).toEqual({
      valor: '30',
      error: 'El tiempo mínimo de préstamo es de 1 hora (60 minutos).',
    })
    expect(evaluarCambioDuracion('7', '6', 'horas', materialVr)).toEqual({
      valor: '6',
      error: 'El tiempo solicitado supera el máximo permitido para este material (6 horas).',
    })
    expect(evaluarCambioDuracion('-1', '3', 'horas', materialVr)).toEqual({
      valor: '3',
      error: 'La duración pactada debe ser de al menos 1 hora (60 minutos) y máximo 6 horas; la tolerancia de 30 minutos queda dentro del máximo total de 3 días.',
    })
    expect(evaluarCambioDuracion('0', '3', 'horas', materialVr)).toEqual({
      valor: '3',
      error: 'La duración pactada debe ser de al menos 1 hora (60 minutos) y máximo 6 horas; la tolerancia de 30 minutos queda dentro del máximo total de 3 días.',
    })
    expect(evaluarCambioDuracion('1.5', '3', 'horas', materialVr)).toEqual({
      valor: '3',
      error: 'La duración pactada debe ser de al menos 1 hora (60 minutos) y máximo 6 horas; la tolerancia de 30 minutos queda dentro del máximo total de 3 días.',
    })
    expect(evaluarCambioDuracion('6', '3', 'horas', materialVr)).toEqual({ valor: '6', error: '' })
    expect(evaluarCambioDuracion('60', '30', 'minutos', materialVr)).toEqual({ valor: '60', error: '' })
    expect(evaluarCambioDuracion('', '3', 'horas', materialVr)).toEqual({ valor: '', error: '' })
  })

  it('requiere fotos válidas por elemento y permite observación opcional', () => {
    const errores = validarFormularioPrestamo({
      ...formularioValido,
      checklist: [
        { elemento: 'Pantalla', observacion: '', foto: null },
        { elemento: 'Teclado', observacion: 'Revisado', foto: formularioValido.checklist[0].foto },
      ],
    })

    expect(errores.fotosChecklist[0]).toMatch(/Adjunta una foto/)
    expect(errores.fotosChecklist).not.toHaveProperty('1')
  })

  it('valida extensión, tipo MIME y tamaño de fotos', () => {
    expect(validarFoto({ name: 'captura.gif', type: 'image/gif', size: 10 })).toMatch(/JPG, PNG o WEBP/)
    expect(validarFoto({ name: 'captura.png', type: 'text/plain', size: 10 })).toMatch(/tipo JPG/)
    expect(validarFoto({
      name: 'captura.png',
      type: 'image/png',
      size: TAMANO_MAXIMO_FOTO_CHECKLIST_BYTES + 1,
    })).toMatch(/no debe superar/)
  })

  it('identifica las filas que no tienen foto para mostrarlas en la advertencia', () => {
    expect(obtenerElementosSinFoto([
      { elemento: 'Pantalla', foto: null },
      { elemento: 'Teclado', foto: { name: 'teclado.png' } },
      { elemento: '', foto: null },
    ])).toEqual([
      { indice: 0, elemento: 'Pantalla' },
      { indice: 2, elemento: 'Elemento 3' },
    ])
  })

  it('mapea los errores de foto del backend a sus índices de fila', () => {
    expect(mapearErroresFotoChecklist({ 1: ['La imagen no es válida.'] })).toEqual({
      1: 'La imagen no es válida.',
    })
    expect(mapearErroresFotoChecklist(null)).toEqual({})
  })
})
