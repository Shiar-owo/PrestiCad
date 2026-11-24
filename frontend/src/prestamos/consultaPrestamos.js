export const ESTADO_CONSULTA_INICIAL = {
  cargando: true,
  prestamos: [],
  error: '',
}

export function reducirConsultaPrestamos(estado, accion) {
  switch (accion.tipo) {
    case 'iniciar':
      return { ...estado, cargando: true, error: '' }
    case 'exito':
      return { cargando: false, prestamos: accion.prestamos, error: '' }
    case 'error':
      return { cargando: false, prestamos: [], error: accion.mensaje }
    default:
      return estado
  }
}
