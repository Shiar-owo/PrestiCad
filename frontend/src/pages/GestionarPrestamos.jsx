import { useContext } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import {
  ArrowUpRight,
  CalendarClock,
  FileText,
  History,
  PackagePlus,
  RotateCcw,
} from 'lucide-react'

import SesionContext from '../contextos/SesionContext'
import useTituloPagina from '../hooks/useTituloPagina'
import {
  OPCIONES_GESTION_PRESTAMOS,
  obtenerOpcionesGestionPrestamos,
} from '../prestamos/navegacionPrestamos'

const ICONOS_OPCION = {
  'registrar-prestamo': PackagePlus,
  'registrar-devolucion': RotateCcw,
  'cola-reservas': CalendarClock,
  'historial-prestamos': History,
  reportes: FileText,
}

function clasePestana({ isActive }) {
  return `inline-flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento-600 ${
    isActive
      ? 'bg-marca-700 text-white shadow-sm dark:bg-marca-600 dark:text-white'
      : 'text-texto-suave hover:bg-superficie-alta hover:text-texto'
  }`
}

export function SeccionGestionPrestamosLayout() {
  const { usuario } = useContext(SesionContext)
  const location = useLocation()
  const opcionesDisponibles = obtenerOpcionesGestionPrestamos(usuario?.rol)
  const esIndex = location.pathname.replace(/\/+$/, '') === '/panel/gestion-prestamos'

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-borde bg-superficie shadow-sm">
        <div className="flex flex-col gap-4 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-marca-600/15 text-marca-700 dark:bg-marca-500/15 dark:text-marca-300">
              <PackagePlus aria-hidden="true" className="size-5" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-acento-700 dark:text-acento-300">Área de gestión</p>
              <Link
                to="/panel/gestion-prestamos"
                className="mt-0.5 inline-block text-lg font-bold text-texto hover:text-marca-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento-600 dark:hover:text-marca-300"
              >
                Préstamos
              </Link>
              <p className="mt-0.5 text-xs text-texto-suave">
                Sección centralizada para entregas, devoluciones, historial y reportes de préstamos.
              </p>
            </div>
          </div>
          {!esIndex && (
            <nav
              aria-label="Opciones de Préstamos"
              className="flex flex-wrap gap-1.5 rounded-xl bg-fondo p-1.5 dark:bg-fondo"
            >
              {opcionesDisponibles.map(({ id, etiqueta, a }) => {
                const Icono = ICONOS_OPCION[id] || History
                return (
                  <NavLink key={id} to={a} className={clasePestana}>
                    <Icono aria-hidden="true" className="size-4" />
                    <span>{etiqueta}</span>
                  </NavLink>
                )
              })}
            </nav>
          )}
        </div>
      </div>

      <Outlet />
    </div>
  )
}

export default function GestionarPrestamos() {
  useTituloPagina('Préstamos')
  const { usuario } = useContext(SesionContext)

  if (!usuario) return null

  return (
    <section aria-labelledby="titulo-gestionar-prestamos" className="mx-auto w-full max-w-6xl space-y-6">
      <header className="rounded-2xl border border-borde bg-gradient-to-r from-superficie via-superficie to-acento-50 p-5 shadow-sm sm:p-6 dark:to-superficie-alta">
        <p className="text-xs font-bold uppercase tracking-wider text-acento-700 dark:text-acento-300">Centro de trabajo</p>
        <h2 id="titulo-gestionar-prestamos" className="mt-1 text-2xl font-bold text-texto">
          Préstamos
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-texto-suave">
          Selecciona el módulo de préstamos con el que deseas trabajar.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {OPCIONES_GESTION_PRESTAMOS.map(({ id, etiqueta, a, descripcion, roles }) => {
          const Icono = ICONOS_OPCION[id] || History
          const habilitado = roles.includes(usuario.rol)

          if (!habilitado) {
            return (
              <div
                key={id}
                aria-disabled="true"
                className="flex min-h-32 items-start justify-between gap-3 rounded-2xl border border-borde bg-superficie/60 p-5 opacity-75"
              >
                <span className="flex items-start gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-superficie-alta text-texto-suave">
                    <Icono aria-hidden="true" className="size-5" />
                  </span>
                  <span className="block">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-texto">{etiqueta}</span>
                      <span className="rounded-full border border-borde bg-superficie-alta px-2.5 py-1 text-[11px] font-semibold text-texto-suave">
                        Exclusivo de Gestor
                      </span>
                    </span>
                    <span className="mt-1 block text-xs text-texto-suave">{descripcion}</span>
                  </span>
                </span>
              </div>
            )
          }

          return (
            <Link
              key={id}
              to={a}
              className="group flex min-h-32 items-start justify-between gap-4 rounded-2xl border border-borde bg-superficie p-5 shadow-sm transition duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento-600 hover:-translate-y-0.5 hover:border-acento-400 hover:bg-superficie-alta hover:shadow-md"
            >
              <span className="flex items-start gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-marca-600/15 text-marca-700 dark:bg-marca-500/15 dark:text-marca-300">
                  <Icono aria-hidden="true" className="size-5" />
                </span>
                <span className="block">
                  <span className="block text-sm font-semibold text-texto">{etiqueta}</span>
                  <span className="mt-0.5 block text-xs text-texto-suave">{descripcion}</span>
                </span>
              </span>
              <ArrowUpRight
                aria-hidden="true"
                className="mt-0.5 size-4 text-texto-suave transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              />
            </Link>
          )
        })}
      </div>
    </section>
  )
}
