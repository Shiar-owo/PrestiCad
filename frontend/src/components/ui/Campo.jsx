import { useId } from 'react'

function Campo({
  etiqueta = '',
  nombre,
  tipo = 'text',
  valor,
  onCambio,
  error = '',
  ayuda = '',
  opciones = null,
  placeholder = '',
  deshabilitado = false,
  requerido = false,
  className = '',
  ...rest
}) {
  const identificador = useId()
  const hayError = error !== ''
  const etiquetaAyuda = hayError ? error : ayuda

  const clasesControl =
    'w-full rounded-lg border px-3 py-2 text-sm text-texto placeholder:text-texto-suave ' +
    (hayError
      ? 'border-error focus:outline-error'
      : 'border-borde focus:outline-acento-600')

  return (
    <div className={`grid gap-1 ${className}`}>
      {etiqueta && (
        <label className="text-sm font-semibold text-texto" htmlFor={identificador}>
          {etiqueta}
          {requerido && <span aria-hidden="true" className="text-error"> *</span>}
        </label>
      )}

      {opciones ? (
        <select
          id={identificador}
          name={nombre}
          value={valor}
          disabled={deshabilitado}
          aria-invalid={hayError}
          aria-describedby={etiquetaAyuda ? `${identificador}-ayuda` : undefined}
          className={clasesControl}
          onChange={onCambio}
          {...rest}
        >
          {opciones.map((opcion) => (
            <option key={opcion.valor} value={opcion.valor}>
              {opcion.etiqueta}
            </option>
          ))}
        </select>
      ) : tipo === 'area' ? (
        <textarea
          id={identificador}
          name={nombre}
          rows={rest.rows ?? 3}
          value={valor}
          placeholder={placeholder}
          disabled={deshabilitado}
          aria-invalid={hayError}
          aria-describedby={etiquetaAyuda ? `${identificador}-ayuda` : undefined}
          className={`${clasesControl} resize-y`}
          onChange={onCambio}
          {...rest}
        />
      ) : (
        <input
          id={identificador}
          type={tipo}
          name={nombre}
          value={valor}
          placeholder={placeholder}
          disabled={deshabilitado}
          aria-invalid={hayError}
          aria-describedby={etiquetaAyuda ? `${identificador}-ayuda` : undefined}
          className={clasesControl}
          onChange={onCambio}
          {...rest}
        />
      )}

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

export default Campo