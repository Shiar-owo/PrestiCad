import { useState } from 'react'

import { ErrorApi } from '../api/client'
import Boton from './ui/Boton'
import Campo from './ui/Campo'
import ErrorAlerta from './ui/ErrorAlerta'

function obtenerMensajeError(error) {
  if (error instanceof ErrorApi && error.datos) {
    const mensajes = Object.values(error.datos).flat().filter(Boolean)
    if (mensajes.length) return mensajes.join(' ')
  }
  return 'No se pudo eliminar el registro. Inténtalo de nuevo.'
}

function ConfirmacionDobleEliminacion({
  titulo,
  descripcion,
  codigoConfirmacion,
  onConfirmar,
  onCancelar,
}) {
  const [paso, setPaso] = useState(1)
  const [codigoIngresado, setCodigoIngresado] = useState('')
  const [error, setError] = useState('')
  const [eliminando, setEliminando] = useState(false)

  async function confirmarEliminacion() {
    setEliminando(true)
    setError('')
    try {
      await onConfirmar()
    } catch (errorApi) {
      setError(obtenerMensajeError(errorApi))
    } finally {
      setEliminando(false)
    }
  }

  const codigoValido = codigoIngresado.trim().toLocaleUpperCase() === codigoConfirmacion.toLocaleUpperCase()

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      role="presentation"
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget && !eliminando) onCancelar()
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmacion-eliminacion-titulo"
        className="w-full max-w-lg rounded-xl border border-borde bg-superficie p-6 shadow-2xl"
      >
        <h3 id="confirmacion-eliminacion-titulo" className="text-lg font-bold text-texto">
          {paso === 1 ? titulo : 'Confirma la eliminación'}
        </h3>
        {paso === 1 ? (
          <>
            <p className="mt-3 text-sm leading-relaxed text-texto-suave">{descripcion}</p>
            <p className="mt-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-800 dark:border-red-700 dark:bg-red-950/40 dark:text-red-300">
              Esta acción es permanente y no se puede deshacer.
            </p>
          </>
        ) : (
          <div className="mt-3 grid gap-3">
            <p className="text-sm text-texto-suave">
              Como segunda verificación, escribe el código <strong className="font-mono text-texto">{codigoConfirmacion}</strong> para continuar.
            </p>
            <Campo
              etiqueta="Código de confirmación"
              valor={codigoIngresado}
              onCambio={(evento) => setCodigoIngresado(evento.target.value)}
              autoFocus
              autoComplete="off"
            />
          </div>
        )}

        {error && <ErrorAlerta mensaje={error} className="mt-4" />}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Boton tipo="button" variante="secundario" onClick={onCancelar} deshabilitado={eliminando}>
            Cancelar
          </Boton>
          {paso === 1 ? (
            <Boton tipo="button" variante="peligro" onClick={() => setPaso(2)}>
              Continuar
            </Boton>
          ) : (
            <Boton
              tipo="button"
              variante="peligro"
              cargando={eliminando}
              deshabilitado={!codigoValido || eliminando}
              onClick={confirmarEliminacion}
            >
              Eliminar definitivamente
            </Boton>
          )}
        </div>
      </section>
    </div>
  )
}

export default ConfirmacionDobleEliminacion
