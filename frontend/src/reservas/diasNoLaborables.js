import { useCallback, useEffect, useMemo, useState } from 'react'

import { api } from '../api/client'

let cacheDiasNoLaborables = null
let promesaEnVuelo = null

export function normalizarListaDiasNoLaborables(lista) {
  if (!Array.isArray(lista)) return []
  return lista
    .filter((item) => item && typeof item.fecha === 'string' && item.fecha.trim())
    .map((item) => ({
      id: item.id,
      fecha: item.fecha.slice(0, 10),
      motivo: String(item.motivo || '').trim() || 'Día inhabilitado',
      creado_por_nombre: item.creado_por_nombre || '',
      created_at: item.created_at || null,
    }))
}

export function crearMapaDiasNoLaborables(diasNoLaborables = []) {
  const mapa = new Map()
  for (const item of normalizarListaDiasNoLaborables(diasNoLaborables)) {
    mapa.set(item.fecha, item)
  }
  return mapa
}

export function extraerFechaIso(valor) {
  if (!valor) return ''
  if (typeof valor === 'string') {
    const limpio = valor.trim()
    const coincidencia = limpio.match(/^(\d{4}-\d{2}-\d{2})/)
    if (coincidencia) return coincidencia[1]
    const parsed = new Date(limpio)
    if (Number.isNaN(parsed.getTime())) return ''
    const y = parsed.getFullYear()
    const m = String(parsed.getMonth() + 1).padStart(2, '0')
    const d = String(parsed.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    const y = valor.getFullYear()
    const m = String(valor.getMonth() + 1).padStart(2, '0')
    const d = String(valor.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return ''
}

export function buscarDiaNoLaborable(fechaValor, diasNoLaborables = []) {
  if (!Array.isArray(diasNoLaborables) || diasNoLaborables.length === 0) return null
  const iso = extraerFechaIso(fechaValor)
  if (!iso) return null
  return normalizarListaDiasNoLaborables(diasNoLaborables).find((item) => item.fecha === iso) || null
}

export function formatearFechaCortaIso(iso) {
  const limpia = extraerFechaIso(iso)
  if (!limpia) return ''
  const [anio, mes, dia] = limpia.split('-')
  return `${dia}/${mes}/${anio}`
}

export function invalidarCacheDiasNoLaborables() {
  cacheDiasNoLaborables = null
  promesaEnVuelo = null
}

export async function cargarDiasNoLaborables({ forzar = false } = {}) {
  if (!forzar && cacheDiasNoLaborables !== null) {
    return cacheDiasNoLaborables
  }
  if (!forzar && promesaEnVuelo) {
    return promesaEnVuelo
  }
  promesaEnVuelo = api
    .get('/dias-no-laborables/')
    .then((datos) => {
      const normalizados = normalizarListaDiasNoLaborables(datos)
      cacheDiasNoLaborables = normalizados
      return normalizados
    })
    .catch(() => cacheDiasNoLaborables ?? [])
    .finally(() => {
      promesaEnVuelo = null
    })
  return promesaEnVuelo
}

export function useDiasNoLaborables({ activo = true } = {}) {
  const [diasNoLaborables, setDiasNoLaborables] = useState(() => cacheDiasNoLaborables ?? [])
  const [cargando, setCargando] = useState(activo && cacheDiasNoLaborables === null)

  const recargar = useCallback(async ({ forzar = true } = {}) => {
    setCargando(true)
    try {
      const lista = await cargarDiasNoLaborables({ forzar })
      setDiasNoLaborables(lista)
      return lista
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    if (!activo) return undefined
    let vigente = true
    cargarDiasNoLaborables()
      .then((lista) => {
        if (vigente) setDiasNoLaborables(lista)
      })
      .finally(() => {
        if (vigente) setCargando(false)
      })
    return () => {
      vigente = false
    }
  }, [activo])

  const mapaDiasNoLaborables = useMemo(
    () => crearMapaDiasNoLaborables(diasNoLaborables),
    [diasNoLaborables],
  )

  return {
    diasNoLaborables,
    mapaDiasNoLaborables,
    cargando,
    recargar,
  }
}
