import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  IdCard,
  Package,
  Shield,
  User,
} from 'lucide-react'

import { api, ErrorApi } from '../api/client'
import {
  ayudaRangoDuracion,
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
import ErrorModal from '../components/ui/ErrorModal'
import EstadoVacio from '../components/ui/EstadoVacio'
import SubidaDocumentoPDF from '../components/prestamos/SubidaDocumentoPDF'
import SelectorPrestatario from '../components/prestamos/SelectorPrestatario'
import AdvertenciaModal from '../components/ui/AdvertenciaModal'
import SelectorFechaHoraDesplegable from '../components/ui/SelectorFechaHoraDesplegable'
import { TAMANO_MAXIMO_GARANTIA_MB } from '../constantes/garantia'
import { esMaterialAltoValor } from '../constantes/catalogo'
import {
  TAMANO_MAXIMO_FOTO_CHECKLIST_MB,
  formatearDuracionMinutos,
} from '../constantes/checklistPrestamo'
import { construirSolicitudPrestamo } from '../prestamos/solicitudPrestamo'
import { validarTamanoSolicitud } from '../prestamos/tamanoSolicitud'
import {
  crearOpcionesInstancia,
  obtenerInstanciaSeleccionada,
} from '../prestamos/instanciasPrestamo'
import {
  calcularMinutosHabilesReserva,
  cruzaFinDeSemana,
  puedeEntregarseReservaAhora,
} from '../reservas/estadoReserva'

const FORMULARIO_INICIAL = {
  dni: '',
  reservaId: '',
  materialId: '',
  instanciaId: '',
  checklist: [{ elemento: '', observacion: '', foto: null, fotoPrevia: '' }],
  documentoIdentidad: null,
  compromisoResponsabilidad: null,
  esExcepcion: false,
}

function listarMensajesError(valor) {
  if (typeof valor === 'string') return valor.trim() ? [valor.trim()] : []
  if (Array.isArray(valor)) return valor.flatMap(listarMensajesError)
  if (valor && typeof valor === 'object') return Object.values(valor).flatMap(listarMensajesError)
  return []
}

const NIVEL_TIER = { restringido: 0, estandar: 1, avanzado: 2 }
const ETIQUETA_TIER = { restringido: 'Restringido', estandar: 'Estándar', avanzado: 'Avanzado' }

const ESTILOS_ESTADO_EJEMPLAR = {
  disponible: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700',
  reservado: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-700',
  prestado: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700',
  en_mantenimiento: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-700',
  de_baja: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-700',
}

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

function fechaParaCalendario(valor = new Date()) {
  const fecha = new Date(valor)
  if (Number.isNaN(fecha.getTime())) return ''
  const local = new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

function calcularMinutosEntreFechas(inicio, fin) {
  if (!inicio || !fin) return NaN
  return calcularMinutosHabilesReserva(inicio, fin)
}

const OPCIONES_MATERIAL = (materiales) => [
  { valor: '', etiqueta: 'Selecciona un material' },
  ...materiales.map((material) => ({
    valor: String(material.id),
    etiqueta: `${material.nombre} — Código de Material: ${material.codigo_material || material.codigo_inventario} (${material.unidades_disponibles} libres ahora${Number(material.resumen_instancias?.reservado) > 0 ? `, ${material.resumen_instancias.reservado} con reservas futuras` : ''})`,
  })),
]

function RegistrarPrestamo() {
  useTituloPagina('Registrar entrega')
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const dniInicial = searchParams.get('dni') || ''
  const reservaIdInicial = searchParams.get('reservaId') || ''
  const esConversionFija = Boolean(reservaIdInicial && searchParams.get('reservaId'))

  const [materiales, setMateriales] = useState([])
  const [instancias, setInstancias] = useState([])
  const [reservasConfirmadas, setReservasConfirmadas] = useState([])
  const [reservaFija, setReservaFija] = useState(null)
  const [cargandoReservaConversion, setCargandoReservaConversion] = useState(esConversionFija)
  const [errorReservaConversion, setErrorReservaConversion] = useState('')
  const [fechaInicioPrestamo, setFechaInicioPrestamo] = useState(() => fechaParaCalendario())
  const [fechaFinPrestamo, setFechaFinPrestamo] = useState(() => {
    const fin = new Date()
    fin.setDate(fin.getDate() + 1)
    while (fin.getDay() === 0 || fin.getDay() === 6) {
      fin.setDate(fin.getDate() + 1)
    }
    fin.setHours(17, 0, 0, 0)
    return fechaParaCalendario(fin)
  })
  const [formulario, setFormulario] = useState(() => ({
    ...FORMULARIO_INICIAL,
    dni: dniInicial,
    reservaId: reservaIdInicial,
  }))
  const [cargando, setCargando] = useState(true)
  const [cargandoInstancias, setCargandoInstancias] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [errorConfirmacion, setErrorConfirmacion] = useState('')
  const [errorInstancias, setErrorInstancias] = useState('')
  const [errores, setErrores] = useState({})
  const [prestamoCreado, setPrestamoCreado] = useState(null)
  const [perfilPrestatario, setPerfilPrestatario] = useState(null)
  const [dniPerfilVerificado, setDniPerfilVerificado] = useState('')
  const [consultandoPerfil, setConsultandoPerfil] = useState(false)
  const [errorPerfil, setErrorPerfil] = useState('')
  const [elementosSinFoto, setElementosSinFoto] = useState(null)
  const [advertenciaFechaHoraReserva, setAdvertenciaFechaHoraReserva] = useState(false)
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
    setCargandoReservaConversion(true)
    setErrorReservaConversion('')
    api.get(`/reservas/confirmadas/${reservaIdInicial}/`)
      .then((reserva) => {
        if (!vigente || !reserva) return
        setReservaFija(reserva)
        setFormulario((actual) => ({
          ...actual,
          dni: reserva.usuario?.dni || actual.dni,
          reservaId: String(reserva.id),
          materialId: String(reserva.material?.id || ''),
          instanciaId: String(reserva.instancia?.id || ''),
          esExcepcion: Boolean(reserva.es_excepcion),
        }))
        if (reserva.fecha_inicio && reserva.fecha_fin) {
          setFechaInicioPrestamo(fechaParaCalendario(reserva.fecha_inicio))
          setFechaFinPrestamo(fechaParaCalendario(reserva.fecha_fin))
        }
      })
      .catch((fallo) => {
        if (!vigente) return
        setReservaFija(null)
        setErrorReservaConversion(
          fallo instanceof ErrorApi && fallo.datos?.detail
            ? fallo.datos.detail
            : 'No se pudo validar la reserva para la entrega. Vuelve a Cola de reservas e inténtalo nuevamente.',
        )
      })
      .finally(() => {
        if (vigente) setCargandoReservaConversion(false)
      })
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
    () => esConversionFija
      ? reservaFija
      : reservasConfirmadas.find(
        (r) => String(r.id) === String(formulario.reservaId),
      ) || null,
    [esConversionFija, reservaFija, reservasConfirmadas, formulario.reservaId],
  )

  const opcionesReservas = useMemo(() => {
    const lista = [...reservasConfirmadas]
    if (reservaFija && !lista.some((r) => String(r.id) === String(reservaFija.id))) {
      lista.unshift(reservaFija)
    }
    return lista
  }, [reservasConfirmadas, reservaFija])

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
    api.get(`/materiales/${formulario.materialId}/instancias/`)
      .then((resultado) => {
        if (!cancelado) {
          const lista = Array.isArray(resultado)
            ? resultado.filter((inst) => ['disponible', 'reservado'].includes(inst.estado))
            : []
          setInstancias(lista)
        }
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
        (material.estado === 'disponible' && Number(material.unidades_disponibles) > 0) ||
        (material.estado === 'reservado' && Number(material.resumen_instancias?.reservado) > 0)
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
  const duracionPrestamoMinutos = calcularMinutosEntreFechas(fechaInicioPrestamo, fechaFinPrestamo)
  const duracionBloqueadaPorReserva = Boolean(
    reservaSeleccionada?.fecha_inicio && reservaSeleccionada?.fecha_fin,
  )
  const tierCumple = Boolean(
    perfilVerificadoActual && materialSeleccionado
    && NIVEL_TIER[perfilVerificadoActual.reputacion_tier] >= NIVEL_TIER[materialSeleccionado.tier_minimo_requerido],
  )
  const perfilHabilitado = perfilVerificadoActual?.rol === 'prestatario' && perfilVerificadoActual?.estado === 'activo'
  const puedeSolicitarExcepcion = Boolean(
    !reservaSeleccionada && perfilHabilitado && materialSeleccionado && !tierCumple
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
  const bloqueadoPorReservaConversion = esConversionFija && (
    cargandoReservaConversion || !reservaSeleccionada || Boolean(errorReservaConversion)
  )

  function seleccionarReserva(nuevoReservaId) {
    const reserva = reservasConfirmadas.find(
      (r) => String(r.id) === String(nuevoReservaId),
    )
    if (reserva) {
      if (reserva.fecha_inicio && reserva.fecha_fin) {
        setFechaInicioPrestamo(fechaParaCalendario(reserva.fecha_inicio))
        setFechaFinPrestamo(fechaParaCalendario(reserva.fecha_fin))
      }
      setFormulario((actual) => ({
        ...actual,
        reservaId: String(reserva.id),
        materialId: String(reserva.material?.id || ''),
        instanciaId: String(reserva.instancia?.id || ''),
        esExcepcion: Boolean(reserva.es_excepcion),
      }))
    } else {
      setFechaInicioPrestamo(fechaParaCalendario())
      setFechaFinPrestamo(fechaParaCalendario(Date.now() + 120 * 60000))
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
    if (['dni', 'materialId', 'instanciaId', 'esExcepcion'].includes(campo) && reservaSeleccionada) return
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
    setErrorConfirmacion('')
    if (bloqueadoPorElegibilidad || bloqueadoPorReservaConversion) return
    if (
      reservaSeleccionada
      && !puedeEntregarseReservaAhora(reservaSeleccionada.fecha_inicio, new Date())
    ) {
      setAdvertenciaFechaHoraReserva(true)
      return
    }
    const duracionMinutos = calcularMinutosEntreFechas(fechaInicioPrestamo, fechaFinPrestamo)
    const datosValidacion = {
      dni: formulario.dni,
      material: materialSeleccionado,
      instanciaId: formulario.instanciaId,
      duracionValor: duracionMinutos,
      duracionUnidad: 'minutos',
      checklist: formulario.checklist,
      documentoIdentidad: formulario.documentoIdentidad,
      compromisoResponsabilidad: formulario.compromisoResponsabilidad,
      esExcepcion: excepcionActiva,
      garantiaReutilizada,
      fechaFin: duracionBloqueadaPorReserva ? null : fechaFinPrestamo,
    }
    const validacion = validarFormularioPrestamo(datosValidacion)
    setErrores(validacion)
    setError('')
    setPrestamoCreado(null)
    const fotosFaltantes = obtenerElementosSinFoto(formulario.checklist)
    setElementosSinFoto(fotosFaltantes.length > 0 ? fotosFaltantes : null)
    if (Object.keys(validacion).length > 0) {
      const mensajes = listarMensajesError(validacion)
      if (mensajes.length) {
        setErrorConfirmacion([...new Set(mensajes)].join('\n'))
      }
      if (fotosFaltantes.length === 0) enfocarPrimerError()
      return
    }

    setGuardando(true)
    try {
      const minutosPrestamo = duracionMinutos
      const solicitud = construirSolicitudPrestamo({
        dni: formulario.dni,
        material: materialSeleccionado,
        instanciaId: formulario.instanciaId,
        reservaId: formulario.reservaId,
        minutos: minutosPrestamo,
        fechaFin: fechaFinPrestamo,
        checklist: formulario.checklist,
        documentoIdentidad: formulario.documentoIdentidad,
        compromisoResponsabilidad: formulario.compromisoResponsabilidad,
        esExcepcion: excepcionActiva,
      })
      const errorTamano = validarTamanoSolicitud(solicitud)
      if (errorTamano) {
        setErrorConfirmacion(errorTamano)
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
      setReservaFija(null)
      setSearchParams({})
      await cargarMateriales()
    } catch (errorApi) {
      const erroresApi = errorApi instanceof ErrorApi ? errorApi.datos : null
      const camposApi = {
        dni_prestatario: 'dni',
        instancia_id: 'instancia_id',
        fecha_fin: 'dias',
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
        const mensajes = [
          ...Object.values(erroresDeCampo),
          ...Object.values(erroresFotosApi),
        ]
        setErrorConfirmacion([...new Set(mensajes)].join('\n') || mensajeApi(errorApi))
        enfocarPrimerError()
      } else {
        setErrorConfirmacion(mensajeApi(errorApi))
      }
    } finally {
      setGuardando(false)
    }
  }

  return (
    <section aria-labelledby="titulo-registro-prestamo" className="max-w-6xl mx-auto space-y-6">
      {/* Contenedor Principal Unificado */}
      <div className="rounded-2xl border border-borde bg-fondo p-6 sm:p-8 shadow-xs space-y-8">
        <header className="flex flex-col gap-1 border-b border-borde/70 pb-5">
          <h2 id="titulo-registro-prestamo" className="text-2xl font-bold tracking-tight text-texto">
            Registrar entrega de préstamo
          </h2>
          <p className="text-sm text-texto-suave">
            Verifica la identidad, reputación institucional y ejemplar asignado antes de confirmar la entrega física.
          </p>
        </header>

        {error && <ErrorAlerta mensaje={error} />}
        {cargandoReservaConversion && (
          <p className="text-sm text-texto-suave" role="status" aria-live="polite">
            Validando la reserva confirmada y cargando el ejemplar asignado…
          </p>
        )}
        {errorReservaConversion && (
          <ErrorAlerta mensaje={errorReservaConversion} />
        )}

        {prestamoCreado && (
          <div
            className="rounded-xl border border-borde bg-superficie-alta/60 p-4.5 text-sm text-texto shadow-xs"
            role="status"
          >
            <div className="flex items-start gap-3">
              <CheckCircle2 className="size-5 shrink-0 text-marca-600 dark:text-marca-400 mt-0.5" />
              <div>
                <p className="font-bold text-base text-texto">
                  ¡Préstamo registrado exitosamente!{prestamoCreado.es_excepcion ? ' (con excepción académica)' : ''}
                </p>
                <p className="mt-1 text-xs text-texto-suave">
                  Prestatario: <span className="font-semibold text-texto">{prestamoCreado.usuario_nombre}</span> · Fecha límite de devolución:{' '}
                  <strong className="text-texto">{fechaLegible(prestamoCreado.fecha_limite)}</strong>
                </p>
              </div>
            </div>
          </div>
        )}

        {cargando && (
          <div className="space-y-4" role="status" aria-live="polite">
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
          </div>
        )}

        {!cargando && materiales.length === 0 && !reservaSeleccionada && (
          <div className="rounded-xl border border-borde bg-superficie-alta/50 p-4 text-sm text-texto-suave">
            No hay materiales con unidades libres para préstamo directo en este momento. Si el prestatario cuenta con una <strong>reserva confirmada</strong> vigente, ingresa su DNI para convertirla en préstamo.
          </div>
        )}

        {!cargando && (
          <form ref={referenciaFormulario} onSubmit={registrar} noValidate className="space-y-8">
            {/* Fila Superior Equilibrada en 2 Columnas Dinámicas */}
            <div className="grid gap-6 lg:grid-cols-2 items-start">
              {/* Columna A: Prestatario */}
              <div className="rounded-xl border border-borde bg-white p-5 space-y-4 dark:bg-superficie shadow-xs">
                <div className="flex items-center gap-2 border-b border-borde/50 pb-3">
                  <User className="size-5 text-marca-600 dark:text-marca-400" />
                  <h3 className="text-base font-bold text-texto">
                    Prestatario
                  </h3>
                </div>

                <SelectorPrestatario
                  etiqueta="DNI del prestatario"
                  valor={formulario.dni}
                  onCambio={(valor) => actualizar('dni', valor)}
                  error={errores.dni}
                  ayuda={reservaSeleccionada || esConversionFija
                    ? 'DNI vinculado a la reserva seleccionada.'
                    : 'Al ingresar el DNI se consultará la reputación y reservas confirmadas.'}
                  deshabilitado={Boolean(reservaSeleccionada) || esConversionFija}
                  requerido
                />

                {esConversionFija && reservaSeleccionada ? (
                  <div className="rounded-xl border border-marca-300 bg-marca-50/50 p-4 space-y-2.5 shadow-xs dark:border-marca-800 dark:bg-marca-950/30">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-marca-200/60 pb-2 dark:border-marca-800/60">
                      <span className="block text-xs font-bold uppercase tracking-wider text-marca-900 dark:text-marca-200">
                        Reserva confirmada vinculada
                      </span>
                      <span className="rounded-full bg-marca-200 px-2.5 py-0.5 text-xs font-bold text-marca-900 dark:bg-marca-900 dark:text-marca-200">
                        Modo conversión fijado
                      </span>
                    </div>

                    <div className="space-y-1 text-xs">
                      <p className="font-semibold text-texto">
                        {reservaSeleccionada.material?.nombre} ({reservaSeleccionada.material?.codigo_material})
                        {reservaSeleccionada.es_excepcion ? ' [Excepción académica aprobada]' : ''}
                      </p>
                      <p className="text-texto-suave">
                        Ejemplar reservado:{' '}
                        <strong className="font-mono text-marca-800 dark:text-marca-300">
                          {reservaSeleccionada.instancia?.codigo_ejemplar}
                        </strong>{' '}
                        · Límite de recojo: {fechaLegible(reservaSeleccionada.fecha_limite_recojo)}
                      </p>
                    </div>

                    <p className="text-[11px] text-texto-suave italic">
                      Todos los datos del prestatario, material, ejemplar y fechas provienen de la reserva confirmada y no pueden modificarse durante la entrega.
                    </p>
                  </div>
                ) : (opcionesReservas.length > 0 || reservaSeleccionada) && (
                  <div className="rounded-xl border border-borde bg-white p-3.5 space-y-2.5 shadow-xs dark:bg-superficie">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label
                        htmlFor="select-reserva-confirmada"
                        className="block text-xs font-bold uppercase tracking-wider text-texto"
                      >
                        Reservas confirmadas vigentes ({opcionesReservas.length})
                      </label>
                    </div>

                    <select
                      id="select-reserva-confirmada"
                      value={formulario.reservaId}
                      onChange={(e) => {
                        seleccionarReserva(e.target.value)
                      }}
                      className="w-full rounded-lg border border-borde bg-white px-3 py-2 text-sm text-texto dark:bg-superficie"
                    >
                      <option value="">-- Préstamo directo (sin reserva previa) --</option>
                      {opcionesReservas.map((res) => (
                        <option key={res.id} value={res.id}>
                          {res.material?.nombre} ({res.material?.codigo_material}) — Ejemplar{' '}
                          {res.instancia?.codigo_ejemplar}
                          {res.es_excepcion ? ' [Excepción]' : ''} · Recojo hasta:{' '}
                          {fechaLegible(res.fecha_limite_recojo)}
                        </option>
                      ))}
                    </select>

                    {reservaSeleccionada && (
                      <p className="text-xs text-texto-suave">
                        Se cargó el ejemplar{' '}
                        <strong>{reservaSeleccionada.instancia?.codigo_ejemplar}</strong> de la reserva confirmada (datos bloqueados para la entrega).
                      </p>
                    )}
                  </div>
                )}

                {consultandoPerfil && (
                  <p className="text-xs text-texto-suave flex items-center gap-2" role="status">
                    <span className="size-3 animate-spin rounded-full border-2 border-marca-600 border-t-transparent" />
                    Consultando perfil institucional y reputación…
                  </p>
                )}
                {errorPerfil && <ErrorAlerta mensaje={errorPerfil} />}

                {perfilVerificadoActual && (
                  <div
                    className={`rounded-xl border p-4 text-sm space-y-3 shadow-xs ${
                      perfilHabilitado && (!materialSeleccionado || tierCumple || puedeSolicitarExcepcion)
                        ? 'border-marca-300 bg-marca-500/20 dark:border-marca-700/60 dark:bg-marca-500/25'
                        : 'border-red-300 bg-red-500/20 dark:border-red-700/60 dark:bg-red-500/25'
                    }`}
                    role="status"
                    aria-live="polite"
                  >
                    <div className="flex items-center gap-3.5">
                      {/* Avatar miniatura con iniciales */}
                      <div
                        className="flex size-12 shrink-0 items-center justify-center rounded-xl font-bold text-base shadow-xs bg-marca-600 text-white ring-2 ring-marca-700/20 dark:bg-marca-500 dark:ring-marca-400/30"
                        aria-hidden="true"
                      >
                        {perfilVerificadoActual.nombre?.[0]?.toUpperCase() || 'U'}
                        {perfilVerificadoActual.apellido?.[0]?.toUpperCase() || ''}
                      </div>

                      {/* Información básica de reconocimiento */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-base text-texto truncate">
                            {perfilVerificadoActual.nombre} {perfilVerificadoActual.apellido}
                          </span>
                          <span
                            className={`shrink-0 inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold border shadow-2xs ${
                              perfilVerificadoActual.reputacion_tier === 'avanzado'
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700'
                                : perfilVerificadoActual.reputacion_tier === 'restringido'
                                  ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700'
                                  : 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-700'
                            }`}
                          >
                            Tier {ETIQUETA_TIER[perfilVerificadoActual.reputacion_tier] || perfilVerificadoActual.reputacion_tier}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 text-sm text-texto-suave mt-1">
                          <span className="inline-flex items-center gap-1">
                            <span>DNI:</span>
                            <strong className="font-mono text-texto font-bold">{perfilVerificadoActual.dni || dniPerfilVerificado || formulario.dni}</strong>
                          </span>
                          <span aria-hidden="true" className="text-borde">·</span>
                          <span className="inline-flex items-center gap-1">
                            <span>Reputación:</span>
                            <strong className="font-bold text-texto">{perfilVerificadoActual.reputacion_puntaje} pts</strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    {!perfilHabilitado && (
                      <p className="font-bold text-red-700 dark:text-red-300 text-sm pt-2.5 border-t border-red-300/60 dark:border-red-700/50">
                        El usuario no está habilitado para recibir préstamos.
                      </p>
                    )}

                    {materialSeleccionado && perfilHabilitado && (
                      <div className="pt-2.5 border-t border-marca-300/60 dark:border-marca-700/40 text-sm">
                        <span className="text-texto-suave">
                          Tier requerido: <strong className="text-texto">{ETIQUETA_TIER[materialSeleccionado.tier_minimo_requerido] || materialSeleccionado.tier_minimo_requerido}</strong>.{' '}
                        </span>
                        {tierCumple && (
                          <strong className="text-marca-900 dark:text-marca-200">Cumple el requisito institucional.</strong>
                        )}
                        {!tierCumple && puedeSolicitarExcepcion && (
                          <strong className="text-amber-900 dark:text-amber-300">Tier insuficiente; puedes autorizar como excepción académica.</strong>
                        )}
                        {!tierCumple && !puedeSolicitarExcepcion && (
                          <strong className="text-red-900 dark:text-red-300 font-bold">Tier insuficiente; el registro está bloqueado.</strong>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Columna B: Material y Ejemplar */}
              <div className="rounded-xl border border-borde bg-white p-5 space-y-4 dark:bg-superficie shadow-xs">
                <div className="flex items-center gap-2 border-b border-borde/50 pb-3">
                  <Package className="size-5 text-marca-600 dark:text-marca-400" />
                  <h3 className="text-base font-bold text-texto">
                    Material y Ejemplar
                  </h3>
                </div>

                <Campo
                  etiqueta="Material del inventario"
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

                {puedeSolicitarExcepcion && (
                  <label
                    className={`flex cursor-pointer gap-3 rounded-xl border p-3 text-xs ${
                      excepcionActiva
                        ? 'border-acento-400 bg-acento-50/70 text-acento-900 dark:border-acento-600 dark:bg-acento-500/15 dark:text-acento-200'
                        : 'border-borde bg-superficie text-texto'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={formulario.esExcepcion}
                      onChange={(evento) => actualizar('esExcepcion', evento.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded text-acento-600"
                    />
                    <div>
                      <span className="block font-bold">Autorizar excepción académica</span>
                      <span className="text-texto-suave">
                        Permite entregar el material exigiendo garantías y duplicando la deducción por daños.
                      </span>
                    </div>
                  </label>
                )}

                <Campo
                  etiqueta={reservaSeleccionada ? 'Ejemplar físico reservado' : 'Ejemplar físico disponible'}
                  opciones={crearOpcionesInstancia(instancias, cargandoInstancias)}
                  valor={formulario.instanciaId}
                  onCambio={(evento) => actualizar('instanciaId', evento.target.value)}
                  error={errores.instancia_id}
                  ayuda={!materialSeleccionado
                    ? 'Selecciona primero el material para listar sus unidades.'
                    : reservaSeleccionada
                      ? 'Ejemplar asignado exclusivamente a esta reserva.'
                      : cargandoInstancias
                        ? 'Consultando ejemplares disponibles…'
                        : errorInstancias
                          ? 'Error al consultar inventario.'
                          : instancias.length > 0
                            ? 'Selecciona el ejemplar físico exacto a entregar.'
                            : 'No hay ejemplares libres para este material.'}
                  deshabilitado={Boolean(reservaSeleccionada) || !materialSeleccionado || cargandoInstancias || instancias.length === 0}
                  requerido
                />

                {/* Subsección: Plazo de Entrega y Devolución integrada en la tarjeta */}
                <div className="rounded-xl border border-borde/70 bg-superficie-alta/30 p-3.5 space-y-3 dark:bg-superficie-alta/20">
                  <div className="flex items-center gap-2 border-b border-borde/50 pb-2">
                    <Clock className="size-4 text-acento-600 dark:text-acento-400" />
                    <h4 className="text-sm font-bold text-texto">
                      Plazo de Entrega y Devolución
                    </h4>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor="fecha-inicio-prestamo" className="block text-xs font-semibold uppercase tracking-wide text-texto-suave mb-1">
                        Fecha y hora de inicio (recojo) *
                      </label>
                      <input
                        id="fecha-inicio-prestamo"
                        type="datetime-local"
                        value={fechaInicioPrestamo}
                        max={fechaFinPrestamo || undefined}
                        disabled
                        onChange={(evento) => {
                          setFechaInicioPrestamo(evento.target.value)
                          setErrores((actual) => ({ ...actual, dias: undefined }))
                        }}
                        className="w-full rounded-lg border border-borde bg-white px-3 py-2 text-sm text-texto disabled:bg-superficie-alta/60 dark:bg-superficie"
                        required
                      />
                    </div>
                    <div>
                      <SelectorFechaHoraDesplegable
                        id="fecha-fin-prestamo"
                        etiqueta="Fecha y hora de fin (devolución) *"
                        valor={fechaFinPrestamo}
                        minFecha={fechaInicioPrestamo ? fechaInicioPrestamo.slice(0, 10) : undefined}
                        deshabilitado={duracionBloqueadaPorReserva}
                        onCambio={(nuevoValor) => {
                          setFechaFinPrestamo(nuevoValor)
                          setErrores((actual) => ({ ...actual, dias: undefined }))
                        }}
                        error={errores.dias}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-texto-suave pt-0.5">
                    <span>
                      {duracionBloqueadaPorReserva
                        ? 'Fechas fijadas por la reserva confirmada.'
                        : ayudaRangoDuracion(materialSeleccionado)}
                    </span>
                    {Number.isFinite(duracionPrestamoMinutos) && duracionPrestamoMinutos > 0 && (
                      <span className="text-xs font-bold text-texto">
                        Duración: {formatearDuracionMinutos(duracionPrestamoMinutos)}
                        {cruzaFinDeSemana(fechaInicioPrestamo, fechaFinPrestamo) ? ' (todos los días intermedios computan)' : ''}
                      </span>
                    )}
                  </div>
                  {cruzaFinDeSemana(fechaInicioPrestamo, fechaFinPrestamo) && (
                    <div
                      role="note"
                      className="rounded-lg border border-acento-300 bg-acento-50/70 p-2.5 text-xs text-acento-900 dark:border-acento-800 dark:bg-acento-950/40 dark:text-acento-200"
                    >
                      <strong>Aclaración para el trámite:</strong> Este préstamo incluye días de fin de semana intermedios. Recuerda que la entrega y la devolución se efectúan exclusivamente de lunes a viernes en horario de atención (09:00 a 17:00), y todos los días en medio computan dentro de la duración del préstamo.
                    </div>
                  )}
                  {errores.dias && <p className="text-xs font-medium text-error">{errores.dias}</p>}
                </div>
              </div>
            </div>

            {/* Ficha del ejemplar (si está seleccionado) */}
            {instanciaSeleccionada && (
              <div
                className="grid gap-4 rounded-xl border border-acento-300 bg-acento-50/50 p-4 dark:border-acento-700/60 dark:bg-acento-500/10 md:grid-cols-[12rem_1fr] items-center"
                aria-labelledby="titulo-ficha-instancia-prestamo"
              >
                <div className="flex h-36 w-full items-center justify-center overflow-hidden rounded-lg border border-borde bg-superficie">
                  {instanciaSeleccionada.foto ? (
                    <img
                      src={instanciaSeleccionada.foto}
                      alt={`Foto del ejemplar ${instanciaSeleccionada.codigo_ejemplar}`}
                      className="h-full w-full object-contain p-2"
                    />
                  ) : (
                    <p className="p-3 text-center text-sm text-texto-suave">
                      Sin fotografía individual
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <header className="flex flex-wrap items-center justify-between gap-2 border-b border-borde pb-2">
                    <div>
                      <p className="text-xs uppercase text-texto-suave">Ficha del ejemplar a entregar</p>
                      <h4 id="titulo-ficha-instancia-prestamo" className="text-base font-bold text-texto">
                        {instanciaSeleccionada.codigo_ejemplar} · {materialSeleccionado?.nombre}
                      </h4>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-bold border shadow-2xs ${
                        ESTILOS_ESTADO_EJEMPLAR[instanciaSeleccionada.estado] ||
                        'bg-superficie border-borde text-texto'
                      }`}
                    >
                      {instanciaSeleccionada.estado_display || instanciaSeleccionada.estado || 'Disponible'}
                    </span>
                  </header>

                  <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4 pt-1">
                    <div>
                      <dt className="text-xs font-medium text-texto-suave">Código de Material</dt>
                      <dd className="text-sm font-semibold text-texto font-mono">
                        {materialSeleccionado?.codigo_material || 'No registrado'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-texto-suave">Nº de serie</dt>
                      <dd className="text-sm font-semibold text-texto font-mono break-words">
                        {instanciaSeleccionada.numero_serie || 'No registrado'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-texto-suave">Color</dt>
                      <dd className="text-sm font-semibold text-texto">
                        {instanciaSeleccionada.color || 'No registrado'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-texto-suave">Ubicación</dt>
                      <dd className="text-sm font-semibold text-texto">
                        {instanciaSeleccionada.ubicacion || 'No registrada'}
                      </dd>
                    </div>
                    <div className="sm:col-span-2 lg:col-span-4">
                      <dt className="text-xs font-medium text-texto-suave">Observaciones</dt>
                      <dd className="text-sm font-semibold text-texto">
                        {instanciaSeleccionada.observaciones || 'Sin observaciones'}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            )}

            {/* Advertencia: ejemplar con reservas programadas */}
            {formulario.instanciaId && instanciaSeleccionada?.estado === 'reservado' && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950/30">
                <p className="flex items-start gap-2 text-xs font-medium text-amber-800 dark:text-amber-300">
                  <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  <span>
                    Este ejemplar tiene{' '}
                    <strong>reservas programadas a futuro</strong>. La duración del préstamo no
                    debe solaparse con la próxima reserva confirmada. Si hay conflicto de fechas,
                    el sistema rechazará el registro automáticamente.
                  </span>
                </p>
              </div>
            )}

            {/* Checklist del estado inicial */}
            <fieldset className="rounded-xl border border-borde p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-borde/60 pb-3">
                <legend className="text-base font-bold text-texto">
                  Checklist del estado inicial
                </legend>
                <Boton
                  variante="secundario"
                  tamanio="pequeno"
                  tipo="button"
                  onClick={agregarElementoChecklist}
                >
                  + Agregar elemento
                </Boton>
              </div>

              <p className="text-xs text-texto-suave">
                Registra los accesorios y condiciones físicas del ejemplar con su respectiva fotografía (máx. {TAMANO_MAXIMO_FOTO_CHECKLIST_MB} MB).
              </p>

              <div className="space-y-3">
                {formulario.checklist.map((item, indice) => (
                  <div key={`checklist-${indice}`} className="rounded-xl border border-borde bg-superficie p-4 space-y-3 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-texto">Elemento #{indice + 1}</span>
                      {formulario.checklist.length > 1 && (
                        <button
                          type="button"
                          onClick={() => quitarElementoChecklist(indice)}
                          className="text-xs font-semibold text-red-600 hover:text-red-700 dark:text-red-400"
                        >
                          Eliminar elemento
                        </button>
                      )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Campo
                        etiqueta="Nombre del componente *"
                        valor={item.elemento}
                        onCambio={(evento) => actualizarChecklist(indice, 'elemento', evento.target.value)}
                        aria-invalid={Boolean(errores.checklist && !item.elemento.trim())}
                        placeholder="Ej. Sonda, cable de poder, adaptador..."
                        maxLength={100}
                        requerido
                      />
                      <Campo
                        etiqueta="Observación (opcional)"
                        valor={item.observacion}
                        onCambio={(evento) => actualizarChecklist(indice, 'observacion', evento.target.value)}
                        placeholder="Sin rayones, operativo..."
                        maxLength={500}
                      />
                    </div>
                    <div className="pt-1">
                      <label className="block text-sm font-semibold text-texto mb-1" htmlFor={`foto-checklist-${indice}`}>
                        Foto de comprobación <span className="text-error">*</span>
                      </label>
                      <input
                        ref={(elemento) => { referenciasFotos.current[indice] = elemento }}
                        id={`foto-checklist-${indice}`}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                        aria-invalid={Boolean(errores.fotosChecklist?.[indice])}
                        className="block w-full text-sm text-texto file:mr-3 file:rounded-lg file:border-0 file:bg-superficie-alta file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-texto"
                        onChange={(evento) => cambiarFotoChecklist(indice, evento.target.files?.[0] || null)}
                      />
                      {errores.fotosChecklist?.[indice] && (
                        <p className="mt-1 text-xs text-error" role="alert">
                          {errores.fotosChecklist[indice]}
                        </p>
                      )}
                      {item.fotoPrevia && (
                        <div className="mt-2.5 flex items-center gap-3">
                          <img
                            src={item.fotoPrevia}
                            alt="Vista previa"
                            className="size-16 rounded-lg border border-borde object-cover"
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
                  </div>
                ))}
              </div>
              {errores.checklist && <ErrorAlerta mensaje={errores.checklist} />}
            </fieldset>

            {/* Garantías documentales (solo si aplica) */}
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
                  <div className="rounded-lg border border-marca-300 bg-marca-50 p-3 text-xs text-marca-900 dark:border-marca-700 dark:bg-marca-950/40 dark:text-marca-200 space-y-1">
                    <p className="font-bold">
                      Garantía verificada en la reserva (reutilización automática)
                    </p>
                    <p className="text-texto-suave">
                      Los documentos de identidad y carta de compromiso registrados en la reserva quedarán vinculados a esta entrega.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-texto-suave">
                    Adjunta ambos documentos en PDF. Se almacenarán de forma privada y solo gestión autorizada podrá descargarlos. Tamaño máximo: {TAMANO_MAXIMO_GARANTIA_MB} MB.
                  </p>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
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
                </div>
              </fieldset>
            )}

            {/* Barra de Acciones del Formulario */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-borde">
              <Boton
                variante="peligro"
                tipo="button"
                icono={ArrowLeft}
                deshabilitado={guardando}
                onClick={() => navigate(-1)}
              >
                Cancelar
              </Boton>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <Boton
                  variante="secundario"
                  tipo="button"
                  deshabilitado={guardando}
                  onClick={cargarMateriales}
                >
                  Actualizar disponibilidad
                </Boton>
                <Boton
                  tipo="submit"
                  cargando={guardando}
                  deshabilitado={bloqueadoPorElegibilidad || bloqueadoPorReservaConversion || Boolean(
                    requiereGarantia
                    && !garantiaReutilizada
                    && (!formulario.documentoIdentidad || !formulario.compromisoResponsabilidad)
                  )}
                >
                  {reservaSeleccionada ? 'Convertir reserva y confirmar entrega' : 'Confirmar entrega'}
                </Boton>
              </div>
            </div>
          </form>
        )}
      </div>

      {elementosSinFoto && (
        <AdvertenciaModal
          titulo="Faltan fotos del checklist"
          descripcion="Adjunta una foto para cada uno de estos elementos antes de continuar:"
          mensajes={elementosSinFoto.map(({ elemento }) => elemento)}
          onCerrar={cerrarAdvertenciaFotos}
        />
      )}
      {advertenciaFechaHoraReserva && reservaSeleccionada && (
        <AdvertenciaModal
          titulo="La reserva todavía no está lista para entregar"
          descripcion="La entrega solo se puede confirmar cuando hayan llegado tanto la fecha como la hora de inicio reservadas."
          mensajes={[
            `Inicio reservado: ${fechaLegible(reservaSeleccionada.fecha_inicio)}.`,
            'Espera hasta ese momento y vuelve a confirmar la entrega.',
          ]}
          onCerrar={() => setAdvertenciaFechaHoraReserva(false)}
        />
      )}
      {errorConfirmacion && (
        <ErrorModal
          titulo="No se pudo confirmar la entrega"
          mensaje={errorConfirmacion}
          onCerrar={() => setErrorConfirmacion('')}
        />
      )}
    </section>
  )
}

export default RegistrarPrestamo
