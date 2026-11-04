import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'

import { api, ErrorApi } from '../api/client'
import {
  ayudaRangoDuracion,
  calcularFechaLimiteEstimada,
  evaluarCambioDuracion,
  mapearErroresFotoChecklist,
  obtenerElementosSinFoto,
  validarFormularioPrestamo,
} from '../validacionesPrestamo'
import useTituloPagina from '../hooks/useTituloPagina'
import Campo from '../components/ui/Campo'
import Boton from '../components/ui/Boton'
import Tarjeta from '../components/ui/Tarjeta'
import Skeleton from '../components/ui/Skeleton'
import ErrorAlerta from '../components/ui/ErrorAlerta'
import EstadoVacio from '../components/ui/EstadoVacio'
import SubidaDocumentoPDF from '../components/prestamos/SubidaDocumentoPDF'
import SelectorPrestatario from '../components/prestamos/SelectorPrestatario'
import AdvertenciaModal from '../components/ui/AdvertenciaModal'
import { TAMANO_MAXIMO_GARANTIA_MB } from '../constantes/garantia'
import { esMaterialAltoValor } from '../constantes/catalogo'
import {
  TAMANO_MAXIMO_FOTO_CHECKLIST_MB,
  UNIDADES_TIEMPO_PRESTAMO,
  convertirTiempoAMinutos,
} from '../constantes/checklistPrestamo'
import { construirSolicitudPrestamo } from '../prestamos/solicitudPrestamo'
import { validarTamanoSolicitud } from '../prestamos/tamanoSolicitud'
import {
  crearOpcionesInstancia,
  obtenerInstanciaSeleccionada,
} from '../prestamos/instanciasPrestamo'

const FORMULARIO_INICIAL = {
  dni: '',
  reservaId: '',
  materialId: '',
  instanciaId: '',
  dias: '1',
  unidadTiempo: 'horas',
  checklist: [{ elemento: '', observacion: '', foto: null, fotoPrevia: '' }],
  documentoIdentidad: null,
  compromisoResponsabilidad: null,
  esExcepcion: false,
}

const NIVEL_TIER = { restringido: 0, estandar: 1, avanzado: 2 }
const ETIQUETA_TIER = { restringido: 'Restringido', estandar: 'Estándar', avanzado: 'Avanzado' }

function mensajeApi(error) {
  const datos = error instanceof ErrorApi ? error.datos : null
  if (datos?.detail) return datos.detail
  if (datos && typeof datos === 'object') {
    const primerError = Object.values(datos).flat()[0]
    if (primerError) return String(primerError)
  }
  return 'No se pudo registrar la entrega. Revisa la conexión e inténtalo otra vez.'
}

function fechaLegible(valor) {
  if (!valor) return ''
  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(valor))
}

const OPCIONES_MATERIAL = (materiales) => [
  { valor: '', etiqueta: 'Selecciona un material' },
  ...materiales.map((material) => ({
    valor: String(material.id),
    etiqueta: `${material.nombre} — Código de Material: ${material.codigo_material || material.codigo_inventario} (${material.unidades_disponibles} disponibles)`,
  })),
]

function RegistrarPrestamo() {
  useTituloPagina('Registrar entrega')
  const [searchParams] = useSearchParams()
  const dniInicial = searchParams.get('dni') || ''
  const reservaIdInicial = searchParams.get('reservaId') || ''
  const esConversionFija = Boolean(reservaIdInicial)

  const [materiales, setMateriales] = useState([])
  const [instancias, setInstancias] = useState([])
  const [reservasConfirmadas, setReservasConfirmadas] = useState([])
  const [formulario, setFormulario] = useState(() => ({
    ...FORMULARIO_INICIAL,
    dni: dniInicial,
    reservaId: reservaIdInicial,
  }))
  const [cargando, setCargando] = useState(true)
  const [cargandoInstancias, setCargandoInstancias] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [errorInstancias, setErrorInstancias] = useState('')
  const [errores, setErrores] = useState({})
  const [prestamoCreado, setPrestamoCreado] = useState(null)
  const [perfilPrestatario, setPerfilPrestatario] = useState(null)
  const [dniPerfilVerificado, setDniPerfilVerificado] = useState('')
  const [consultandoPerfil, setConsultandoPerfil] = useState(false)
  const [errorPerfil, setErrorPerfil] = useState('')
  const [elementosSinFoto, setElementosSinFoto] = useState(null)
  const referenciaFormulario = useRef(null)
  const referenciasFotos = useRef([])
  const urlsTemporales = useRef(new Set())

  useEffect(() => () => {
    urlsTemporales.current.forEach((url) => URL.revokeObjectURL(url))
    urlsTemporales.current.clear()
  }, [])

  useEffect(() => {
    cargarMateriales()
  }, [])

  useEffect(() => {
    if (!reservaIdInicial) return undefined
    let vigente = true
    api.get(`/reservas/${reservaIdInicial}/`)
      .then((reserva) => {
        if (!vigente || !reserva) return
        setReservasConfirmadas((prev) => {
          const existe = prev.some((r) => String(r.id) === String(reserva.id))
          return existe ? prev : [reserva, ...prev]
        })
        setFormulario((actual) => ({
          ...actual,
          dni: reserva.usuario?.dni || actual.dni,
          reservaId: String(reserva.id),
          materialId: String(reserva.material?.id || ''),
          instanciaId: String(reserva.instancia?.id || ''),
          esExcepcion: Boolean(reserva.es_excepcion),
        }))
      })
      .catch(() => {})
    return () => {
      vigente = false
    }
  }, [reservaIdInicial])

  useEffect(() => {
    const dni = formulario.dni.trim()
    setPerfilPrestatario(null)
    setDniPerfilVerificado('')
    setErrorPerfil('')
    setReservasConfirmadas([])
    if (!/^\d{8}$/.test(dni)) {
      setConsultandoPerfil(false)
      return undefined
    }

    let vigente = true
    setConsultandoPerfil(true)
    Promise.all([
      api.get(`/usuarios/elegibilidad-prestamo/?dni=${dni}`),
      api.get(`/reservas/confirmadas/?dni=${dni}`).catch(() => []),
    ])
      .then(([perfil, confirmadas]) => {
        if (!vigente) return
        setPerfilPrestatario(perfil)
        setDniPerfilVerificado(dni)
        const listaConfirmadas = Array.isArray(confirmadas) ? confirmadas : []
        setReservasConfirmadas(listaConfirmadas)

        if (reservaIdInicial) {
          const coincide = listaConfirmadas.find(
            (r) => String(r.id) === String(reservaIdInicial),
          )
          if (coincide) {
            setFormulario((actual) => ({
              ...actual,
              reservaId: String(coincide.id),
              materialId: String(coincide.material?.id || ''),
              instanciaId: String(coincide.instancia?.id || ''),
              esExcepcion: Boolean(coincide.es_excepcion),
            }))
          }
        }
      })
      .catch((errorApi) => {
        if (!vigente) return
        const datos = errorApi instanceof ErrorApi ? errorApi.datos : null
        setErrorPerfil(datos?.detail || 'No se pudo verificar el perfil. Inténtalo otra vez.')
      })
      .finally(() => {
        if (vigente) setConsultandoPerfil(false)
      })

    return () => { vigente = false }
  }, [formulario.dni, reservaIdInicial])

  const reservaSeleccionada = useMemo(
    () =>
      reservasConfirmadas.find(
        (r) => String(r.id) === String(formulario.reservaId),
      ) || null,
    [reservasConfirmadas, formulario.reservaId],
  )

  useEffect(() => {
    let cancelado = false
    setInstancias([])
    setErrorInstancias('')

    if (reservaSeleccionada) {
      setInstancias(reservaSeleccionada.instancia ? [reservaSeleccionada.instancia] : [])
      setCargandoInstancias(false)
      return () => {
        cancelado = true
      }
    }

    if (!formulario.materialId) {
      setCargandoInstancias(false)
      return () => {
        cancelado = true
      }
    }

    setCargandoInstancias(true)
    api.get(`/materiales/${formulario.materialId}/instancias/?estado=disponible`)
      .then((resultado) => {
        if (!cancelado) setInstancias(resultado)
      })
      .catch(() => {
        if (!cancelado) setErrorInstancias('No se pudieron cargar las instancias disponibles.')
      })
      .finally(() => {
        if (!cancelado) setCargandoInstancias(false)
      })

    return () => {
      cancelado = true
    }
  }, [formulario.materialId, reservaSeleccionada])

  async function cargarMateriales() {
    setCargando(true)
    setError('')
    try {
      const resultado = await api.get('/materiales/')
      setMateriales(resultado.filter((material) => (
        material.estado === 'disponible' && Number(material.unidades_disponibles) > 0
      )))
    } catch {
      setError('No se pudo cargar el inventario disponible.')
    } finally {
      setCargando(false)
    }
  }

  const materialSeleccionado =
    reservaSeleccionada?.material ||
    materiales.find((material) => String(material.id) === String(formulario.materialId))
  const instanciaSeleccionada =
    reservaSeleccionada?.instancia ||
    obtenerInstanciaSeleccionada(instancias, formulario.instanciaId)
  const perfilVerificadoActual = dniPerfilVerificado === formulario.dni.trim()
    ? perfilPrestatario
    : null
  const fechaLimiteEstimada = useMemo(
    () => calcularFechaLimiteEstimada(formulario.dias, formulario.unidadTiempo, materialSeleccionado),
    [formulario.dias, formulario.unidadTiempo, materialSeleccionado],
  )
  const tierCumple = Boolean(
    perfilVerificadoActual && materialSeleccionado
    && NIVEL_TIER[perfilVerificadoActual.reputacion_tier] >= NIVEL_TIER[materialSeleccionado.tier_minimo_requerido],
  )
  const perfilHabilitado = perfilVerificadoActual?.rol === 'prestatario' && perfilVerificadoActual?.estado === 'activo'
  const puedeSolicitarExcepcion = Boolean(
    perfilHabilitado && materialSeleccionado && !tierCumple
    && ['restringido', 'estandar'].includes(perfilVerificadoActual?.reputacion_tier),
  )
  const excepcionActiva = Boolean(
    reservaSeleccionada?.es_excepcion || (puedeSolicitarExcepcion && formulario.esExcepcion),
  )
  const garantiaReutilizada = Boolean(reservaSeleccionada?.garantia?.garantia_completa)
  const requiereGarantia = Boolean(
    excepcionActiva || esMaterialAltoValor(materialSeleccionado),
  )
  const verificacionPendiente = /^\d{8}$/.test(formulario.dni.trim())
    && (consultandoPerfil || !perfilVerificadoActual && !errorPerfil)
  const bloqueadoPorElegibilidad = Boolean(
    materialSeleccionado && /^\d{8}$/.test(formulario.dni.trim())
    && (
      verificacionPendiente || errorPerfil || !perfilVerificadoActual || !perfilHabilitado
      || (!tierCumple && !excepcionActiva)
    ),
  )

  function seleccionarReserva(nuevoReservaId) {
    const reserva = reservasConfirmadas.find(
      (r) => String(r.id) === String(nuevoReservaId),
    )
    if (reserva) {
      setFormulario((actual) => ({
        ...actual,
        reservaId: String(reserva.id),
        materialId: String(reserva.material?.id || ''),
        instanciaId: String(reserva.instancia?.id || ''),
        esExcepcion: Boolean(reserva.es_excepcion),
      }))
    } else {
      setFormulario((actual) => ({
        ...actual,
        reservaId: '',
        materialId: '',
        instanciaId: '',
        esExcepcion: false,
      }))
    }
    setErrores((actual) => ({
      ...actual,
      material: undefined,
      instancia_id: undefined,
      documento_identidad: undefined,
      compromiso_responsabilidad: undefined,
    }))
    setError('')
    setPrestamoCreado(null)
  }

  function actualizar(campo, valor) {
    if (campo === 'dni' && reservaSeleccionada) return
    const camposError = {
      dni: 'dni',
      materialId: 'material',
      instanciaId: 'instancia_id',
      dias: 'dias',
      documentoIdentidad: 'documento_identidad',
      compromisoResponsabilidad: 'compromiso_responsabilidad',
    }
    setFormulario((actual) => ({
      ...actual,
      [campo]: valor,
      ...(campo === 'dni'
        ? {
            reservaId: '',
          }
        : {}),
      ...(campo === 'materialId'
        ? {
            reservaId: '',
            instanciaId: '',
            documentoIdentidad: null,
            compromisoResponsabilidad: null,
            esExcepcion: false,
          }
        : {}),
    }))
    setErrores((actual) => ({
      ...actual,
      [camposError[campo] || campo]: undefined,
      ...(campo === 'materialId'
        ? {
            instancia_id: undefined,
            documento_identidad: undefined,
            compromiso_responsabilidad: undefined,
          }
        : {}),
    }))
    if (campo === 'materialId') {
      setInstancias([])
      setCargandoInstancias(Boolean(valor))
      setErrorInstancias('')
    }
    setError('')
    setPrestamoCreado(null)
  }

  function cambiarDuracion(duracion) {
    const cambio = evaluarCambioDuracion(
      duracion,
      formulario.dias,
      formulario.unidadTiempo,
      materialSeleccionado,
    )
    if (cambio.error) {
      setErrores((actual) => ({ ...actual, dias: cambio.error }))
      return
    }
    actualizar('dias', cambio.valor)
  }

  function cambiarUnidadTiempo(nuevaUnidad) {
    setFormulario((actual) => ({ ...actual, unidadTiempo: nuevaUnidad }))
    setErrores((actual) => ({ ...actual, dias: undefined }))
  }

  function actualizarChecklist(indice, campo, valor) {
    setFormulario((actual) => ({
      ...actual,
      checklist: actual.checklist.map((item, posicion) => (
        posicion === indice ? { ...item, [campo]: valor } : item
      )),
    }))
    setErrores((actual) => ({ ...actual, checklist: undefined }))
  }

  function cambiarFotoChecklist(indice, archivo) {
    const filaActual = formulario.checklist[indice]
    if (filaActual?.fotoPrevia) {
      URL.revokeObjectURL(filaActual.fotoPrevia)
      urlsTemporales.current.delete(filaActual.fotoPrevia)
    }
    const fotoPrevia = archivo ? URL.createObjectURL(archivo) : ''
    if (fotoPrevia) urlsTemporales.current.add(fotoPrevia)
    if (referenciasFotos.current[indice]) referenciasFotos.current[indice].value = ''
    setFormulario((actual) => ({
      ...actual,
      checklist: actual.checklist.map((item, posicion) => (
        posicion === indice ? { ...item, foto: archivo, fotoPrevia } : item
      )),
    }))
    setErrores((actual) => ({
      ...actual,
      fotosChecklist: { ...actual.fotosChecklist, [indice]: undefined },
    }))
  }

  function enfocarPrimerError() {
    window.requestAnimationFrame(() => {
      const control = referenciaFormulario.current?.querySelector('[aria-invalid="true"]')
      if (!control) return
      control.scrollIntoView({ behavior: 'smooth', block: 'center' })
      control.focus({ preventScroll: true })
    })
  }

  function cerrarAdvertenciaFotos() {
    setElementosSinFoto(null)
    enfocarPrimerError()
  }

  function agregarElementoChecklist() {
    setFormulario((actual) => ({
      ...actual,
      checklist: [...actual.checklist, { elemento: '', observacion: '', foto: null, fotoPrevia: '' }],
    }))
  }

  function quitarElementoChecklist(indice) {
    const fila = formulario.checklist[indice]
    if (fila?.fotoPrevia) {
      URL.revokeObjectURL(fila.fotoPrevia)
      urlsTemporales.current.delete(fila.fotoPrevia)
    }
    setFormulario((actual) => ({
      ...actual,
      checklist: actual.checklist.filter((_, posicion) => posicion !== indice),
    }))
    setErrores((actual) => ({ ...actual, checklist: undefined }))
  }

  async function registrar(evento) {
    evento.preventDefault()
    if (bloqueadoPorElegibilidad) return
    const datosValidacion = {
      dni: formulario.dni,
      material: materialSeleccionado,
      instanciaId: formulario.instanciaId,
      duracionValor: formulario.dias,
      duracionUnidad: formulario.unidadTiempo,
      checklist: formulario.checklist,
      documentoIdentidad: formulario.documentoIdentidad,
      compromisoResponsabilidad: formulario.compromisoResponsabilidad,
      esExcepcion: excepcionActiva,
      garantiaReutilizada,
    }
    const validacion = validarFormularioPrestamo(datosValidacion)
    setErrores(validacion)
    setError('')
    setPrestamoCreado(null)
    const fotosFaltantes = obtenerElementosSinFoto(formulario.checklist)
    setElementosSinFoto(fotosFaltantes.length > 0 ? fotosFaltantes : null)
    if (Object.keys(validacion).length > 0) {
      if (fotosFaltantes.length === 0) enfocarPrimerError()
      return
    }

    setGuardando(true)
    try {
      const minutosPrestamo = convertirTiempoAMinutos(formulario.dias, formulario.unidadTiempo)
      const solicitud = construirSolicitudPrestamo({
        dni: formulario.dni,
        material: materialSeleccionado,
        instanciaId: formulario.instanciaId,
        reservaId: formulario.reservaId,
        minutos: minutosPrestamo,
        checklist: formulario.checklist,
        documentoIdentidad: formulario.documentoIdentidad,
        compromisoResponsabilidad: formulario.compromisoResponsabilidad,
        esExcepcion: excepcionActiva,
      })
      const errorTamano = validarTamanoSolicitud(solicitud)
      if (errorTamano) {
        setError(errorTamano)
        return
      }
      const respuesta = await api.post(
        excepcionActiva ? '/prestamos/excepcion/' : '/prestamos/',
        solicitud,
      )
      setPrestamoCreado(respuesta)
      formulario.checklist.forEach((item) => {
        if (item.fotoPrevia) {
          URL.revokeObjectURL(item.fotoPrevia)
          urlsTemporales.current.delete(item.fotoPrevia)
        }
      })
      setFormulario(FORMULARIO_INICIAL)
      await cargarMateriales()
    } catch (errorApi) {
      const erroresApi = errorApi instanceof ErrorApi ? errorApi.datos : null
      const camposApi = {
        dni_prestatario: 'dni',
        instancia_id: 'instancia_id',
        tiempo_prestamo_minutos: 'dias',
        tiempo_prestamo_dias: 'dias',
        documento_identidad: 'documento_identidad',
        compromiso_responsabilidad: 'compromiso_responsabilidad',
      }
      const erroresDeCampo = Object.fromEntries(
        Object.entries(camposApi)
          .filter(([campo]) => erroresApi?.[campo])
          .map(([campo, destino]) => [
            destino,
            Array.isArray(erroresApi[campo]) ? erroresApi[campo][0] : String(erroresApi[campo]),
          ]),
      )
      const erroresFotosApi = mapearErroresFotoChecklist(erroresApi?.fotos_checklist)
      if (Object.keys(erroresDeCampo).length > 0 || Object.keys(erroresFotosApi).length > 0) {
        setErrores((actual) => ({
          ...actual,
          ...erroresDeCampo,
          fotosChecklist: { ...actual.fotosChecklist, ...erroresFotosApi },
        }))
        setError('')
        enfocarPrimerError()
      } else {
        setError(mensajeApi(errorApi))
      }
    } finally {
      setGuardando(false)
    }
  }

  return (
    <section aria-labelledby="titulo-registro-prestamo">
      <header className="mb-5">
        <h2 id="titulo-registro-prestamo" className="text-xl font-bold text-texto">
          Registrar entrega de préstamo
        </h2>
        <p className="mt-1 text-sm text-texto-suave">
          Confirma la identidad y elegibilidad del prestatario antes de entregar el material.
        </p>
      </header>

      {error && <ErrorAlerta mensaje={error} className="mb-4" />}

      {prestamoCreado && (
        <div
          className="mb-4 rounded-xl border border-marca-200 bg-marca-50 p-4 text-sm text-marca-800 dark:border-marca-700/60 dark:bg-marca-500/15 dark:text-marca-300"
          role="status"
        >
          <p className="font-semibold">
            Préstamo registrado como activo{prestamoCreado.es_excepcion ? ' con excepción académica' : ''} para {prestamoCreado.usuario_nombre}.
          </p>
          <p className="mt-1">
            Fecha límite de devolución:{' '}
            <strong>{fechaLegible(prestamoCreado.fecha_limite)}</strong>
          </p>
        </div>
      )}

      {cargando && (
        <div className="space-y-3" role="status" aria-live="polite">
          <p className="text-sm text-texto-suave">Cargando materiales disponibles…</p>
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      )}

      {!cargando && materiales.length === 0 && !reservaSeleccionada && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          No hay materiales con unidades libres para préstamo directo en este momento. Si el prestatario cuenta con una <strong>reserva confirmada</strong> vigente, ingresa su DNI para convertirla en préstamo.
        </div>
      )}

      {!cargando && (
        <Tarjeta className="p-6">
          <form ref={referenciaFormulario} onSubmit={registrar} noValidate className="grid gap-5">
            <SelectorPrestatario
              etiqueta="DNI del prestatario"
              valor={formulario.dni}
              onCambio={(valor) => actualizar('dni', valor)}
              error={errores.dni}
              ayuda={esConversionFija ? "DNI vinculado a la reserva seleccionada." : "Al completar o seleccionar el DNI se consultará la reputación y las reservas confirmadas del prestatario."}
              deshabilitado={esConversionFija}
              requerido
            />
            {reservasConfirmadas.length > 0 && (
              <div className="rounded-xl border border-marca-300 bg-marca-50/50 p-4 space-y-2 dark:border-marca-700 dark:bg-marca-950/30">
                <label
                  htmlFor="select-reserva-confirmada"
                  className="block text-sm font-bold text-marca-900 dark:text-marca-200"
                >
                  {esConversionFija ? 'Reserva confirmada a convertir' : `Convertir reserva confirmada vigente (${reservasConfirmadas.length})`}
                </label>
                <select
                  id="select-reserva-confirmada"
                  value={formulario.reservaId}
                  disabled={esConversionFija}
                  onChange={(e) => seleccionarReserva(e.target.value)}
                  className="w-full rounded-lg border border-borde bg-white px-3 py-2 text-sm text-texto disabled:bg-superficie-alta disabled:cursor-not-allowed dark:bg-superficie"
                >
                  {(esConversionFija && reservaSeleccionada
                    ? [reservaSeleccionada]
                    : reservasConfirmadas
                  ).map((res) => (
                    <option key={res.id} value={res.id}>
                      {res.material?.nombre} ({res.material?.codigo_material}) — Ejemplar{' '}
                      {res.instancia?.codigo_ejemplar}
                      {res.es_excepcion ? ' [Excepción académica]' : ''} · Recojo hasta:{' '}
                      {fechaLegible(res.fecha_limite_recojo)}
                    </option>
                  ))}
                </select>
                {reservaSeleccionada && (
                  <p className="text-xs text-texto-suave">
                    {esConversionFija ? (
                      <span className="font-semibold text-marca-800 dark:text-marca-300">
                        Conversión de reserva fija: el material y el ejemplar {reservaSeleccionada.instancia?.codigo_ejemplar} están cargados y bloqueados para esta entrega.
                      </span>
                    ) : (
                      <>
                        Se ha precargado automáticamente el material y el ejemplar{' '}
                        <strong>{reservaSeleccionada.instancia?.codigo_ejemplar}</strong> asignado a la reserva.
                      </>
                    )}
                  </p>
                )}
              </div>
            )}
            <Campo
              etiqueta="Material disponible"
              opciones={
                reservaSeleccionada?.material &&
                !materiales.some((m) => String(m.id) === String(reservaSeleccionada.material.id))
                  ? OPCIONES_MATERIAL([reservaSeleccionada.material, ...materiales])
                  : OPCIONES_MATERIAL(materiales)
              }
              valor={formulario.materialId}
              onCambio={(evento) => actualizar('materialId', evento.target.value)}
              error={errores.material}
              deshabilitado={Boolean(reservaSeleccionada)}
              requerido
            />
            {consultandoPerfil && (
              <p className="text-sm text-texto-suave" role="status">Consultando perfil y reputación…</p>
            )}
            {errorPerfil && <ErrorAlerta mensaje={errorPerfil} />}
            {perfilVerificadoActual && (
              <div
                className={`rounded-xl border p-4 text-sm ${
                  perfilHabilitado && (!materialSeleccionado || tierCumple)
                    ? 'border-marca-200 bg-marca-50 text-marca-800 dark:border-marca-700/60 dark:bg-marca-500/15 dark:text-marca-300'
                    : 'border-red-300 bg-red-50 text-red-800 dark:border-red-700/60 dark:bg-red-500/10 dark:text-red-300'
                }`}
                role="status"
                aria-live="polite"
              >
                <p className="font-semibold">{perfilVerificadoActual.nombre} {perfilVerificadoActual.apellido}</p>
                <p>
                  Reputación: {perfilVerificadoActual.reputacion_puntaje} puntos · Tier{' '}
                  {ETIQUETA_TIER[perfilVerificadoActual.reputacion_tier] || perfilVerificadoActual.reputacion_tier}
                </p>
                {!perfilHabilitado && <p className="mt-1 font-semibold">El usuario no está habilitado para recibir préstamos.</p>}
                {materialSeleccionado && (
                  <p className="mt-1">
                    Tier requerido: {ETIQUETA_TIER[materialSeleccionado.tier_minimo_requerido] || materialSeleccionado.tier_minimo_requerido}.
                    {tierCumple && perfilHabilitado && <strong> Cumple el requisito.</strong>}
                    {!tierCumple && puedeSolicitarExcepcion && (
                      <strong> No cumple el requisito; puedes registrar una excepción académica.</strong>
                    )}
                    {!tierCumple && !puedeSolicitarExcepcion && (
                      <strong> No cumple el requisito; el registro está bloqueado.</strong>
                    )}
                  </p>
                )}
              </div>
            )}
            {puedeSolicitarExcepcion && (
              <label
                className={`flex cursor-pointer gap-3 rounded-xl border p-4 text-sm ${
                  excepcionActiva
                    ? 'border-acento-400 bg-acento-50 text-acento-900 dark:border-acento-600 dark:bg-acento-500/15 dark:text-acento-200'
                    : 'border-borde bg-superficie text-texto'
                }`}
              >
                <input
                  type="checkbox"
                  checked={formulario.esExcepcion}
                  onChange={(evento) => actualizar('esExcepcion', evento.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0"
                />
                <span>
                  <span className="block font-semibold">Registrar como préstamo excepcional</span>
                  <span className="mt-1 block text-texto-suave">
                    Autoriza este material pese al Tier insuficiente del prestatario. Exige ambos
                    documentos de garantía y duplica la deducción por daño; el cobro económico no se duplica.
                  </span>
                </span>
              </label>
            )}
            <Campo
              etiqueta={reservaSeleccionada ? 'Instancia reservada asignada' : 'Instancia disponible'}
              opciones={crearOpcionesInstancia(instancias, cargandoInstancias)}
              valor={formulario.instanciaId}
              onCambio={(evento) => actualizar('instanciaId', evento.target.value)}
              error={errores.instancia_id}
              ayuda={!materialSeleccionado
                ? 'Selecciona primero el material.'
                : reservaSeleccionada
                  ? 'Ejemplar reservado exclusivamente para esta solicitud.'
                  : cargandoInstancias
                    ? 'Consultando sus instancias disponibles.'
                    : errorInstancias
                      ? 'No se pudo consultar el inventario de instancias.'
                      : instancias.length > 0
                        ? 'El código identifica el ejemplar físico que se entregará.'
                        : 'No hay instancias disponibles para este material.'}
              deshabilitado={Boolean(reservaSeleccionada) || !materialSeleccionado || cargandoInstancias || instancias.length === 0}
              requerido
            />
            {instanciaSeleccionada && (
              <section
                className="grid gap-4 rounded-xl border border-acento-300 bg-acento-50/50 p-4 dark:border-acento-700/60 dark:bg-acento-500/10 sm:grid-cols-[minmax(9rem,12rem)_1fr]"
                aria-labelledby="titulo-ficha-instancia-prestamo"
              >
                <div className="flex min-h-36 items-center justify-center overflow-hidden rounded-lg border border-borde bg-superficie">
                  {instanciaSeleccionada.foto ? (
                    <img
                      src={instanciaSeleccionada.foto}
                      alt={`Foto del ejemplar ${instanciaSeleccionada.codigo_ejemplar}`}
                      className="h-full max-h-48 w-full object-contain p-2"
                    />
                  ) : (
                    <p className="p-4 text-center text-sm text-texto-suave">
                      Este ejemplar no tiene fotografía individual.
                    </p>
                  )}
                </div>
                <div>
                  <h3 id="titulo-ficha-instancia-prestamo" className="font-bold text-texto">
                    Ficha del ejemplar seleccionado
                  </h3>
                  <p className="mt-1 text-sm text-texto-suave">
                    {materialSeleccionado?.nombre || 'Material'} · Código de Material:{' '}
                    {materialSeleccionado?.codigo_material || materialSeleccionado?.codigo_inventario || 'No registrado'}
                  </p>
                  <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="font-semibold text-texto">Código de Ejemplar</dt>
                      <dd className="break-words text-texto-suave">{instanciaSeleccionada.codigo_ejemplar}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-texto">Estado</dt>
                      <dd className="text-texto-suave">
                        {instanciaSeleccionada.estado_display || instanciaSeleccionada.estado || 'No registrado'}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-texto">Número de serie</dt>
                      <dd className="break-words text-texto-suave">
                        {instanciaSeleccionada.numero_serie || 'No registrado'}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-texto">Color</dt>
                      <dd className="text-texto-suave">{instanciaSeleccionada.color || 'No registrado'}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-texto">Observaciones del ejemplar</dt>
                      <dd className="text-texto-suave">{instanciaSeleccionada.observaciones || 'No registrado'}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-texto">Ubicación</dt>
                      <dd className="text-texto-suave">{instanciaSeleccionada.ubicacion || 'No registrada'}</dd>
                    </div>
                  </dl>
                </div>
              </section>
            )}
            {errorInstancias && <ErrorAlerta mensaje={errorInstancias} />}
            {materialSeleccionado && !cargandoInstancias && !errorInstancias && instancias.length === 0 && (
              <EstadoVacio
                titulo="Sin instancias disponibles"
                mensaje="Este material no tiene ejemplares disponibles para prestar."
              />
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo
                etiqueta="Duración del préstamo"
                tipo="number"
                min="1"
                step="1"
                valor={formulario.dias}
                onCambio={(evento) => cambiarDuracion(evento.target.value)}
                error={errores.dias}
                ayuda={ayudaRangoDuracion(materialSeleccionado)}
                requerido
              />
              <Campo
                etiqueta="Unidad de tiempo"
                opciones={UNIDADES_TIEMPO_PRESTAMO}
                valor={formulario.unidadTiempo}
                onCambio={(evento) => cambiarUnidadTiempo(evento.target.value)}
              />
            </div>
            {fechaLimiteEstimada && (
              <p className="text-sm text-texto-suave">
                Fecha límite estimada:{' '}
                <strong className="text-texto">{fechaLegible(fechaLimiteEstimada)}</strong>
                <small className="block">La fecha confirmada por el servidor aparecerá al registrar.</small>
              </p>
            )}

            <fieldset className="grid gap-4 rounded-xl border border-borde p-4">
              <legend className="px-2 text-sm font-bold text-texto">Checklist del estado inicial</legend>
              <p className="text-xs text-texto-suave">
                Cada elemento debe tener una foto JPG, PNG o WEBP. Tamaño máximo: {TAMANO_MAXIMO_FOTO_CHECKLIST_MB} MB.
              </p>
              {formulario.checklist.map((item, indice) => (
                <div key={`checklist-${indice}`} className="relative grid gap-4 rounded-lg border border-borde p-4 sm:grid-cols-2">
                  <Campo
                    etiqueta="Elemento"
                    valor={item.elemento}
                    onCambio={(evento) => actualizarChecklist(indice, 'elemento', evento.target.value)}
                    aria-invalid={Boolean(errores.checklist && !item.elemento.trim())}
                    maxLength={100}
                    requerido
                  />
                  <Campo
                    etiqueta="Observación del checklist (opcional)"
                    valor={item.observacion}
                    onCambio={(evento) => actualizarChecklist(indice, 'observacion', evento.target.value)}
                    maxLength={500}
                  />
                  <div className="grid gap-2 sm:col-span-2">
                    <label className="text-sm font-semibold text-texto" htmlFor={`foto-checklist-${indice}`}>
                      Foto del elemento <span aria-hidden="true" className="text-error">*</span>
                    </label>
                    <input
                      ref={(elemento) => { referenciasFotos.current[indice] = elemento }}
                      id={`foto-checklist-${indice}`}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                      aria-invalid={Boolean(errores.fotosChecklist?.[indice])}
                      aria-describedby={errores.fotosChecklist?.[indice]
                        ? `foto-checklist-${indice}-ayuda foto-checklist-${indice}-error`
                        : `foto-checklist-${indice}-ayuda`}
                      className="block w-full text-sm text-texto file:mr-3 file:rounded-lg file:border-0 file:bg-superficie-alta file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-texto"
                      onChange={(evento) => cambiarFotoChecklist(indice, evento.target.files?.[0] || null)}
                    />
                    <p id={`foto-checklist-${indice}-ayuda`} className="text-xs text-texto-suave">
                      Formatos permitidos: JPG, PNG y WEBP.
                    </p>
                    {errores.fotosChecklist?.[indice] && (
                      <p id={`foto-checklist-${indice}-error`} className="text-xs text-error" role="alert">
                        {errores.fotosChecklist[indice]}
                      </p>
                    )}
                    {item.fotoPrevia && (
                      <div className="flex flex-wrap items-start gap-3">
                        <img
                          src={item.fotoPrevia}
                          alt={`Vista previa de ${item.elemento || `elemento ${indice + 1}`}`}
                          className="h-28 w-28 rounded-lg border border-borde bg-superficie object-contain p-1"
                        />
                        <Boton
                          variante="secundario"
                          tamanio="pequeno"
                          tipo="button"
                          onClick={() => cambiarFotoChecklist(indice, null)}
                        >
                          Quitar foto
                        </Boton>
                      </div>
                    )}
                  </div>
                  {formulario.checklist.length > 1 && (
                    <Boton
                      variante="secundario"
                      tamanio="pequeno"
                      tipo="button"
                      className="sm:absolute sm:right-3 sm:top-3"
                      onClick={() => quitarElementoChecklist(indice)}
                    >
                      Quitar elemento
                    </Boton>
                  )}
                </div>
              ))}
              {errores.checklist && <ErrorAlerta mensaje={errores.checklist} />}
              <Boton variante="secundario" tipo="button" onClick={agregarElementoChecklist}>
                Agregar elemento
              </Boton>
            </fieldset>

            {requiereGarantia && (
              <fieldset
                key={formulario.materialId}
                className="grid gap-3 rounded-xl border border-acento-300 bg-acento-50/50 p-4 dark:border-acento-700/60 dark:bg-acento-500/10"
              >
                <legend className="px-2 text-sm font-bold text-acento-800 dark:text-acento-300">
                  {excepcionActiva
                    ? 'Garantía obligatoria para préstamo excepcional'
                    : 'Garantía obligatoria para material de alto valor'}
                </legend>
                {garantiaReutilizada ? (
                  <div className="rounded-lg border border-marca-300 bg-marca-50 p-3 text-xs text-marca-900 dark:border-marca-700 dark:bg-marca-950/40 dark:text-marca-200 space-y-1.5">
                    <p className="font-bold">
                      Garantía verificada en la reserva (se reutilizará automáticamente)
                    </p>
                    <p>
                      No es necesario volver a adjuntar los PDFs: el préstamo quedará vinculado a los documentos registrados en la reserva. Puedes adjuntar nuevos archivos abajo solo si deseas reemplazarlos.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-texto-suave">
                    Adjunta ambos documentos en PDF. Se almacenarán de forma privada y solo gestión
                    autorizada podrá descargarlos. Tamaño máximo: {TAMANO_MAXIMO_GARANTIA_MB} MB.
                  </p>
                )}
                <SubidaDocumentoPDF
                  etiqueta={
                    garantiaReutilizada
                      ? 'Documento de identidad (PDF, opcional para reemplazar)'
                      : 'Documento de identidad (PDF)'
                  }
                  archivo={formulario.documentoIdentidad}
                  onCambio={(archivo) => actualizar('documentoIdentidad', archivo)}
                  error={errores.documento_identidad}
                  ayuda={`Solo se aceptan archivos PDF (.pdf), hasta ${TAMANO_MAXIMO_GARANTIA_MB} MB.`}
                />
                <SubidaDocumentoPDF
                  etiqueta={
                    garantiaReutilizada
                      ? 'Carta de responsabilidad (PDF, opcional para reemplazar)'
                      : 'Carta de responsabilidad (PDF)'
                  }
                  archivo={formulario.compromisoResponsabilidad}
                  onCambio={(archivo) => actualizar('compromisoResponsabilidad', archivo)}
                  error={errores.compromiso_responsabilidad}
                  ayuda={`Solo se aceptan archivos PDF (.pdf), hasta ${TAMANO_MAXIMO_GARANTIA_MB} MB.`}
                />
              </fieldset>
            )}

            <div className="flex flex-wrap gap-2">
              <Boton
                tipo="submit"
                cargando={guardando}
                deshabilitado={bloqueadoPorElegibilidad || Boolean(
                  requiereGarantia
                  && !garantiaReutilizada
                  && (!formulario.documentoIdentidad || !formulario.compromisoResponsabilidad)
                )}
              >
                {reservaSeleccionada ? 'Convertir reserva y confirmar entrega' : 'Confirmar entrega'}
              </Boton>
              <Boton
                variante="secundario"
                tipo="button"
                deshabilitado={guardando}
                onClick={cargarMateriales}
              >
                Actualizar disponibilidad
              </Boton>
            </div>
          </form>
        </Tarjeta>
      )}
      {elementosSinFoto && (
        <AdvertenciaModal
          titulo="Faltan fotos del checklist"
          descripcion="Adjunta una foto para cada uno de estos elementos antes de continuar:"
          mensajes={elementosSinFoto.map(({ elemento }) => elemento)}
          onCerrar={cerrarAdvertenciaFotos}
        />
      )}
    </section>
  )
}

export default RegistrarPrestamo
