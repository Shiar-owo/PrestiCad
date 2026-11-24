import { useEffect, useRef } from 'react'
import { CircleCheck } from 'lucide-react'

import Boton from './Boton'

function ExitoModal({ titulo = 'Acción completada', mensaje, onCerrar, abierto = true }) {
  const dialogoRef = useRef(null)

  useEffect(() => {
    if (abierto && mensaje) dialogoRef.current?.querySelector('button')?.focus()
  }, [abierto, mensaje])

  if (!abierto || !mensaje) return null

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
        role="dialog"
        aria-modal="true"
        aria-labelledby="exito-modal-titulo"
        className="w-full max-w-lg rounded-xl border border-emerald-300 bg-superficie p-6 shadow-2xl dark:border-emerald-700"
      >
        <h2 id="exito-modal-titulo" className="flex items-center gap-2 text-lg font-bold text-emerald-700 dark:text-emerald-300">
          <CircleCheck aria-hidden="true" className="size-5 shrink-0" />
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

export default ExitoModal
