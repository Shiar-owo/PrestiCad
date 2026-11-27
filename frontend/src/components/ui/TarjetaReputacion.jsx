import { Award, Shield, ShieldAlert, Sparkles, TrendingUp } from 'lucide-react'
import { ETIQUETAS_TIER } from '../../constantes/roles'

export const CONFIG_TIER = {
  avanzado: {
    nombre: 'Avanzado',
    icono: Award,
    iconoDecorativo: Sparkles,
    colorBorde: 'border-emerald-300 dark:border-emerald-500/30',
    colorFondo: 'bg-gradient-to-br from-emerald-50/90 via-teal-50/40 to-white dark:from-emerald-950/25 dark:via-teal-950/15 dark:to-superficie',
    colorBadge: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-600/40',
    colorBarra: 'bg-emerald-500 dark:bg-emerald-400',
    colorPuntaje: 'text-emerald-700 dark:text-emerald-300',
    colorIcono: 'text-emerald-600 dark:text-emerald-400',
    descripcion: 'Acceso total al catálogo, incluidos equipos de alto valor (con garantía según RN05).',
    rango: '201 a 500 puntos',
  },
  estandar: {
    nombre: 'Estándar',
    icono: Shield,
    iconoDecorativo: TrendingUp,
    colorBorde: 'border-sky-300 dark:border-sky-500/30',
    colorFondo: 'bg-gradient-to-br from-sky-50/80 via-blue-50/40 to-white dark:from-sky-950/25 dark:via-blue-950/15 dark:to-superficie',
    colorBadge: 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-500/20 dark:text-sky-300 dark:border-sky-600/40',
    colorBarra: 'bg-sky-500 dark:bg-sky-400',
    colorPuntaje: 'text-sky-700 dark:text-sky-300',
    colorIcono: 'text-sky-600 dark:text-sky-400',
    descripcion: 'Acceso regular al catálogo. Devuelve a tiempo para subir a nivel Avanzado.',
    rango: '-50 a 200 puntos',
  },
  restringido: {
    nombre: 'Restringido',
    icono: ShieldAlert,
    iconoDecorativo: ShieldAlert,
    colorBorde: 'border-amber-300 dark:border-amber-500/30',
    colorFondo: 'bg-gradient-to-br from-amber-50/80 via-orange-50/40 to-white dark:from-amber-950/25 dark:via-orange-950/15 dark:to-superficie',
    colorBadge: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-600/40',
    colorBarra: 'bg-amber-500 dark:bg-amber-400',
    colorPuntaje: 'text-amber-700 dark:text-amber-300',
    colorIcono: 'text-amber-600 dark:text-amber-400',
    descripcion: 'Acceso a materiales básicos; equipos superiores requieren solicitud excepcional con garantía.',
    rango: '-500 a -51 puntos',
  },
}

export const TOPES_SEMANALES_DEFAULT = {
  restringido: 30,
  estandar: 60,
  avanzado: 80,
}

export function calcularPorcentajeBarra(puntaje) {
  const p = typeof puntaje === 'number' ? puntaje : 0
  const normalizado = Math.max(-500, Math.min(500, p))
  return Math.round(((normalizado + 500) / 1000) * 100)
}

function TarjetaReputacion({
  tier = 'estandar',
  puntaje = 0,
  puntosGanadosSemana = 0,
  topeSemanal = null,
  compacta = false,
  mostrarProgresoSemanal = true,
  className = '',
}) {
  const claveTier = String(tier).toLowerCase()
  const config = CONFIG_TIER[claveTier] || CONFIG_TIER.estandar
  const IconoPrincipal = config.icono
  const nombreTier = ETIQUETAS_TIER[claveTier] || config.nombre
  const porcentaje = calcularPorcentajeBarra(puntaje)
  const signoPuntaje = puntaje > 0 ? `+${puntaje}` : `${puntaje}`
  const topeEfectivo = typeof topeSemanal === 'number' && topeSemanal > 0
    ? topeSemanal
    : TOPES_SEMANALES_DEFAULT[claveTier] || 60
  const puntosSemana = typeof puntosGanadosSemana === 'number' ? Math.max(0, puntosGanadosSemana) : 0
  const topeAlcanzado = puntosSemana >= topeEfectivo

  if (compacta) {
    return (
      <div
        className={`relative overflow-hidden rounded-xl border p-5 shadow-xs transition-shadow ${config.colorBorde} ${config.colorFondo} ${className}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-texto-suave">
              <IconoPrincipal aria-hidden="true" className={`size-4 ${config.colorIcono}`} />
              Reputación de cuenta
            </p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-extrabold text-texto">{nombreTier}</span>
              <span className={`text-sm font-bold ${config.colorPuntaje}`}>
                ({signoPuntaje} pts)
              </span>
            </div>
          </div>
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold ${config.colorBadge}`}
          >
            Nivel {nombreTier}
          </span>
        </div>

        {mostrarProgresoSemanal && (
          <div className="mt-2.5 flex items-center justify-between text-[11px] font-medium text-texto-suave border-t border-borde/30 pt-2">
            <span>Esta semana (Lun-Vie):</span>
            <span className={`font-bold ${topeAlcanzado ? 'text-amber-700 dark:text-amber-400' : 'text-texto'}`}>
              +{puntosSemana} / {topeEfectivo} pts {topeAlcanzado ? '(Tope)' : ''}
            </span>
          </div>
        )}

        {/* Mini barra de nivel */}
        <div className="mt-2">
          <div className="flex justify-between text-[11px] font-semibold text-texto-suave">
            <span>Escala</span>
            <span>{config.rango}</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-superficie-alta/80 dark:bg-superficie-alta">
            <div
              className={`h-full rounded-full transition-all duration-500 ${config.colorBarra}`}
              style={{ width: `${Math.max(6, Math.min(100, porcentaje))}%` }}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-6 shadow-xs transition-shadow ${config.colorBorde} ${config.colorFondo} ${className}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5">
          <div className={`flex size-12 items-center justify-center rounded-xl bg-superficie shadow-xs ring-1 ${config.colorBorde}`}>
            <IconoPrincipal aria-hidden="true" className={`size-6 ${config.colorIcono}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-texto-suave">
                Nivel de Reputación
              </span>
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${config.colorBadge}`}
              >
                {nombreTier}
              </span>
            </div>
            <p className="mt-0.5 text-2xl font-black text-texto">
              {signoPuntaje}{' '}
              <span className="text-sm font-semibold text-texto-suave">puntos</span>
            </p>
          </div>
        </div>

        <div className="sm:text-right">
          <span className="inline-block text-xs font-semibold text-texto-suave">
            Rango de nivel: <strong className="text-texto">{config.rango}</strong>
          </span>
          <p className="mt-1 max-w-sm text-xs text-texto-suave sm:ml-auto">
            {config.descripcion}
          </p>
        </div>
      </div>

      {/* Progreso semanal (Lunes a Viernes) */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-superficie/60 p-3 text-xs text-texto-suave border border-borde/40 dark:bg-superficie-alta/30">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-texto">Puntos ganados esta semana (Lun-Vie):</span>
          <span className="font-bold text-texto">
            +{puntosSemana} de {topeEfectivo} pts máx.
          </span>
        </div>
        {topeAlcanzado ? (
          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700">
            Tope semanal alcanzado
          </span>
        ) : (
          <span className="text-[11px] text-texto-suave">
            Disponible: +{Math.max(0, topeEfectivo - puntosSemana)} pts
          </span>
        )}
      </div>

      {/* Barra de progreso visual de reputación */}
      <div className="mt-4 pt-3 border-t border-borde/40">
        <div className="flex items-center justify-between text-xs font-semibold text-texto-suave">
          <span>Restringido (-500)</span>
          <span>Estándar (0)</span>
          <span>Avanzado (+500)</span>
        </div>
        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-superficie-alta/80 dark:bg-superficie-alta">
          <div
            className={`h-full rounded-full transition-all duration-500 ${config.colorBarra}`}
            style={{ width: `${Math.max(4, Math.min(100, porcentaje))}%` }}
          />
        </div>
      </div>
    </div>
  )
}

export default TarjetaReputacion
