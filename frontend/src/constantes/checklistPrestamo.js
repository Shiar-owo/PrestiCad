const TAMANO_PREDETERMINADO = 4 * 1024 * 1024

export const DURACION_MINIMA_PRESTAMO_MINUTOS = 60
export const DURACION_DEFECTO_PRESTAMO_DIAS = 3
export const DURACION_DEFECTO_PRESTAMO_MINUTOS = DURACION_DEFECTO_PRESTAMO_DIAS * 24 * 60
export const DURACION_MAXIMA_PRESTAMO_DIAS = 15
export const DURACION_MAXIMA_TOTAL_MINUTOS = DURACION_MAXIMA_PRESTAMO_DIAS * 24 * 60
export const TIEMPO_TOLERANCIA_DEVOLUCION_MINUTOS = 30
export const DURACION_MAXIMA_PRESTAMO_MINUTOS = (
  DURACION_MAXIMA_TOTAL_MINUTOS - TIEMPO_TOLERANCIA_DEVOLUCION_MINUTOS
)
export const DURACION_MAXIMA_RESERVA_MINUTOS = DURACION_MAXIMA_PRESTAMO_MINUTOS
export const DURACION_MINIMA_MATERIAL_MINUTOS = 60
export const DURACION_MAXIMA_MATERIAL_MINUTOS = DURACION_MAXIMA_TOTAL_MINUTOS
export const TIEMPO_GRACIA_MINUTOS = TIEMPO_TOLERANCIA_DEVOLUCION_MINUTOS

export const DURACION_MINIMA_PRESTAMO_DIAS = 1

export const TIEMPO_MAXIMO_DEFAULT_POR_TIER = {
  avanzado: { valor: DURACION_DEFECTO_PRESTAMO_DIAS, unidad: 'dias', minutos: DURACION_DEFECTO_PRESTAMO_MINUTOS },
  estandar: { valor: DURACION_DEFECTO_PRESTAMO_DIAS, unidad: 'dias', minutos: DURACION_DEFECTO_PRESTAMO_MINUTOS },
  restringido: { valor: DURACION_DEFECTO_PRESTAMO_DIAS, unidad: 'dias', minutos: DURACION_DEFECTO_PRESTAMO_MINUTOS },
}

const UNIDADES_TIEMPO_PRESTAMO = [
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

export function calcularMinutosDuracionPersonalizada(dias, horas, minutos) {
  const cantidadDias = dias === '' || dias === null ? 0 : Number(dias)
  const cantidadHoras = horas === '' || horas === null ? 0 : Number(horas)
  const cantidadMinutos = minutos === '' || minutos === null ? 0 : Number(minutos)
  if (
    !Number.isInteger(cantidadDias)
    || !Number.isInteger(cantidadHoras)
    || !Number.isInteger(cantidadMinutos)
    || cantidadDias < 0
    || cantidadDias > DURACION_MAXIMA_PRESTAMO_DIAS
    || cantidadHoras < 0
    || cantidadHoras > 23
    || cantidadMinutos < 0
    || cantidadMinutos > 59
  ) return NaN
  const totalMinutos = cantidadDias * 1440 + cantidadHoras * 60 + cantidadMinutos
  return totalMinutos <= DURACION_MAXIMA_TOTAL_MINUTOS ? totalMinutos : NaN
}

export function limitarValorCampoDuracion(campo, valor) {
  const limites = {
    tiempo_maximo_dias: DURACION_MAXIMA_PRESTAMO_DIAS,
    tiempo_maximo_horas: 23,
    tiempo_maximo_minutos: 59,
  }
  const maximo = limites[campo]
  if (maximo === undefined || valor === '') return valor
  const numero = Number(valor)
  if (!Number.isFinite(numero)) return ''
  return String(Math.min(maximo, Math.max(0, Math.trunc(numero))))
}

export function formatearDuracionMinutos(minutos) {
  const total = Math.floor(Number(minutos))
  if (!Number.isFinite(total) || total <= 0) return '—'
  const partes = []
  const dias = Math.floor(total / 1440)
  const horas = Math.floor((total % 1440) / 60)
  const restoMinutos = total % 60
  if (dias) partes.push(`${dias} ${dias === 1 ? 'día' : 'días'}`)
  if (horas) partes.push(`${horas} ${horas === 1 ? 'hora' : 'horas'}`)
  if (restoMinutos || partes.length === 0) {
    partes.push(`${restoMinutos} ${restoMinutos === 1 ? 'minuto' : 'minutos'}`)
  }
  if (partes.length < 2) return partes[0]
  return `${partes.slice(0, -1).join(', ')} y ${partes.at(-1)}`
}

export const TAMANO_MAXIMO_FOTO_CHECKLIST_BYTES = TAMANO_PREDETERMINADO
export const TAMANO_MAXIMO_FOTO_CHECKLIST_MB = TAMANO_MAXIMO_FOTO_CHECKLIST_BYTES / (1024 * 1024)
export const TIPOS_FOTO_CHECKLIST = ['image/jpeg', 'image/png', 'image/webp']
export const EXTENSIONES_FOTO_CHECKLIST = ['.jpg', '.jpeg', '.png', '.webp']

