import { LoaderCircle } from 'lucide-react'

function Spinner({ etiqueta = 'Cargando…', className = '' }) {
  return (
    <span role="status" className={`inline-flex items-center gap-2 text-sm text-texto-suave ${className}`}>
      <LoaderCircle aria-hidden="true" className="animate-spin text-acento-600" />
      {etiqueta}
    </span>
  )
}

export default Spinner