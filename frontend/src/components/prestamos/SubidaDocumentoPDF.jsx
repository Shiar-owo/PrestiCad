import { useId, useRef } from 'react'

function SubidaDocumentoPDF({
  etiqueta,
  archivo,
  onCambio,
  error = '',
  ayuda,
  enlaceAyuda,
  enlaceExistente,
  requerido = true,
}) {
  const identificador = useId()
  const entrada = useRef(null)
  const idAyuda = `${identificador}-ayuda`
  const mensaje = error || ayuda
  const debeSerRequerido = requerido && !archivo

  function cambiarArchivo(evento) {
    onCambio(evento.target.files?.[0] ?? null)
  }

  function quitarArchivo() {
    if (entrada.current) entrada.current.value = ''
    onCambio(null)
  }

  return (
    <div className="grid gap-1">
      <label className="text-sm font-semibold text-texto" htmlFor={identificador}>
        {etiqueta}
        {debeSerRequerido && <span aria-hidden="true" className="text-error"> *</span>}
      </label>
      <input
        ref={entrada}
        id={identificador}
        type="file"
        accept="application/pdf,.pdf"
        required={debeSerRequerido}
        onChange={cambiarArchivo}
        aria-invalid={Boolean(error)}
        aria-describedby={mensaje ? idAyuda : undefined}
        className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-texto file:mr-3 file:rounded-md file:border-0 file:bg-marca-50 file:px-3 file:py-1.5 file:font-semibold file:text-marca-800 dark:bg-superficie dark:file:bg-marca-500/15 dark:file:text-marca-300 ${error ? 'border-error' : 'border-borde'}`}
      />
      {archivo && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-texto-suave">
          <span className="font-medium text-texto">{archivo.name}</span>
          {enlaceExistente && (
            <a
              href={enlaceExistente}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-acento-700 underline dark:text-acento-300"
            >
              Ver PDF
            </a>
          )}
          <button
            type="button"
            onClick={quitarArchivo}
            className="font-semibold text-acento-700 underline dark:text-acento-300"
          >
            Quitar archivo
          </button>
        </div>
      )}
      {mensaje && (
        <p id={idAyuda} className={`text-xs ${error ? 'text-error' : 'text-texto-suave'}`}>
          {mensaje}
        </p>
      )}
      {enlaceAyuda && <div className="text-xs text-marca-700 underline dark:text-marca-400">{enlaceAyuda}</div>}
    </div>
  )
}

export default SubidaDocumentoPDF
