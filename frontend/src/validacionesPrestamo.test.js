import { describe, expect, it } from 'vitest'

import {
  ayudaRangoDuracion,
  calcularFechaLimiteEstimada,
  evaluarCambioDuracion,
  mapearErroresFotoChecklist,
  obtenerMinutosMaximosMaterial,
  obtenerElementosSinFoto,
  validarFoto,
  validarFormularioPrestamo,
} from './validacionesPrestamo'
import { TAMANO_MAXIMO_GARANTIA_BYTES } from './constantes/garantia'
import { TAMANO_MAXIMO_FOTO_CHECKLIST_BYTES } from './constantes/checklistPrestamo'

const formularioValido = {
  dni: '12345678',
  material: { id: 'mat-1', es_alto_valor: false },
  instanciaId: 'instancia-1',
  dias: '5',
  checklist: [{ elemento: 'Pantalla', observacion: '', foto: { name: 'pantalla.jpg', type: 'image/jpeg', size: 100 } }],
}

describe('validarFormularioPrestamo', () => {
  it('acepta una entrega regular válida', () => {
    expect(validarFormularioPrestamo(formularioValido)).toEqual({})
  })

  it('requiere DNI de ocho dígitos, material, duración y checklist completos', () => {
    const errores = validarFormularioPrestamo({
      ...formularioValido,
      dni: 'abc',
      material: null,
      instanciaId: '',
      dias: 0,
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

  it('calcula la fecha estimada y rechaza duraciones fuera del mínimo de 15 min o máximo del material', () => {
    const fechaLimite = calcularFechaLimiteEstimada(3, 'horas', { tiempo_maximo_prestamo: 360 })

    expect(fechaLimite).toBeInstanceOf(Date)
    expect(calcularFechaLimiteEstimada(10, 'minutos')).toBeNull()
    expect(calcularFechaLimiteEstimada(7, 'horas', { tiempo_maximo_prestamo: 360 })).toBeNull()
    expect(calcularFechaLimiteEstimada(6, 'horas', { tier_minimo_requerido: 'avanzado' })).not.toBeNull()
  })

  it('limita la duración mínima a 15 minutos y la máxima según el material (defaults por Tier)', () => {
    expect(obtenerMinutosMaximosMaterial({ tier_minimo_requerido: 'avanzado' })).toBe(360)
    expect(obtenerMinutosMaximosMaterial({ tier_minimo_requerido: 'estandar' })).toBe(1440)
    expect(obtenerMinutosMaximosMaterial({ tier_minimo_requerido: 'restringido' })).toBe(4320)
    expect(obtenerMinutosMaximosMaterial({ tiempo_maximo_prestamo: 180 })).toBe(180)

    expect(
      validarFormularioPrestamo({
        ...formularioValido,
        duracionValor: '10',
        duracionUnidad: 'minutos',
      }).dias,
    ).toBe('El tiempo mínimo de préstamo es de 15 minutos.')

    expect(
      validarFormularioPrestamo({
        ...formularioValido,
        material: { id: 'vr-1', es_alto_valor: false, tier_minimo_requerido: 'avanzado' },
        duracionValor: '7',
        duracionUnidad: 'horas',
      }).dias,
    ).toBe('El tiempo solicitado supera el máximo permitido para este material (6 horas).')

    expect(
      validarFormularioPrestamo({
        ...formularioValido,
        material: { id: 'vr-1', es_alto_valor: false, tier_minimo_requerido: 'avanzado' },
        duracionValor: '6',
        duracionUnidad: 'horas',
      }),
    ).toEqual({})

    expect(ayudaRangoDuracion({ tier_minimo_requerido: 'avanzado' })).toMatch(/6 horas/)
    expect(ayudaRangoDuracion({ tier_minimo_requerido: 'avanzado' })).toMatch(/30 min de tiempo de gracia/)
  })

  it('conserva el último valor válido y avisa ante duraciones fuera del rango permitido', () => {
    const materialVr = { tier_minimo_requerido: 'avanzado' }
    expect(evaluarCambioDuracion('10', '30', 'minutos', materialVr)).toEqual({
      valor: '30',
      error: 'El tiempo mínimo de préstamo es de 15 minutos.',
    })
    expect(evaluarCambioDuracion('7', '6', 'horas', materialVr)).toEqual({
      valor: '6',
      error: 'El tiempo solicitado supera el máximo permitido para este material (6 horas).',
    })
    expect(evaluarCambioDuracion('-1', '3', 'horas', materialVr)).toEqual({
      valor: '3',
      error: 'La duración debe ser de al menos 15 minutos y máximo 6 horas.',
    })
    expect(evaluarCambioDuracion('0', '3', 'horas', materialVr)).toEqual({
      valor: '3',
      error: 'La duración debe ser de al menos 15 minutos y máximo 6 horas.',
    })
    expect(evaluarCambioDuracion('1.5', '3', 'horas', materialVr)).toEqual({
      valor: '3',
      error: 'La duración debe ser de al menos 15 minutos y máximo 6 horas.',
    })
    expect(evaluarCambioDuracion('6', '3', 'horas', materialVr)).toEqual({ valor: '6', error: '' })
    expect(evaluarCambioDuracion('15', '30', 'minutos', materialVr)).toEqual({ valor: '15', error: '' })
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
