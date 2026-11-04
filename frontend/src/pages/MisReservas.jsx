import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { CalendarClock, FileText, Plus, RefreshCw, ShieldAlert } from 'lucide-react'

import { api } from '../api/client'
import BadgeEstado from '../components/ui/BadgeEstado'
import Boton from '../components/ui/Boton'
import ErrorAlerta from '../components/ui/ErrorAlerta'
import EstadoVacio from '../components/ui/EstadoVacio'
import Skeleton from '../components/ui/Skeleton'
import Tarjeta from '../components/ui/Tarjeta'
import { ETIQUETAS_TIER } from '../constantes/catalogo'
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
  { id: 'en_espera', etiqueta: 'En espera' },
  { id: 'reservada', etiqueta: 'Confirmadas' },
  { id: 'cerradas', etiqueta: 'Cerradas / Expiradas' },
]

function filtrarReservas(reservas, filtro) {
  if (filtro === 'activas') return reservas.filter(esReservaActiva)
  if (filtro === 'en_espera') return reservas.filter((r) => r.estado === 'en_espera')
  if (filtro === 'reservada') return reservas.filter((r) => r.estado === 'reservada')
  if (filtro === 'cerradas') return reservas.filter((r) => !esReservaActiva(r))
  return reservas
}

export default function MisReservas() {
  useTituloPagina('Mis reservas')
  const [reservas, setReservas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [filtro, setFiltro] = useState('todas')
  const [intento, setIntento] = useState(0)

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
  const visibles = filtrarReservas(reservas, filtro)

  if (cargando) {
    return (
      <div className="space-y-3" role="status" aria-live="polite">
        <p className="text-sm text-texto-suave">Cargando tus reservas y solicitudes en espera…</p>
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
      </div>
    )
  }

  if (error) {
    return (
      <section aria-label="Consulta de reservas" className="grid gap-4">
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
    <section aria-labelledby="titulo-mis-reservas" className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="titulo-mis-reservas" className="text-xl font-bold text-texto">
            Mis reservas y solicitudes en espera
          </h2>
          <p className="mt-1 text-sm text-texto-suave">
            Solicitudes activas:{' '}
            <span className="font-semibold text-texto">
              {activasCount} de {MAXIMO_RESERVAS_ACTIVAS}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Boton
            variante="secundario"
            tamanio="pequeno"
            icono={RefreshCw}
            onClick={() => setIntento((valor) => valor + 1)}
          >
            Actualizar
          </Boton>
          {activasCount < MAXIMO_RESERVAS_ACTIVAS ? (
            <Link
              to="/panel/reservas/nueva"
              className="inline-flex items-center gap-2 rounded-lg bg-marca-700 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-marca-800"
            >
              <Plus aria-hidden="true" className="size-4" />
              Nueva reserva
            </Link>
          ) : (
            <span className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
              Límite de {MAXIMO_RESERVAS_ACTIVAS} solicitudes activas alcanzado
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filtrar reservas por estado">
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
                  : 'border border-borde bg-superficie text-texto hover:bg-superficie-alta'
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
              ? 'Aún no tienes reservas ni solicitudes en espera'
              : 'Sin reservas para este filtro'
          }
          mensaje={
            reservas.length === 0
              ? 'Puedes reservar un material disponible por 24 horas o unirte a la lista de espera desde el catálogo.'
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
                <Tarjeta className="p-5">
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
                    <div className="rounded-lg border border-borde bg-superficie-alta/40 p-3">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-texto-suave">
                        Fecha de solicitud
                      </dt>
                      <dd className="mt-1 font-medium text-texto">
                        {formatearFechaReserva(reserva.fecha_solicitud || reserva.fecha_creacion || reserva.created_at)}
                      </dd>
                    </div>

                    {reserva.estado === 'en_espera' && (
                      <>
                        <div className="rounded-lg border border-borde bg-superficie-alta/40 p-3">
                          <dt className="text-xs font-semibold uppercase tracking-wide text-texto-suave">
                            Orden de atención
                          </dt>
                          <dd className="mt-1 font-medium text-texto">
                            {reserva.es_excepcion
                              ? 'Evaluación manual por Gestor de Almacén'
                              : reserva.posicion_cola
                                ? `Posición #${reserva.posicion_cola} en la cola de espera`
                                : 'En cola de espera'}
                          </dd>
                        </div>
                        <div className="rounded-lg border border-borde bg-superficie-alta/40 p-3">
                          <dt className="text-xs font-semibold uppercase tracking-wide text-texto-suave">
                            Vigencia en espera (72 h)
                          </dt>
                          <dd className="mt-1 font-medium text-texto">
                            {formatearFechaReserva(reserva.fecha_limite_espera)}
                          </dd>
                        </div>
                      </>
                    )}

                    {reserva.estado === 'reservada' && (
                      <>
                        <div className="rounded-lg border border-marca-200 bg-marca-50/50 p-3 dark:border-marca-800 dark:bg-marca-950/30">
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
                        </div>
                        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
                          <dt className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                            <CalendarClock aria-hidden="true" className="size-3.5" />
                            Límite de recojo (24 h)
                          </dt>
                          <dd className="mt-1 font-bold text-texto">
                            {formatearFechaReserva(reserva.fecha_limite_recojo)}
                          </dd>
                        </div>
                      </>
                    )}

                    {reserva.fecha_recojo && (
                      <div className="rounded-lg border border-borde bg-superficie-alta/40 p-3">
                        <dt className="text-xs font-semibold uppercase tracking-wide text-texto-suave">
                          Fecha de entrega en préstamo
                        </dt>
                        <dd className="mt-1 font-medium text-texto">
                          {formatearFechaReserva(reserva.fecha_recojo)}
                        </dd>
                      </div>
                    )}
                  </dl>

                  <div className="mt-3 rounded-lg border border-borde bg-superficie p-3 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-wide text-texto-suave">
                      Justificación:
                    </span>
                    <p className="mt-0.5 text-texto">{reserva.justificacion}</p>
                  </div>

                  {reserva.estado === 'reservada' && (
                    <p className="mt-3 text-xs text-texto-suave">
                      Acércate al almacén antes de la fecha límite de recojo. Si la reserva confirmada vence sin ser recogida, se liberará el ejemplar y se aplicará la deducción de reputación correspondiente.
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
                    <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-borde bg-superficie-alta/40 p-3 text-xs">
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
                </Tarjeta>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
