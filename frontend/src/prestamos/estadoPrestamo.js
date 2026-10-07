const PRESENTACION_ESTADOS = {
  activo: { texto: 'Activo', clase: 'prestamo-estado--activo' },
  reservado: { texto: 'Reservado', clase: 'prestamo-estado--reservado' },
  vencido: { texto: 'Vencido', clase: 'prestamo-estado--vencido' },
  devuelto: { texto: 'Devuelto', clase: 'prestamo-estado--devuelto' },
}

function fechaComoNumero(fecha) {
  const valor = new Date(fecha).getTime()
  return Number.isNaN(valor) ? null : valor
}

export function obtenerEstadoVisible(prestamo, ahora = new Date()) {
  if (prestamo.estado !== 'activo') return prestamo.estado

  const fechaLimite = fechaComoNumero(prestamo.fecha_limite)
  if (fechaLimite === null || fechaLimite >= ahora.getTime()) return prestamo.estado

  return 'vencido'
}

export function presentarEstadoPrestamo(estado) {
  return PRESENTACION_ESTADOS[estado] || {
    texto: 'Estado desconocido',
    clase: 'prestamo-estado--desconocido',
  }
}

export function ordenarPrestamos(prestamos, ahora = new Date()) {
  return prestamos
    .map((prestamo) => ({
      ...prestamo,
      estado_visible: obtenerEstadoVisible(prestamo, ahora),
    }))
    .sort((a, b) => {
      const aVencido = a.estado_visible === 'vencido'
      const bVencido = b.estado_visible === 'vencido'
      if (aVencido !== bVencido) return aVencido ? -1 : 1

      if (aVencido) {
        const fechaLimiteA = fechaComoNumero(a.fecha_limite) ?? Number.POSITIVE_INFINITY
        const fechaLimiteB = fechaComoNumero(b.fecha_limite) ?? Number.POSITIVE_INFINITY
        if (fechaLimiteA !== fechaLimiteB) return fechaLimiteA - fechaLimiteB
      } else {
        const fechaEntregaA = fechaComoNumero(a.fecha_entrega) ?? 0
        const fechaEntregaB = fechaComoNumero(b.fecha_entrega) ?? 0
        if (fechaEntregaA !== fechaEntregaB) return fechaEntregaB - fechaEntregaA
      }

      return Number(b.id) - Number(a.id)
    })
}
