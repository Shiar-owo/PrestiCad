import { useEffect, useMemo, useRef, useState } from 'react'

import { api, ErrorApi } from '../api/client'
import {
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
import {
  DURACION_MAXIMA_PRESTAMO_DIAS,
  TAMANO_MAXIMO_FOTO_CHECKLIST_MB,
} from '../constantes/checklistPrestamo'
import { construirSolicitudPrestamo } from '../prestamos/solicitudPrestamo'
import { validarTamanoSolicitud } from '../prestamos/tamanoSolicitud'
import {
  crearOpcionesInstancia,
  obtenerInstanciaSeleccionada,
} from '../prestamos/instanciasPrestamo'

const FORMULARIO_INICIAL = {
  dni: '',
  materialId: '',
  instanciaId: '',
  dias: '7',
  checklist: [{ elemento: '', observacion: '', foto: null, fotoPrevia: '' }],
  documentoIdentidad: null,
  compromisoResponsabilidad: null,
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
    etiqueta: `${material.nombre} — ${material.codigo_inventario} (${material.unidades_disponibles} disponibles)`,
  })),
]

function RegistrarPrestamo() {
  useTituloPagina('Registrar entrega')
  const [materiales, setMateriales] = useState([])
  const [instancias, setInstancias] = useState([])
  const [formulario, setFormulario] = useState(FORMULARIO_INICIAL)
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
    const dni = formulario.dni.trim()
    setPerfilPrestatario(null)
    setDniPerfilVerificado('')
    setErrorPerfil('')
    if (!/^\d{8}$/.test(dni)) {
      setConsultandoPerfil(false)
      return undefined
    }

    let vigente = true
    setConsultandoPerfil(true)
    api.get(`/usuarios/elegibilidad-prestamo/?dni=${dni}`)
      .then((perfil) => {
        if (vigente) {
          setPerfilPrestatario(perfil)
          setDniPerfilVerificado(dni)
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
  }, [formulario.dni])

  useEffect(() => {
    let cancelado = false
    setInstancias([])
    setErrorInstancias('')

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
  }, [formulario.materialId])

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

  const materialSeleccionado = materiales.find(
    (material) => String(material.id) === String(formulario.materialId),
  )
  const instanciaSeleccionada = obtenerInstanciaSeleccionada(
    instancias,
    formulario.instanciaId,
  )
  const fechaLimiteEstimada = useMemo(
    () => calcularFechaLimiteEstimada(formulario.dias),
    [formulario.dias],
  )
  const perfilVerificadoActual = dniPerfilVerificado === formulario.dni.trim()
    ? perfilPrestatario
    : null
  const tierCumple = Boolean(
    perfilVerificadoActual && materialSeleccionado
    && NIVEL_TIER[perfilVerificadoActual.reputacion_tier] >= NIVEL_TIER[materialSeleccionado.tier_minimo_requerido],
  )
  const perfilHabilitado = perfilVerificadoActual?.rol === 'prestatario' && perfilVerificadoActual?.estado === 'activo'
  const verificacionPendiente = /^\d{8}$/.test(formulario.dni.trim())
    && (consultandoPerfil || !perfilVerificadoActual && !errorPerfil)
  const bloqueadoPorElegibilidad = Boolean(
    materialSeleccionado && /^\d{8}$/.test(formulario.dni.trim())
    && (verificacionPendiente || errorPerfil || !perfilVerificadoActual || !perfilHabilitado || !tierCumple),
  )

  function actualizar(campo, valor) {
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
      ...(campo === 'materialId'
        ? {
            instanciaId: '',
            documentoIdentidad: null,
            compromisoResponsabilidad: null,
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
    const cambio = evaluarCambioDuracion(duracion, formulario.dias)
    if (cambio.error) {
      setErrores((actual) => ({ ...actual, dias: cambio.error }))
      return
    }
    actualizar('dias', cambio.valor)
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
      dias: formulario.dias,
      checklist: formulario.checklist,
      documentoIdentidad: formulario.documentoIdentidad,
      compromisoResponsabilidad: formulario.compromisoResponsabilidad,
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
      const solicitud = construirSolicitudPrestamo({
        dni: formulario.dni,
        material: materialSeleccionado,
        instanciaId: formulario.instanciaId,
        dias: formulario.dias,
        checklist: formulario.checklist,
        documentoIdentidad: formulario.documentoIdentidad,
        compromisoResponsabilidad: formulario.compromisoResponsabilidad,
      })
      const errorTamano = validarTamanoSolicitud(solicitud)
      if (errorTamano) {
        setError(errorTamano)
        return
      }
      const respuesta = await api.post('/prestamos/', solicitud)
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
            Préstamo registrado como activo para {prestamoCreado.usuario_nombre}.
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

      {!cargando && materiales.length === 0 && (
        <EstadoVacio
          titulo="No hay unidades disponibles"
          mensaje="No hay materiales disponibles para prestar en este momento."
        />
      )}

      {!cargando && materiales.length > 0 && (
        <Tarjeta className="p-6">
          <form ref={referenciaFormulario} onSubmit={registrar} noValidate className="grid gap-5">
            <SelectorPrestatario
              etiqueta="DNI del prestatario"
              valor={formulario.dni}
              onCambio={(valor) => actualizar('dni', valor)}
              error={errores.dni}
              ayuda="Al completar o seleccionar el DNI se consultará la reputación del prestatario."
              requerido
            />
            <Campo
              etiqueta="Material disponible"
              opciones={OPCIONES_MATERIAL(materiales)}
              valor={formulario.materialId}
              onCambio={(evento) => actualizar('materialId', evento.target.value)}
              error={errores.material}
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
                    {' '}{!tierCumple && <strong>No cumple el requisito; el registro está bloqueado.</strong>}
                    {tierCumple && perfilHabilitado && <strong> Cumple el requisito.</strong>}
                  </p>
                )}
              </div>
            )}
            <Campo
              etiqueta="Instancia disponible"
              opciones={crearOpcionesInstancia(instancias, cargandoInstancias)}
              valor={formulario.instanciaId}
              onCambio={(evento) => actualizar('instanciaId', evento.target.value)}
              error={errores.instancia_id}
              ayuda={!materialSeleccionado
                ? 'Selecciona primero el material.'
                : cargandoInstancias
                  ? 'Consultando sus instancias disponibles.'
                  : errorInstancias
                    ? 'No se pudo consultar el inventario de instancias.'
                    : instancias.length > 0
                      ? 'El código identifica el ejemplar físico que se entregará.'
                      : 'No hay instancias disponibles para este material.'}
              deshabilitado={!materialSeleccionado || cargandoInstancias || instancias.length === 0}
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
                    {materialSeleccionado?.nombre || 'Material'} · Código de inventario:{' '}
                    {materialSeleccionado?.codigo_inventario || 'No registrado'}
                  </p>
                  <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="font-semibold text-texto">Código de ejemplar</dt>
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
                      <dt className="font-semibold text-texto">Condición física</dt>
                      <dd className="text-texto-suave">{instanciaSeleccionada.condicion_fisica || 'No registrado'}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-texto">Ubicación</dt>
                      <dd className="text-texto-suave">{instanciaSeleccionada.ubicacion || 'No registrada'}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="font-semibold text-texto">Observaciones</dt>
                      <dd className="break-words text-texto-suave">
                        {instanciaSeleccionada.observaciones || 'Sin observaciones'}
                      </dd>
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
            <Campo
              etiqueta="Duración del préstamo (días)"
              tipo="number"
              min="1"
              max={DURACION_MAXIMA_PRESTAMO_DIAS}
              step="1"
              valor={formulario.dias}
              onCambio={(evento) => cambiarDuracion(evento.target.value)}
              error={errores.dias}
              requerido
            />
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
                    etiqueta="Observación (opcional)"
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

            {materialSeleccionado?.es_alto_valor && (
              <fieldset
                key={formulario.materialId}
                className="grid gap-3 rounded-xl border border-acento-300 bg-acento-50/50 p-4 dark:border-acento-700/60 dark:bg-acento-500/10"
              >
                <legend className="px-2 text-sm font-bold text-acento-800 dark:text-acento-300">
                  Garantía obligatoria para material de alto valor
                </legend>
                <p className="text-xs text-texto-suave">
                  Adjunta ambos documentos en PDF. Se almacenarán de forma privada y solo gestión
                  autorizada podrá descargarlos. Tamaño máximo: {TAMANO_MAXIMO_GARANTIA_MB} MB.
                </p>
                <SubidaDocumentoPDF
                  etiqueta="Documento de identidad (PDF)"
                  archivo={formulario.documentoIdentidad}
                  onCambio={(archivo) => actualizar('documentoIdentidad', archivo)}
                  error={errores.documento_identidad}
                  ayuda={`Solo se acepta application/pdf, hasta ${TAMANO_MAXIMO_GARANTIA_MB} MB.`}
                />
                <SubidaDocumentoPDF
                  etiqueta="Carta de responsabilidad (PDF)"
                  archivo={formulario.compromisoResponsabilidad}
                  onCambio={(archivo) => actualizar('compromisoResponsabilidad', archivo)}
                  error={errores.compromiso_responsabilidad}
                  ayuda={`Solo se acepta application/pdf, hasta ${TAMANO_MAXIMO_GARANTIA_MB} MB.`}
                />
              </fieldset>
            )}

            <div className="flex flex-wrap gap-2">
              <Boton
                tipo="submit"
                cargando={guardando}
                deshabilitado={bloqueadoPorElegibilidad || Boolean(
                  materialSeleccionado?.es_alto_valor
                  && (!formulario.documentoIdentidad || !formulario.compromisoResponsabilidad)
                )}
              >
                Confirmar entrega
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
