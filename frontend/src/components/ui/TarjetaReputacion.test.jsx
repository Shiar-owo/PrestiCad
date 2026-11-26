import { describe, expect, it } from 'vitest'
import { calcularPorcentajeBarra, CONFIG_TIER, TOPES_SEMANALES_DEFAULT } from './TarjetaReputacion'

describe('TarjetaReputacion - Funciones y Configuración de Tiers', () => {
  it('contiene la configuración y descriptores para avanzado, estandar y restringido', () => {
    expect(CONFIG_TIER.avanzado).toBeDefined()
    expect(CONFIG_TIER.estandar).toBeDefined()
    expect(CONFIG_TIER.restringido).toBeDefined()

    expect(CONFIG_TIER.avanzado.nombre).toBe('Avanzado')
    expect(CONFIG_TIER.estandar.nombre).toBe('Estándar')
    expect(CONFIG_TIER.restringido.nombre).toBe('Restringido')

    expect(CONFIG_TIER.avanzado.rango).toBe('201 a 500 puntos')
    expect(CONFIG_TIER.estandar.rango).toBe('-50 a 200 puntos')
    expect(CONFIG_TIER.restringido.rango).toBe('-500 a -51 puntos')
    expect(CONFIG_TIER.avanzado.descripcion).not.toContain('sin restricciones de garantía')
  })

  it('define los topes semanales de bonificación por tier (restringido=30, estandar=60, avanzado=80)', () => {
    expect(TOPES_SEMANALES_DEFAULT).toBeDefined()
    expect(TOPES_SEMANALES_DEFAULT.restringido).toBe(30)
    expect(TOPES_SEMANALES_DEFAULT.estandar).toBe(60)
    expect(TOPES_SEMANALES_DEFAULT.avanzado).toBe(80)
  })

  it('calcula correctamente el porcentaje de barra en los rangos límites y neutro', () => {
    // Puntaje mínimo (-500) -> 0%
    expect(calcularPorcentajeBarra(-500)).toBe(0)

    // Puntaje neutro (0) -> 50%
    expect(calcularPorcentajeBarra(0)).toBe(50)

    // Puntaje máximo (+500) -> 100%
    expect(calcularPorcentajeBarra(500)).toBe(100)

    // Clamping fuera de rango
    expect(calcularPorcentajeBarra(-1000)).toBe(0)
    expect(calcularPorcentajeBarra(1000)).toBe(100)
  })

  it('calcula porcentajes proporcionales para puntajes intermedios', () => {
    // +250 pts -> 75%
    expect(calcularPorcentajeBarra(250)).toBe(75)

    // -250 pts -> 25%
    expect(calcularPorcentajeBarra(-250)).toBe(25)
  })
})
