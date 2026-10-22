import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Download } from 'lucide-react'

import { api, ErrorApi } from '../api/client'
import useTituloPagina from '../hooks/useTituloPagina'
import {
  ESTADOS_CHECKLIST_DEVOLUCION,
  ETIQUETAS_DANO,
  ETIQUETAS_ESTADO_DEVOLUCION,
  esDevoluble,
} from '../constantes/devolucion'
import {
  armarChecklistDevolucion,
  construirFormularioDevolucion,
  obtenerElementosSinFotoDevolucion,
  serializarChecklistDevolucion,
  validarChecklistDevolucion,
} from '../validacionesDevolucion'
import { ETIQUETAS_TIER } from '../constantes/roles'
import Campo from '../components/ui/Campo'
import Boton from '../components/ui/Boton'
import Tarjeta from '../components/ui/Tarjeta'
import Skeleton from '../components/ui/Skeleton'
import ErrorAlerta from '../components/ui/ErrorAlerta'
import EstadoVacio from '../components/ui/EstadoVacio'
import BadgeEstado from '../components/ui/BadgeEstado'
import AdvertenciaModal from '../components/ui/AdvertenciaModal'

const OPCIONES_ESTADO = ESTADOS_CHECKLIST_DEVOLUCION.map((valor) => ({
  valor,
  etiqueta: ETIQUETAS_ESTADO_DEVOLUCION[valor],
}))

const DEMORA_ESTIMACION_MS = 400

function mensajeApi(error) {
  const datos = error instanceof ErrorApi ? error.datos : null
  if (datos?.detail) return datos.detail
  if (datos && typeof datos === 'object') {
    const primerError = Object.values(datos).flat()[0]
    if (primerError) return String(primerError)
  }
  return 'No se pudo completar la operación. Revisa la conexión e inténtalo otra vez.'
}

function mensajeFotoApi(error) {
  const errores = error instanceof ErrorApi ? error.datos?.fotos_checklist : null
  const mensajes = Array.isArray(errores)
    ? errores.flat(Infinity)
    : errores && typeof errores === 'object'
      ? Object.values(errores).flat(Infinity)
      : []
  return mensajes.find((mensaje) => typeof mensaje === 'string') ?? ''
}

function fechaLegible(valor) {
  if (!valor) return '—'
  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(valor))
}

function moneda(valor) {
  if (valor === null || valor === undefined || valor === '') return null
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
  }).format(Number(valor))
}

function firmarPuntos(delta) {
  if (delta > 0) return `+${delta} puntos`
  if (delta < 0) return `${delta} puntos`
  return '0 puntos'
}

function etiquetaTier(tier) {
  return ETIQUETAS_TIER[tier] ?? tier
}

function CampoResumen({ etiqueta, children }) {
  return (
    <div className="rounded-xl border border-borde bg-superficie p-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-texto-suave">
        {etiqueta}
      </dt>
      <dd className="mt-1 break-words text-sm font-medium text-texto">{children}</dd>
    </div>
  )
}

function ResumenSanciones({ estimacion }) {
  if (!estimacion) return null

  const cobro = moneda(estimacion.cobro_economico)
  const tono = estimacion.puntos_delta >= 0 ? 'exito' : 'advertencia'

  return (
    <div
      className="grid gap-3 rounded-xl border border-borde bg-superficie p-4 sm:grid-cols-2 lg:grid-cols-3"
      aria-live="polite"
    >
      <CampoResumen etiqueta="Entrega">
        {estimacion.a_tiempo
          ? 'A tiempo (sin tardanza)'
          : `Tardía por ${estimacion.dias_tardanza} día(s)`}
      </CampoResumen>
      <CampoResumen etiqueta="Sanción por tiempo">
        {estimacion.a_tiempo
          ? `Bonificación +${estimacion.bonificacion} puntos`
          : `Deducción −${estimacion.deduccion_tardanza} puntos`}
      </CampoResumen>
      <CampoResumen etiqueta="Daño detectado">
        {ETIQUETAS_DANO[estimacion.dano]}
        {estimacion.hay_dano && estimacion.deduccion_dano > 0
          ? ` (−${estimacion.deduccion_dano} puntos)`
          : ''}
      </CampoResumen>
      <CampoResumen etiqueta="Cobro económico">
        {cobro ?? 'Sin cobro por daños'}
      </CampoResumen>
      <CampoResumen etiqueta="Puntos de reputación">
        <span className={tono === 'exito' ? 'text-acento-700' : 'text-error'}>
          {firmarPuntos(estimacion.puntos_delta)}
        </span>
      </CampoResumen>
      <CampoResumen etiqueta="Reputación resultante">
        {estimacion.reputacion_antes} ({etiquetaTier(estimacion.tier_antes)}) →{' '}
        {estimacion.reputacion_despues} ({etiquetaTier(estimacion.tier_despues)})
      </CampoResumen>
    </div>
  )
}

function DevolucionPrestamo() {
  useTituloPagina('Registrar devolución')
  const { prestamoId: parametroId } = useParams()
  const navigate = useNavigate()

  const [detalle, setDetalle] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')
  const [filas, setFilas] = useState([])
  const [errores, setErrores] = useState({})
  const [estimacion, setEstimacion] = useState(null)
  const [estimando, setEstimando] = useState(false)
  const [errorEstimacion, setErrorEstimacion] = useState('')
  const [intentoEstimacion, setIntentoEstimacion] = useState(0)
  const [etapa, setEtapa] = useState('edicion')
  const [guardando, setGuardando] = useState(false)
  const [errorEnvio, setErrorEnvio] = useState('')
  const [resultado, setResultado] = useState(null)
  const [elementosSinFoto, setElementosSinFoto] = useState(null)
  const formularioRef = useRef(null)
  const referenciasFotos = useRef([])
  const urlsTemporales = useRef(new Set())

  const prestamoId = useMemo(() => Number(parametroId), [parametroId])
  const idValido = Number.isInteger(prestamoId) && prestamoId > 0

  useEffect(() => () => {
    urlsTemporales.current.forEach((url) => URL.revokeObjectURL(url))
    urlsTemporales.current.clear()
  }, [])

  useEffect(() => {
    if (!idValido) {
      setCargando(false)
      setErrorCarga('No existe el préstamo indicado.')
      return undefined
    }

    let vigente = true
    setCargando(true)
    setErrorCarga('')
    api
      .get(`/prestamos/${prestamoId}/`)
      .then((datos) => {
        if (!vigente) return
        setDetalle(datos)
        setFilas(armarChecklistDevolucion(datos.checklist_inicial))
      })
      .catch((errorApi) => {
        if (vigente) setErrorCarga(mensajeApi(errorApi))
      })
      .finally(() => {
        if (vigente) setCargando(false)
      })

    return () => {
      vigente = false
    }
  }, [prestamoId, idValido])

  const checklistValido = validarChecklistDevolucion(filas).checklist === undefined
  const devoluble = detalle ? esDevoluble(detalle.estado) : false

  useEffect(() => {
    if (!detalle || !devoluble || etapa === 'exito' || !checklistValido) {
      setEstimacion(null)
      setEstimando(false)
      return undefined
    }

    let vigente = true
    setEstimando(true)
    setErrorEstimacion('')
    const temporizador = setTimeout(() => {
      api
        .post(`/prestamos/${prestamoId}/devolucion/estimar/`, {
          checklist: serializarChecklistDevolucion(filas),
        })
        .then((respuesta) => {
          if (vigente) setEstimacion(respuesta)
        })
        .catch((errorApi) => {
          if (vigente) {
            setEstimacion(null)
            setErrorEstimacion(mensajeApi(errorApi))
          }
        })
        .finally(() => {
          if (vigente) setEstimando(false)
        })
    }, DEMORA_ESTIMACION_MS)

    return () => {
      vigente = false
      clearTimeout(temporizador)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filas, detalle, devoluble, etapa, checklistValido, intentoEstimacion])

  function actualizarFila(indice, campo, valor) {
    setFilas((actual) =>
      actual.map((fila, posicion) =>
        posicion === indice ? { ...fila, [campo]: valor } : fila,
      ),
    )
    setErrores((actual) => {
      const erroresFila = { ...actual.filas?.[indice] }
      const campos = campo === 'estado' ? ['estado', 'foto', 'observacion'] : [campo]
      campos.forEach((nombre) => delete erroresFila[nombre])
      return {
        ...actual,
        checklist: undefined,
        filas: { ...actual.filas, [indice]: erroresFila },
      }
    })
    setErrorEnvio('')
  }

  function cambiarFoto(indice, archivo) {
    const fila = filas[indice]
    if (fila?.fotoPrevia) {
      URL.revokeObjectURL(fila.fotoPrevia)
      urlsTemporales.current.delete(fila.fotoPrevia)
    }
    const fotoPrevia = archivo ? URL.createObjectURL(archivo) : ''
    if (fotoPrevia) urlsTemporales.current.add(fotoPrevia)
    if (referenciasFotos.current[indice]) referenciasFotos.current[indice].value = ''
    setFilas((actual) => actual.map((elemento, posicion) => (
      posicion === indice ? { ...elemento, foto: archivo, fotoPrevia } : elemento
    )))
    setErrores((actual) => {
      const erroresFila = { ...actual.filas?.[indice] }
      delete erroresFila.foto
      return { ...actual, filas: { ...actual.filas, [indice]: erroresFila } }
    })
    setErrorEnvio('')
  }

  function enfocarPrimerError(indicePreferido = null) {
    window.requestAnimationFrame(() => {
      const control = indicePreferido === null
        ? formularioRef.current?.querySelector('[aria-invalid="true"]')
        : referenciasFotos.current[indicePreferido]
      if (!control) return
      control.scrollIntoView({ behavior: 'smooth', block: 'center' })
      control.focus({ preventScroll: true })
    })
  }

  function cerrarAdvertenciaFotos() {
    const primerIndice = elementosSinFoto?.[0]?.indice ?? null
    setElementosSinFoto(null)
    if (primerIndice !== null) enfocarPrimerError(primerIndice)
  }

  function irAlResumen(evento) {
    evento.preventDefault()
    const validacion = validarChecklistDevolucion(filas)
    setErrores(validacion)
    setErrorEnvio('')
    const faltantes = obtenerElementosSinFotoDevolucion(filas)
    setElementosSinFoto(faltantes.length > 0 ? faltantes : null)
    if (faltantes.length > 0) return
    if (Object.keys(validacion).length > 0) return
    setEtapa('resumen')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function confirmarDevolucion() {
    setGuardando(true)
    setErrorEnvio('')
    try {
      const respuesta = await api.post(
        `/prestamos/${prestamoId}/devolucion/`,
        construirFormularioDevolucion(filas),
      )
      setResultado(respuesta)
      setEtapa('exito')
      urlsTemporales.current.forEach((url) => URL.revokeObjectURL(url))
      urlsTemporales.current.clear()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (errorApi) {
      setErrorEnvio(mensajeApi(errorApi))
      const errorFoto = mensajeFotoApi(errorApi)
      if (errorFoto) {
        const indiceConFoto = filas.findIndex((fila) => fila.foto)
        if (indiceConFoto >= 0) {
          setErrores((actual) => ({
            ...actual,
            filas: {
              ...actual.filas,
              [indiceConFoto]: {
                ...actual.filas?.[indiceConFoto],
                foto: errorFoto,
              },
            },
          }))
          setEtapa('edicion')
          enfocarPrimerError(indiceConFoto)
        }
      }
    } finally {
      setGuardando(false)
    }
  }

  function reintentarEstimacion() {
    setIntentoEstimacion((valor) => valor + 1)
  }

  function descargarReporte() {
    if (!resultado?.reporte_url) return
    window.open(resultado.reporte_url, '_blank', 'noopener,noreferrer')
  }

  if (cargando) {
    return (
      <section aria-label="Registrar devolución">
        <div className="space-y-3" role="status" aria-live="polite">
          <p className="text-sm text-texto-suave">Cargando datos del préstamo…</p>
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </section>
    )
  }

  if (errorCarga || !detalle) {
    return (
      <section aria-label="Registrar devolución" className="grid gap-4">
        <ErrorAlerta mensaje={errorCarga || 'No existe el préstamo indicado.'} />
        <div>
          <Boton variante="secundario" onClick={() => navigate('/panel/historial')}>
            Volver al historial
          </Boton>
        </div>
      </section>
    )
  }

  if (!devoluble) {
    return (
      <section aria-label="Registrar devolución" className="grid gap-4">
        <EstadoVacio
          titulo="Este préstamo no admite devolución"
          mensaje={`El préstamo del material ${detalle.material_nombre} está en estado "${detalle.estado}" y ya no puede recibir una devolución.`}
        />
        <div>
          <Boton variante="secundario" onClick={() => navigate('/panel/historial')}>
            Volver al historial
          </Boton>
        </div>
      </section>
    )
  }

  if (etapa === 'exito' && resultado) {
    return (
      <section aria-labelledby="titulo-devolucion-exito">
        <header className="mb-5">
          <h2 id="titulo-devolucion-exito" className="text-xl font-bold text-texto">
            Devolución registrada
          </h2>
          <p className="mt-1 text-sm text-texto-suave">
            Préstamo #{detalle.id} · {detalle.material_nombre} ({detalle.material_codigo})
          </p>
        </header>

        <div
          className="mb-4 rounded-xl border border-marca-200 bg-marca-50 p-4 text-sm text-marca-800 dark:border-marca-700/60 dark:bg-marca-500/15 dark:text-marca-300"
          role="status"
        >
          <p className="font-semibold">
            La devolución quedó registrada con {firmarPuntos(resultado.puntos_delta)}.
          </p>
          <p className="mt-1">
            Reputación de {detalle.prestatario_nombre}:{' '}
            <strong>
              {resultado.reputacion_antes} ({etiquetaTier(resultado.tier_antes)}) →{' '}
              {resultado.reputacion_despues} ({etiquetaTier(resultado.tier_despues)})
            </strong>
          </p>
          <p className="mt-1">
            Cobro económico:{' '}
            <strong>{moneda(resultado.cobro_economico) ?? 'sin cobro'}</strong>
          </p>
        </div>

        <ResumenSanciones estimacion={resultado} />

        <div className="mt-5 flex flex-wrap gap-2">
          {resultado.hay_dano && resultado.reporte_url && (
            <Boton icono={Download} onClick={descargarReporte}>
              Descargar reporte de daños (PDF)
            </Boton>
          )}
          <Boton variante="secundario" onClick={() => navigate('/panel/historial')}>
            Volver al historial
          </Boton>
        </div>
      </section>
    )
  }

  if (etapa === 'resumen') {
    return (
      <section aria-labelledby="titulo-resumen-devolucion">
        <header className="mb-5">
          <h2 id="titulo-resumen-devolucion" className="text-xl font-bold text-texto">
            Resumen antes de confirmar
          </h2>
          <p className="mt-1 text-sm text-texto-suave">
            Revisa el estado final del material y las sanciones calculadas. La confirmación
            registra la devolución de forma permanente.
          </p>
        </header>

        {errorEnvio && <ErrorAlerta mensaje={errorEnvio} className="mb-4" />}

        <Tarjeta className="p-6">
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <CampoResumen etiqueta="Material">
              {detalle.material_nombre} ({detalle.material_codigo})
            </CampoResumen>
            <CampoResumen etiqueta="Prestatario">
              {detalle.prestatario_nombre} · DNI {detalle.prestatario_dni}
            </CampoResumen>
            <CampoResumen etiqueta="Estado del préstamo">
              <BadgeEstado estado={detalle.estado} />
            </CampoResumen>
            <CampoResumen etiqueta="Fecha de entrega">
              {fechaLegible(detalle.fecha_entrega)}
            </CampoResumen>
            <CampoResumen etiqueta="Fecha límite">
              {fechaLegible(detalle.fecha_limite)}
            </CampoResumen>
            <CampoResumen etiqueta="Duración">{detalle.tiempo_prestamo_dias} días</CampoResumen>
          </dl>

          <h3 className="mt-6 text-sm font-bold text-texto">Checklist de devolución</h3>
          <ul className="mt-3 grid gap-4">
            {filas.map((fila, indice) => (
              <li
                key={`${fila.elemento}-${indice}`}
                className="grid min-w-0 gap-4 rounded-2xl border border-borde bg-superficie p-4 sm:p-5"
              >
                <header className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-borde pb-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-texto-suave">
                      Elemento {indice + 1}
                    </p>
                    <h4 className="mt-1 break-words text-lg font-bold text-texto">{fila.elemento}</h4>
                  </div>
                  <span className="rounded-full border border-borde bg-white px-3 py-1.5 text-sm font-semibold text-texto dark:bg-superficie-alta">
                    {ETIQUETAS_ESTADO_DEVOLUCION[fila.estado]}
                  </span>
                </header>

                <dl className="grid min-w-0 gap-3 sm:grid-cols-2">
                  <div className="min-w-0 rounded-xl border border-borde bg-white p-3 dark:bg-superficie-alta">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-texto-suave">
                      Observación inicial
                    </dt>
                    <dd className="mt-1 break-words text-sm leading-6 text-texto">
                      {fila.observacionInicial || 'Sin observaciones'}
                    </dd>
                  </div>
                  <div className="min-w-0 rounded-xl border border-borde bg-white p-3 dark:bg-superficie-alta">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-texto-suave">
                      Observación de devolución
                    </dt>
                    <dd className="mt-1 break-words text-sm leading-6 text-texto">
                      {fila.observacion || 'Sin observaciones'}
                    </dd>
                  </div>
                </dl>
                {(fila.fotoInicialUrl || fila.fotoPrevia) && (
                  <section
                    className="grid min-w-0 gap-3"
                    aria-label={`Fotos de comparación de ${fila.elemento}`}
                  >
                    <div>
                      <h5 className="text-base font-bold text-texto">Evidencia fotográfica</h5>
                      <p className="mt-1 text-sm text-texto-suave">
                        Compara el estado del elemento al entregar y al devolver.
                      </p>
                    </div>
                    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                      {fila.fotoInicialUrl && (
                        <figure className="grid min-w-0 content-start gap-2 rounded-xl border border-borde bg-white p-3 dark:bg-superficie-alta">
                          <figcaption className="text-sm font-semibold text-texto">Al entregar</figcaption>
                          <div className="aspect-[4/3] w-full max-w-[16rem] overflow-hidden rounded-lg border border-borde bg-superficie p-2">
                            <img
                              src={fila.fotoInicialUrl}
                              alt={`Estado inicial de ${fila.elemento}`}
                              className="h-full w-full object-contain"
                            />
                          </div>
                        </figure>
                      )}
                      {fila.fotoPrevia && (
                        <figure className="grid min-w-0 content-start gap-2 rounded-xl border border-borde bg-white p-3 dark:bg-superficie-alta">
                          <figcaption className="text-sm font-semibold text-texto">Al devolver</figcaption>
                          <div className="aspect-[4/3] w-full max-w-[16rem] overflow-hidden rounded-lg border border-borde bg-superficie p-2">
                            <img
                              src={fila.fotoPrevia}
                              alt={`Estado de devolución de ${fila.elemento}`}
                              className="h-full w-full object-contain"
                            />
                          </div>
                        </figure>
                      )}
                    </div>
                  </section>
                )}
              </li>
            ))}
          </ul>

          <h3 className="mt-6 text-sm font-bold text-texto">Sanciones estimadas</h3>
          {estimando && !estimacion && (
            <p className="mt-2 text-sm text-texto-suave">Calculando sanciones…</p>
          )}
          {errorEstimacion && (
            <div className="mt-3 grid gap-2">
              <ErrorAlerta mensaje={errorEstimacion} />
              <div>
                <Boton variante="secundario" tipo="button" onClick={reintentarEstimacion}>
                  Reintentar cálculo
                </Boton>
              </div>
            </div>
          )}
          <div className="mt-3">
            <ResumenSanciones estimacion={estimacion} />
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Boton
              cargando={guardando}
              deshabilitado={!estimacion || estimando}
              onClick={confirmarDevolucion}
            >
              Confirmar devolución
            </Boton>
            <Boton
              variante="secundario"
              tipo="button"
              deshabilitado={guardando}
              onClick={() => setEtapa('edicion')}
            >
              Volver a editar
            </Boton>
          </div>
          {!estimacion && !errorEstimacion && (
            <p className="mt-2 text-xs text-texto-suave">
              Espera a que el sistema calcule las sanciones para poder confirmar.
            </p>
          )}
        </Tarjeta>
      </section>
    )
  }

  return (
    <section aria-labelledby="titulo-devolucion">
      <header className="mb-5">
        <h2 id="titulo-devolucion" className="text-xl font-bold text-texto">
          Registrar devolución
        </h2>
        <p className="mt-1 text-sm text-texto-suave">
          Compara cada elemento con su observación y foto inicial. Conserva todas las filas en el
          mismo orden y registra el estado recibido.
        </p>
      </header>

      {errorEnvio && <ErrorAlerta mensaje={errorEnvio} className="mb-4" />}
      {errorEstimacion && !estimacion && (
        <div className="mb-4 grid gap-2">
          <ErrorAlerta mensaje={errorEstimacion} />
          <div>
            <Boton variante="secundario" tipo="button" onClick={reintentarEstimacion}>
              Reintentar cálculo
            </Boton>
          </div>
        </div>
      )}

      <Tarjeta className="mb-4 p-6">
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <CampoResumen etiqueta="Material">
            {detalle.material_nombre} ({detalle.material_codigo})
          </CampoResumen>
          <CampoResumen etiqueta="Prestatario">{detalle.prestatario_nombre}</CampoResumen>
          <CampoResumen etiqueta="Estado">
            <BadgeEstado estado={detalle.estado} />
          </CampoResumen>
          <CampoResumen etiqueta="Fecha de entrega">{fechaLegible(detalle.fecha_entrega)}</CampoResumen>
          <CampoResumen etiqueta="Fecha límite">{fechaLegible(detalle.fecha_limite)}</CampoResumen>
          <CampoResumen etiqueta="Duración">{detalle.tiempo_prestamo_dias} días</CampoResumen>
        </dl>
      </Tarjeta>

      <form ref={formularioRef} onSubmit={irAlResumen} noValidate className="grid gap-5">
        <fieldset className="grid gap-3 rounded-xl border border-borde p-3 sm:p-4">
          <legend className="px-2 text-sm font-bold text-texto">
            Estado final del material
          </legend>

          {filas.map((fila, indice) => (
            <div
              key={`${fila.elemento}-${indice}`}
              data-fila-checklist={indice}
              className="grid min-w-0 gap-3 rounded-xl border border-borde bg-superficie p-3 sm:p-4 lg:grid-cols-2 lg:gap-4"
            >
              <header className="min-w-0 border-b border-borde pb-2 lg:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-texto-suave">
                  Elemento {indice + 1}
                </p>
                <h4 className="mt-1 break-words text-base font-bold text-texto">
                  {fila.elemento || `Elemento ${indice + 1}`}
                </h4>
              </header>

              <section
                className="grid min-w-0 content-start gap-2 rounded-lg border border-borde bg-white p-3 dark:bg-superficie"
                aria-label={`Estado inicial de ${fila.elemento}`}
              >
                <h5 className="text-sm font-semibold text-texto">Observación inicial</h5>
                <p className="break-words text-sm leading-relaxed text-texto-suave">
                  {fila.observacionInicial || 'Sin observaciones registradas al entregar.'}
                </p>
                {fila.fotoInicialUrl ? (
                  <figure className="aspect-[4/3] w-full max-w-[16rem] overflow-hidden rounded-lg border border-borde bg-superficie">
                    <img
                      src={fila.fotoInicialUrl}
                      alt={`Foto inicial de ${fila.elemento}`}
                      className="h-full w-full object-contain"
                    />
                  </figure>
                ) : (
                  <p className="text-xs text-texto-suave">No hay foto inicial registrada.</p>
                )}
              </section>

              <div className="grid min-w-0 content-start gap-3">
                <Campo
                  etiqueta="Estado de devolución"
                  opciones={OPCIONES_ESTADO}
                  valor={fila.estado}
                  onCambio={(evento) => actualizarFila(indice, 'estado', evento.target.value)}
                  requerido
                  error={errores.filas?.[indice]?.estado}
                />
                <Campo
                  etiqueta={fila.estado === 'sin_cambios' ? 'Observación (opcional)' : 'Observación del daño'}
                  valor={fila.observacion}
                  onCambio={(evento) => actualizarFila(indice, 'observacion', evento.target.value)}
                  maxLength={500}
                  tipo="area"
                  rows={2}
                  requerido={fila.estado !== 'sin_cambios'}
                  error={errores.filas?.[indice]?.observacion}
                />
                {fila.estado !== 'sin_cambios' && (
                  <div className="grid min-w-0 gap-2 rounded-lg border border-borde bg-white p-3 dark:bg-superficie">
                    <label
                      className="text-sm font-semibold text-texto"
                      htmlFor={`foto-devolucion-${indice}`}
                    >
                      Foto del daño <span aria-hidden="true" className="text-error">*</span>
                    </label>
                    <input
                      ref={(elemento) => { referenciasFotos.current[indice] = elemento }}
                      id={`foto-devolucion-${indice}`}
                      data-foto-devolucion={indice}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                      aria-invalid={Boolean(errores.filas?.[indice]?.foto)}
                      aria-describedby={errores.filas?.[indice]?.foto
                        ? `foto-devolucion-${indice}-ayuda`
                        : undefined}
                      className="block w-full rounded-lg border border-borde bg-white px-3 py-2 text-sm text-texto file:mr-3 file:rounded-lg file:border-0 file:bg-superficie-alta file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-texto dark:bg-superficie"
                      onChange={(evento) => cambiarFoto(indice, evento.target.files?.[0] ?? null)}
                    />
                    <p
                      id={`foto-devolucion-${indice}-ayuda`}
                      className="text-xs leading-relaxed text-texto-suave"
                    >
                      Adjunta una foto JPG, PNG o WEBP de hasta 5 MB.
                    </p>
                    {errores.filas?.[indice]?.foto && (
                      <p className="text-xs text-error" role="alert">
                        {errores.filas[indice].foto}
                      </p>
                    )}
                    {fila.fotoPrevia && (
                      <div className="flex min-w-0 flex-wrap items-start gap-3">
                        <figure className="aspect-[4/3] w-full max-w-[12rem] overflow-hidden rounded-lg border border-borde bg-superficie p-1">
                          <img
                            src={fila.fotoPrevia}
                            alt={`Vista previa del daño en ${fila.elemento}`}
                            className="h-full w-full object-contain"
                          />
                        </figure>
                        <Boton
                          variante="secundario"
                          tamanio="pequeno"
                          tipo="button"
                          onClick={() => cambiarFoto(indice, null)}
                        >
                          Quitar foto
                        </Boton>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {errores.checklist && <ErrorAlerta mensaje={errores.checklist} />}
        </fieldset>

        <div>
          <h3 className="text-sm font-bold text-texto">Sanciones estimadas</h3>
          <p className="mt-1 text-xs text-texto-suave">
            {estimando ? 'Actualizando cálculo…' : 'El cálculo se actualiza con cada cambio.'}
          </p>
          <div className="mt-3">
            <ResumenSanciones estimacion={estimacion} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Boton tipo="submit">Revisar y confirmar</Boton>
          <Boton
            variante="secundario"
            tipo="button"
            onClick={() => navigate('/panel/historial')}
          >
            Cancelar
          </Boton>
        </div>
      </form>
      {elementosSinFoto && (
        <AdvertenciaModal
          titulo="Faltan fotos de devolución"
          descripcion="Adjunta una foto por cada elemento que reporta daño antes de continuar."
          mensajes={elementosSinFoto.map(({ indice, elemento }) => (
            `El elemento «${elemento}» requiere una foto porque reporta daño (${ETIQUETAS_ESTADO_DEVOLUCION[filas[indice]?.estado]}).`
          ))}
          onCerrar={cerrarAdvertenciaFotos}
        />
      )}
    </section>
  )
}

export default DevolucionPrestamo
