import { describe, expect, it } from 'vitest'
import { normalizarTelefonoE164, validarTelefono } from './validaciones'

describe('validarTelefono', () => {
  it('rechaza teléfono vacío cuando es obligatorio', () => {
    expect(validarTelefono('', { obligatorio: true })).toBe(
      'El teléfono o celular es obligatorio.'
    )
    expect(validarTelefono('   ', { obligatorio: true })).toBe(
      'El teléfono o celular es obligatorio.'
    )
  })

  it('permite teléfono vacío cuando no es obligatorio', () => {
    expect(validarTelefono('', { obligatorio: false })).toBe('')
    expect(validarTelefono('   ', { obligatorio: false })).toBe('')
  })

  it('rechaza caracteres no permitidos', () => {
    expect(validarTelefono('98765abcd')).toBe(
      'El teléfono solo puede contener dígitos.'
    )
  })

  it('rechaza longitud insuficiente para celular peruano', () => {
    expect(validarTelefono('9876543')).toBe(
      'La longitud del número de teléfono o celular no es válida.'
    )
  })

  it('rechaza longitud excesiva para celular peruano', () => {
    expect(validarTelefono('987654321000')).toBe(
      'La longitud del número de teléfono o celular no es válida.'
    )
  })

  it('rechaza prefijo incoherente para celular peruano', () => {
    // 123456789 tiene 9 dígitos pero 1 no es prefijo móvil en Perú
    expect(validarTelefono('123456789')).toBe(
      'Ingresa un número de teléfono o celular válido.'
    )
  })

  it('acepta celular peruano válido de 9 dígitos', () => {
    expect(validarTelefono('987654321')).toBe('')
    expect(validarTelefono('912345678')).toBe('')
  })

  it('acepta número internacional válido con código de país', () => {
    // Chile móvil (+56 9 9123 4567)
    expect(validarTelefono('+56991234567')).toBe('')
    // USA móvil (+1 415 555 2671)
    expect(validarTelefono('+14155552671')).toBe('')
  })

  it('valida con respecto a un país seleccionado diferente', () => {
    // Número válido de Chile sin el '+56' si se especifica país CL
    expect(validarTelefono('991234567', { paisDefault: 'CL' })).toBe('')
    // Número inválido para Chile
    expect(validarTelefono('123', { paisDefault: 'CL' })).toBe(
      'La longitud del número de teléfono o celular no es válida.'
    )
  })
})

describe('normalizarTelefonoE164', () => {
  it('normaliza celular peruano a formato E.164 con +51', () => {
    expect(normalizarTelefonoE164('987654321', 'PE')).toBe('+51987654321')
  })

  it('mantiene prefijo en números internacionales válidos', () => {
    expect(normalizarTelefonoE164('+56991234567', 'PE')).toBe('+56991234567')
  })

  it('devuelve cadena vacía si el valor es vacío', () => {
    expect(normalizarTelefonoE164('')).toBe('')
    expect(normalizarTelefonoE164('   ')).toBe('')
  })
})
