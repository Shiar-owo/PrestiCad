import { useEffect, useState } from 'react'
import { Download, FileText } from 'lucide-react'

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
import Tarjeta from '../components/ui/Tarjeta'
import SelectorPrestatario from '../components/prestamos/SelectorPrestatario'

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
  const [nombreEntrada, setNombreEntrada] = useState('')
  const [dniEntrada, setDniEntrada] = useState('')
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

    setConsulta((actual) => ({ cargando: true, error: '', datos: actual.datos }))
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
    if (filtros[campo] === valor) return
    setFiltros((actual) => ({ ...actual, [campo]: valor }))
    setPagina(1)
  }

  function seleccionarPrestatario(prestatario, modo) {
    setDniEntrada(prestatario.dni)
    setNombreEntrada(modo === 'nombre' ? prestatario.nombre_completo : '')
    cambiarFiltro('dni', prestatario.dni)
  }

  const hayFiltros = filtros.dano !== 'todos' || filtros.fechaDesde || filtros.fechaHasta || filtros.dni

  if (consulta.cargando && !consulta.datos) {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-3" role="status" aria-live="polite">
        <CabeceraReportes />
        <p className="text-sm text-texto-suave">Cargando reportes de daños…</p>
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
    )
  }

  const count = consulta.datos?.count ?? 0
  const next = consulta.datos?.next ?? null
  const previous = consulta.datos?.previous ?? null
  const results = consulta.datos?.results ?? []
  const totalPaginas = Math.max(1, Math.ceil(count / TAMANO_PAGINA_REPORTES))

  return (
    <section aria-label="Reportes de daños" className="mx-auto w-full max-w-7xl">
      <CabeceraReportes />

      {consulta.cargando && (
        <p className="mt-3 text-xs text-texto-suave" role="status" aria-live="polite">
          Actualizando reportes…
        </p>
      )}

      <Tarjeta className="mt-5 space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-borde pb-3">
          <div>
            <h3 className="text-base font-bold text-texto">Buscar reportes</h3>
            <p className="mt-0.5 text-xs text-texto-suave">Filtra por prestatario, tipo de daño o fecha de devolución.</p>
          </div>
          <span className="rounded-full bg-superficie-alta px-3 py-1 text-xs font-semibold text-texto-suave">
            {count} {count === 1 ? 'reporte' : 'reportes'}
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <div className="grid gap-3">
            <SelectorPrestatario
              modo="nombre"
              incluirInactivos
              etiqueta="Buscar por nombre"
              valor={nombreEntrada}
              ayuda="Escribe el nombre y selecciona a la persona; las opciones incluyen su DNI."
              onCambio={(valor) => {
                setNombreEntrada(valor)
                if (filtros.dni) {
                  setDniEntrada('')
                  cambiarFiltro('dni', '')
                }
              }}
              onSeleccionar={(prestatario) => seleccionarPrestatario(prestatario, 'nombre')}
            />
          </div>
          <div className="grid gap-3">
            <SelectorPrestatario
              incluirInactivos
              etiqueta="Buscar por DNI"
              valor={dniEntrada}
              ayuda="Escribe el DNI para elegir a la persona o completa los 8 dígitos."
              onCambio={(valor) => {
                setDniEntrada(valor)
                setNombreEntrada('')
                cambiarFiltro('dni', valor.length === 8 ? valor : '')
              }}
              onSeleccionar={(prestatario) => seleccionarPrestatario(prestatario, 'dni')}
            />
            {filtros.dni && (
              <Boton
                variante="secundario"
                tipo="button"
                tamanio="pequeno"
                className="w-fit"
                onClick={() => {
                  setNombreEntrada('')
                  setDniEntrada('')
                  cambiarFiltro('dni', '')
                }}
              >
                Quitar filtro de prestatario
              </Boton>
            )}
          </div>
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
            max={filtros.fechaHasta || undefined}
            onCambio={(evento) => cambiarFiltro('fechaDesde', evento.target.value)}
          />
          <Campo
            etiqueta="Devuelto hasta"
            tipo="date"
            valor={filtros.fechaHasta}
            min={filtros.fechaDesde || undefined}
            onCambio={(evento) => cambiarFiltro('fechaHasta', evento.target.value)}
          />
          {(filtros.dano !== 'todos' || filtros.fechaDesde || filtros.fechaHasta || filtros.dni) && (
            <Boton
              variante="fantasma"
              tipo="button"
              tamanio="pequeno"
              className="w-fit xl:col-span-5"
              onClick={() => {
                setFiltros(FILTROS_INICIALES)
                setNombreEntrada('')
                setDniEntrada('')
                setPagina(1)
              }}
            >
              Limpiar filtros
            </Boton>
          )}
        </div>
      </Tarjeta>

      {consulta.error ? (
        <div className="mt-5 grid gap-3">
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
        </div>
      ) : results.length === 0 ? (
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
        <ul className="mt-5 grid gap-4">
          {results.map((reporte) => (
            <li key={reporte.devolucion_id}>
              <Tarjeta className="space-y-4 p-5 transition-shadow hover:shadow-md sm:p-6">
                <div className="flex flex-col gap-3 border-b border-borde pb-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-texto-suave">{fechaLegible(reporte.fecha_devolucion)}</p>
                    <h3 className="mt-1 break-words text-lg font-bold text-texto">{reporte.material_nombre}</h3>
                    <p className="mt-1 break-words text-xs text-texto-suave">
                      Código de Material: {reporte.material_codigo}
                      {reporte.codigo_ejemplar && <> · Código de Ejemplar: {reporte.codigo_ejemplar}</>}
                    </p>
                  </div>
                  <BadgeEstado
                    estado={VARIANTES_DANO[reporte.dano] ?? 'desconocido'}
                    texto={ETIQUETAS_DANO[reporte.dano] ?? reporte.dano}
                  />
                </div>
                <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-xl bg-superficie-alta/50 p-3">
                    <dt className="text-xs font-semibold text-texto-suave">Prestatario</dt>
                    <dd className="mt-1 break-words text-sm font-semibold text-texto">{reporte.prestatario_nombre}</dd>
                  </div>
                  <div className="rounded-xl bg-superficie-alta/50 p-3">
                    <dt className="text-xs font-semibold text-texto-suave">Registrado por</dt>
                    <dd className="mt-1 break-words text-sm font-semibold text-texto">{reporte.gestor_nombre}</dd>
                  </div>
                  <div className="rounded-xl bg-superficie-alta/50 p-3">
                    <dt className="text-xs font-semibold text-texto-suave">Sanción</dt>
                    <dd className={`mt-1 text-sm font-bold ${reporte.puntos_delta >= 0 ? 'text-acento-700' : 'text-error'}`}>
                      {firmarPuntos(reporte.puntos_delta)} pts
                    </dd>
                  </div>
                  <div className="rounded-xl bg-superficie-alta/50 p-3">
                    <dt className="text-xs font-semibold text-texto-suave">Cobro</dt>
                    <dd className="mt-1 text-sm font-bold text-texto">{moneda(reporte.cobro_economico)}</dd>
                  </div>
                </dl>
                <div className="flex justify-end border-t border-borde pt-3">
                  <Boton
                    variante="accion"
                    tamanio="pequeno"
                    tipo="button"
                    icono={Download}
                    onClick={() => window.open(reporte.reporte_url, '_blank', 'noopener,noreferrer')}
                  >
                    Descargar reporte
                  </Boton>
                </div>
              </Tarjeta>
            </li>
          ))}
        </ul>
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
    <header className="flex flex-col gap-4 rounded-2xl border border-borde bg-gradient-to-r from-superficie via-superficie to-acento-50 p-5 shadow-sm sm:flex-row sm:items-center sm:p-6 dark:to-superficie-alta">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-marca-600/15 text-marca-700 dark:bg-marca-500/15 dark:text-marca-300">
        <FileText aria-hidden="true" className="size-6" />
      </span>
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-acento-700 dark:text-acento-300">Gestión de préstamos</p>
        <h2 className="mt-1 text-2xl font-bold text-texto">Reportes de daños</h2>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-texto-suave">
          Listado de reportes PDF generados ante daños en las devoluciones. Descarga cada reporte para su archivo.
        </p>
      </div>
    </header>
  )
}

export default ReportesDanos
