import { CalendarCheck2, ClipboardCheck } from 'lucide-react'

import Tarjeta from '../ui/Tarjeta'

function IndicadorLimite({ etiqueta, usados, limite, icono: Icono, tono }) {
  const valorUsado = Math.max(0, Number(usados) || 0)
  const valorLimite = Math.max(0, Number(limite) || 0)
  const porcentaje = valorLimite > 0 ? Math.min(100, (valorUsado / valorLimite) * 100) : 0
  const alcanzado = valorLimite > 0 && valorUsado >= valorLimite
  const colores = tono === 'acento'
    ? {
        icono: 'bg-acento-100 text-acento-700 dark:bg-acento-500/15 dark:text-acento-300',
        barra: 'bg-acento-600 dark:bg-acento-400',
      }
    : {
        icono: 'bg-marca-100 text-marca-700 dark:bg-marca-500/15 dark:text-marca-300',
        barra: 'bg-marca-600 dark:bg-marca-400',
      }

  return (
    <div className="rounded-xl bg-superficie p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-texto-suave">{etiqueta}</p>
          <p className="mt-1 text-2xl font-extrabold tracking-tight text-texto">
            {valorUsado}<span className="ml-1 text-base font-semibold text-texto-suave">/ {valorLimite}</span>
          </p>
          <p className="mt-0.5 text-xs text-texto-suave">En uso / límite permitido</p>
        </div>
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${colores.icono}`}>
          <Icono aria-hidden="true" className="size-5" />
        </span>
      </div>
      <div
        className="mt-4 h-2 overflow-hidden rounded-full bg-superficie-alta"
        role="progressbar"
        aria-label={`${etiqueta}: ${valorUsado} de ${valorLimite}`}
        aria-valuemin="0"
        aria-valuemax={valorLimite || 1}
        aria-valuenow={Math.min(valorUsado, valorLimite || 1)}
      >
        <div className={`h-full rounded-full transition-[width] ${alcanzado ? 'bg-amber-500' : colores.barra}`} style={{ width: `${porcentaje}%` }} />
      </div>
      <p className={`mt-2 text-xs font-semibold ${alcanzado ? 'text-amber-800 dark:text-amber-300' : 'text-texto-suave'}`}>
        {alcanzado ? 'Límite alcanzado' : `Disponibles: ${Math.max(0, valorLimite - valorUsado)}`}
      </p>
    </div>
  )
}

export default function ResumenLimitesPrestatario({
  prestamosActivos = 0,
  maximoPrestamos = 3,
  reservasActivas = 0,
  maximoReservas = 3,
}) {
  return (
    <Tarjeta className="border-acento-200 bg-gradient-to-r from-acento-50 to-superficie p-4 sm:p-5 dark:border-acento-800 dark:from-acento-950/30 dark:to-superficie">
      <div className="mb-4">
        <h2 className="text-base font-bold text-texto">Tus límites de actividad</h2>
        <p className="mt-0.5 text-xs text-texto-suave">Consulta cuántos préstamos y reservas activas tienes permitidos.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <IndicadorLimite
          etiqueta="Préstamos activos"
          usados={prestamosActivos}
          limite={maximoPrestamos}
          icono={ClipboardCheck}
          tono="marca"
        />
        <IndicadorLimite
          etiqueta="Reservas activas"
          usados={reservasActivas}
          limite={maximoReservas}
          icono={CalendarCheck2}
          tono="acento"
        />
      </div>
    </Tarjeta>
  )
}
