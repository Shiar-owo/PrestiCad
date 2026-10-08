import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'

import { api } from '../api/client'
import useTituloPagina from '../hooks/useTituloPagina'
import { ETIQUETAS_DANO } from '../constantes/devolucion'
import {
  TAMANO_PAGINA_REPORTES,
  construirRutaReportes,
  validarRespuestaReportes,
} from '../prestamos/reportesDevolucion'
import Campo from '../components/ui/Campo'
import Boton from '../components/ui/Boton'
import Skeleton from '../components/ui/Skeleton'
import ErrorAlerta from '../components/ui/ErrorAlerta'
import EstadoVacio from '../components/ui/EstadoVacio'
import BadgeEstado from '../components/ui/BadgeEstado'

const CONSULTA_INICIAL = { cargando: true, error: '', datos: null }
const FILTROS_INICIALES = { dano: 'todos', fechaDesde: '', fechaHasta: '' }

const OPCIONES_DANO = [
  { valor: 'todos', etiqueta: 'Todos los daños' },
  { valor: 'dano_parcial', etiqueta: 'Daño parcial' },
  { valor: 'dano_total', etiqueta: 'Daño total' },
]

const VARIANTES_DANO = {
  dano_parcial: 'prestado',
  dano_total: 'en_mantenimiento',
}

function moneda(valor) {
  if (valor === null || valor === undefined || valor === '') return '—'
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
  }).format(Number(valor))
}

function fechaLegible(valor) {
  if (!valor) return '—'
  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(valor))
}

function firmarPuntos(delta) {
  if (delta > 0) return `+${delta}`
  if (delta < 0) return String(delta)
  return '0'
}

function ReportesDanos() {
  useTituloPagina('Reportes de daños')
  const [filtros, setFiltros] = useState(FILTROS_INICIALES)
  const [pagina, setPagina] = useState(1)
  const [intento, setIntento] = useState(0)
  const [consulta, setConsulta] = useState(CONSULTA_INICIAL)

  const rangoFechasInvalido = Boolean(
    filtros.fechaDesde
    && filtros.fechaHasta
    && filtros.fechaDesde > filtros.fechaHasta,
  )

  useEffect(() => {
    let activa = true

    if (rangoFechasInvalido) {
      setConsulta({
        cargando: false,
        error: 'La fecha inicial no puede ser posterior a la fecha final.',
        datos: null,
      })
      return undefined
    }

    setConsulta({ cargando: true, error: '', datos: null })
    api
      .get(construirRutaReportes({ ...filtros, pagina }))
      .then(validarRespuestaReportes)
      .then((datos) => {
        if (activa) setConsulta({ cargando: false, error: '', datos })
      })
      .catch(() => {
        if (activa) {
          setConsulta({
            cargando: false,
            error: 'No fue posible consultar los reportes de daños. Intenta nuevamente.',
            datos: null,
          })
        }
      })

    return () => {
      activa = false
    }
  }, [filtros, pagina, intento, rangoFechasInvalido])

  function cambiarFiltro(campo, valor) {
    setFiltros((actual) => ({ ...actual, [campo]: valor }))
    setPagina(1)
  }

  const hayFiltros = filtros.dano !== 'todos' || filtros.fechaDesde || filtros.fechaHasta

  if (consulta.cargando) {
    return (
      <div className="space-y-3" role="status" aria-live="polite">
        <p className="text-sm text-texto-suave">Cargando reportes de daños…</p>
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
    )
  }

  if (consulta.error) {
    return (
      <section aria-label="Reportes de daños" className="grid gap-4">
        <CabeceraReportes />
        <ErrorAlerta mensaje={consulta.error} />
        {!rangoFechasInvalido && (
          <Boton
            variante="secundario"
            className="w-full sm:w-auto"
            onClick={() => setIntento((valor) => valor + 1)}
          >
            Reintentar
          </Boton>
        )}
      </section>
    )
  }

  const { count, next, previous, results } = consulta.datos
  const totalPaginas = Math.max(1, Math.ceil(count / TAMANO_PAGINA_REPORTES))

  return (
    <section aria-label="Reportes de daños">
      <CabeceraReportes />

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Campo
          etiqueta="Tipo de daño"
          opciones={OPCIONES_DANO}
          valor={filtros.dano}
          onCambio={(evento) => cambiarFiltro('dano', evento.target.value)}
        />
        <Campo
          etiqueta="Devuelto desde"
          tipo="date"
          valor={filtros.fechaDesde}
          onCambio={(evento) => cambiarFiltro('fechaDesde', evento.target.value)}
        />
        <Campo
          etiqueta="Devuelto hasta"
          tipo="date"
          valor={filtros.fechaHasta}
          onCambio={(evento) => cambiarFiltro('fechaHasta', evento.target.value)}
        />
      </div>

      {results.length === 0 ? (
        <div className="mt-6">
          <EstadoVacio
            titulo={hayFiltros ? 'Sin reportes con estos filtros' : 'Aún no hay reportes de daños'}
            mensaje={
              hayFiltros
                ? 'Prueba con otros criterios de búsqueda.'
                : 'Los reportes aparecerán aquí cuando una devolución detecte daño parcial o total.'
            }
          />
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-borde bg-white dark:bg-superficie">
          <table className="w-full min-w-[720px] text-sm">
            <caption className="sr-only">Listado de reportes de daños</caption>
            <thead>
              <tr className="border-b border-borde text-left text-xs font-semibold uppercase tracking-wide text-texto-suave">
                <th scope="col" className="px-4 py-3">Material</th>
                <th scope="col" className="px-4 py-3">Prestatario</th>
                <th scope="col" className="px-4 py-3">Gestor</th>
                <th scope="col" className="px-4 py-3">Devolución</th>
                <th scope="col" className="px-4 py-3">Daño</th>
                <th scope="col" className="px-4 py-3">Sanción</th>
                <th scope="col" className="px-4 py-3">Cobro</th>
                <th scope="col" className="px-4 py-3">
                  <span className="sr-only">Reporte</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {results.map((reporte) => (
                <tr
                  key={reporte.devolucion_id}
                  className="border-b border-borde last:border-b-0 text-texto"
                >
                  <td className="px-4 py-3">
                    <span className="block font-semibold">{reporte.material_nombre}</span>
                    <span className="block text-xs text-texto-suave">
                      {reporte.material_codigo}
                    </span>
                  </td>
                  <td className="px-4 py-3">{reporte.prestatario_nombre}</td>
                  <td className="px-4 py-3">{reporte.gestor_nombre}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {fechaLegible(reporte.fecha_devolucion)}
                  </td>
                  <td className="px-4 py-3">
                    <BadgeEstado
                      estado={VARIANTES_DANO[reporte.dano] ?? 'desconocido'}
                      texto={ETIQUETAS_DANO[reporte.dano] ?? reporte.dano}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        reporte.puntos_delta >= 0
                          ? 'font-semibold text-acento-700'
                          : 'font-semibold text-error'
                      }
                    >
                      {firmarPuntos(reporte.puntos_delta)} pts
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {moneda(reporte.cobro_economico)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Boton
                      variante="secundario"
                      tamanio="pequeno"
                      tipo="button"
                      icono={Download}
                      onClick={() =>
                        window.open(reporte.reporte_url, '_blank', 'noopener,noreferrer')}
                    >
                      Descargar
                    </Boton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {count > 0 && (
        <nav className="mt-6 flex flex-wrap items-center justify-center gap-3" aria-label="Páginas de reportes">
          <Boton
            variante="secundario"
            tipo="button"
            deshabilitado={!previous}
            onClick={() => setPagina((actual) => actual - 1)}
          >
            Anterior
          </Boton>
          <span className="text-sm text-texto-suave" aria-live="polite">
            Página {pagina} de {totalPaginas} · {count} reportes
          </span>
          <Boton
            variante="secundario"
            tipo="button"
            deshabilitado={!next}
            onClick={() => setPagina((actual) => actual + 1)}
          >
            Siguiente
          </Boton>
        </nav>
      )}
    </section>
  )
}

function CabeceraReportes() {
  return (
    <header>
      <h2 className="text-xl font-bold text-texto">Reportes de daños</h2>
      <p className="mt-1 text-sm text-texto-suave">
        Listado de reportes PDF generados ante daños en las devoluciones. Descarga cada
        reporte para su archivo.
      </p>
    </header>
  )
}

export default ReportesDanos
