import { useEffect, useRef } from 'react'

import Boton from './Boton'

function AdvertenciaModal({
  titulo,
  descripcion = 'Completa los requisitos indicados antes de continuar.',
  mensajes,
  onCerrar,
}) {
  const dialogoRef = useRef(null)

  useEffect(() => {
    dialogoRef.current?.querySelector('button')?.focus()
  }, [])

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
      role="presentation"
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget) onCerrar()
      }}
    >
      <section
        role="dialog"
        ref={dialogoRef}
        aria-modal="true"
        aria-labelledby="advertencia-modal-titulo"
        className="w-full max-w-lg rounded-xl border border-amber-300 bg-superficie p-6 shadow-2xl dark:border-amber-700"
      >
        <h2 id="advertencia-modal-titulo" className="text-lg font-bold text-amber-800 dark:text-amber-300">
          {titulo}
        </h2>
        <p className="mt-2 text-sm text-texto-suave">{descripcion}</p>
        <ul className="mt-3 list-inside list-disc space-y-1 text-sm font-medium text-texto">
          {mensajes.map((mensaje, indice) => <li key={`${mensaje}-${indice}`}>{mensaje}</li>)}
        </ul>
        <div className="mt-5 flex justify-end">
          <Boton tipo="button" onClick={onCerrar}>Entendido</Boton>
        </div>
      </section>
    </div>
  )
}

export default AdvertenciaModal
