export const OPCIONES_GESTION_PRESTAMOS = [
  {
    id: 'registrar-prestamo',
    etiqueta: 'Registrar Préstamo',
    a: '/panel/prestamo',
    descripcion: 'Entrega física de ejemplares con checklist inicial y garantía.',
    roles: ['gestor'],
  },
  {
    id: 'registrar-devolucion',
    etiqueta: 'Registrar Devolución',
    a: '/panel/devolucion',
    descripcion: 'Inspección del ejemplar devuelto, cálculo de reputación y sanciones.',
    roles: ['gestor'],
  },
  {
    id: 'historial-prestamos',
    etiqueta: 'Historial de Préstamos',
    a: '/panel/historial',
    descripcion: 'Consulta histórica, fichas de ejemplares entregados y documentos.',
    roles: ['gestor', 'administrador'],
  },
  {
    id: 'reportes',
    etiqueta: 'Reportes',
    a: '/panel/reportes',
    descripcion: 'Listado y descarga de reportes PDF por daños en devoluciones.',
    roles: ['gestor', 'administrador'],
  },
]

export function obtenerOpcionesGestionPrestamos(rol) {
  if (!rol) return []
  return OPCIONES_GESTION_PRESTAMOS.filter((opcion) => opcion.roles.includes(rol))
}

export function esRutaGestionPrestamos(pathname = '') {
  return [
    '/panel/gestion-prestamos',
    '/panel/prestamo',
    '/panel/devolucion',
    '/panel/historial',
    '/panel/reportes',
  ].some((prefijo) => pathname === prefijo || pathname.startsWith(`${prefijo}/`))
}
