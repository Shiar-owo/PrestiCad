import { useEffect, useMemo, useState } from 'react'

import { api, ErrorApi } from '../api/client'
import {
  calcularFechaLimiteEstimada,
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
import { TAMANO_MAXIMO_GARANTIA_MB } from '../constantes/garantia'
import { construirSolicitudPrestamo } from '../prestamos/solicitudPrestamo'
import { crearOpcionesInstancia } from '../prestamos/instanciasPrestamo'

const FORMULARIO_INICIAL = {
  dni: '',
  materialId: '',
  instanciaId: '',
  dias: '7',
  checklist: [{ elemento: '', condicion: '', observacion: '' }],
  documentoIdentidad: null,
  compromisoResponsabilidad: null,
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

  useEffect(() => {
    cargarMateriales()
  }, [])

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
  const instanciaSeleccionada = instancias.find(
    (instancia) => String(instancia.id) === String(formulario.instanciaId),
  )
  const fechaLimiteEstimada = useMemo(
    () => calcularFechaLimiteEstimada(formulario.dias),
    [formulario.dias],
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

  function actualizarChecklist(indice, campo, valor) {
    setFormulario((actual) => ({
      ...actual,
      checklist: actual.checklist.map((item, posicion) => (
        posicion === indice ? { ...item, [campo]: valor } : item
      )),
    }))
    setErrores((actual) => ({ ...actual, checklist: undefined }))
  }

  function agregarElementoChecklist() {
    setFormulario((actual) => ({
      ...actual,
      checklist: [...actual.checklist, { elemento: '', condicion: '', observacion: '' }],
    }))
  }

  function quitarElementoChecklist(indice) {
    setFormulario((actual) => ({
      ...actual,
      checklist: actual.checklist.filter((_, posicion) => posicion !== indice),
    }))
    setErrores((actual) => ({ ...actual, checklist: undefined }))
  }

  async function registrar(evento) {
    evento.preventDefault()
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
    if (Object.keys(validacion).length > 0) return

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
      const respuesta = await api.post('/prestamos/', solicitud)
      setPrestamoCreado(respuesta)
      setFormulario(FORMULARIO_INICIAL)
      await cargarMateriales()
    } catch (errorApi) {
      const erroresApi = errorApi instanceof ErrorApi ? errorApi.datos : null
      const camposApi = {
        dni_prestatario: 'dni',
        instancia_id: 'instancia_id',
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
      if (Object.keys(erroresDeCampo).length > 0) {
        setErrores((actual) => ({
          ...actual,
          ...erroresDeCampo,
        }))
        setError('')
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
          <form onSubmit={registrar} noValidate className="grid gap-5">
            <SelectorPrestatario
              etiqueta="DNI del prestatario"
              valor={formulario.dni}
              onCambio={(valor) => actualizar('dni', valor)}
              error={errores.dni}
              ayuda="El sistema verificará que el usuario esté activo y cumpla el Tier requerido."
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
                      <dt className="font-semibold text-texto">Estado físico</dt>
                      <dd className="text-texto-suave">{instanciaSeleccionada.estado_fisico || 'No registrado'}</dd>
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
              step="1"
              valor={formulario.dias}
              onCambio={(evento) => actualizar('dias', evento.target.value)}
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
              <legend className="px-2 text-sm font-bold text-texto">
                Checklist del estado inicial
              </legend>
              {formulario.checklist.map((item, indice) => (
                <div key={`checklist-${indice}`} className="relative grid gap-4 rounded-lg border border-borde p-4 sm:grid-cols-3">
                  <Campo
                    etiqueta="Elemento"
                    valor={item.elemento}
                    onCambio={(evento) => actualizarChecklist(indice, 'elemento', evento.target.value)}
                    maxLength={100}
                    requerido
                  />
                  <Campo
                    etiqueta="Condición"
                    valor={item.condicion}
                    onCambio={(evento) => actualizarChecklist(indice, 'condicion', evento.target.value)}
                    maxLength={500}
                    requerido
                  />
                  <Campo
                    etiqueta="Observación (opcional)"
                    valor={item.observacion}
                    onCambio={(evento) => actualizarChecklist(indice, 'observacion', evento.target.value)}
                    maxLength={500}
                  />
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
                deshabilitado={materialSeleccionado?.es_alto_valor && (
                  !formulario.documentoIdentidad || !formulario.compromisoResponsabilidad
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
    </section>
  )
}

export default RegistrarPrestamo
