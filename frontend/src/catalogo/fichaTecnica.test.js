import { describe, expect, it } from 'vitest'

import { formatearMoneda, obtenerDatosFichaTecnica } from './fichaTecnica'

describe('formatearMoneda', () => {
  it('formatea números a formato de moneda peruana S/.', () => {
    expect(formatearMoneda(150)).toBe('S/. 150.00')
    expect(formatearMoneda('45.5')).toBe('S/. 45.50')
    expect(formatearMoneda(0)).toBe('S/. 0.00')
  })

  it('retorna null para valores vacíos o inválidos', () => {
    expect(formatearMoneda(null)).toBeNull()
    expect(formatearMoneda(undefined)).toBeNull()
    expect(formatearMoneda('')).toBeNull()
    expect(formatearMoneda('invalido')).toBeNull()
  })
})

describe('obtenerDatosFichaTecnica', () => {
  it('retorna null si el material es nulo o indefinido', () => {
    expect(obtenerDatosFichaTecnica(null)).toBeNull()
    expect(obtenerDatosFichaTecnica(undefined)).toBeNull()
  })

  it('extrae las especificaciones completas de hardware del material', () => {
    const material = {
      id: 'abc-123',
      nombre: 'Osciloscopio Digital 100MHz',
      descripcion: 'Osciloscopio de 2 canales para prácticas de laboratorio.',
      codigo_inventario: 'EQ-OSC-01',
      tipo: 'equipo',
      estado: 'disponible',
      marca: 'Rigol',
      modelo: 'DS1054Z',
      numero_serie: 'SN-987654321',
      color: 'Gris oscuro',
      estado_fisico: 'Excelente',
      es_alto_valor: true,
      stock: 4,
      unidades_disponibles: 3,
      tier_minimo_requerido: 'avanzado',
      bonificacion_tiempo: 8,
      deduccion_tardanza: 15,
      deduccion_dano_parcial: 40,
      deduccion_dano_total: 100,
      costo_reparacion: 120.0,
      costo_reposicion: 1500.0,
      foto: 'https://ejemplo.com/foto.jpg',
    }

    const ficha = obtenerDatosFichaTecnica(material)

    expect(ficha).toEqual({
      id: 'abc-123',
      nombre: 'Osciloscopio Digital 100MHz',
      descripcion: 'Osciloscopio de 2 canales para prácticas de laboratorio.',
      codigoInventario: 'EQ-OSC-01',
      tipo: 'equipo',
      tipoLegible: 'Equipo',
      estado: 'disponible',
      estadoLegible: 'Disponible',
      foto: 'https://ejemplo.com/foto.jpg',
      esAltoValor: true,
      stockTotal: 4,
      unidadesDisponibles: 3,
      hayDisponibilidad: true,
      marca: 'Rigol',
      modelo: 'DS1054Z',
      numeroSerie: 'SN-987654321',
      color: 'Gris oscuro',
      estadoFisico: 'Excelente',
      tierMinimo: 'avanzado',
      tierMinimoLegible: 'Avanzado',
      bonificacionTiempo: 8,
      deduccionTardanza: 15,
      deduccionDanoParcial: 40,
      deduccionDanoTotal: 100,
      costoReparacionTexto: 'S/. 120.00',
      costoReposicionTexto: 'S/. 1500.00',
      instancias: [],
      resumenInstancias: {
        total: 4,
        disponible: 3,
        reservado: 0,
        prestado: 0,
        en_mantenimiento: 0,
        de_baja: 0,
      },
    })
  })

  it('procesa correctamente la lista de instancias físicas y su estado', () => {
    const materialConInstancias = {
      nombre: 'Libro CLRS',
      codigo_inventario: 'LIB-CLRS',
      stock: 2,
      instancias: [
        {
          id: 'inst-1',
          codigo_ejemplar: 'LIB-CLRS-01',
          numero_serie: '',
          estado: 'disponible',
          estado_fisico: 'Excelente',
          observaciones: 'Estante A-1',
        },
        {
          id: 'inst-2',
          codigo_ejemplar: 'LIB-CLRS-02',
          numero_serie: '',
          estado: 'en_mantenimiento',
          estado_fisico: 'Hojas sueltas',
          observaciones: 'En empastado',
        },
      ],
      resumen_instancias: {
        total: 2,
        disponible: 1,
        en_mantenimiento: 1,
        prestado: 0,
        reservado: 0,
        de_baja: 0,
      },
    }

    const ficha = obtenerDatosFichaTecnica(materialConInstancias)
    expect(ficha.instancias).toHaveLength(2)
    expect(ficha.instancias[0].codigoEjemplar).toBe('LIB-CLRS-01')
    expect(ficha.instancias[0].esDisponible).toBe(true)
    expect(ficha.instancias[1].codigoEjemplar).toBe('LIB-CLRS-02')
    expect(ficha.instancias[1].esDisponible).toBe(false)
    expect(ficha.resumenInstancias.disponible).toBe(1)
    expect(ficha.resumenInstancias.en_mantenimiento).toBe(1)
  })

  it('aplica valores por defecto cuando las especificaciones no están registradas', () => {
    const materialMinimo = {
      id: 'xyz-789',
      nombre: 'Cable Adaptador USB-C',
      codigo_inventario: 'OBJ-002',
      tipo: 'objeto',
      estado: 'disponible',
    }

    const ficha = obtenerDatosFichaTecnica(materialMinimo)

    expect(ficha.marca).toBe('No especificada')
    expect(ficha.modelo).toBe('No especificado')
    expect(ficha.numeroSerie).toBe('No registrado')
    expect(ficha.color).toBe('No especificado')
    expect(ficha.estadoFisico).toBe('No especificado')
    expect(ficha.esAltoValor).toBe(false)
    expect(ficha.tierMinimoLegible).toBe('Estándar')
    expect(ficha.bonificacionTiempo).toBe(5)
    expect(ficha.deduccionTardanza).toBe(10)
    expect(ficha.costoReparacionTexto).toBeNull()
    expect(ficha.costoReposicionTexto).toBeNull()
  })

  it('calcula la disponibilidad correctamente cuando no hay unidades', () => {
    const materialSinStock = {
      nombre: 'Kit Arduino',
      estado: 'prestado',
      stock: 2,
      unidades_disponibles: 0,
    }

    const ficha = obtenerDatosFichaTecnica(materialSinStock)
    expect(ficha.hayDisponibilidad).toBe(false)
  })
})
