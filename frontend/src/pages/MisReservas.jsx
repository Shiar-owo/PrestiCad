import { useContext, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { CalendarCheck2, FileText, Plus, RefreshCw, ShieldAlert } from 'lucide-react'

import { api } from '../api/client'
import BadgeEstado from '../components/ui/BadgeEstado'
import Boton from '../components/ui/Boton'
import ErrorAlerta from '../components/ui/ErrorAlerta'
import ExitoModal from '../components/ui/ExitoModal'
import EstadoVacio from '../components/ui/EstadoVacio'
import Skeleton from '../components/ui/Skeleton'
import Tarjeta from '../components/ui/Tarjeta'
import ResumenLimitesPrestatario from '../components/prestamos/ResumenLimitesPrestatario'
import { ETIQUETAS_TIER } from '../constantes/catalogo'
import SesionContext from '../contextos/SesionContext'
import useTituloPagina from '../hooks/useTituloPagina'
import {
  MAXIMO_RESERVAS_ACTIVAS,
  contarReservasActivas,
  esReservaActiva,
  formatearFechaReserva,
  obtenerMotivoVisibleReserva,
  textoEstadoReserva,
} from '../reservas/estadoReserva'

const FILTROS = [
  { id: 'todas', etiqueta: 'Todas' },
  { id: 'activas', etiqueta: 'Activas' },
  { id: 'en_espera', etiqueta: 'Pendientes de revisión' },
  { id: 'reservada', etiqueta: 'Confirmadas' },
  { id: 'cerradas', etiqueta: 'Cerradas / Expiradas' },
]

function CabeceraMisReservas({ tituloId = 'titulo-mis-reservas', children }) {
  return (
    <header className="flex flex-col gap-4 rounded-2xl border border-borde bg-gradient-to-r from-superficie via-superficie to-acento-50 p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6 dark:to-superficie-alta">
      <div className="flex items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-acento-100 text-acento-700 dark:bg-acento-500/15 dark:text-acento-300">
          <CalendarCheck2 aria-hidden="true" className="size-6" />
        </span>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-acento-700 dark:text-acento-300">Tu actividad</p>
          <h2 id={tituloId} className="mt-1 text-2xl font-bold text-texto">Mis reservas</h2>
          <p className="mt-1 text-sm text-texto-suave">Consulta tus solicitudes y las fechas de recojo y devolución.</p>
        </div>
      </div>
      {children}
    </header>
  )
}

function filtrarReservas(reservas, filtro) {
  if (filtro === 'activas') return reservas.filter(esReservaActiva)
  if (filtro === 'en_espera') return reservas.filter((r) => r.estado === 'en_espera')
  if (filtro === 'reservada') return reservas.filter((r) => r.estado === 'reservada')
  if (filtro === 'cerradas') return reservas.filter((r) => !esReservaActiva(r))
  return reservas
}

export default function MisReservas() {
  useTituloPagina('Mis reservas')
  const { usuario } = useContext(SesionContext)
  const [reservas, setReservas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [filtro, setFiltro] = useState('todas')
  const [intento, setIntento] = useState(0)

  const [reservaACancelar, setReservaACancelar] = useState(null)
  const [cancelando, setCancelando] = useState(false)
  const [errorCancelacion, setErrorCancelacion] = useState('')
  const [exitoCancelacion, setExitoCancelacion] = useState('')

  async function confirmarCancelacion() {
    if (!reservaACancelar) return
    setCancelando(true)
    setErrorCancelacion('')
    try {
      await api.post(`/reservas/${reservaACancelar.id}/cancelar/`, {
        motivo: 'Cancelada por el prestatario.',
      })
      setExitoCancelacion(`La reserva de ${reservaACancelar.material?.nombre || 'material'} fue cancelada correctamente.`)
      setReservaACancelar(null)
    } catch (err) {
      const datos = err?.datos
      const mensaje = datos?.detail || (datos && Object.values(datos).flat()[0]) || 'No se pudo cancelar la reserva.'
      setErrorCancelacion(String(mensaje))
    } finally {
      setCancelando(false)
    }
  }

  useEffect(() => {
    let activa = true
    setCargando(true)
    setError('')

    api
      .get('/reservas/mis-reservas/')
      .then((datos) => {
        if (!Array.isArray(datos)) {
          throw new Error('Formato inesperado en mis reservas.')
        }
        if (activa) setReservas(datos)
      })
      .catch(() => {
        if (activa) {
          setError('No fue posible consultar tus reservas. Intenta nuevamente.')
        }
      })
      .finally(() => {
        if (activa) setCargando(false)
      })

    return () => {
      activa = false
    }
  }, [intento])

  const activasCount = contarReservasActivas(reservas)
  const limiteReservas = usuario?.maximo_reservas_activas ?? MAXIMO_RESERVAS_ACTIVAS
  const visibles = filtrarReservas(reservas, filtro)
  const resumenLimites = (
    <ResumenLimitesPrestatario
      prestamosActivos={usuario?.prestamos_activos ?? 0}
      maximoPrestamos={usuario?.maximo_prestamos_activos ?? 3}
      reservasActivas={cargando || error ? usuario?.reservas_activas ?? activasCount : activasCount}
      maximoReservas={limiteReservas}
    />
  )

  if (cargando) {
    return (
      <section className="mx-auto w-full max-w-6xl space-y-5" aria-label="Mis reservas">
        <CabeceraMisReservas />
        {resumenLimites}
        <div className="space-y-3" role="status" aria-live="polite">
          <p className="text-sm text-texto-suave">Cargando tus reservas y solicitudes pendientes de revisión…</p>
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section aria-label="Consulta de reservas" className="mx-auto grid w-full max-w-6xl gap-5">
        <CabeceraMisReservas />
        {resumenLimites}
        <ErrorAlerta mensaje={error} />
        <Boton
          variante="secundario"
          className="w-full sm:w-auto"
          onClick={() => setIntento((valor) => valor + 1)}
        >
          Reintentar
        </Boton>
      </section>
    )
  }

  return (
    <section aria-labelledby="titulo-mis-reservas" className="mx-auto w-full max-w-6xl space-y-5">
      <ExitoModal
        titulo="Reserva cancelada"
        mensaje={exitoCancelacion}
        onCerrar={() => {
          setExitoCancelacion('')
          setIntento((actual) => actual + 1)
        }}
      />
      <CabeceraMisReservas tituloId="titulo-mis-reservas">
        <div className="flex flex-wrap items-center gap-2">
          <Boton
            variante="secundario"
            tamanio="pequeno"
            icono={RefreshCw}
            onClick={() => setIntento((valor) => valor + 1)}
          >
            Actualizar
          </Boton>
          {activasCount < limiteReservas ? (
            <Link
              to="/panel/reservas/nueva"
              className="inline-flex items-center gap-2 rounded-lg bg-marca-700 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-marca-800"
            >
              <Plus aria-hidden="true" className="size-4" />
              Nueva reserva
            </Link>
          ) : (
            <span className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
              Límite de {limiteReservas} solicitudes activas alcanzado
            </span>
          )}
        </div>
      </CabeceraMisReservas>

      {resumenLimites}

      <div className="inline-flex flex-wrap gap-1.5 rounded-xl bg-superficie-alta p-1.5" role="tablist" aria-label="Filtrar reservas por estado">
        {FILTROS.map((opcion) => {
          const activo = filtro === opcion.id
          return (
            <button
              key={opcion.id}
              type="button"
              role="tab"
              aria-selected={activo}
              onClick={() => setFiltro(opcion.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                activo
                  ? 'bg-marca-700 text-white dark:bg-marca-600'
                  : 'text-texto-suave hover:bg-superficie hover:text-texto'
              }`}
            >
              {opcion.etiqueta}
            </button>
          )
        })}
      </div>

      {visibles.length === 0 ? (
        <EstadoVacio
          titulo={
            reservas.length === 0
              ? 'Aún no tienes reservas ni solicitudes pendientes de revisión'
              : 'Sin reservas para este filtro'
          }
          mensaje={
            reservas.length === 0
              ? 'Puedes elegir el rango de fecha y hora para reservar un material disponible desde el catálogo.'
              : 'Prueba seleccionando otro filtro de estado.'
          }
        />
      ) : (
        <ul className="grid gap-4">
          {visibles.map((reserva) => {
            const material = reserva.material || {}
            const instancia = reserva.instancia
            const motivo = obtenerMotivoVisibleReserva(reserva)
            const tierLegible =
              ETIQUETAS_TIER[material.tier_minimo_requerido] || material.tier_minimo_requerido

            return (
              <li key={reserva.id}>
                <Tarjeta className="p-5 shadow-sm transition-shadow hover:shadow-md sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-bold text-texto">
                          {material.nombre || 'Material'}
                        </h3>
                        {reserva.es_excepcion && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
                            <ShieldAlert aria-hidden="true" className="size-3.5" />
                            Excepción académica
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-texto-suave">
                        Código de Material: <span className="font-semibold">{material.codigo_material}</span>
                        {tierLegible && <> · Tier mínimo: {tierLegible}</>}
                      </p>
                    </div>

                    <BadgeEstado
                      estado={reserva.estado}
                      texto={textoEstadoReserva(reserva, reserva.estado)}
                    />
                  </div>

                  <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
                    <div className="rounded-xl bg-superficie-alta/50 p-3">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-texto-suave">
                        Fecha de solicitud
                      </dt>
                      <dd className="mt-1 font-medium text-texto">
                        {formatearFechaReserva(reserva.fecha_solicitud || reserva.fecha_creacion || reserva.created_at)}
                      </dd>
                    </div>

                    {reserva.estado === 'en_espera' && (
                      <>
                        <div className="rounded-xl bg-superficie-alta/50 p-3">
                          <dt className="text-xs font-semibold uppercase tracking-wide text-texto-suave">
                            Orden de atención
                          </dt>
                          <dd className="mt-1 font-medium text-texto">
                            Pendiente de revisión por el Gestor de Almacén
                          </dd>
                        </div>
                        <div className="rounded-xl bg-superficie-alta/50 p-3">
                          <dt className="text-xs font-semibold uppercase tracking-wide text-texto-suave">
                            Plazo para revisar la solicitud (72 h)
                          </dt>
                          <dd className="mt-1 font-medium text-texto">
                            {formatearFechaReserva(reserva.fecha_limite_espera)}
                          </dd>
                        </div>
                      </>
                    )}

                    {reserva.fecha_inicio && reserva.fecha_fin && (
                      <div className="rounded-xl bg-superficie-alta/50 p-3 sm:col-span-2 lg:col-span-3">
                        <dt className="text-xs font-semibold uppercase tracking-wide text-texto-suave">
                          Rango reservado
                        </dt>
                        <dd className="mt-1 grid gap-1 font-medium text-texto sm:grid-cols-2">
                          <span>Recojo: {formatearFechaReserva(reserva.fecha_inicio)}</span>
                          <span>Devolución: {formatearFechaReserva(reserva.fecha_fin)}</span>
                        </dd>
                      </div>
                    )}

                    {reserva.estado === 'reservada' && (
                      <>
                        <div className="rounded-xl bg-marca-50/70 p-3 dark:bg-marca-950/30">
                          <dt className="text-xs font-semibold uppercase tracking-wide text-marca-800 dark:text-marca-300">
                            Ejemplar reservado
                          </dt>
                          <dd className="mt-1 font-bold text-texto">
                            {instancia?.codigo_ejemplar || 'Asignado'}
                            {instancia?.ubicacion && (
                              <span className="block text-xs font-normal text-texto-suave">
                                Ubicación: {instancia.ubicacion}
                              </span>
                            )}
                          </dd>
                          {instancia?.foto && (
                            <img
                              src={instancia.foto}
                              alt={`Foto del ejemplar ${instancia.codigo_ejemplar}`}
                              className="mt-2 h-16 w-16 rounded-lg border border-borde object-cover"
                            />
                          )}
                        </div>
                      </>
                    )}

                    {reserva.fecha_recojo && (
                      <div className="rounded-xl bg-superficie-alta/50 p-3">
                        <dt className="text-xs font-semibold uppercase tracking-wide text-texto-suave">
                          Fecha de entrega en préstamo
                        </dt>
                        <dd className="mt-1 font-medium text-texto">
                          {formatearFechaReserva(reserva.fecha_recojo)}
                        </dd>
                      </div>
                    )}
                  </dl>

                  <div className="mt-3 rounded-xl bg-superficie-alta/50 p-4 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-wide text-texto-suave">
                      Justificación:
                    </span>
                    <p className="mt-0.5 text-texto">{reserva.justificacion}</p>
                  </div>

                  {reserva.estado === 'reservada' && (
                    <p className="mt-3 text-xs text-texto-suave">
                      Acércate al almacén en la fecha de recojo indicada. Tienes 30 minutos de tolerancia para el recojo y la devolución. Si la reserva vence sin ser recogida, se liberará el ejemplar y se aplicará la deducción de reputación correspondiente.
                    </p>
                  )}

                  {motivo && (
                    <div className="mt-3 rounded-lg border border-red-200 bg-red-50/70 p-3 text-sm text-red-800 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-200">
                      <span className="font-semibold">
                        {reserva.estado === 'rechazada'
                          ? 'Motivo de rechazo:'
                          : 'Motivo de cancelación / vencimiento:'}
                      </span>{' '}
                      {motivo}
                    </div>
                  )}

                  {reserva.garantia && (
                    <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-superficie-alta/50 p-3 text-xs">
                      <span className="font-semibold text-texto">Documentos de garantía adjuntos:</span>
                      {(reserva.garantia.documento_identidad_disponible || reserva.garantia.tiene_documento_identidad) && (
                        <a
                          href={`/api/reservas/${reserva.id}/garantia/documento-identidad/`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-semibold text-acento-700 underline dark:text-acento-300"
                        >
                          <FileText aria-hidden="true" className="size-3.5" />
                          Documento de identidad (PDF)
                        </a>
                      )}
                      {(reserva.garantia.compromiso_responsabilidad_disponible || reserva.garantia.tiene_compromiso_responsabilidad) && (
                        <a
                          href={`/api/reservas/${reserva.id}/garantia/compromiso/`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-semibold text-acento-700 underline dark:text-acento-300"
                        >
                          <FileText aria-hidden="true" className="size-3.5" />
                          Compromiso firmado (PDF)
                        </a>
                      )}
                    </div>
                  )}
                  {esReservaActiva(reserva) && (
                    <div className="mt-4 flex justify-end border-t border-borde pt-3">
                      <Boton
                        variante="peligro"
                        tamanio="pequeno"
                        onClick={() => {
                          setReservaACancelar(reserva)
                          setErrorCancelacion('')
                        }}
                      >
                        Cancelar reserva
                      </Boton>
                    </div>
                  )}
                </Tarjeta>
              </li>
            )
          })}
        </ul>
      )}

      {reservaACancelar && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-modal-cancelar"
            className="w-full max-w-md rounded-xl border border-borde bg-superficie p-6 shadow-2xl space-y-4"
          >
            <h3 id="titulo-modal-cancelar" className="text-lg font-bold text-texto">
              ¿Cancelar esta reserva?
            </h3>
            <p className="text-sm text-texto-suave">
              ¿Estás seguro de que deseas cancelar tu reserva para{' '}
              <strong>{reservaACancelar.material?.nombre}</strong>? Esta acción no se puede deshacer y liberará tu lugar.
            </p>
            {errorCancelacion && <ErrorAlerta mensaje={errorCancelacion} />}
            <div className="flex justify-end gap-3 pt-2">
              <Boton
                variante="secundario"
                deshabilitado={cancelando}
                onClick={() => {
                  setReservaACancelar(null)
                  setErrorCancelacion('')
                }}
              >
                No, mantener reserva
              </Boton>
              <Boton
                variante="peligro"
                cargando={cancelando}
                onClick={confirmarCancelacion}
              >
                Sí, cancelar reserva
              </Boton>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
