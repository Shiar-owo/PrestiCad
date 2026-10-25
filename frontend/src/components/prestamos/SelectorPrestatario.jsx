import { useEffect, useId, useState } from 'react'

import { api } from '../../api/client'
import {
  construirRutaBusquedaPrestatarios,
  crearEtiquetaPrestatario,
  crearSeleccionPrestatario,
  debeBuscarPrestatarios,
  MINIMO_DIGITOS_BUSQUEDA_PRESTATARIO,
  notificarSeleccionPrestatario,
  normalizarDniPrestatario,
} from '../../prestamos/prestatarios'
import Campo from '../ui/Campo'

export default function SelectorPrestatario({
  etiqueta = 'Buscar prestatario por DNI',
  valor,
  onCambio,
  onSeleccionar = null,
  error = '',
  ayuda = '',
  requerido = false,
}) {
  const id = useId()
  const [seleccionado, setSeleccionado] = useState(null)
  const [sugerencias, setSugerencias] = useState([])
  const [cargando, setCargando] = useState(false)
  const [errorBusqueda, setErrorBusqueda] = useState('')

  useEffect(() => {
    let vigente = true
    const dni = String(valor || '').trim()

    if (seleccionado && seleccionado.dni !== dni) setSeleccionado(null)

    if (!debeBuscarPrestatarios(dni, seleccionado)) {
      setSugerencias([])
      setCargando(false)
      setErrorBusqueda('')
      return () => {
        vigente = false
      }
    }

    setCargando(true)
    setErrorBusqueda('')
    const temporizador = window.setTimeout(async () => {
      try {
        const resultados = await api.get(construirRutaBusquedaPrestatarios(dni))
        if (vigente) setSugerencias(resultados)
      } catch {
        if (vigente) {
          setSugerencias([])
          setErrorBusqueda('No se pudieron buscar prestatarios. Intenta nuevamente.')
        }
      } finally {
        if (vigente) setCargando(false)
      }
    }, 250)

    return () => {
      vigente = false
      window.clearTimeout(temporizador)
    }
  }, [valor, seleccionado])

  function cambiar(evento) {
    const nuevoValor = normalizarDniPrestatario(evento.target.value)
    setSeleccionado(null)
    onCambio(nuevoValor)
  }

  function seleccionar(prestatario) {
    const seleccion = crearSeleccionPrestatario(prestatario)
    if (!seleccion) return
    setSeleccionado(seleccion)
    setSugerencias([])
    notificarSeleccionPrestatario(seleccion, onCambio, onSeleccionar)
  }

  const ayudaCampo = error || ayuda || (
    `Escribe al menos ${MINIMO_DIGITOS_BUSQUEDA_PRESTATARIO} dígitos para ver coincidencias.`
  )

  return (
    <div className="grid gap-2">
      <Campo
        etiqueta={etiqueta}
        valor={valor}
        onCambio={cambiar}
        error={error}
        ayuda={ayudaCampo}
        inputMode="numeric"
        autoComplete="off"
        maxLength={8}
        requerido={requerido}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={sugerencias.length > 0}
        aria-controls={`${id}-sugerencias`}
        aria-busy={cargando}
      />
      {cargando && (
        <p className="flex items-center gap-2 text-xs text-texto-suave" role="status" aria-live="polite">
          <span
            aria-hidden="true"
            className="size-3 animate-spin rounded-full border-2 border-acento-600 border-t-transparent"
          />
          Buscando prestatarios…
        </p>
      )}
      {errorBusqueda && (
        <p className="rounded-lg border border-error/30 bg-error/5 px-3 py-2 text-xs text-error" role="status">
          {errorBusqueda}
        </p>
      )}
      {sugerencias.length > 0 && (
        <ul
          id={`${id}-sugerencias`}
          role="listbox"
          aria-label="Prestatarios coincidentes"
          className="max-h-64 divide-y divide-borde overflow-y-auto rounded-xl border border-borde bg-white shadow-xl ring-1 ring-black/5 dark:bg-superficie"
        >
          {sugerencias.map((prestatario) => (
            <li key={prestatario.dni} role="option" aria-selected="false">
              <button
                type="button"
                aria-label={crearEtiquetaPrestatario(prestatario)}
                className="grid w-full grid-cols-[auto_auto_minmax(0,1fr)] items-start gap-x-2 px-3 py-3 text-left transition-colors hover:bg-acento-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-acento-600 focus-visible:outline-offset-[-2px] dark:hover:bg-acento-500/10"
                onClick={() => seleccionar(prestatario)}
              >
                <span className="rounded-md bg-superficie-alta px-2 py-1 font-mono text-xs font-bold tabular-nums text-texto">
                  {prestatario.dni}
                </span>
                <span aria-hidden="true" className="pt-1.5 text-sm text-texto-suave">-</span>
                <span className="min-w-0 break-words pt-1 text-sm font-medium leading-5 text-texto">
                  {prestatario.nombre_completo}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {seleccionado?.dni === valor && (
        <p className="rounded-lg border border-marca-200 bg-marca-50 px-3 py-2 text-xs text-marca-800 dark:border-marca-700/60 dark:bg-marca-500/10 dark:text-marca-300" role="status">
          Seleccionado: <span className="font-semibold">{crearEtiquetaPrestatario(seleccionado)}</span>
        </p>
      )}
    </div>
  )
}
