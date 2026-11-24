// Taxonomías compartidas del catálogo.
// Deben reflejar backend/apps/inventario/constants.py

export const ETIQUETAS_TIPO = {
  equipo: 'Equipo',
  libro: 'Libro',
  objeto: 'Objeto',
}

export const ETIQUETAS_ESTADO = {
  disponible: 'Disponible',
  en_mantenimiento: 'En Mantenimiento',
  reservado: 'Reservado',
  prestado: 'Prestado',
}

export const UMBRAL_PRECIO_ALTO_VALOR = 200

export function esMaterialAltoValor(material) {
  if (material?.precio !== null && material?.precio !== undefined && material?.precio !== '') {
    return Number(material.precio) > UMBRAL_PRECIO_ALTO_VALOR
  }
  return Boolean(material?.es_alto_valor)
}

// Debe reflejar apps/usuarios/constants.py (TIERS)
export const ETIQUETAS_TIER = {
  avanzado: 'Avanzado',
  estandar: 'Estándar',
  restringido: 'Restringido',
}

export const OPCIONES_TIPO = Object.entries(ETIQUETAS_TIPO).map(([valor, etiqueta]) => ({
  valor,
  etiqueta,
}))

export const OPCIONES_ESTADO = Object.entries(ETIQUETAS_ESTADO).map(([valor, etiqueta]) => ({
  valor,
  etiqueta,
}))

export const OPCIONES_TIER = [
  { valor: 'estandar', etiqueta: 'Estándar' },
  { valor: 'avanzado', etiqueta: 'Avanzado' },
  { valor: 'restringido', etiqueta: 'Restringido' },
]

export const OPCIONES_FILTRO_CATEGORIA = [
  { valor: '', etiqueta: 'Todas las categorías' },
  ...OPCIONES_TIPO,
]

export const OPCIONES_FILTRO_ESTADO = [
  { valor: '', etiqueta: 'Todos los estados' },
  ...OPCIONES_ESTADO,
]
