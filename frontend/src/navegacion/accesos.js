import { CalendarDays, CalendarClock, ClipboardList, Package, ShieldCheck } from 'lucide-react'

export const ACCESOS_POR_ROL = {
  prestatario: [
    { id: 'prestamos', etiqueta: 'Mis Préstamos', a: '/panel/prestamos', icono: ClipboardList, descripcion: 'Consulta tus préstamos' },
    { id: 'reservas', etiqueta: 'Mis reservas', a: '/panel/reservas', icono: CalendarClock, descripcion: 'Consulta y gestiona tus reservas' },
  ],
  gestor: [
    { id: 'prestamos', etiqueta: 'Préstamos', a: '/panel/gestion-prestamos', icono: ClipboardList, descripcion: 'Registra entregas, devoluciones y consulta el historial' },
    { id: 'reservas', etiqueta: 'Reservas', a: '/panel/cola-reservas', icono: CalendarClock, descripcion: 'Revisa solicitudes y administra reservas confirmadas' },
    { id: 'inventario', etiqueta: 'Inventario', a: '/panel/inventario', icono: Package, descripcion: 'Administra materiales y ejemplares' },
  ],
  administrador: [
    { id: 'prestamos', etiqueta: 'Préstamos', a: '/panel/gestion-prestamos', icono: ClipboardList, descripcion: 'Registra entregas, devoluciones y consulta el historial' },
    { id: 'reservas', etiqueta: 'Reservas', a: '/panel/cola-reservas', icono: CalendarClock, descripcion: 'Revisa solicitudes y administra reservas confirmadas' },
    { id: 'inventario', etiqueta: 'Inventario', a: '/panel/inventario', icono: Package, descripcion: 'Administra materiales y ejemplares' },
    { id: 'usuarios', etiqueta: 'Usuarios', a: '/admin/roles', icono: ShieldCheck, descripcion: 'Administra usuarios y roles' },
    { id: 'calendario', etiqueta: 'Calendario', a: '/admin/dias-no-laborables', icono: CalendarDays, descripcion: 'Configura los días no laborables' },
  ],
}

export function rutaAccesoActiva(id, pathname) {
  const prefijos = {
    prestamos: ['/panel/prestamos', '/panel/gestion-prestamos', '/panel/prestamo', '/panel/devolucion', '/panel/historial', '/panel/reportes'],
    reservas: ['/panel/reservas', '/panel/cola-reservas'],
    inventario: ['/panel/inventario'],
    usuarios: ['/admin/roles'],
    calendario: ['/admin/dias-no-laborables'],
  }
  return (prefijos[id] || []).some((ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`))
}
