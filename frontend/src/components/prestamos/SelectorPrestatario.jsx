import { useEffect, useId, useRef, useState } from 'react'

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
  modo = 'dni',
  incluirInactivos = false,
  valor,
  onCambio,
  onSeleccionar = null,
  error = '',
  ayuda = '',
  requerido = false,
  deshabilitado = false,
}) {
  const id = useId()
  const contenedorRef = useRef(null)
  const [seleccionado, setSeleccionado] = useState(null)
  const [sugerencias, setSugerencias] = useState([])
  const [cargando, setCargando] = useState(false)
  const [errorBusqueda, setErrorBusqueda] = useState('')

  useEffect(() => {
    function manejarClickFuera(e) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target)) {
        setSugerencias([])
      }
    }
    function manejarTecla(e) {
      if (e.key === 'Escape') {
        setSugerencias([])
      }
    }
    document.addEventListener('mousedown', manejarClickFuera)
    document.addEventListener('keydown', manejarTecla)
    return () => {
      document.removeEventListener('mousedown', manejarClickFuera)
      document.removeEventListener('keydown', manejarTecla)
    }
  }, [])

  useEffect(() => {
    let vigente = true
    const consulta = String(valor || '').trim()
    const valorSeleccionado = modo === 'nombre' ? seleccionado?.nombre_completo : seleccionado?.dni

    if (seleccionado && valorSeleccionado !== consulta) setSeleccionado(null)

    const consultaCompleta = modo === 'dni' && consulta.length >= 8
    const puedeBuscar = modo === 'nombre'
      ? consulta.length >= MINIMO_DIGITOS_BUSQUEDA_PRESTATARIO && valorSeleccionado !== consulta
      : debeBuscarPrestatarios(consulta, seleccionado)
    if (consultaCompleta || !puedeBuscar) {
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
        const resultados = await api.get(construirRutaBusquedaPrestatarios(consulta, modo, incluirInactivos))
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
  }, [valor, seleccionado, modo, incluirInactivos])

  function cambiar(evento) {
    const nuevoValor = modo === 'nombre'
      ? evento.target.value
      : normalizarDniPrestatario(evento.target.value)
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
    modo === 'nombre'
      ? `Escribe al menos ${MINIMO_DIGITOS_BUSQUEDA_PRESTATARIO} caracteres para ver coincidencias.`
      : `Escribe al menos ${MINIMO_DIGITOS_BUSQUEDA_PRESTATARIO} dígitos para ver coincidencias.`
  )

  return (
    <div className="relative grid gap-2" ref={contenedorRef}>
      <div className="relative">
        <Campo
          etiqueta={etiqueta}
          valor={valor}
          onCambio={cambiar}
          error={error}
          ayuda={ayudaCampo}
          inputMode={modo === 'nombre' ? 'search' : 'numeric'}
          autoComplete="off"
          maxLength={modo === 'nombre' ? 100 : 8}
          requerido={requerido}
          deshabilitado={deshabilitado}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={sugerencias.length > 0}
          aria-controls={`${id}-sugerencias`}
          aria-busy={cargando}
        />
        {cargando && (
          <span
            className="absolute right-3 top-9 flex items-center gap-1.5 text-xs text-texto-suave pointer-events-none"
            role="status"
            aria-live="polite"
          >
            <span
              aria-hidden="true"
              className="size-4 animate-spin rounded-full border-2 border-acento-600 border-t-transparent"
            />
          </span>
        )}
      </div>
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
          className="absolute left-0 right-0 top-full z-40 mt-1 max-h-60 divide-y divide-borde overflow-y-auto rounded-xl border border-borde bg-white shadow-2xl ring-1 ring-black/5 dark:bg-superficie"
        >
          {sugerencias.map((prestatario) => (
            <li key={prestatario.dni} role="option" aria-selected="false">
              <button
                type="button"
                onMouseDown={(e) => {
                  // Prevenir desenfoque del input para evitar requerir doble clic
                  e.preventDefault()
                }}
                onClick={() => seleccionar(prestatario)}
                aria-label={crearEtiquetaPrestatario(prestatario)}
                className="grid w-full grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-x-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-acento-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-acento-600 focus-visible:outline-offset-[-2px] dark:hover:bg-acento-500/10 cursor-pointer"
              >
                <span className="rounded-md bg-superficie-alta px-2 py-0.5 font-mono text-xs font-bold tabular-nums text-texto border border-borde/40">
                  {prestatario.dni}
                </span>
                <span aria-hidden="true" className="text-sm text-texto-suave">·</span>
                <span className="min-w-0 truncate text-sm font-semibold text-texto">
                  {prestatario.nombre_completo}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
