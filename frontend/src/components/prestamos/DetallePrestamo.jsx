import { ArrowLeft, RotateCcw } from 'lucide-react'

import BadgeEstado from '../ui/BadgeEstado'
import Boton from '../ui/Boton'
import Tarjeta from '../ui/Tarjeta'

function mostrarFecha(fecha) {
  const valor = new Date(fecha)
  if (Number.isNaN(valor.getTime())) return fecha

  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(valor)
}

function CampoDetalle({ etiqueta, children }) {
  return (
    <div className="rounded-xl border border-borde bg-superficie p-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-texto-suave">
        {etiqueta}
      </dt>
      <dd className="mt-1 break-words text-sm font-medium text-texto">{children}</dd>
    </div>
  )
}

export default function DetallePrestamo({
  prestamo,
  onVolver,
  etiquetaVolver = 'Volver a mis préstamos',
  onDevolucion = null,
}) {
  const estado = prestamo.estado_visible ?? prestamo.estado

  return (
    <Tarjeta className="p-6" aria-labelledby="prestamo-detalle-titulo">
      <Boton
        variante="fantasma"
        tamanio="pequeno"
        tipo="button"
        icono={ArrowLeft}
        onClick={onVolver}
      >
        {etiquetaVolver}
      </Boton>
      <h3 id="prestamo-detalle-titulo" className="mt-4 text-lg font-bold text-texto">
        Detalle del préstamo
      </h3>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {prestamo.prestatario_nombre && (
          <CampoDetalle etiqueta="Prestatario">{prestamo.prestatario_nombre}</CampoDetalle>
        )}
        <CampoDetalle etiqueta="Material">{prestamo.material_nombre}</CampoDetalle>
        <CampoDetalle etiqueta="Código de inventario">{prestamo.material_codigo}</CampoDetalle>
        <CampoDetalle etiqueta="Fecha de entrega">{mostrarFecha(prestamo.fecha_entrega)}</CampoDetalle>
        <CampoDetalle etiqueta="Fecha límite">{mostrarFecha(prestamo.fecha_limite)}</CampoDetalle>
        <CampoDetalle etiqueta="Duración">{prestamo.tiempo_prestamo_dias} días</CampoDetalle>
        <CampoDetalle etiqueta="Estado">
          <BadgeEstado estado={estado} />
        </CampoDetalle>
      </dl>
      {onDevolucion && (
        <Boton
          tipo="button"
          icono={RotateCcw}
          className="mt-4"
          onClick={onDevolucion}
        >
          Registrar devolución
        </Boton>
      )}
    </Tarjeta>
  )
}