import { useEffect, useMemo, useState } from 'react'
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Info,
  Clock,
  CheckCircle2,
  XCircle,
} from 'lucide-react'

import { api } from '../../api/client'
import Boton from '../ui/Boton'
import Skeleton from '../ui/Skeleton'

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export default function CalendarioDisponibilidad({
  materialId,
  fechaSeleccionada,
  onSeleccionarFecha,
}) {
  const [fechaBase, setFechaBase] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [datosDisponibilidad, setDatosDisponibilidad] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  const mes = fechaBase.getMonth()
  const anio = fechaBase.getFullYear()

  const nombreMes = useMemo(() => {
    return new Intl.DateTimeFormat('es-PE', { month: 'long', year: 'numeric' }).format(fechaBase)
  }, [fechaBase])

  // Rango de fechas del mes a consultar
  const { desdeStr, hastaStr } = useMemo(() => {
    const primerDia = new Date(anio, mes, 1)
    const ultimoDia = new Date(anio, mes + 1, 0)
    const formato = (d) => {
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    return {
      desdeStr: formato(primerDia),
      hastaStr: formato(ultimoDia),
    }
  }, [anio, mes])

  useEffect(() => {
    if (!materialId) {
      setDatosDisponibilidad(null)
      return
    }

    let activa = true
    setCargando(true)
    setError('')

    api
      .get(`/materiales/${materialId}/disponibilidad/?desde=${desdeStr}&hasta=${hastaStr}`)
      .then((datos) => {
        if (!activa) return
        setDatosDisponibilidad(datos)
      })
      .catch(() => {
        if (!activa) return
        setError('No se pudo cargar la disponibilidad para este mes.')
      })
      .finally(() => {
        if (activa) setCargando(false)
      })

    return () => {
      activa = false
    }
  }, [materialId, desdeStr, hastaStr])

  // Mapear días de disponibilidad por fecha YYYY-MM-DD
  const mapaDias = useMemo(() => {
    const mapa = new Map()
    if (datosDisponibilidad?.dias) {
      for (const d of datosDisponibilidad.dias) {
        mapa.set(d.fecha, d)
      }
    }
    return mapa
  }, [datosDisponibilidad])

  // Generar cuadrícula del mes
  const celdasMes = useMemo(() => {
    const primerDia = new Date(anio, mes, 1)
    const ultimoDia = new Date(anio, mes + 1, 0)
    const totalDias = ultimoDia.getDate()

    // weekday: 0 = Dom, 1 = Lun ... 6 = Sáb -> convertir a 0 = Lun ... 6 = Dom
    let diaInicioSemana = primerDia.getDay() - 1
    if (diaInicioSemana === -1) diaInicioSemana = 6

    const celdas = []
    // Celdas vacías antes del primer día del mes
    for (let i = 0; i < diaInicioSemana; i++) {
      celdas.push(null)
    }

    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)

    for (let d = 1; d <= totalDias; d++) {
      const fechaActual = new Date(anio, mes, d)
      const year = fechaActual.getFullYear()
      const month = String(fechaActual.getMonth() + 1).padStart(2, '0')
      const day = String(fechaActual.getDate()).padStart(2, '0')
      const isoFecha = `${year}-${month}-${day}`

      const infoDia = mapaDias.get(isoFecha)
      const esPasado = fechaActual < hoy
      const esFinDeSemana = fechaActual.getDay() === 0 || fechaActual.getDay() === 6

      celdas.push({
        diaNumero: d,
        isoFecha,
        esPasado,
        esFinDeSemana,
        disponible: infoDia ? infoDia.disponible : !esPasado && !esFinDeSemana,
        ejemplaresLibres: infoDia ? infoDia.ejemplares_libres : 0,
        ejemplaresTotales: infoDia ? infoDia.ejemplares_totales : 0,
        ocupaciones: infoDia ? infoDia.ocupaciones : [],
      })
    }
    return celdas
  }, [anio, mes, mapaDias])

  function mesAnterior() {
    setFechaBase((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  function mesSiguiente() {
    setFechaBase((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  if (!materialId) {
    return null
  }

  return (
    <div className="rounded-xl border border-borde bg-white p-4 shadow-xs dark:bg-superficie">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-borde pb-3">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5 text-primario-600 dark:text-primario-400" />
          <h3 className="font-semibold text-sm capitalize text-texto">
            {nombreMes}
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          <Boton
            tipo="button"
            variante="secundario"
            tamano="sm"
            onClick={mesAnterior}
            title="Mes anterior"
            aria-label="Mes anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Boton>
          <Boton
            tipo="button"
            variante="secundario"
            tamano="sm"
            onClick={mesSiguiente}
            title="Mes siguiente"
            aria-label="Mes siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </Boton>
        </div>
      </div>

      {cargando ? (
        <div className="py-8 space-y-2">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : error ? (
        <div className="py-4 text-xs text-error flex items-center gap-1.5">
          <Info className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : (
        <div className="mt-3">
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-texto-suave mb-1">
            {DIAS_SEMANA.map((dia) => (
              <div key={dia} className="py-1">
                {dia}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {celdasMes.map((celda, idx) => {
              if (!celda) {
                return <div key={`vacia-${idx}`} className="h-14 rounded-lg bg-superficie-suave/30" />
              }

              const seleccionada = fechaSeleccionada === celda.isoFecha
              const deshabilitada = celda.esPasado || celda.esFinDeSemana

              let colorFondo = 'bg-white hover:bg-superficie-suave text-texto dark:bg-superficie'
              let badgeColor = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'

              if (deshabilitada) {
                colorFondo = 'bg-superficie-suave/60 text-texto-suave/40 cursor-not-allowed dark:bg-superficie-suave/20'
              } else if (!celda.disponible) {
                badgeColor = 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
              }

              return (
                <button
                  key={celda.isoFecha}
                  type="button"
                  disabled={deshabilitada}
                  onClick={() => onSeleccionarFecha && onSeleccionarFecha(celda.isoFecha)}
                  className={`group relative flex h-14 flex-col justify-between rounded-lg border p-1.5 text-left transition-all ${
                    seleccionada
                      ? 'border-primario-600 bg-primario-50/60 ring-2 ring-primario-600 dark:border-primario-500 dark:bg-primario-950/40'
                      : 'border-borde ' + colorFondo
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold ${seleccionada ? 'text-primario-700 dark:text-primario-300' : ''}`}>
                      {celda.diaNumero}
                    </span>
                    {!celda.esFinDeSemana && !celda.esPasado && (
                      <span className={`text-[10px] font-semibold px-1 py-0.5 rounded ${badgeColor}`}>
                        {celda.disponible ? `${celda.ejemplaresLibres} disp` : 'Ocupado'}
                      </span>
                    )}
                  </div>

                  {!celda.esFinDeSemana && !celda.esPasado && celda.ocupaciones.length > 0 && (
                    <div className="flex items-center gap-0.5 text-[9px] text-texto-suave truncate">
                      <Clock className="h-2.5 w-2.5 shrink-0" />
                      <span>{celda.ocupaciones.length} evento(s)</span>
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-borde pt-2 text-xs text-texto-suave">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Disponible
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                Ocupado
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-gray-300 dark:bg-gray-700" />
                No laborable
              </span>
            </div>
            <p className="italic text-[11px]">
              Haz clic en un día laborable para autocompletar la fecha.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
