import { useEffect, useMemo, useState } from 'react'
import {
  Calendar as CalendarIcon,
  CalendarOff,
  ChevronLeft,
  ChevronRight,
  Clock,
  Info,
  User,
} from 'lucide-react'

import { api } from '../../api/client'
import Boton from '../ui/Boton'
import Skeleton from '../ui/Skeleton'

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function formatearFechaHoraLima(iso) {
  if (!iso) return ''
  const valor = new Date(iso)
  if (Number.isNaN(valor.getTime())) return String(iso)
  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'America/Lima',
  }).format(valor)
}

function formatearFechaDiaLarga(isoFecha) {
  if (!isoFecha) return ''
  const [anio, mes, dia] = isoFecha.split('-').map(Number)
  const fecha = new Date(anio, mes - 1, dia)
  if (Number.isNaN(fecha.getTime())) return isoFecha
  return new Intl.DateTimeFormat('es-PE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(fecha)
}

export default function CalendarioDisponibilidad({
  materialId,
  fechaSeleccionada,
  onSeleccionarFecha,
  soloLectura = false,
  mostrarDetalleEventos = true,
  mostrarResumenReservas = false,
}) {
  const [fechaBase, setFechaBase] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [datosDisponibilidad, setDatosDisponibilidad] = useState(null)
  const [diaInspeccionado, setDiaInspeccionado] = useState('')
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
      const esInhabilitado = Boolean(infoDia?.es_dia_inhabilitado)

      celdas.push({
        diaNumero: d,
        isoFecha,
        esPasado,
        esFinDeSemana,
        esInhabilitado,
        motivoInhabilitado: infoDia?.motivo_inhabilitado || '',
        disponible: infoDia ? infoDia.disponible : !esPasado && !esFinDeSemana,
        ejemplaresLibres: infoDia ? infoDia.ejemplares_libres : 0,
        ejemplaresTotales: infoDia ? infoDia.ejemplares_totales : 0,
        ocupaciones: infoDia ? infoDia.ocupaciones : [],
      })
    }
    return celdas
  }, [anio, mes, mapaDias])

  // Reservas futuras únicas del mes consultado (deduplicadas por id en rangos multi-día)
  const reservasFuturasMes = useMemo(() => {
    if (!datosDisponibilidad?.dias) return []
    const ahoraMs = Date.now()
    const porId = new Map()
    for (const dia of datosDisponibilidad.dias) {
      for (const ocupacion of dia.ocupaciones || []) {
        if (ocupacion.tipo !== 'reserva') continue
        const finMs = new Date(ocupacion.fin).getTime()
        if (!Number.isNaN(finMs) && finMs < ahoraMs) continue
        if (!porId.has(ocupacion.id)) {
          porId.set(ocupacion.id, ocupacion)
        }
      }
    }
    return [...porId.values()].sort(
      (a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime(),
    )
  }, [datosDisponibilidad])

  const fechaActivaDetalle = diaInspeccionado || fechaSeleccionada || ''
  const celdaActivaDetalle = useMemo(() => {
    if (!fechaActivaDetalle) return null
    return celdasMes.find((celda) => celda && celda.isoFecha === fechaActivaDetalle) || null
  }, [celdasMes, fechaActivaDetalle])

  function mesAnterior() {
    setFechaBase((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  function mesSiguiente() {
    setFechaBase((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  function manejarClickCelda(celda, deshabilitadaParaSeleccion) {
    setDiaInspeccionado(celda.isoFecha)
    if (!soloLectura && !deshabilitadaParaSeleccion && onSeleccionarFecha) {
      onSeleccionarFecha(celda.isoFecha)
    }
  }

  if (!materialId) {
    return null
  }

  return (
    <div className="rounded-xl border border-borde bg-white p-4 shadow-xs dark:bg-superficie">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-borde pb-3">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5 text-marca-700 dark:text-marca-400" />
          <h3 className="font-semibold text-sm capitalize text-texto">
            {nombreMes}
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          <Boton
            tipo="button"
            variante="secundario"
            tamanio="pequeno"
            onClick={mesAnterior}
            title="Mes anterior"
            aria-label="Mes anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Boton>
          <Boton
            tipo="button"
            variante="secundario"
            tamanio="pequeno"
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

              const seleccionada = (fechaSeleccionada || diaInspeccionado) === celda.isoFecha
              const deshabilitadaParaSeleccion = celda.esPasado || celda.esFinDeSemana || celda.esInhabilitado
              const botonDeshabilitado = soloLectura
                ? (celda.esFinDeSemana && celda.ocupaciones.length === 0)
                : deshabilitadaParaSeleccion

              let colorFondo = 'bg-white hover:bg-superficie-suave text-texto dark:bg-superficie'
              let badgeColor = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'

              if (celda.esInhabilitado) {
                colorFondo = 'bg-rose-50/70 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300'
                badgeColor = 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-200'
              } else if (celda.esPasado || celda.esFinDeSemana) {
                colorFondo = 'bg-superficie-suave/60 text-texto-suave/50 dark:bg-superficie-suave/20'
              } else if (!celda.disponible) {
                badgeColor = 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
              }

              const totalReservasDia = celda.ocupaciones.filter((o) => o.tipo === 'reserva').length

              return (
                <button
                  key={celda.isoFecha}
                  type="button"
                  disabled={botonDeshabilitado}
                  title={celda.esInhabilitado ? `Inhabilitado: ${celda.motivoInhabilitado}` : undefined}
                  onClick={() => manejarClickCelda(celda, deshabilitadaParaSeleccion)}
                  className={`group relative flex h-14 flex-col justify-between rounded-lg border p-1.5 text-left transition-all ${
                    botonDeshabilitado ? 'cursor-not-allowed' : 'cursor-pointer'
                  } ${
                    seleccionada
                      ? 'border-marca-600 bg-marca-50/60 ring-2 ring-marca-600 dark:border-marca-500 dark:bg-marca-950/40'
                      : 'border-borde ' + colorFondo
                  }`}
                >
                  <div className="flex items-center justify-between gap-0.5">
                    <span className={`text-xs font-bold ${seleccionada ? 'text-marca-700 dark:text-marca-300' : ''}`}>
                      {celda.diaNumero}
                    </span>
                    {celda.esInhabilitado ? (
                      <span className={`text-[9px] font-semibold px-1 py-0.5 rounded truncate ${badgeColor}`}>
                        Feriado
                      </span>
                    ) : !celda.esFinDeSemana && !celda.esPasado && (
                      <span className={`text-[10px] font-semibold px-1 py-0.5 rounded ${badgeColor}`}>
                        {celda.disponible ? `${celda.ejemplaresLibres} disp` : 'Ocupado'}
                      </span>
                    )}
                  </div>

                  {!celda.esFinDeSemana && !celda.esPasado && celda.ocupaciones.length > 0 && (
                    <div className="flex items-center gap-0.5 text-[9px] font-medium text-amber-800 dark:text-amber-300 truncate">
                      <Clock className="h-2.5 w-2.5 shrink-0" />
                      <span>
                        {totalReservasDia > 0
                          ? `${totalReservasDia} res.`
                          : `${celda.ocupaciones.length} evento(s)`}
                      </span>
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-borde pt-2 text-xs text-texto-suave">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Disponible
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                Ocupado
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                Feriado / Inhabilitado
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-gray-300 dark:bg-gray-700" />
                Fin de semana
              </span>
            </div>
            <p className="italic text-[11px]">
              {soloLectura
                ? 'Haz clic en un día para ver las reservas y préstamos programados.'
                : 'Haz clic en un día laborable para autocompletar la fecha y ver su agenda.'}
            </p>
          </div>

          {mostrarDetalleEventos && celdaActivaDetalle && (
            <div className="mt-3 rounded-lg border border-borde bg-superficie-alta/50 p-3 text-xs space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-bold capitalize text-texto">
                  Agenda del {formatearFechaDiaLarga(celdaActivaDetalle.isoFecha)}
                </h4>
                {celdaActivaDetalle.esInhabilitado ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 font-semibold text-rose-800 dark:bg-rose-950/60 dark:text-rose-200">
                    <CalendarOff className="size-3" />
                    Inhabilitado: {celdaActivaDetalle.motivoInhabilitado}
                  </span>
                ) : !celdaActivaDetalle.esFinDeSemana && !celdaActivaDetalle.esPasado && (
                  <span className="text-texto-suave font-medium">
                    {celdaActivaDetalle.ejemplaresLibres} de {celdaActivaDetalle.ejemplaresTotales} ejemplar(es) libre(s)
                  </span>
                )}
              </div>

              {celdaActivaDetalle.ocupaciones.length > 0 ? (
                <ul className="space-y-1.5">
                  {celdaActivaDetalle.ocupaciones.map((ocupacion) => (
                    <li
                      key={`${ocupacion.tipo}-${ocupacion.id}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-borde bg-white px-2.5 py-1.5 dark:bg-superficie"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                            ocupacion.tipo === 'reserva'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                              : 'bg-acento-100 text-acento-800 dark:bg-acento-950/60 dark:text-acento-300'
                          }`}
                        >
                          {ocupacion.tipo === 'reserva' ? 'Reserva' : 'Préstamo'}
                        </span>
                        {ocupacion.codigo_ejemplar && (
                          <span className="font-mono font-semibold text-texto">
                            {ocupacion.codigo_ejemplar}
                          </span>
                        )}
                        {ocupacion.prestatario && (
                          <span className="inline-flex items-center gap-1 text-texto-suave">
                            <User className="size-3" />
                            {ocupacion.prestatario}
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-[11px] text-texto-suave">
                        {formatearFechaHoraLima(ocupacion.inicio)} → {formatearFechaHoraLima(ocupacion.fin)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-texto-suave">
                  No hay reservas ni préstamos registrados para esta fecha.
                </p>
              )}
            </div>
          )}

          {mostrarResumenReservas && (
            <div className="mt-3 rounded-lg border border-borde bg-superficie p-3 text-xs space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-bold uppercase tracking-wider text-texto-suave text-[11px]">
                  Reservas futuras en {nombreMes} ({reservasFuturasMes.length})
                </h4>
              </div>
              {reservasFuturasMes.length > 0 ? (
                <ul className="divide-y divide-borde">
                  {reservasFuturasMes.map((reserva) => (
                    <li
                      key={reserva.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-1.5"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                          Reservada
                        </span>
                        {reserva.codigo_ejemplar && (
                          <span className="font-mono font-semibold text-texto">
                            {reserva.codigo_ejemplar}
                          </span>
                        )}
                        {reserva.prestatario && (
                          <span className="inline-flex items-center gap-1 text-texto-suave">
                            <User className="size-3" />
                            {reserva.prestatario}
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-[11px] text-texto-suave">
                        {formatearFechaHoraLima(reserva.inicio)} → {formatearFechaHoraLima(reserva.fin)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-texto-suave">
                  Este material no tiene reservas futuras programadas durante {nombreMes}.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
