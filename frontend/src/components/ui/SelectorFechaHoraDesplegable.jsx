import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, X } from 'lucide-react'

const DIAS_CABECERA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

// Accesos rápidos de horario frecuentes dentro de la ventana de atención
const ATAJOS_HORA = ['08:00', '10:00', '12:00', '14:00', '17:30']
const FORMATO_HORA_24H = /^(?:[01]\d|2[0-3]):[0-5]\d$/

function formatearFechaIso(anio, mes, dia) {
  const m = String(mes + 1).padStart(2, '0')
  const d = String(dia).padStart(2, '0')
  return `${anio}-${m}-${d}`
}

function parsearValor(valor) {
  if (!valor) return { fecha: '', hora: '08:00' }
  const partes = String(valor).split('T')
  if (partes.length === 2) {
    return { fecha: partes[0], hora: partes[1].slice(0, 5) || '08:00' }
  }
  return { fecha: partes[0] || '', hora: '08:00' }
}

export default function SelectorFechaHoraDesplegable({
  id: idProp,
  valor,
  onCambio,
  minFecha,
  maxFecha,
  minHora = '08:00',
  maxHora = '17:30',
  deshabilitado = false,
  soloFecha = false,
  etiqueta,
  error,
  ayuda,
  placeholder = 'Selecciona una fecha laborable...',
  className = '',
}) {
  const idGenerado = useId()
  const idInput = idProp || idGenerado
  const contenedorRef = useRef(null)

  const [abierto, setAbierto] = useState(false)
  const { fecha: fechaVal, hora: horaVal } = useMemo(() => parsearValor(valor), [valor])

  const [fechaInterna, setFechaInterna] = useState(fechaVal)
  const [horaInterna, setHoraInterna] = useState(horaVal)
  const [errorHora, setErrorHora] = useState('')

  // Mes a mostrar en el calendario
  const [mesActual, setMesActual] = useState(() => {
    if (fechaVal) {
      const d = new Date(`${fechaVal}T00:00:00`)
      if (!Number.isNaN(d.getTime())) return new Date(d.getFullYear(), d.getMonth(), 1)
    }
    const hoy = new Date()
    return new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  })

  // Sincronizar cuando cambia valor externamente
  useEffect(() => {
    const { fecha: f, hora: h } = parsearValor(valor)
    setFechaInterna(f)
    setHoraInterna(h)
    setErrorHora('')
    if (f) {
      const d = new Date(`${f}T00:00:00`)
      if (!Number.isNaN(d.getTime())) {
        setMesActual(new Date(d.getFullYear(), d.getMonth(), 1))
      }
    }
  }, [valor])

  // Cerrar al hacer click afuera o presionar Escape
  useEffect(() => {
    if (!abierto) return

    function manejarClickAfuera(e) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target)) {
        setAbierto(false)
      }
    }

    function manejarEscape(e) {
      if (e.key === 'Escape') {
        setAbierto(false)
      }
    }

    document.addEventListener('mousedown', manejarClickAfuera)
    document.addEventListener('keydown', manejarEscape)
    return () => {
      document.removeEventListener('mousedown', manejarClickAfuera)
      document.removeEventListener('keydown', manejarEscape)
    }
  }, [abierto])

  const anio = mesActual.getFullYear()
  const mes = mesActual.getMonth()

  const nombreMes = useMemo(() => {
    return new Intl.DateTimeFormat('es-PE', { month: 'long', year: 'numeric' }).format(mesActual)
  }, [mesActual])

  // Generar celdas de días para el mes
  const celdas = useMemo(() => {
    const primerDia = new Date(anio, mes, 1)
    const ultimoDia = new Date(anio, mes + 1, 0)
    const totalDias = ultimoDia.getDate()

    // 0 = Domingo, 1 = Lunes ... 6 = Sábado -> convertir a 0 = Lun ... 6 = Dom
    let diaInicio = primerDia.getDay() - 1
    if (diaInicio === -1) diaInicio = 6

    const items = []
    for (let i = 0; i < diaInicio; i++) {
      items.push(null)
    }

    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)

    const minDateObj = minFecha ? new Date(minFecha.includes('T') ? minFecha : `${minFecha}T00:00:00`) : hoy
    const maxDateObj = maxFecha ? new Date(maxFecha.includes('T') ? maxFecha : `${maxFecha}T23:59:59`) : null

    for (let d = 1; d <= totalDias; d++) {
      const fechaDia = new Date(anio, mes, d)
      fechaDia.setHours(0, 0, 0, 0)
      const iso = formatearFechaIso(anio, mes, d)

      // getDay: 0 = Domingo, 6 = Sábado
      const esFinDeSemana = fechaDia.getDay() === 0 || fechaDia.getDay() === 6
      const esAnteriorMin = minDateObj ? fechaDia < minDateObj : false
      const esPosteriorMax = maxDateObj ? fechaDia > maxDateObj : false

      // Bloquear sábados, domingos, fechas anteriores o posteriores
      const bloqueado = esFinDeSemana || esAnteriorMin || esPosteriorMax

      items.push({
        diaNumero: d,
        iso,
        esFinDeSemana,
        bloqueado,
        motivoBloqueo: esFinDeSemana ? 'No laborable (cerrado)' : 'Fuera de rango permitido',
      })
    }

    return items
  }, [anio, mes, minFecha, maxFecha])

  function cambiarMes(delta) {
    setMesActual((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1))
  }

  function seleccionarDia(iso) {
    setFechaInterna(iso)
    if (soloFecha) {
      if (onCambio) onCambio(iso)
      setAbierto(false)
    } else {
      const nuevoValor = `${iso}T${horaInterna}`
      if (onCambio) onCambio(nuevoValor)
    }
  }

  function manejarCambioHora(nuevaHora) {
    setHoraInterna(nuevaHora)
    if (!nuevaHora) {
      setErrorHora('La hora es obligatoria.')
      return
    }
    if (!FORMATO_HORA_24H.test(nuevaHora)) {
      setErrorHora('Ingresa la hora en formato de 24 horas (HH:MM), por ejemplo 14:30.')
      return
    }

    // Validar rango horario
    const [h, m] = nuevaHora.split(':').map(Number)
    const minutos = h * 60 + (m || 0)
    const [minH, minM] = minHora.split(':').map(Number)
    const [maxH, maxM] = maxHora.split(':').map(Number)
    const minMinutos = minH * 60 + minM
    const maxMinutos = maxH * 60 + maxM

    if (minutos < minMinutos || minutos > maxMinutos) {
      setErrorHora(`El horario de atención es de ${minHora} a ${maxHora}.`)
    } else {
      setErrorHora('')
      if (fechaInterna && onCambio) {
        onCambio(`${fechaInterna}T${nuevaHora}`)
      }
    }
  }

  // Texto legible mostrado en el botón
  const textoLegible = useMemo(() => {
    if (!fechaInterna) return ''
    try {
      const [y, m, d] = fechaInterna.split('-').map(Number)
      const obj = new Date(y, m - 1, d)
      const formatoFecha = new Intl.DateTimeFormat('es-PE', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(obj)
      if (soloFecha) return formatoFecha
      return `${formatoFecha} · ${horaInterna} h`
    } catch {
      return valor
    }
  }, [fechaInterna, horaInterna, soloFecha, valor])

  return (
    <div ref={contenedorRef} className={`relative ${className}`}>
      {etiqueta && (
        <label
          htmlFor={idInput}
          className="block text-xs font-semibold uppercase tracking-wide text-texto-suave mb-1"
        >
          {etiqueta}
        </label>
      )}

      {/* Disparador tipo input */}
      <div className="relative">
        <button
          id={idInput}
          type="button"
          disabled={deshabilitado}
          onClick={() => setAbierto((prev) => !prev)}
          aria-expanded={abierto}
          aria-haspopup="dialog"
          className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
            deshabilitado
              ? 'border-borde/60 bg-superficie-alta/50 text-texto-suave/60 cursor-not-allowed'
              : error
                ? 'border-error bg-white text-texto focus:border-error focus:ring-1 focus:ring-error dark:bg-superficie'
                : 'border-borde bg-white text-texto hover:border-marca-400 focus:border-marca-600 focus:ring-1 focus:ring-marca-600 dark:bg-superficie'
          }`}
        >
          <span className={textoLegible ? 'font-medium text-texto' : 'text-texto-suave'}>
            {textoLegible || placeholder}
          </span>
          <div className="flex items-center gap-1.5 text-texto-suave">
            <CalendarIcon className="size-4 shrink-0" aria-hidden="true" />
          </div>
        </button>
      </div>

      {error && <p className="mt-1 text-xs font-medium text-error">{error}</p>}
      {ayuda && !error && <p className="mt-1 text-xs text-texto-suave">{ayuda}</p>}

      {/* Popover desplegable del calendario */}
      {abierto && !deshabilitado && (
        <div
          role="dialog"
          aria-label="Selector de fecha y hora"
          className="absolute left-0 z-50 mt-1.5 w-76 sm:w-84 rounded-xl border border-borde bg-white p-3.5 shadow-xl dark:border-borde dark:bg-superficie"
        >
          {/* Navegación de mes */}
          <div className="flex items-center justify-between border-b border-borde pb-2.5">
            <span className="text-xs font-bold capitalize text-texto">{nombreMes}</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => cambiarMes(-1)}
                className="rounded-md p-1 text-texto-suave hover:bg-superficie-alta hover:text-texto"
                title="Mes anterior"
                aria-label="Mes anterior"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => cambiarMes(1)}
                className="rounded-md p-1 text-texto-suave hover:bg-superficie-alta hover:text-texto"
                title="Mes siguiente"
                aria-label="Mes siguiente"
              >
                <ChevronRight className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                className="ml-1 rounded-md p-1 text-texto-suave hover:bg-superficie-alta hover:text-texto"
                title="Cerrar calendario"
                aria-label="Cerrar calendario"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {/* Días de la semana */}
          <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-texto-suave">
            {DIAS_CABECERA.map((d, idx) => (
              <div key={d} className={`py-0.5 ${idx >= 5 ? 'text-amber-700/70 dark:text-amber-400/60' : ''}`}>
                {d}
              </div>
            ))}
          </div>

          {/* Cuadrícula de días */}
          <div className="mt-1 grid grid-cols-7 gap-1">
            {celdas.map((celda, idx) => {
              if (!celda) {
                return <div key={`vacia-${idx}`} className="h-8 rounded" />
              }

              const seleccionada = fechaInterna === celda.iso

              if (celda.bloqueado) {
                return (
                  <button
                    key={celda.iso}
                    type="button"
                    disabled
                    title={`${celda.diaNumero} (${celda.motivoBloqueo})`}
                    className="flex h-8 flex-col items-center justify-center rounded text-xs text-texto-suave/30 bg-superficie-alta/30 cursor-not-allowed select-none"
                  >
                    <span>{celda.diaNumero}</span>
                  </button>
                )
              }

              return (
                <button
                  key={celda.iso}
                  type="button"
                  onClick={() => seleccionarDia(celda.iso)}
                  className={`flex h-8 items-center justify-center rounded text-xs font-semibold transition-all ${
                    seleccionada
                      ? 'bg-marca-700 text-white font-bold ring-2 ring-marca-700 dark:bg-marca-600'
                      : 'text-texto hover:bg-marca-50 hover:text-marca-700 dark:hover:bg-marca-950/40 dark:hover:text-marca-300'
                  }`}
                >
                  {celda.diaNumero}
                </button>
              )
            })}
          </div>

          {/* Leyenda aclaratoria */}
          <div className="mt-2.5 flex items-center justify-between border-t border-borde pt-2 text-[11px] text-texto-suave">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-marca-600" />
              Laborable
            </span>
            <span className="flex items-center gap-1.5 text-amber-700/80 dark:text-amber-400/80">
              <span className="size-2 rounded-full bg-gray-300 dark:bg-gray-600" />
              Sáb/Dom bloqueados
            </span>
          </div>

          {/* Selector de horario libre con input time y atajos frecuentes */}
          {!soloFecha && (
            <div className="mt-2.5 border-t border-borde pt-2.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor={`${idInput}-hora`}
                  className="flex items-center gap-1.5 text-xs font-semibold text-texto"
                >
                  <Clock className="size-3.5 text-texto-suave" />
                  Hora libre ({minHora} a {maxHora}):
                </label>
                <input
                  id={`${idInput}-hora`}
                  type="text"
                  inputMode="text"
                  placeholder="HH:MM"
                  aria-label="Hora en formato de 24 horas"
                  maxLength={5}
                  pattern="(?:[01][0-9]|2[0-3]):[0-5][0-9]"
                  value={horaInterna}
                  onChange={(e) => manejarCambioHora(e.target.value)}
                  className="w-28 rounded-md border border-borde bg-white px-2 py-1 text-xs font-semibold tabular-nums text-texto focus:border-marca-600 focus:ring-1 focus:ring-marca-600 dark:bg-superficie"
                />
              </div>

              {/* Atajos de hora comunes */}
              <div className="flex flex-wrap items-center gap-1 pt-0.5">
                <span className="text-[10px] text-texto-suave mr-0.5">Atajos:</span>
                {ATAJOS_HORA.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => manejarCambioHora(h)}
                    className={`rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors ${
                      horaInterna === h
                        ? 'bg-marca-100 text-marca-800 font-bold dark:bg-marca-950/60 dark:text-marca-300'
                        : 'bg-superficie-alta text-texto-suave hover:bg-superficie-alta/80 hover:text-texto'
                    }`}
                  >
                    {h}
                  </button>
                ))}
              </div>

              {errorHora && (
                <p className="text-[11px] font-medium text-error">{errorHora}</p>
              )}
            </div>
          )}

          {/* Botón de confirmar selección */}
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => setAbierto(false)}
              disabled={!fechaInterna || Boolean(errorHora)}
              className="rounded-md bg-marca-700 px-3.5 py-1 text-xs font-semibold text-white hover:bg-marca-800 disabled:opacity-50"
            >
              Listo
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
