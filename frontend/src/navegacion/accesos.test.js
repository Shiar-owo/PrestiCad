import { describe, expect, it } from 'vitest'

import { ACCESOS_POR_ROL, rutaAccesoActiva } from './accesos'

describe('accesos por rol', () => {
  it.each([
    ['prestatario', ['Mis Préstamos', 'Mis reservas'], ['/panel/prestamos', '/panel/reservas']],
    ['gestor', ['Préstamos', 'Reservas', 'Inventario'], ['/panel/gestion-prestamos', '/panel/cola-reservas', '/panel/inventario']],
    ['administrador', ['Préstamos', 'Reservas', 'Inventario', 'Usuarios', 'Calendario'], ['/panel/gestion-prestamos', '/panel/cola-reservas', '/panel/inventario', '/admin/roles', '/admin/dias-no-laborables']],
  ])('define etiquetas y destinos correctos para %s', (rol, etiquetas, destinos) => {
    expect(ACCESOS_POR_ROL[rol].map(({ etiqueta }) => etiqueta)).toEqual(etiquetas)
    expect(ACCESOS_POR_ROL[rol].map(({ a }) => a)).toEqual(destinos)
  })
})

describe('rutaAccesoActiva', () => {
  it('mantiene activo el acceso correspondiente en rutas anidadas', () => {
    expect(rutaAccesoActiva('reservas', '/panel/reservas/nueva')).toBe(true)
    expect(rutaAccesoActiva('reservas', '/panel/cola-reservas')).toBe(true)
    expect(rutaAccesoActiva('prestamos', '/panel/devolucion/42')).toBe(true)
    expect(rutaAccesoActiva('inventario', '/panel/inventario/9/historial')).toBe(true)
    expect(rutaAccesoActiva('calendario', '/admin/dias-no-laborables')).toBe(true)
  })
})
