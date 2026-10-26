import { useContext } from 'react'
import { Link, NavLink, Outlet } from 'react-router'
import {
  ArrowUpRight,
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
  'historial-prestamos': History,
  reportes: FileText,
}

function clasePestana({ isActive }) {
  return `inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento-600 ${
    isActive
      ? 'bg-marca-700 text-white dark:bg-marca-600 dark:text-white'
      : 'text-texto hover:bg-superficie-alta'
  }`
}

export function SeccionGestionPrestamosLayout() {
  const { usuario } = useContext(SesionContext)
  const opcionesDisponibles = obtenerOpcionesGestionPrestamos(usuario?.rol)

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-borde bg-superficie p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              to="/panel/gestion-prestamos"
              className="text-lg font-bold text-texto hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento-600"
            >
              Gestionar Préstamos
            </Link>
            <p className="mt-0.5 text-xs text-texto-suave">
              Sección centralizada para entregas, devoluciones, historial y reportes de préstamos.
            </p>
          </div>
          <nav
            aria-label="Opciones de Gestionar Préstamos"
            className="flex flex-wrap gap-1.5"
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
        </div>
      </div>

      <Outlet />
    </div>
  )
}

export default function GestionarPrestamos() {
  useTituloPagina('Gestionar Préstamos')
  const { usuario } = useContext(SesionContext)

  if (!usuario) return null

  return (
    <section aria-labelledby="titulo-gestionar-prestamos" className="space-y-4">
      <header>
        <h2 id="titulo-gestionar-prestamos" className="text-xl font-bold text-texto">
          Opciones de gestión de préstamos
        </h2>
        <p className="mt-1 text-sm text-texto-suave">
          Selecciona el módulo de préstamos con el que deseas trabajar.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {OPCIONES_GESTION_PRESTAMOS.map(({ id, etiqueta, a, descripcion, roles }) => {
          const Icono = ICONOS_OPCION[id] || History
          const habilitado = roles.includes(usuario.rol)

          if (!habilitado) {
            return (
              <div
                key={id}
                aria-disabled="true"
                className="flex items-start justify-between gap-3 rounded-xl border border-borde bg-superficie/60 p-4 opacity-75"
              >
                <span className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-superficie-alta text-texto-suave">
                    <Icono aria-hidden="true" className="size-5" />
                  </span>
                  <span className="block">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-texto">{etiqueta}</span>
                      <span className="rounded-full border border-borde bg-superficie-alta px-2 py-0.5 text-[11px] font-semibold text-texto-suave">
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
              className="group flex items-start justify-between gap-3 rounded-xl border border-borde bg-superficie p-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento-600 hover:border-acento-400 hover:bg-superficie-alta"
            >
              <span className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-marca-600/15 text-marca-700 dark:bg-marca-500/15 dark:text-marca-300">
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
