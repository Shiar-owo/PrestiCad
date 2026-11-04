import { useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import {
  CheckCircle2,
  Clock,
  FileText,
  PackageCheck,
  RefreshCw,
  Search,
  ShieldAlert,
  XCircle,
} from 'lucide-react'

import { api, ErrorApi } from '../api/client'
import BadgeEstado from '../components/ui/BadgeEstado'
import Boton from '../components/ui/Boton'
import ErrorAlerta from '../components/ui/ErrorAlerta'
import EstadoVacio from '../components/ui/EstadoVacio'
import Skeleton from '../components/ui/Skeleton'
import Tarjeta from '../components/ui/Tarjeta'
import { ETIQUETAS_TIER } from '../constantes/catalogo'
import SesionContext from '../contextos/SesionContext'
import useTituloPagina from '../hooks/useTituloPagina'
import {
  formatearFechaReserva,
  ordenarColaReservas,
  textoEstadoReserva,
} from '../reservas/estadoReserva'

function extraerMensajeError(error, porDefecto) {
  if (error instanceof ErrorApi && error.datos) {
    if (typeof error.datos.detail === 'string') return error.datos.detail
    const primerMensaje = Object.values(error.datos).flat()[0]
    if (primerMensaje) return String(primerMensaje)
  }
  return porDefecto
}

export default function ColaReservas() {
  useTituloPagina('Cola de reservas')
  const { usuario } = useContext(SesionContext)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const materialIdUrl = searchParams.get('materialId') || ''

  const esGestor = usuario?.rol === 'gestor' || usuario?.rol === 'administrador'

  const [materiales, setMateriales] = useState([])
  const [busquedaMaterial, setBusquedaMaterial] = useState('')
  const [materialIdSeleccionado, setMaterialIdSeleccionado] = useState(materialIdUrl)
  const [cargandoMateriales, setCargandoMateriales] = useState(true)
  const [errorMateriales, setErrorMateriales] = useState('')

  const [cola, setCola] = useState(null)
  const [cargandoCola, setCargandoCola] = useState(false)
  const [errorCola, setErrorCola] = useState('')
  const [recarga, setRecarga] = useState(0)

  const [procesandoId, setProcesandoId] = useState('')
  const [mensajeExito, setMensajeExito] = useState('')
  const [errorAccion, setErrorAccion] = useState('')

  // Estado para formulario de motivo (rechazar o cancelar)
  const [accionConMotivo, setAccionConMotivo] = useState(null) // { id, tipo: 'rechazar' | 'cancelar', etiqueta }
  const [motivoTexto, setMotivoTexto] = useState('')
  const [errorMotivo, setErrorMotivo] = useState('')

  useEffect(() => {
    let activa = true
    setCargandoMateriales(true)
    setErrorMateriales('')

    api
      .get('/materiales/')
      .then((datos) => {
        if (!activa) return
        const lista = Array.isArray(datos)
          ? datos
          : Array.isArray(datos?.results)
            ? datos.results
            : []
        setMateriales(lista)
        if (!materialIdSeleccionado && lista.length > 0) {
          setMaterialIdSeleccionado(String(lista[0].id))
        }
      })
      .catch(() => {
        if (activa) {
          setErrorMateriales('No se pudo cargar la lista de materiales del catálogo.')
        }
      })
      .finally(() => {
        if (activa) setCargandoMateriales(false)
      })

    return () => {
      activa = false
    }
  }, [])

  useEffect(() => {
    if (!materialIdSeleccionado) {
      setCola(null)
      return
    }

    let activa = true
    setCargandoCola(true)
    setErrorCola('')

    api
      .get(`/reservas/cola/${materialIdSeleccionado}/`)
      .then((datos) => {
        if (activa) setCola(datos)
      })
      .catch(() => {
        if (activa) {
          setErrorCola('No fue posible consultar la cola de reservas para este material.')
        }
      })
      .finally(() => {
        if (activa) setCargandoCola(false)
      })

    return () => {
      activa = false
    }
  }, [materialIdSeleccionado, recarga])

  const materialesFiltrados = useMemo(() => {
    const termino = busquedaMaterial.trim().toLowerCase()
    if (!termino) return materiales
    return materiales.filter(
      (m) =>
        m.nombre?.toLowerCase().includes(termino) ||
        m.codigo_material?.toLowerCase().includes(termino),
    )
  }, [materiales, busquedaMaterial])

  function seleccionarMaterial(nuevoId) {
    setMaterialIdSeleccionado(nuevoId)
    setMensajeExito('')
    setErrorAccion('')
    setAccionConMotivo(null)
    if (nuevoId) {
      setSearchParams({ materialId: nuevoId }, { replace: true })
    }
  }

  async function manejarAprobarExcepcion(reserva) {
    setErrorAccion('')
    setMensajeExito('')
    setProcesandoId(reserva.id)

    try {
      const respuesta = await api.post(`/reservas/${reserva.id}/aprobar-excepcion/`, {})
      if (respuesta?.estado === 'reservada') {
        setMensajeExito(
          `Excepción académica aprobada para ${reserva.usuario?.nombre_completo || reserva.usuario?.dni}. Se asignó un ejemplar con recojo por 24 horas.`,
        )
      } else {
        setMensajeExito(
          `Excepción académica aprobada para ${reserva.usuario?.nombre_completo || reserva.usuario?.dni}. Ha ingresado a la lista de espera con turno por orden de llegada.`,
        )
      }
      setRecarga((v) => v + 1)
    } catch (err) {
      setErrorAccion(
        extraerMensajeError(
          err,
          'No se pudo aprobar la excepción académica.',
        ),
      )
    } finally {
      setProcesandoId('')
    }
  }

  async function confirmarAccionConMotivo(evento) {
    evento.preventDefault()
    if (!accionConMotivo) return

    const motivoLimpio = motivoTexto.trim()
    if (!motivoLimpio) {
      setErrorMotivo(
        accionConMotivo.tipo === 'rechazar'
          ? 'El motivo de rechazo es obligatorio.'
          : 'El motivo de cancelación es obligatorio.',
      )
      return
    }

    setErrorMotivo('')
    setErrorAccion('')
    setMensajeExito('')
    setProcesandoId(accionConMotivo.id)

    try {
      if (accionConMotivo.tipo === 'rechazar') {
        await api.post(`/reservas/${accionConMotivo.id}/rechazar/`, {
          motivo: motivoLimpio,
        })
        setMensajeExito('La solicitud en espera fue rechazada correctamente.')
      } else {
        await api.post(`/reservas/${accionConMotivo.id}/cancelar/`, {
          motivo: motivoLimpio,
        })
        setMensajeExito(
          'La reserva confirmada fue cancelada, liberando el ejemplar sin penalizar al prestatario.',
        )
      }
      setAccionConMotivo(null)
      setMotivoTexto('')
      setRecarga((v) => v + 1)
    } catch (err) {
      setErrorAccion(
        extraerMensajeError(
          err,
          'No fue posible completar la acción sobre la reserva.',
        ),
      )
    } finally {
      setProcesandoId('')
    }
  }

  if (cargandoMateriales) {
    return (
      <div className="space-y-3" role="status" aria-live="polite">
        <p className="text-sm text-texto-suave">Cargando materiales y colas de reserva…</p>
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-44 rounded-xl" />
      </div>
    )
  }

  if (errorMateriales) {
    return <ErrorAlerta mensaje={errorMateriales} />
  }

  const enEsperaNormales = ordenarColaReservas(cola?.en_espera_normales || [])
  const enEsperaExcepciones = cola?.en_espera_excepciones || []
  const reservasConfirmadas = cola?.reservas_confirmadas || []
  const instanciasDisponibles = cola?.instancias_disponibles || []

  return (
    <section aria-labelledby="titulo-cola-reservas" className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="titulo-cola-reservas" className="text-xl font-bold text-texto">
            Cola de reservas y excepciones por material
          </h2>
          <p className="mt-1 text-sm text-texto-suave">
            Consulta las solicitudes en lista de espera, evalúa excepciones académicas y administra las reservas confirmadas.
          </p>
        </div>
        <Boton
          variante="secundario"
          tamanio="pequeno"
          icono={RefreshCw}
          onClick={() => setRecarga((v) => v + 1)}
          deshabilitado={!materialIdSeleccionado || cargandoCola}
        >
          Actualizar cola
        </Boton>
      </div>

      {/* Selector y buscador de material */}
      <Tarjeta className="p-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor="buscar-material-cola"
              className="block text-xs font-semibold uppercase tracking-wide text-texto-suave"
            >
              Filtrar material por nombre o código
            </label>
            <div className="relative mt-1">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-2.5 size-4 text-texto-suave"
              />
              <input
                id="buscar-material-cola"
                type="search"
                value={busquedaMaterial}
                onChange={(e) => setBusquedaMaterial(e.target.value)}
                placeholder="Ej. Laptop, Osciloscopio, EQP-001…"
                className="w-full rounded-lg border border-borde bg-white pl-9 pr-3 py-2 text-sm text-texto dark:bg-superficie"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="select-material-cola"
              className="block text-xs font-semibold uppercase tracking-wide text-texto-suave"
            >
              Material seleccionado
            </label>
            <select
              id="select-material-cola"
              value={materialIdSeleccionado}
              onChange={(e) => seleccionarMaterial(e.target.value)}
              className="mt-1 w-full rounded-lg border border-borde bg-white px-3 py-2 text-sm text-texto dark:bg-superficie"
            >
              <option value="">Selecciona un material…</option>
              {materialesFiltrados.map((m) => {
                const disp = m.unidades_disponibles ?? m.resumen_instancias?.disponible ?? 0
                return (
                  <option key={m.id} value={m.id}>
                    {m.nombre} ({m.codigo_material}) — {disp} de {m.stock} libre(s)
                  </option>
                )
              })}
            </select>
          </div>
        </div>
      </Tarjeta>

      {mensajeExito && (
        <div
          role="status"
          className="rounded-xl border border-marca-300 bg-marca-50 p-4 text-sm font-medium text-marca-800 dark:border-marca-700 dark:bg-marca-950/50 dark:text-marca-200"
        >
          {mensajeExito}
        </div>
      )}

      {errorAccion && <ErrorAlerta mensaje={errorAccion} />}

      {/* Modal/Panel para ingresar motivo de rechazo o cancelación */}
      {accionConMotivo && (
        <Tarjeta className="border-amber-300 bg-amber-50/50 p-5 dark:border-amber-700 dark:bg-amber-950/30">
          <form onSubmit={confirmarAccionConMotivo} className="space-y-3" noValidate>
            <h3 className="text-sm font-bold text-texto">
              {accionConMotivo.tipo === 'rechazar'
                ? `Rechazar solicitud en espera (${accionConMotivo.etiqueta})`
                : `Cancelar reserva confirmada (${accionConMotivo.etiqueta})`}
            </h3>
            <div>
              <label
                htmlFor="input-motivo-reserva"
                className="block text-xs font-semibold text-texto"
              >
                Motivo {accionConMotivo.tipo === 'rechazar' ? 'de rechazo' : 'de cancelación'} *
              </label>
              <textarea
                id="input-motivo-reserva"
                rows={2}
                value={motivoTexto}
                onChange={(e) => {
                  setMotivoTexto(e.target.value)
                  setErrorMotivo('')
                }}
                className="mt-1 w-full rounded-lg border border-borde bg-white px-3 py-2 text-sm text-texto dark:bg-superficie"
              />
              {errorMotivo && (
                <p className="mt-1 text-xs font-medium text-error">{errorMotivo}</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Boton
                tipo="submit"
                variante="peligro"
                tamanio="pequeno"
                cargando={procesandoId === accionConMotivo.id}
              >
                Confirmar {accionConMotivo.tipo === 'rechazar' ? 'rechazo' : 'cancelación'}
              </Boton>
              <Boton
                tipo="button"
                variante="secundario"
                tamanio="pequeno"
                onClick={() => {
                  setAccionConMotivo(null)
                  setMotivoTexto('')
                  setErrorMotivo('')
                }}
              >
                Cerrar
              </Boton>
            </div>
          </form>
        </Tarjeta>
      )}

      {cargandoCola && (
        <div className="space-y-3" role="status">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-36 rounded-xl" />
        </div>
      )}

      {errorCola && <ErrorAlerta mensaje={errorCola} />}

      {!cargandoCola && cola && (
        <div className="space-y-6">
          {/* Resumen del material y ejemplares libres */}
          <Tarjeta className="p-5 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wide text-acento-700 dark:text-acento-300">
                  Código de Material: {cola.material?.codigo_material} · Tier mínimo:{' '}
                  {ETIQUETAS_TIER[cola.material?.tier_minimo_requerido] ||
                    cola.material?.tier_minimo_requerido}
                </span>
                <h3 className="text-lg font-bold text-texto">{cola.material?.nombre}</h3>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-lg bg-marca-100 px-3 py-1 text-marca-800 dark:bg-marca-950/60 dark:text-marca-300">
                  {instanciasDisponibles.length} disponible(s)
                </span>
                <span className="rounded-lg bg-amber-100 px-3 py-1 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
                  {enEsperaNormales.length + enEsperaExcepciones.length} en espera
                </span>
                <span className="rounded-lg bg-acento-100 px-3 py-1 text-acento-900 dark:bg-acento-950/60 dark:text-acento-200">
                  {reservasConfirmadas.length} reservada(s)
                </span>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-texto-suave">
                Ejemplares físicos disponibles actualmente:
              </p>
              {instanciasDisponibles.length === 0 ? (
                <p className="mt-1 text-xs text-texto-suave">
                  No hay ejemplares en estado Disponible en este momento.
                </p>
              ) : (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {instanciasDisponibles.map((inst) => (
                    <span
                      key={inst.id}
                      className="rounded-md border border-marca-300 bg-marca-50 px-2.5 py-1 font-mono text-xs font-semibold text-marca-800 dark:border-marca-800 dark:bg-marca-950/40 dark:text-marca-300"
                    >
                      {inst.codigo_ejemplar}
                      {inst.ubicacion ? ` (${inst.ubicacion})` : ''}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </Tarjeta>

          {/* 1. Excepciones académicas en espera */}
          <section aria-labelledby="subtitulo-excepciones" className="space-y-3">
            <h3
              id="subtitulo-excepciones"
              className="flex items-center gap-2 text-base font-bold text-texto"
            >
              <ShieldAlert aria-hidden="true" className="size-5 text-amber-600" />
              Solicitudes de Excepción Académica pendientes ({enEsperaExcepciones.length})
            </h3>
            {enEsperaExcepciones.length === 0 ? (
              <p className="rounded-xl border border-borde bg-superficie p-4 text-sm text-texto-suave">
                No hay solicitudes de excepción académica pendientes para este material.
              </p>
            ) : (
              <ul className="grid gap-3">
                {enEsperaExcepciones.map((reserva) => (
                  <li key={reserva.id}>
                    <Tarjeta className="border-amber-300 p-4 dark:border-amber-800 space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-texto">
                              {reserva.usuario?.nombre_completo}
                            </span>
                            <span className="text-xs text-texto-suave">
                              DNI {reserva.usuario?.dni} · Tier{' '}
                              {ETIQUETAS_TIER[reserva.usuario?.reputacion_tier] ||
                                reserva.usuario?.reputacion_tier}{' '}
                              ({reserva.usuario?.reputacion_puntaje} pts)
                            </span>
                            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
                              Excepción académica
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-texto-suave">
                            Solicitada: {formatearFechaReserva(reserva.fecha_solicitud || reserva.fecha_creacion || reserva.created_at)} · Expira
                            en espera: {formatearFechaReserva(reserva.fecha_limite_espera)}
                          </p>
                        </div>
                        <BadgeEstado
                          estado={reserva.estado}
                          texto={textoEstadoReserva(reserva, reserva.estado)}
                        />
                      </div>

                      <p className="rounded-lg bg-superficie-alta/50 p-2.5 text-sm text-texto">
                        <span className="font-semibold">Justificación:</span>{' '}
                        {reserva.justificacion}
                      </p>

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                        <div className="flex flex-wrap items-center gap-3 text-xs">
                          <span className="font-semibold text-texto">Garantía adjunta:</span>
                          {(reserva.garantia?.documento_identidad_disponible ?? reserva.garantia?.tiene_documento_identidad) ? (
                            <a
                              href={`/api/reservas/${reserva.id}/garantia/documento-identidad/`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 font-semibold text-acento-700 underline dark:text-acento-300"
                            >
                              <FileText aria-hidden="true" className="size-3.5" />
                              DNI (PDF)
                            </a>
                          ) : (
                            <span className="text-error">Sin DNI</span>
                          )}
                          {(reserva.garantia?.compromiso_responsabilidad_disponible ?? reserva.garantia?.tiene_compromiso_responsabilidad) ? (
                            <a
                              href={`/api/reservas/${reserva.id}/garantia/compromiso/`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 font-semibold text-acento-700 underline dark:text-acento-300"
                            >
                              <FileText aria-hidden="true" className="size-3.5" />
                              Compromiso (PDF)
                            </a>
                          ) : (
                            <span className="text-error">Sin Compromiso</span>
                          )}
                        </div>

                        {esGestor && (
                          <div className="flex flex-wrap gap-2">
                            <Boton
                              tamanio="pequeno"
                              icono={CheckCircle2}
                              cargando={procesandoId === reserva.id}
                              deshabilitado={
                                Boolean(procesandoId) ||
                                !reserva.garantia?.garantia_completa
                              }
                              title={
                                !reserva.garantia?.garantia_completa
                                  ? 'La solicitud requiere que ambos documentos de garantía estén completos para poder ser aprobada.'
                                  : undefined
                              }
                              onClick={() => manejarAprobarExcepcion(reserva)}
                            >
                              Aprobar excepción
                            </Boton>
                            <Boton
                              variante="peligro"
                              tamanio="pequeno"
                              icono={XCircle}
                              deshabilitado={Boolean(procesandoId)}
                              onClick={() => {
                                setAccionConMotivo({
                                  id: reserva.id,
                                  tipo: 'rechazar',
                                  etiqueta: `${reserva.usuario?.nombre_completo} · Excepción`,
                                })
                                setMotivoTexto('')
                                setErrorMotivo('')
                              }}
                            >
                              Rechazar
                            </Boton>
                          </div>
                        )}
                      </div>
                    </Tarjeta>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 2. Cola de espera normal */}
          <section aria-labelledby="subtitulo-cola-normal" className="space-y-3">
            <h3
              id="subtitulo-cola-normal"
              className="flex items-center gap-2 text-base font-bold text-texto"
            >
              <Clock aria-hidden="true" className="size-5 text-acento-600" />
              Cola de espera ordenada ({enEsperaNormales.length})
            </h3>
            {enEsperaNormales.length === 0 ? (
              <p className="rounded-xl border border-borde bg-superficie p-4 text-sm text-texto-suave">
                No hay solicitudes en lista de espera para este material.
              </p>
            ) : (
              <ul className="grid gap-3">
                {enEsperaNormales.map((reserva, indice) => (
                  <li key={reserva.id}>
                    <Tarjeta className="p-4 space-y-2.5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex items-start gap-3">
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-acento-100 text-xs font-bold text-acento-900 dark:bg-acento-950 dark:text-acento-200">
                            #{reserva.posicion_cola || indice + 1}
                          </span>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-bold text-texto">
                                {reserva.usuario?.nombre_completo}{' '}
                                <span className="font-normal text-xs text-texto-suave">
                                  · DNI {reserva.usuario?.dni} · Tier{' '}
                                  {ETIQUETAS_TIER[reserva.usuario?.reputacion_tier] ||
                                    reserva.usuario?.reputacion_tier}{' '}
                                  ({reserva.usuario?.reputacion_puntaje} pts)
                                </span>
                              </p>
                              {reserva.es_excepcion && (
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
                                  Excepción aprobada
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-texto-suave">
                              Creada: {formatearFechaReserva(reserva.fecha_solicitud || reserva.fecha_creacion || reserva.created_at)} · Expira:{' '}
                              {formatearFechaReserva(reserva.fecha_limite_espera)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <BadgeEstado estado={reserva.estado} />
                          {esGestor && (
                            <Boton
                              variante="peligro"
                              tamanio="pequeno"
                              icono={XCircle}
                              deshabilitado={Boolean(procesandoId)}
                              onClick={() => {
                                setAccionConMotivo({
                                  id: reserva.id,
                                  tipo: 'rechazar',
                                  etiqueta: reserva.usuario?.nombre_completo || reserva.id,
                                })
                                setMotivoTexto('')
                                setErrorMotivo('')
                              }}
                            >
                              Rechazar
                            </Boton>
                          )}
                        </div>
                      </div>

                      <p className="rounded-lg bg-superficie-alta/40 p-2.5 text-sm text-texto">
                        <span className="font-semibold">Justificación:</span>{' '}
                        {reserva.justificacion}
                      </p>
                    </Tarjeta>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 3. Reservas confirmadas vigentes */}
          <section aria-labelledby="subtitulo-confirmadas" className="space-y-3">
            <h3
              id="subtitulo-confirmadas"
              className="flex items-center gap-2 text-base font-bold text-texto"
            >
              <PackageCheck aria-hidden="true" className="size-5 text-marca-700 dark:text-marca-400" />
              Reservas confirmadas pendientes de recojo ({reservasConfirmadas.length})
            </h3>
            {reservasConfirmadas.length === 0 ? (
              <EstadoVacio
                titulo="Sin reservas confirmadas activas"
                mensaje="Las reservas confirmadas con ejemplar asignado (vigencia de 24 h) aparecerán aquí."
              />
            ) : (
              <ul className="grid gap-3">
                {reservasConfirmadas.map((reserva) => (
                  <li key={reserva.id}>
                    <Tarjeta className="p-4 space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-texto">
                              {reserva.usuario?.nombre_completo}
                            </span>
                            <span className="text-xs text-texto-suave">
                              DNI {reserva.usuario?.dni} · Tier{' '}
                              {ETIQUETAS_TIER[reserva.usuario?.reputacion_tier] ||
                                reserva.usuario?.reputacion_tier}
                            </span>
                            {reserva.es_excepcion && (
                              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
                                Excepción académica
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-texto-suave">
                            Ejemplar reservado:{' '}
                            <strong className="font-mono text-texto">
                              {reserva.instancia?.codigo_ejemplar}
                            </strong>{' '}
                            · Límite de recojo (24 h):{' '}
                            <strong className="text-texto">
                              {formatearFechaReserva(reserva.fecha_limite_recojo)}
                            </strong>
                          </p>
                        </div>

                        <BadgeEstado
                          estado={reserva.estado}
                          texto={textoEstadoReserva(reserva, reserva.estado)}
                        />
                      </div>

                      <p className="rounded-lg bg-superficie-alta/40 p-2.5 text-sm text-texto">
                        <span className="font-semibold">Justificación:</span>{' '}
                        {reserva.justificacion}
                      </p>

                      {esGestor && (
                        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                          <Boton
                            tamanio="pequeno"
                            onClick={() =>
                              navigate(
                                `/panel/prestamo?dni=${encodeURIComponent(reserva.usuario?.dni || '')}&reservaId=${encodeURIComponent(reserva.id)}`,
                              )
                            }
                          >
                            Entregar / Convertir en préstamo
                          </Boton>
                          <Boton
                            variante="peligro"
                            tamanio="pequeno"
                            icono={XCircle}
                            deshabilitado={Boolean(procesandoId)}
                            onClick={() => {
                              setAccionConMotivo({
                                id: reserva.id,
                                tipo: 'cancelar',
                                etiqueta: `${reserva.usuario?.nombre_completo} · ${reserva.instancia?.codigo_ejemplar || ''}`,
                              })
                              setMotivoTexto('')
                              setErrorMotivo('')
                            }}
                          >
                            Cancelar reserva
                          </Boton>
                        </div>
                      )}
                    </Tarjeta>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </section>
  )
}
