import { useEffect, useMemo, useState } from 'react'
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

function serializarChecklist(filas) {
  return filas.map((fila) => ({
    elemento: fila.elemento.trim(),
    estado: fila.estado,
    condicion: fila.condicion.trim(),
    observacion: fila.observacion.trim(),
  }))
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

  const prestamoId = useMemo(() => Number(parametroId), [parametroId])
  const idValido = Number.isInteger(prestamoId) && prestamoId > 0

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
          checklist: serializarChecklist(filas),
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
    setErrores((actual) => ({ ...actual, checklist: undefined }))
    setErrorEnvio('')
  }

  function agregarFila() {
    setFilas((actual) => [
      ...actual,
      { elemento: '', condicion: '', estado: 'sin_cambios', observacion: '' },
    ])
    setErrores((actual) => ({ ...actual, checklist: undefined }))
  }

  function quitarFila(indice) {
    setFilas((actual) => actual.filter((_, posicion) => posicion !== indice))
    setErrores((actual) => ({ ...actual, checklist: undefined }))
  }

  function irAlResumen(evento) {
    evento.preventDefault()
    const validacion = validarChecklistDevolucion(filas)
    setErrores(validacion)
    setErrorEnvio('')
    if (Object.keys(validacion).length > 0) return
    setEtapa('resumen')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function confirmarDevolucion() {
    setGuardando(true)
    setErrorEnvio('')
    try {
      const respuesta = await api.post(`/prestamos/${prestamoId}/devolucion/`, {
        checklist: serializarChecklist(filas),
      })
      setResultado(respuesta)
      setEtapa('exito')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (errorApi) {
      setErrorEnvio(mensajeApi(errorApi))
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
          <ul className="mt-3 grid gap-2">
            {serializarChecklist(filas).map((item, indice) => (
              <li
                key={`resumen-${indice}`}
                className="grid gap-1 rounded-lg border border-borde p-3 text-sm sm:grid-cols-4"
              >
                <span className="font-semibold text-texto">{item.elemento}</span>
                <span className="text-texto-suave">
                  Condición de entrega: {item.condicion || '—'}
                </span>
                <span className="font-medium text-texto">
                  {ETIQUETAS_ESTADO_DEVOLUCION[item.estado]}
                </span>
                <span className="text-texto-suave">
                  {item.observacion || 'Sin observaciones'}
                </span>
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
          Contrasta cada elemento con la condición de entrega y registra el estado final del
          material.
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

      <form onSubmit={irAlResumen} noValidate className="grid gap-5">
        <fieldset className="grid gap-4 rounded-xl border border-borde p-4">
          <legend className="px-2 text-sm font-bold text-texto">
            Estado final del material
          </legend>

          {filas.map((fila, indice) => (
            <div
              key={`devolucion-${indice}`}
              className="relative grid gap-4 rounded-lg border border-borde p-4 sm:grid-cols-2 lg:grid-cols-4"
            >
              <Campo
                etiqueta="Elemento"
                valor={fila.elemento}
                onCambio={(evento) => actualizarFila(indice, 'elemento', evento.target.value)}
                maxLength={100}
                requerido
              />
              <Campo
                etiqueta="Condición de entrega"
                valor={fila.condicion}
                deshabilitado
              />
              <Campo
                etiqueta="Estado de devolución"
                opciones={OPCIONES_ESTADO}
                valor={fila.estado}
                onCambio={(evento) => actualizarFila(indice, 'estado', evento.target.value)}
                requerido
              />
              <Campo
                etiqueta="Observación (opcional)"
                valor={fila.observacion}
                onCambio={(evento) => actualizarFila(indice, 'observacion', evento.target.value)}
                maxLength={500}
              />
              {filas.length > 1 && (
                <Boton
                  variante="secundario"
                  tamanio="pequeno"
                  tipo="button"
                  className="sm:absolute sm:right-3 sm:top-3"
                  onClick={() => quitarFila(indice)}
                >
                  Quitar elemento
                </Boton>
              )}
            </div>
          ))}

          {errores.checklist && <ErrorAlerta mensaje={errores.checklist} />}
          <Boton variante="secundario" tipo="button" onClick={agregarFila}>
            Agregar elemento
          </Boton>
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
    </section>
  )
}

export default DevolucionPrestamo
