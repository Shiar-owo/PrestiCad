import { useEffect, useId, useState } from 'react'

import { api } from '../../api/client'
import Campo from '../ui/Campo'

const MINIMO_DIGITOS = 3

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

    if (seleccionado?.dni === dni || dni.length < MINIMO_DIGITOS) {
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
        const parametros = new URLSearchParams({ dni })
        const resultados = await api.get(`/prestamos/prestatarios/?${parametros.toString()}`)
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
    const nuevoValor = evento.target.value.replace(/\D/g, '').slice(0, 8)
    setSeleccionado(null)
    onCambio(nuevoValor)
  }

  function seleccionar(prestatario) {
    setSeleccionado(prestatario)
    setSugerencias([])
    onCambio(prestatario.dni)
    onSeleccionar(prestatario)
  }

  const ayudaCampo = error || ayuda || `Escribe al menos ${MINIMO_DIGITOS} dígitos para ver coincidencias.`

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
          className="max-h-56 overflow-y-auto rounded-lg border border-borde bg-white shadow-lg dark:bg-superficie"
        >
          {sugerencias.map((prestatario) => (
            <li key={prestatario.dni} role="option" aria-selected="false">
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-superficie-alta focus-visible:outline focus-visible:outline-2 focus-visible:outline-acento-600"
                onClick={() => seleccionar(prestatario)}
              >
                <span className="block font-semibold text-texto">{prestatario.dni}</span>
                <span className="block text-texto-suave">{prestatario.nombre_completo}</span>
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
