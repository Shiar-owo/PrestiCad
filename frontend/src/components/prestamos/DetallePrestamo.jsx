import { presentarEstadoPrestamo } from '../../prestamos/estadoPrestamo'

function mostrarFecha(fecha) {
  const valor = new Date(fecha)
  if (Number.isNaN(valor.getTime())) return fecha

  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(valor)
}

export default function DetallePrestamo({
  prestamo,
  onVolver,
  etiquetaVolver = 'Volver a mis préstamos',
}) {
  const estado = presentarEstadoPrestamo(prestamo.estado_visible ?? prestamo.estado)

  return (
    <section className="prestamo-detalle" aria-labelledby="prestamo-detalle-titulo">
      <button className="prestamo-detalle__volver" onClick={onVolver} type="button">
        {etiquetaVolver}
      </button>
      <h3 id="prestamo-detalle-titulo">Detalle del préstamo</h3>
      <dl className="prestamo-detalle__campos">
        {prestamo.prestatario_nombre && (
          <div>
            <dt>Prestatario</dt>
            <dd>{prestamo.prestatario_nombre}</dd>
          </div>
        )}
        <div>
          <dt>Material</dt>
          <dd>{prestamo.material_nombre}</dd>
        </div>
        <div>
          <dt>Código de inventario</dt>
          <dd>{prestamo.material_codigo}</dd>
        </div>
        <div>
          <dt>Fecha de entrega</dt>
          <dd>{mostrarFecha(prestamo.fecha_entrega)}</dd>
        </div>
        <div>
          <dt>Fecha límite</dt>
          <dd>{mostrarFecha(prestamo.fecha_limite)}</dd>
        </div>
        <div>
          <dt>Duración</dt>
          <dd>{prestamo.tiempo_prestamo_dias} días</dd>
        </div>
        <div>
          <dt>Estado</dt>
          <dd>
            <span className={`prestamo-estado ${estado.clase}`}>
              {estado.texto}
            </span>
          </dd>
        </div>
      </dl>
    </section>
  )
}
