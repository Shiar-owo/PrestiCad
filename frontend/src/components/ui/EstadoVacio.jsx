import { Inbox } from 'lucide-react'

function EstadoVacio({ titulo = 'Sin resultados', mensaje = '', icono: Icono = Inbox }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-borde bg-superficie px-6 py-10 text-center">
      <Icono aria-hidden="true" className="size-8 text-texto-suave" />
      <p className="font-semibold text-texto">{titulo}</p>
      {mensaje && <p className="max-w-sm text-sm text-texto-suave">{mensaje}</p>}
    </div>
  )
}

export default EstadoVacio