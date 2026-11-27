import { useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import {
  CheckCircle2,
  FileText,
  PackageCheck,
  RefreshCw,
  Search,
  ShieldAlert,
  XCircle,
} from 'lucide-react'

import { Calendar } from 'lucide-react'

import { api, ErrorApi } from '../api/client'
import BadgeEstado from '../components/ui/BadgeEstado'
import Boton from '../components/ui/Boton'
import ErrorAlerta from '../components/ui/ErrorAlerta'
import ErrorModal from '../components/ui/ErrorModal'
import ExitoModal from '../components/ui/ExitoModal'
import EstadoVacio from '../components/ui/EstadoVacio'
import Skeleton from '../components/ui/Skeleton'
import Tarjeta from '../components/ui/Tarjeta'
import { ETIQUETAS_TIER } from '../constantes/catalogo'
import SesionContext from '../contextos/SesionContext'
import useTituloPagina from '../hooks/useTituloPagina'
import {
  formatearFechaReserva,
  textoEstadoReserva,
} from '../reservas/estadoReserva'
import CalendarioDisponibilidad from '../components/reservas/CalendarioDisponibilidad'

function extraerMensajeError(error, porDefecto) {
  if (error instanceof ErrorApi && error.datos) {
    if (typeof error.datos.detail === 'string') return error.datos.detail
    const primerMensaje = Object.values(error.datos).flat()[0]
    if (primerMensaje) return String(primerMensaje)
  }
  return porDefecto
}

export default function ColaReservas() {
  useTituloPagina('Reservas')
  const { usuario } = useContext(SesionContext)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const materialIdUrl = searchParams.get('materialId') || ''

  const esGestor = ['gestor', 'administrador'].includes(usuario?.rol)

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
  const [mensajePopupExito, setMensajePopupExito] = useState('')
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
    let activa = true
    setCargandoCola(true)
    setErrorCola('')

    const url = materialIdSeleccionado
      ? `/reservas/cola/${materialIdSeleccionado}/`
      : `/reservas/cola/`

    api
      .get(url)
      .then((datos) => {
        if (activa) setCola(datos)
      })
      .catch(() => {
        if (activa) {
          setErrorCola('No fue posible consultar las reservas.')
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
    setErrorAccion('')
    setAccionConMotivo(null)
    if (nuevoId) {
      setSearchParams({ materialId: nuevoId }, { replace: true })
    }
  }

  async function manejarAprobarExcepcion(reserva) {
    setErrorAccion('')
    setMensajePopupExito('')
    setProcesandoId(reserva.id)

    try {
      const respuesta = await api.post(`/reservas/${reserva.id}/aprobar-excepcion/`, {})
      if (respuesta?.estado === 'reservada') {
        const mensaje = `Excepción académica aprobada para ${reserva.usuario?.nombre_completo || reserva.usuario?.dni}. Se asignó un ejemplar con 30 minutos de tolerancia para el recojo.`
        setMensajePopupExito(mensaje)
      } else {
        const mensaje = `La solicitud de excepción de ${reserva.usuario?.nombre_completo || reserva.usuario?.dni} fue aprobada.`
        setMensajePopupExito(mensaje)
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
      const mensaje = accionConMotivo.tipo === 'rechazar'
        ? 'El motivo de rechazo es obligatorio.'
        : 'El motivo de cancelación es obligatorio.'
      setErrorMotivo(mensaje)
      setErrorAccion(mensaje)
      return
    }

    setErrorMotivo('')
    setErrorAccion('')
    setMensajePopupExito('')
    setProcesandoId(accionConMotivo.id)

    try {
      if (accionConMotivo.tipo === 'rechazar') {
        await api.post(`/reservas/${accionConMotivo.id}/rechazar/`, {
          motivo: motivoLimpio,
        })
        const mensaje = 'La solicitud de excepción fue rechazada correctamente.'
        setMensajePopupExito(mensaje)
      } else {
        await api.post(`/reservas/${accionConMotivo.id}/cancelar/`, {
          motivo: motivoLimpio,
        })
        const mensaje = 'La reserva confirmada fue cancelada, liberando el ejemplar sin penalizar al prestatario.'
        setMensajePopupExito(mensaje)
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
        <p className="text-sm text-texto-suave">Cargando materiales y reservas…</p>
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-44 rounded-xl" />
      </div>
    )
  }

  if (errorMateriales) {
    return <ErrorAlerta mensaje={errorMateriales} />
  }

  const enEsperaExcepciones = cola?.en_espera_excepciones || []
  const reservasConfirmadas = cola?.reservas_confirmadas || []
  const instanciasDisponibles = cola?.instancias_disponibles || []

  return (
    <section aria-labelledby="titulo-cola-reservas" className="mx-auto w-full max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 rounded-2xl border border-borde bg-gradient-to-r from-superficie via-superficie to-acento-50 p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6 dark:to-superficie-alta">
        <div className="flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-marca-600/15 text-marca-700 dark:bg-marca-500/15 dark:text-marca-300">
            <Calendar aria-hidden="true" className="size-6" />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-acento-700 dark:text-acento-300">Gestión de préstamos</p>
            <h2 id="titulo-cola-reservas" className="mt-1 text-xl font-bold text-texto">
              Reservas
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-texto-suave">
              Consulta el calendario de disponibilidad, evalúa excepciones académicas y administra las reservas confirmadas. Las reservas se gestionan por fechas: un mismo ejemplar puede tener múltiples reservas en distintas temporadas.
            </p>
          </div>
        </div>
        <Boton
          variante="secundario"
          tamanio="pequeno"
          icono={RefreshCw}
          onClick={() => setRecarga((v) => v + 1)}
          deshabilitado={cargandoCola}
        >
          Actualizar
        </Boton>
      </header>

      {/* Selector y buscador de material */}
      <Tarjeta className="space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-borde pb-3">
          <div>
            <h3 className="text-base font-bold text-texto">Filtrar reservas</h3>
            <p className="mt-0.5 text-xs text-texto-suave">Busca un material o consulta todas las reservas.</p>
          </div>
          <span className="rounded-full bg-superficie-alta px-3 py-1 text-xs font-semibold text-texto-suave">
            {materialesFiltrados.length} materiales
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="buscar-material-cola"
              className="block text-xs font-semibold text-texto"
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
                className="w-full rounded-lg border border-borde bg-white py-2 pl-9 pr-3 text-sm text-texto shadow-xs transition focus:border-acento-500 focus:outline-none focus:ring-2 focus:ring-acento-500/20 dark:bg-superficie"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="select-material-cola"
            className="block text-xs font-semibold text-texto"
            >
              Material seleccionado
            </label>
            <select
              id="select-material-cola"
              value={materialIdSeleccionado}
              onChange={(e) => seleccionarMaterial(e.target.value)}
              className="mt-1 w-full rounded-lg border border-borde bg-white px-3 py-2 text-sm text-texto shadow-xs transition focus:border-acento-500 focus:outline-none focus:ring-2 focus:ring-acento-500/20 dark:bg-superficie"
            >
              <option value="">Todas las reservas (todos los materiales)</option>
              {materialesFiltrados.map((m) => {
                const disp = m.unidades_disponibles ?? m.resumen_instancias?.disponible ?? 0
                return (
                  <option key={m.id} value={m.id}>
                    {m.nombre} ({m.codigo_material}) — {disp} de {m.stock}{' '}
                    {m.stock === 1 ? 'ejemplar' : 'ejemplares'} disponibles
                  </option>
                )
              })}
            </select>
          </div>
        </div>
      </Tarjeta>

      {errorAccion && (
        <ErrorModal
          titulo="No se pudo completar la acción"
          mensaje={errorAccion}
          onCerrar={() => setErrorAccion('')}
        />
      )}
      <ExitoModal
        titulo="Acción completada"
        mensaje={mensajePopupExito}
        onCerrar={() => setMensajePopupExito('')}
      />

      {/* Modal/Panel para ingresar motivo de rechazo o cancelación */}
      {accionConMotivo && (
        <Tarjeta className="border-amber-300 bg-amber-50/50 p-5 dark:border-amber-700 dark:bg-amber-950/30">
          <form onSubmit={confirmarAccionConMotivo} className="space-y-3" noValidate>
            <h3 className="text-sm font-bold text-texto">
              {accionConMotivo.tipo === 'rechazar'
                ? `Rechazar solicitud de excepción (${accionConMotivo.etiqueta})`
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
          {/* Resumen del material y ejemplares libres o vista general */}
          <Tarjeta className="space-y-5 p-5 sm:p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wide text-acento-700 dark:text-acento-300">
                  {cola.material ? (
                    `Código de Material: ${cola.material.codigo_material} · Tier mínimo: ${
                      ETIQUETAS_TIER[cola.material.tier_minimo_requerido] ||
                      cola.material.tier_minimo_requerido
                    }`
                  ) : (
                    'Vista general del almacén (sin filtros aplicados)'
                  )}
                </span>
                <h3 className="text-lg font-bold text-texto">
                  {cola.material ? cola.material.nombre : 'Todas las reservas y solicitudes activas'}
                </h3>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:min-w-[28rem]">
                {cola.material && (
                  <div className="rounded-xl bg-marca-50 p-3 dark:bg-marca-950/40">
                    <span className="block text-xs font-semibold text-marca-800 dark:text-marca-300">
                      Ejemplares disponibles
                    </span>
                    <span className="mt-1 block text-2xl font-bold tabular-nums text-marca-800 dark:text-marca-200">
                      {instanciasDisponibles.length}
                    </span>
                  </div>
                )}
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-900">
                  <span className="block text-xs font-semibold text-amber-900 dark:text-amber-200">
                    Pendientes de revisión
                  </span>
                  <span className="mt-1 block text-2xl font-bold tabular-nums text-amber-900 dark:text-amber-100">
                    {enEsperaExcepciones.length}
                  </span>
                </div>
                <div className="rounded-xl border border-acento-200 bg-acento-50 p-3 dark:border-acento-700 dark:bg-acento-900">
                  <span className="block text-xs font-semibold text-acento-900 dark:text-acento-200">
                    Reservas pendientes de recojo
                  </span>
                  <span className="mt-1 block text-2xl font-bold tabular-nums text-acento-900 dark:text-acento-100">
                    {reservasConfirmadas.length}
                  </span>
                </div>
              </div>
            </div>

            {cola.material && (
              <div>
                <p className="text-xs font-semibold text-texto-suave">
                  Ejemplares físicos disponibles (sin préstamo activo):
                </p>
                {instanciasDisponibles.length === 0 ? (
                  <p className="mt-1 text-xs text-texto-suave">
                    No hay ejemplares en estado Disponible en este momento (pueden tener reservas futuras programadas).
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
            )}
          </Tarjeta>

          {/* Calendario de disponibilidad del material seleccionado */}
          {materialIdSeleccionado && (
            <Tarjeta className="space-y-4 p-5 sm:p-6">
              <div className="flex items-start gap-3 border-b border-borde pb-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-acento-100 text-acento-700 dark:bg-acento-500/15 dark:text-acento-300">
                  <Calendar aria-hidden="true" className="size-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-texto">Disponibilidad por fechas</h3>
                  <p className="mt-0.5 text-xs text-texto-suave">Consulta la ocupación de este material en el calendario.</p>
                </div>
              </div>
              <p className="text-xs text-texto-suave">
                Vista del calendario de ocupación del material. Los días en verde tienen al menos un
                ejemplar libre; los días en rojo están completamente reservados o prestados.
              </p>
              <CalendarioDisponibilidad materialId={materialIdSeleccionado} />
            </Tarjeta>
          )}

          {/* Excepciones académicas pendientes de revisión */}
          <section aria-labelledby="subtitulo-excepciones" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-borde pb-3">
            <h3
              id="subtitulo-excepciones"
              className="flex items-center gap-2 text-base font-bold text-texto"
            >
              <ShieldAlert aria-hidden="true" className="size-5 text-amber-600" />
              Excepciones académicas pendientes de revisión
            </h3>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold tabular-nums text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">{enEsperaExcepciones.length}</span>
            </div>
            {enEsperaExcepciones.length === 0 ? (
              <p className="rounded-xl border border-borde bg-superficie p-4 text-sm text-texto-suave">
                No hay solicitudes de excepción académica pendientes para este material.
              </p>
            ) : (
              <ul className="grid gap-3">
                {enEsperaExcepciones.map((reserva) => (
                  <li key={reserva.id}>
                    <Tarjeta className="space-y-4 border-l-4 border-l-amber-400 p-4 sm:p-5 dark:border-l-amber-500">
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
                          {reserva.material && (
                            <p className="mt-0.5 text-xs font-semibold text-acento-700 dark:text-acento-300">
                              Material: {reserva.material.nombre} ({reserva.material.codigo_material})
                            </p>
                          )}
                          <p className="mt-1 text-xs text-texto-suave">
                            Solicitada: {formatearFechaReserva(reserva.fecha_solicitud || reserva.fecha_creacion || reserva.created_at)}
                            {' · Límite de revisión: '}
                            {formatearFechaReserva(reserva.fecha_limite_espera)}
                          </p>
                        </div>
                        <BadgeEstado
                          estado={reserva.estado}
                          texto={textoEstadoReserva(reserva, reserva.estado)}
                        />
                      </div>

                      <p className="rounded-lg bg-superficie-alta/50 p-3 text-sm leading-relaxed text-texto">
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
                              variante="accion"
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
                              variante="peligro-secundario"
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

          {/* Reservas confirmadas vigentes */}
          <section aria-labelledby="subtitulo-confirmadas" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-borde pb-3">
            <h3
              id="subtitulo-confirmadas"
              className="flex items-center gap-2 text-base font-bold text-texto"
            >
              <PackageCheck aria-hidden="true" className="size-5 text-marca-700 dark:text-marca-400" />
              Reservas confirmadas pendientes de recojo
            </h3>
            <span className="rounded-full bg-acento-100 px-3 py-1 text-xs font-bold tabular-nums text-acento-900 dark:bg-acento-950/60 dark:text-acento-200">{reservasConfirmadas.length}</span>
            </div>
            {reservasConfirmadas.length === 0 ? (
              <EstadoVacio
                titulo="Sin reservas confirmadas activas"
                mensaje="Las reservas confirmadas con ejemplar asignado y su límite de recojo aparecerán aquí."
              />
            ) : (
              <ul className="grid gap-3">
                {reservasConfirmadas.map((reserva) => (
                  <li key={reserva.id}>
                    <Tarjeta className="space-y-4 p-4 sm:p-5">
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
                          {reserva.material && (
                            <p className="mt-0.5 text-xs font-semibold text-acento-700 dark:text-acento-300">
                              Material: {reserva.material.nombre} ({reserva.material.codigo_material})
                            </p>
                          )}
                          <p className="mt-1 text-xs text-texto-suave">
                            Ejemplar reservado:{' '}
                            <strong className="font-mono text-texto">
                              {reserva.instancia?.codigo_ejemplar}
                            </strong>{' '}
                            · Límite de recojo (30 min de tolerancia):{' '}
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

                      <p className="rounded-lg bg-superficie-alta/50 p-3 text-sm leading-relaxed text-texto">
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
                            variante="peligro-secundario"
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
