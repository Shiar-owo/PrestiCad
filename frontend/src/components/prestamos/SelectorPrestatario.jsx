import { useEffect, useId, useState } from 'react'

import { api } from '../../api/client'
import {
  construirRutaBusquedaPrestatarios,
  crearSeleccionPrestatario,
  debeBuscarPrestatarios,
  MINIMO_DIGITOS_BUSQUEDA_PRESTATARIO,
  normalizarDniPrestatario,
} from '../../prestamos/prestatarios'
import Campo from '../ui/Campo'

export default function SelectorPrestatario({
  etiqueta = 'Buscar prestatario por DNI',
  valor,
  onCambio,
  onSeleccionar = () => {},
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
    onCambio(seleccion.dni)
    onSeleccionar(seleccion)
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
        <p className="text-xs text-texto-suave" role="status" aria-live="polite">
          Buscando prestatarios…
        </p>
      )}
      {errorBusqueda && <p className="text-xs text-error" role="status">{errorBusqueda}</p>}
      {sugerencias.length > 0 && (
        <ul
          id={`${id}-sugerencias`}
          role="listbox"
          aria-label="Prestatarios coincidentes"
          className="max-h-56 overflow-y-auto rounded-xl border border-borde bg-superficie shadow-lg"
        >
          {sugerencias.map((prestatario) => (
            <li key={prestatario.dni} role="option" aria-selected="false">
              <button
                type="button"
                className="flex w-full flex-wrap items-baseline gap-x-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-superficie-alta focus-visible:outline focus-visible:outline-2 focus-visible:outline-acento-600"
                onClick={() => seleccionar(prestatario)}
              >
                <span className="font-semibold tabular-nums text-texto">{prestatario.dni}</span>
                <span aria-hidden="true" className="text-texto-suave">-</span>
                <span className="min-w-0 text-texto">{prestatario.nombre_completo}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {seleccionado?.dni === valor && (
        <p className="text-xs text-texto-suave" role="status">
          Prestatario seleccionado: {seleccionado.nombre_completo}
        </p>
      )}
    </div>
  )
}
