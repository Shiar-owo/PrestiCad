import {
  ETIQUETAS_ESTADO,
  ETIQUETAS_TIER,
  ETIQUETAS_TIPO,
} from '../constantes/catalogo'

/**
 * Formatea un valor numérico como moneda en Soles (S/.).
 */
export function formatearMoneda(valor) {
  if (valor === null || valor === undefined || valor === '') return null
  const num = Number(valor)
  if (!Number.isFinite(num)) return null
  return `S/. ${num.toFixed(2)}`
}

/**
 * Normaliza y estructura los datos de un material para su presentación
 * en la ficha técnica detallada (especificaciones de hardware, stock y reglas).
 */
export function obtenerDatosFichaTecnica(material) {
  if (!material) return null

  const unidades = material.unidades_disponibles ?? material.stock ?? 0
  const hayDisponibilidad = material.estado === 'disponible' && unidades > 0

  return {
    id: material.id,
    nombre: material.nombre || 'Material sin nombre',
    descripcion: material.descripcion?.trim() || '',
    codigoInventario: material.codigo_inventario || '—',
    tipo: material.tipo || 'objeto',
    tipoLegible: ETIQUETAS_TIPO[material.tipo] || material.tipo || 'Objeto',
    estado: material.estado || 'disponible',
    estadoLegible: ETIQUETAS_ESTADO[material.estado] || material.estado || 'Disponible',
    foto: material.foto || '',
    esAltoValor: Boolean(material.es_alto_valor),
    stockTotal: material.stock ?? 1,
    unidadesDisponibles: unidades,
    hayDisponibilidad,

    // Especificaciones de hardware (Ficha técnica)
    marca: material.marca?.trim() || 'No especificada',
    modelo: material.modelo?.trim() || 'No especificado',
    numeroSerie: material.numero_serie?.trim() || 'No registrado',
    color: material.color?.trim() || 'No especificado',
    estadoFisico: material.estado_fisico?.trim() || 'No especificado',

    // Reglas de negocio y reputación
    tierMinimo: material.tier_minimo_requerido || 'estandar',
    tierMinimoLegible:
      ETIQUETAS_TIER[material.tier_minimo_requerido] ||
      material.tier_minimo_requerido ||
      'Estándar',
    bonificacionTiempo: material.bonificacion_tiempo ?? 5,
    deduccionTardanza: material.deduccion_tardanza ?? 10,
    deduccionDanoParcial: material.deduccion_dano_parcial ?? 30,
    deduccionDanoTotal: material.deduccion_dano_total ?? 60,
    costoReparacionTexto: formatearMoneda(material.costo_reparacion),
    costoReposicionTexto: formatearMoneda(material.costo_reposicion),
  }
}
