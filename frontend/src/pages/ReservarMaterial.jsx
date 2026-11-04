import { useContext, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { ArrowLeft, CalendarCheck, Clock, Download, ShieldAlert } from 'lucide-react'

import { api, ErrorApi } from '../api/client'
import BadgeEstado from '../components/ui/BadgeEstado'
import Boton from '../components/ui/Boton'
import ErrorAlerta from '../components/ui/ErrorAlerta'
import Skeleton from '../components/ui/Skeleton'
import Tarjeta from '../components/ui/Tarjeta'
import { ETIQUETAS_TIER, ETIQUETAS_TIPO } from '../constantes/catalogo'
import SesionContext from '../contextos/SesionContext'
import useTituloPagina from '../hooks/useTituloPagina'
import {
  MAXIMO_RESERVAS_ACTIVAS,
  construirFormularioReservaExcepcional,
  contarReservasActivas,
  esElegiblePorTier,
  esReservaActiva,
  formatearFechaReserva,
  formatearFechaHoraInput,
  HORA_RESERVA_MAXIMO_FIN,
  HORA_RESERVA_MINIMO_INICIO,
  requiereExcepcionAcademica,
  textoEstadoReserva,
  validarFormularioReserva,
  validarHorarioReserva,
} from '../reservas/estadoReserva'

function extraerMensajeError(error) {
  if (error instanceof ErrorApi && error.datos) {
    if (typeof error.datos.detail === 'string') return error.datos.detail
    const primerCampo = Object.values(error.datos).flat()[0]
    if (primerCampo) return String(primerCampo)
  }
  return 'No se pudo registrar la solicitud de reserva. Verifica los datos e intenta nuevamente.'
}

export default function ReservarMaterial() {
  useTituloPagina('Reservar material')
  const { usuario } = useContext(SesionContext)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const materialIdParam = searchParams.get('materialId') || ''

  const [materiales, setMateriales] = useState([])
  const [misReservas, setMisReservas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')

  const [materialId, setMaterialId] = useState(materialIdParam)
  const [justificacion, setJustificacion] = useState('')
  const [instanciaId, setInstanciaId] = useState('')
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [documentoIdentidad, setDocumentoIdentidad] = useState(null)
  const [compromisoResponsabilidad, setCompromisoResponsabilidad] = useState(null)
  const [errores, setErrores] = useState({})
  const [errorEnvio, setErrorEnvio] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [reservaCreada, setReservaCreada] = useState(null)

  const [instancias, setInstancias] = useState([])
  const [cargandoInstancias, setCargandoInstancias] = useState(false)
  const [fechaSeleccionada, setFechaSeleccionada] = useState('')
  const [horaInicio, setHoraInicio] = useState('')
  const [horaFin, setHoraFin] = useState('')

  useEffect(() => {
    let activa = true
    setCargando(true)
    setErrorCarga('')

    Promise.all([api.get('/materiales/'), api.get('/reservas/mis-reservas/')])
      .then(([listaMateriales, listaReservas]) => {
        if (!activa) return
        const mats = Array.isArray(listaMateriales)
          ? listaMateriales
          : Array.isArray(listaMateriales?.results)
            ? listaMateriales.results
            : []
        setMateriales(mats)
        setMisReservas(Array.isArray(listaReservas) ? listaReservas : [])
      })
      .catch(() => {
        if (activa) {
          setErrorCarga('No fue posible cargar el catálogo de materiales para reservar.')
        }
      })
      .finally(() => {
        if (activa) setCargando(false)
      })

    return () => {
      activa = false
    }
  }, [])

  useEffect(() => {
    let activa = true
    setInstancias([])
    setInstanciaId('')
    setCargandoInstancias(false)

    if (!materialId) {
      return () => {
        activa = false
      }
    }

    setCargandoInstancias(true)
    api
      .get(`/materiales/${materialId}/instancias/?estado=disponible`)
      .then((resultado) => {
        if (!activa) return
        const lista = Array.isArray(resultado)
          ? resultado
          : Array.isArray(resultado?.results)
            ? resultado.results
            : []
        setInstancias(lista)
      })
      .catch(() => {
        if (activa) setInstancias([])
      })
      .finally(() => {
        if (activa) setCargandoInstancias(false)
      })

    return () => {
      activa = false
    }
  }, [materialId])

  const materialSeleccionado = useMemo(
    () => materiales.find((m) => String(m.id) === String(materialId)) || null,
    [materiales, materialId],
  )

  const tierUsuario = usuario?.reputacion_tier || 'estandar'
  const tierMaterial = materialSeleccionado?.tier_minimo_requerido || 'estandar'
  const esAvanzado = tierMaterial === 'avanzado'
  const elegibleNormal = materialSeleccionado
    ? esElegiblePorTier(tierUsuario, tierMaterial)
    : true
  const aplicaExcepcion = materialSeleccionado
    ? requiereExcepcionAcademica(tierUsuario, tierMaterial)
    : false
  const bloqueadoPorTier = Boolean(
    materialSeleccionado && !elegibleNormal && !aplicaExcepcion,
  )

  const reservasActivas = useMemo(() => contarReservasActivas(misReservas), [misReservas])
  const yaTieneActivaEnMaterial = useMemo(
    () =>
      Boolean(
        materialSeleccionado &&
          misReservas.some(
            (r) =>
              esReservaActiva(r) &&
              String(r.material?.id || '') === String(materialSeleccionado.id),
          ),
      ),
    [misReservas, materialSeleccionado],
  )

  const unidadesDisponibles =
    materialSeleccionado?.unidades_disponibles ??
    materialSeleccionado?.resumen_instancias?.disponible ??
    0

  async function manejarSubmit(evento) {
    evento.preventDefault()
    setErrorEnvio('')

    const nuevosErrores = validarFormularioReserva({
      materialId,
      instanciaId,
      fechaSeleccionada: esAvanzado ? fechaSeleccionada : undefined,
      horaInicio: esAvanzado ? horaInicio : undefined,
      horaFin: esAvanzado ? horaFin : undefined,
      fechaInicio: esAvanzado ? undefined : fechaInicio,
      fechaFin: esAvanzado ? undefined : fechaFin,
      prioridad,
      justificacion,
      esExcepcion: aplicaExcepcion,
      esAvanzado,
      documentoIdentidad,
      compromisoResponsabilidad,
    })

    if (Object.keys(nuevosErrores).length > 0) {
      setErrores(nuevosErrores)
      return
    }

    setErrores({})
    setEnviando(true)

    try {
      let respuesta
      if (aplicaExcepcion) {
        const formData = construirFormularioReservaExcepcional({
          materialId,
          justificacion,
          documentoIdentidad,
          compromisoResponsabilidad,
        })
        respuesta = await api.post('/reservas/excepcion/', formData)
      } else {
        const fechaI = esAvanzado
          ? `${fechaSeleccionada}T${horaInicio}:00`
          : fechaInicio || undefined
        const fechaF = esAvanzado
          ? `${fechaSeleccionada}T${horaFin}:00`
          : fechaFin || undefined
        respuesta = await api.post('/reservas/', {
          material_id: materialId,
          instancia_id: instanciaId || undefined,
          fecha_inicio: fechaI,
          fecha_fin: fechaF,
          prioridad,
          justificacion: justificacion.trim(),
        })
      }
      setReservaCreada(respuesta)
    } catch (err) {
      setErrorEnvio(extraerMensajeError(err))
    } finally {
      setEnviando(false)
    }
  }

  if (cargando) {
    return (
      <div className="space-y-3" role="status" aria-live="polite">
        <p className="text-sm text-texto-suave">Cargando datos para registrar tu reserva…</p>
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    )
  }

  if (errorCarga) {
    return (
      <section className="space-y-4">
        <ErrorAlerta mensaje={errorCarga} />
        <Link
          to="/panel/reservas"
          className="inline-flex items-center gap-2 text-sm font-semibold text-acento-700 hover:underline dark:text-acento-300"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Volver a mis reservas
        </Link>
      </section>
    )
  }

  if (reservaCreada) {
    const confirmada = reservaCreada.estado === 'reservada'
    return (
      <Tarjeta className="p-6 space-y-5" aria-labelledby="titulo-reserva-exitosa">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {confirmada ? (
              <CalendarCheck aria-hidden="true" className="size-6 text-marca-700 dark:text-marca-400" />
            ) : (
              <Clock aria-hidden="true" className="size-6 text-amber-600 dark:text-amber-400" />
            )}
            <h2 id="titulo-reserva-exitosa" className="text-xl font-bold text-texto">
              {confirmada
                ? 'Reserva confirmada por 24 horas'
                : reservaCreada.es_excepcion
                  ? 'Solicitud de excepción académica registrada'
                  : 'Solicitud registrada en lista de espera'}
            </h2>
          </div>
          <BadgeEstado
            estado={reservaCreada.estado}
            texto={textoEstadoReserva(reservaCreada, reservaCreada.estado)}
          />
        </div>

        <p className="text-sm text-texto-suave">
          {confirmada
            ? 'Se ha bloqueado un ejemplar disponible para ti. Acércate al almacén antes de la fecha límite para concretar el préstamo.'
            : reservaCreada.es_excepcion
              ? 'Tu solicitud excepcional con documentos de garantía ha quedado en espera de evaluación manual por el Gestor de Almacén.'
              : 'Actualmente no hay ejemplares libres o existen solicitudes previas. Tu solicitud entró a la cola de espera por 72 horas sin consumir inventario.'}
        </p>

        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          <div className="rounded-lg border border-borde bg-superficie-alta/40 p-3">
            <dt className="text-xs font-semibold uppercase tracking-wide text-texto-suave">
              Material
            </dt>
            <dd className="mt-1 font-bold text-texto">
              {reservaCreada.material?.nombre} ({reservaCreada.material?.codigo_material})
            </dd>
          </div>

          {confirmada ? (
            <>
              <div className="rounded-lg border border-marca-200 bg-marca-50/50 p-3 dark:border-marca-800 dark:bg-marca-950/30">
                <dt className="text-xs font-semibold uppercase tracking-wide text-marca-800 dark:text-marca-300">
                  Ejemplar asignado
                </dt>
                <dd className="mt-1 font-bold text-texto">
                  {reservaCreada.instancia?.codigo_ejemplar || 'Asignado'}
                </dd>
                {reservaCreada.instancia?.foto && (
                  <img
                    src={reservaCreada.instancia.foto}
                    alt={`Foto del ejemplar ${reservaCreada.instancia.codigo_ejemplar}`}
                    className="mt-2 h-16 w-16 rounded-lg border border-borde object-cover"
                  />
                )}
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-800 dark:bg-marca-950/30">
                <dt className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                  Límite de recojo (24 h)
                </dt>
                <dd className="mt-1 font-bold text-texto">
                  {formatearFechaReserva(reservaCreada.fecha_limite_recojo)}
                </dd>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-lg border border-borde bg-superficie-alta/40 p-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-texto-suave">
                  Orden en cola
                </dt>
                <dd className="mt-1 font-bold text-texto">
                  {reservaCreada.es_excepcion
                    ? 'Evaluación por gestor'
                    : reservaCreada.posicion_cola
                      ? `Posición #${reservaCreada.posicion_cola}`
                      : 'En espera'}
                </dd>
              </div>
              <div className="rounded-lg border border-borde bg-superficie-alta/40 p-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-texto-suave">
                  Vigencia en espera (72 h)
                </dt>
                <dd className="mt-1 font-bold text-texto">
                  {formatearFechaReserva(reservaCreada.fecha_limite_espera)}
                </dd>
              </div>
            </>
          )}
        </dl>

        <div className="flex flex-wrap gap-3 pt-2">
          <Boton onClick={() => navigate('/panel/reservas')}>Ver mis reservas</Boton>
          <Boton variante="secundario" onClick={() => navigate('/catalogo')}>
            Volver al catálogo
          </Boton>
        </div>
      </Tarjeta>
    )
  }

  return (
    <section aria-labelledby="titulo-reservar-material" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            to="/panel/reservas"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-acento-700 hover:underline dark:text-acento-300"
          >
            <ArrowLeft aria-hidden="true" className="size-3.5" />
            Volver a mis reservas
          </Link>
          <h2 id="titulo-reservar-material" className="mt-1 text-xl font-bold text-texto">
            Reservar material o solicitar lista de espera
          </h2>
          <p className="mt-0.5 text-sm text-texto-suave">
            Tu Tier actual:{' '}
            <span className="font-semibold text-texto">
              {ETIQUETAS_TIER[tierUsuario] || tierUsuario}
            </span>{' '}
            ({usuario?.reputacion_puntaje ?? 0} pts) · Solicitudes activas:{' '}
            <span className="font-semibold text-texto">
              {reservasActivas} de {MAXIMO_RESERVAS_ACTIVAS}
            </span>
          </p>
        </div>
      </div>

      {reservasActivas >= MAXIMO_RESERVAS_ACTIVAS && (
        <ErrorAlerta
          mensaje={`Ya alcanzaste el máximo de ${MAXIMO_RESERVAS_ACTIVAS} solicitudes activas simultáneas (entre reservas confirmadas y solicitudes en espera).`}
        />
      )}

      {errorEnvio && <ErrorAlerta mensaje={errorEnvio} />}

      <Tarjeta className="p-6">
        <form onSubmit={manejarSubmit} noValidate className="space-y-5">
          <p className="text-xs text-texto-suave">* Campos obligatorios.</p>

          <div>
            <label
              htmlFor="select-material-reserva"
              className="block text-sm font-semibold text-texto"
            >
              Material a solicitar *
            </label>
            <select
              id="select-material-reserva"
              value={materialId}
              onChange={(e) => {
                setMaterialId(e.target.value)
                setErrores((actual) => ({ ...actual, materialId: '' }))
              }}
              className="mt-1.5 w-full rounded-lg border border-borde bg-white px-3 py-2 text-sm text-texto dark:bg-superficie"
            >
              <option value="">Selecciona un material del catálogo…</option>
              {materiales.map((mat) => {
                const disp = mat.unidades_disponibles ?? mat.resumen_instancias?.disponible ?? 0
                const tierMat = ETIQUETAS_TIER[mat.tier_minimo_requerido] || mat.tier_minimo_requerido
                return (
                  <option key={mat.id} value={mat.id}>
                    {mat.nombre} ({mat.codigo_material}) — {disp} de {mat.stock} libre(s) · Tier mín: {tierMat}
                  </option>
                )
              })}
            </select>
            {errores.materialId && (
              <p className="mt-1 text-xs font-medium text-error">{errores.materialId}</p>
            )}
          </div>

          {materialSeleccionado && (
            <div className="rounded-xl border border-borde bg-superficie-alta/40 p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-acento-700 dark:text-acento-300">
                    {ETIQUETAS_TIPO[materialSeleccionado.tipo] || materialSeleccionado.tipo} · Código:{' '}
                    {materialSeleccionado.codigo_material}
                  </span>
                  <h3 className="text-base font-bold text-texto">{materialSeleccionado.nombre}</h3>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    unidadesDisponibles > 0
                      ? 'bg-marca-100 text-marca-800 dark:bg-marca-950/60 dark:text-marca-300'
                      : 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200'
                  }`}
                >
                  {unidadesDisponibles} de {materialSeleccionado.stock} disponible(s)
                </span>
              </div>

              {materialSeleccionado.foto && (
                <img
                  src={materialSeleccionado.foto}
                  alt={`Foto del material ${materialSeleccionado.nombre}`}
                  className="mt-3 h-24 w-24 rounded-lg border border-borde object-cover"
                />
              )}

              <div className="grid gap-2 sm:grid-cols-2 text-xs text-texto-suave">
                <p>
                  <span className="font-semibold text-texto">Tier mínimo requerido:</span>{' '}
                  {ETIQUETAS_TIER[tierMaterial] || tierMaterial}
                </p>
                <p>
                  <span className="font-semibold text-texto">Modalidad estimada:</span>{' '}
                  {aplicaExcepcion
                    ? 'Solicitud excepcional en espera (72 h, sujeta a aprobación del gestor)'
                    : unidadesDisponibles > 0
                      ? 'Reserva confirmada inmediata (24 h de vigencia)'
                      : 'Lista de espera sin bloquear inventario (72 h de vigencia)'}
                </p>
              </div>

              {yaTieneActivaEnMaterial && (
                <ErrorAlerta mensaje="Ya tienes una reserva confirmada o solicitud en espera activa para este material." />
              )}

              {bloqueadoPorTier && (
                <ErrorAlerta
                  mensaje={`Este material requiere Tier ${ETIQUETAS_TIER[tierMaterial] || tierMaterial} y tu cuenta tiene Tier ${ETIQUETAS_TIER[tierUsuario] || tierUsuario}.`}
                />
              )}

              {aplicaExcepcion && (
                <div className="rounded-lg border border-amber-300 bg-amber-50/80 p-3.5 text-xs text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100 space-y-1.5">
                  <p className="flex items-center gap-1.5 font-bold text-sm">
                    <ShieldAlert aria-hidden="true" className="size-4 shrink-0" />
                    Solicitud de Excepción por Necesidad Académica (HU13)
                  </p>
                  <p>
                    Tu cuenta se encuentra en Tier{' '}
                    <strong>{ETIQUETAS_TIER[tierUsuario] || tierUsuario}</strong> y este material exige Tier{' '}
                    <strong>{ETIQUETAS_TIER[tierMaterial] || tierMaterial}</strong>. Puedes registrar una solicitud excepcional adjuntando obligatoriamente tu documento de identidad y el compromiso de responsabilidad firmado en PDF (máximo 4 MB en total).
                  </p>
                  <p>
                    <a
                      href="/compromiso_responsabilidad.pdf"
                      download="compromiso_responsabilidad.pdf"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 font-bold text-amber-900 underline hover:text-amber-950 dark:text-amber-200"
                    >
                      <Download aria-hidden="true" className="size-4" />
                      Descargar formato oficial de compromiso de responsabilidad (.pdf)
                    </a>
                  </p>
                  <p>
                    La solicitud quedará en estado <strong>En espera</strong> hasta que el Gestor de Almacén verifique la garantía y la apruebe manualmente para entrar a la lista de espera.
                  </p>
                </div>
              )}
            </div>
          )}

          {materialSeleccionado && instancias.length > 0 && (
            <div>
              <label
                htmlFor="select-instancia-reserva"
                className="block text-sm font-semibold text-texto"
              >
                Instancia / ejemplar *
              </label>
              <select
                id="select-instancia-reserva"
                value={instanciaId}
                onChange={(e) => {
                  setInstanciaId(e.target.value)
                  setErrores((actual) => ({ ...actual, instanciaId: '' }))
                }}
                className="mt-1.5 w-full rounded-lg border border-borde bg-white px-3 py-2 text-sm text-texto dark:bg-superficie"
              >
                <option value="">Selecciona una instancia disponible…</option>
                {instancias.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.codigo_ejemplar}{inst.ubicacion ? ` (${inst.ubicacion})` : ''}
                  </option>
                ))}
              </select>
              {errores.instanciaId && (
                <p className="mt-1 text-xs font-medium text-error">{errores.instanciaId}</p>
              )}
            </div>
          )}

          {materialSeleccionado && esAvanzado ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label
                  htmlFor="input-fecha-reserva"
                  className="block text-sm font-semibold text-texto"
                >
                  Fecha *
                </label>
                <input
                  id="input-fecha-reserva"
                  type="date"
                  value={fechaSeleccionada}
                  onChange={(e) => {
                    setFechaSeleccionada(e.target.value)
                    setErrores((actual) => ({ ...actual, fecha: '' }))
                  }}
                  className="mt-1.5 w-full rounded-lg border border-borde bg-white px-3 py-2 text-sm text-texto dark:bg-superficie"
                />
                {errores.fecha && (
                  <p className="mt-1 text-xs font-medium text-error">{errores.fecha}</p>
                )}
              </div>
              <div>
                <label
                  htmlFor="input-hora-inicio-reserva"
                  className="block text-sm font-semibold text-texto"
                >
                  Hora de inicio *
                </label>
                <input
                  id="input-hora-inicio-reserva"
                  type="time"
                  value={horaInicio}
                  onChange={(e) => {
                    setHoraInicio(e.target.value)
                    setErrores((actual) => ({ ...actual, horaInicio: '' }))
                  }}
                  className="mt-1.5 w-full rounded-lg border border-borde bg-white px-3 py-2 text-sm text-texto dark:bg-superficie"
                />
                {errores.horaInicio && (
                  <p className="mt-1 text-xs font-medium text-error">{errores.horaInicio}</p>
                )}
              </div>
              <div>
                <label
                  htmlFor="input-hora-fin-reserva"
                  className="block text-sm font-semibold text-texto"
                >
                  Hora de fin *
                </label>
                <input
                  id="input-hora-fin-reserva"
                  type="time"
                  value={horaFin}
                  onChange={(e) => {
                    setHoraFin(e.target.value)
                    setErrores((actual) => ({ ...actual, horaFin: '' }))
                  }}
                  className="mt-1.5 w-full rounded-lg border border-borde bg-white px-3 py-2 text-sm text-texto dark:bg-superficie"
                />
                {errores.horaFin && (
                  <p className="mt-1 text-xs font-medium text-error">{errores.horaFin}</p>
                )}
              </div>
              <p className="text-xs text-texto-suave col-span-3">
                Horario de atención: lunes a viernes, de {HORA_RESERVA_MINIMO_INICIO}:00 a {HORA_RESERVA_MAXIMO_FIN}:00.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="input-fecha-inicio-reserva"
                  className="block text-sm font-semibold text-texto"
                >
                  Fecha y hora de inicio *
                </label>
                <input
                  id="input-fecha-inicio-reserva"
                  type="datetime-local"
                  value={fechaInicio}
                  onChange={(e) => {
                    setFechaInicio(e.target.value)
                    setErrores((actual) => ({ ...actual, fechaInicio: '' }))
                  }}
                  className="mt-1.5 w-full rounded-lg border border-borde bg-white px-3 py-2 text-sm text-texto dark:bg-superficie"
                />
                {errores.fechaInicio && (
                  <p className="mt-1 text-xs font-medium text-error">{errores.fechaInicio}</p>
                )}
              </div>
              <div>
                <label
                  htmlFor="input-fecha-fin-reserva"
                  className="block text-sm font-semibold text-texto"
                >
                  Fecha y hora de fin *
                </label>
                <input
                  id="input-fecha-fin-reserva"
                  type="datetime-local"
                  value={fechaFin}
                  onChange={(e) => {
                    setFechaFin(e.target.value)
                    setErrores((actual) => ({ ...actual, fechaFin: '' }))
                  }}
                  className="mt-1.5 w-full rounded-lg border border-borde bg-white px-3 py-2 text-sm text-texto dark:bg-superficie"
                />
                {errores.fechaFin && (
                  <p className="mt-1 text-xs font-medium text-error">{errores.fechaFin}</p>
                )}
              </div>
              <p className="text-xs text-texto-suave col-span-2">
                Horario de atención: lunes a viernes, de {HORA_RESERVA_MINIMO_INICIO}:00 a {HORA_RESERVA_MAXIMO_FIN}:00.
              </p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="select-prioridad-reserva"
                className="block text-sm font-semibold text-texto"
              >
                Nivel de prioridad *
              </label>
              <select
                id="select-prioridad-reserva"
                value={prioridad}
                onChange={(e) => setPrioridad(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-borde bg-white px-3 py-2 text-sm text-texto dark:bg-superficie"
              >
                {OPCIONES_PRIORIDAD.map((op) => (
                  <option key={op.valor} value={op.valor}>
                    {op.etiqueta}
                  </option>
                ))}
              </select>
              {errores.prioridad && (
                <p className="mt-1 text-xs font-medium text-error">{errores.prioridad}</p>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="textarea-justificacion-reserva"
              className="block text-sm font-semibold text-texto"
            >
              Justificación académica / motivo de uso *
            </label>
            <textarea
              id="textarea-justificacion-reserva"
              rows={3}
              value={justificacion}
              onChange={(e) => {
                setJustificacion(e.target.value)
                setErrores((actual) => ({ ...actual, justificacion: '' }))
              }}
              className="mt-1.5 w-full rounded-lg border border-borde bg-white px-3 py-2 text-sm text-texto dark:bg-superficie"
            />
            {errores.justificacion && (
              <p className="mt-1 text-xs font-medium text-error">{errores.justificacion}</p>
            )}
          </div>

          {aplicaExcepcion && (
            <div className="rounded-xl border border-amber-300 bg-amber-50/40 p-4 space-y-4 dark:border-amber-800 dark:bg-amber-950/20">
              <h3 className="text-sm font-bold text-texto">
                Documentos de garantía para Excepción Académica (PDF, máx. 4 MB en total) *
              </h3>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="archivo-dni-reserva"
                    className="block text-xs font-semibold text-texto"
                  >
                    Documento de identidad (PDF) *
                  </label>
                  <input
                    id="archivo-dni-reserva"
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(e) => {
                      setDocumentoIdentidad(e.target.files?.[0] ?? null)
                      setErrores((actual) => ({
                        ...actual,
                        documentoIdentidad: '',
                        archivos: '',
                      }))
                    }}
                    className="mt-1 w-full rounded-lg border border-borde bg-white px-3 py-2 text-xs text-texto dark:bg-superficie"
                  />
                  {errores.documentoIdentidad && (
                    <p className="mt-1 text-xs font-medium text-error">
                      {errores.documentoIdentidad}
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <label
                      htmlFor="archivo-compromiso-reserva"
                      className="block text-xs font-semibold text-texto"
                    >
                      Compromiso de responsabilidad firmado (PDF) *
                    </label>
                    <a
                      href="/compromiso_responsabilidad.pdf"
                      download="compromiso_responsabilidad.pdf"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-marca-700 hover:text-marca-800 underline dark:text-marca-400"
                      title="Descargar formato oficial de compromiso de responsabilidad"
                    >
                      <Download aria-hidden="true" className="size-3.5" />
                      Descargar formato PDF
                    </a>
                  </div>
                  <input
                    id="archivo-compromiso-reserva"
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(e) => {
                      setCompromisoResponsabilidad(e.target.files?.[0] ?? null)
                      setErrores((actual) => ({
                        ...actual,
                        compromisoResponsabilidad: '',
                        archivos: '',
                      }))
                    }}
                    className="mt-1 w-full rounded-lg border border-borde bg-white px-3 py-2 text-xs text-texto dark:bg-superficie"
                  />
                  {errores.compromisoResponsabilidad && (
                    <p className="mt-1 text-xs font-medium text-error">
                      {errores.compromisoResponsabilidad}
                    </p>
                  )}
                </div>
              </div>

              {errores.archivos && (
                <p className="text-xs font-medium text-error">{errores.archivos}</p>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Boton
              tipo="submit"
              cargando={enviando}
              deshabilitado={
                enviando ||
                reservasActivas >= MAXIMO_RESERVAS_ACTIVAS ||
                yaTieneActivaEnMaterial ||
                bloqueadoPorTier
              }
            >
              {aplicaExcepcion
                ? 'Enviar solicitud de excepción académica'
                : unidadesDisponibles > 0
                  ? 'Confirmar reserva (24 h)'
                  : 'Unirse a lista de espera (72 h)'}
            </Boton>
            <Boton
              tipo="button"
              variante="secundario"
              onClick={() => navigate('/panel/reservas')}
            >
              Cancelar
            </Boton>
          </div>
        </form>
      </Tarjeta>
    </section>
  )
}
