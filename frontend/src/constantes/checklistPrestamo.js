const TAMANO_PREDETERMINADO = 4 * 1024 * 1024

export const DURACION_MINIMA_PRESTAMO_MINUTOS = 15
export const DURACION_MAXIMA_PRESTAMO_MINUTOS = 15 * 24 * 60
export const DURACION_MINIMA_MATERIAL_MINUTOS = 30
export const DURACION_MAXIMA_MATERIAL_MINUTOS = 15 * 24 * 60
export const TIEMPO_GRACIA_MINUTOS = 30

export const DURACION_MINIMA_PRESTAMO_DIAS = 1
export const DURACION_MAXIMA_PRESTAMO_DIAS = 15

export const TIEMPO_MAXIMO_DEFAULT_POR_TIER = {
  avanzado: { valor: 6, unidad: 'horas', minutos: 360 },
  estandar: { valor: 24, unidad: 'horas', minutos: 1440 },
  restringido: { valor: 3, unidad: 'dias', minutos: 4320 },
}

export const UNIDADES_TIEMPO_PRESTAMO = [
  { valor: 'minutos', etiqueta: 'Minutos', factor: 1 },
  { valor: 'horas', etiqueta: 'Horas', factor: 60 },
  { valor: 'dias', etiqueta: 'Días', factor: 1440 },
]

export function convertirTiempoAMinutos(cantidad, unidad = 'horas') {
  const numero = Number(cantidad)
  if (!Number.isFinite(numero)) return NaN
  const entrada = UNIDADES_TIEMPO_PRESTAMO.find((item) => item.valor === unidad)
  const factor = entrada ? entrada.factor : 1
  return numero * factor
}

export function descomponerMinutosEnUnidad(minutos) {
  const total = Number(minutos)
  if (!Number.isFinite(total) || total <= 0) {
    return { valor: 24, unidad: 'horas' }
  }
  if (total >= 1440 && total % 1440 === 0) {
    if (total === 1440) return { valor: 24, unidad: 'horas' }
    return { valor: total / 1440, unidad: 'dias' }
  }
  if (total >= 60 && total % 60 === 0) {
    return { valor: total / 60, unidad: 'horas' }
  }
  return { valor: total, unidad: 'minutos' }
}

export function formatearDuracionMinutos(minutos) {
  const total = Number(minutos)
  if (!Number.isFinite(total) || total <= 0) return '—'
  if (total >= 1440 && total % 1440 === 0) {
    const dias = total / 1440
    return dias === 1 ? '24 horas (1 día)' : `${dias} días`
  }
  if (total >= 60 && total % 60 === 0) {
    const horas = total / 60
    return horas === 1 ? '1 hora' : `${horas} horas`
  }
  return total === 1 ? '1 minuto' : `${total} minutos`
}

export const TAMANO_MAXIMO_FOTO_CHECKLIST_BYTES = TAMANO_PREDETERMINADO
export const TAMANO_MAXIMO_FOTO_CHECKLIST_MB = TAMANO_MAXIMO_FOTO_CHECKLIST_BYTES / (1024 * 1024)
export const TIPOS_FOTO_CHECKLIST = ['image/jpeg', 'image/png', 'image/webp']
export const EXTENSIONES_FOTO_CHECKLIST = ['.jpg', '.jpeg', '.png', '.webp']

