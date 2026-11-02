import { useEffect, useId, useRef } from 'react'
import intlTelInput from 'intl-tel-input'
import 'intl-tel-input/build/css/intlTelInput.css'
import { normalizarTelefonoE164 } from '../../validaciones'

export default function CampoTelefono({
  etiqueta = 'Teléfono / Celular',
  nombre = 'telefono',
  valor = '',
  onCambio,
  onPaisCambio,
  error = '',
  ayuda = '',
  placeholder = '',
  deshabilitado = false,
  requerido = false,
  className = '',
  ...rest
}) {
  const identificador = useId()
  const inputRef = useRef(null)
  const itiRef = useRef(null)
  const hayError = error !== ''
  const etiquetaAyuda = hayError ? error : ayuda

  useEffect(() => {
    if (!inputRef.current) return

    const iti = intlTelInput(inputRef.current, {
      initialCountry: 'pe',
      countryOrder: ['pe', 'cl', 'co', 'bo', 'ar', 'us', 'es'],
      separateDialCode: true,
      strictMode: true,
      autoPlaceholder: 'polite',
      formatAsYouType: true,
      countrySearch: true,
      loadUtils: () => import('intl-tel-input/utils'),
    })

    itiRef.current = iti

    if (valor) {
      iti.setNumber(valor)
    }

    const inputEl = inputRef.current

    function manejarCambio() {
      const datosPais = iti.getSelectedCountryData()
      const codigoPais = datosPais?.iso2?.toUpperCase() || 'PE'
      if (onPaisCambio) {
        onPaisCambio(codigoPais)
      }

      const valorIti = iti.getNumber()
      const valorInput = inputEl.value.trim()
      let valorFinal = ''

      if (valorIti) {
        valorFinal = valorIti
      } else if (valorInput) {
        valorFinal = normalizarTelefonoE164(valorInput, codigoPais)
      }

      if (onCambio) {
        onCambio({
          target: {
            name: nombre,
            value: valorFinal,
          },
        })
      }
    }

    inputEl.addEventListener('input', manejarCambio)
    inputEl.addEventListener('countrychange', manejarCambio)

    return () => {
      inputEl.removeEventListener('input', manejarCambio)
      inputEl.removeEventListener('countrychange', manejarCambio)
      iti.destroy()
    }
  }, [])

  useEffect(() => {
    if (itiRef.current && valor !== undefined) {
      const actualE164 = itiRef.current.getNumber()
      if (valor !== actualE164 && valor !== inputRef.current?.value) {
        itiRef.current.setNumber(valor || '')
      }
    }
  }, [valor])

  const clasesControl =
    'w-full rounded-lg border px-3 py-2 text-sm text-texto bg-white dark:bg-superficie placeholder:text-texto-suave ' +
    (hayError
      ? 'border-error focus:outline-error'
      : 'border-borde focus:outline-acento-600')

  return (
    <div className={`campo-telefono grid gap-1 ${className}`}>
      {etiqueta && (
        <label className="text-sm font-semibold text-texto" htmlFor={identificador}>
          {etiqueta}
          {requerido && <span aria-hidden="true" className="text-error"> *</span>}
        </label>
      )}

      <input
        ref={inputRef}
        id={identificador}
        type="tel"
        name={nombre}
        defaultValue={valor}
        placeholder={placeholder}
        disabled={deshabilitado}
        aria-invalid={hayError}
        aria-describedby={etiquetaAyuda ? `${identificador}-ayuda` : undefined}
        className={clasesControl}
        {...rest}
      />

      {etiquetaAyuda && (
        <p
          id={`${identificador}-ayuda`}
          className={`text-xs ${hayError ? 'text-error' : 'text-texto-suave'}`}
        >
          {etiquetaAyuda}
        </p>
      )}
    </div>
  )
}
