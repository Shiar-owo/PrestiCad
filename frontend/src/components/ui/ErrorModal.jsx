import { useEffect, useRef } from 'react'
import { CircleAlert } from 'lucide-react'

import Boton from './Boton'

function ErrorModal({ titulo = 'No se pudo completar la acción', mensaje, onCerrar }) {
  const dialogoRef = useRef(null)

  useEffect(() => {
    dialogoRef.current?.querySelector('button')?.focus()
  }, [])

  if (!mensaje) return null

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4"
      role="presentation"
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget) onCerrar()
      }}
    >
      <section
        ref={dialogoRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="error-modal-titulo"
        className="w-full max-w-lg rounded-xl border border-red-300 bg-superficie p-6 shadow-2xl dark:border-red-700"
      >
        <h2 id="error-modal-titulo" className="flex items-center gap-2 text-lg font-bold text-red-700 dark:text-red-300">
          <CircleAlert aria-hidden="true" className="size-5 shrink-0" />
          {titulo}
        </h2>
        <p className="mt-3 whitespace-pre-line text-sm text-texto">{mensaje}</p>
        <div className="mt-5 flex justify-end">
          <Boton tipo="button" onClick={onCerrar}>Entendido</Boton>
        </div>
      </section>
    </div>
  )
}

export default ErrorModal
