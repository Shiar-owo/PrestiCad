import { useEffect, useMemo, useState } from 'react'

import { api, ErrorApi } from '../api/client'
import {
  calcularFechaLimiteEstimada,
  validarFormularioPrestamo,
} from '../validacionesPrestamo'
import Campo from '../components/ui/Campo'
import Boton from '../components/ui/Boton'
import Tarjeta from '../components/ui/Tarjeta'
import Skeleton from '../components/ui/Skeleton'
import ErrorAlerta from '../components/ui/ErrorAlerta'
import EstadoVacio from '../components/ui/EstadoVacio'

const FORMULARIO_INICIAL = {
  dni: '',
  materialId: '',
  dias: '7',
  checklist: [{ elemento: '', condicion: '', observacion: '' }],
  documentoIdentidadRecibido: false,
  compromisoFirmadoRecibido: false,
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
  const [materiales, setMateriales] = useState([])
  const [formulario, setFormulario] = useState(FORMULARIO_INICIAL)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [errores, setErrores] = useState({})
  const [prestamoCreado, setPrestamoCreado] = useState(null)

  useEffect(() => {
    cargarMateriales()
  }, [])

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
  const fechaLimiteEstimada = useMemo(
    () => calcularFechaLimiteEstimada(formulario.dias),
    [formulario.dias],
  )

  function actualizar(campo, valor) {
    const camposError = {
      dni: 'dni',
      materialId: 'material',
      dias: 'dias',
      documentoIdentidadRecibido: 'garantia_documento_identidad_recibido',
      compromisoFirmadoRecibido: 'garantia_compromiso_firmado_recibido',
    }
    setFormulario((actual) => ({ ...actual, [campo]: valor }))
    setErrores((actual) => ({ ...actual, [camposError[campo] || campo]: undefined }))
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
      dias: formulario.dias,
      checklist: formulario.checklist,
      documentoIdentidadRecibido: formulario.documentoIdentidadRecibido,
      compromisoFirmadoRecibido: formulario.compromisoFirmadoRecibido,
    }
    const validacion = validarFormularioPrestamo(datosValidacion)
    setErrores(validacion)
    setError('')
    setPrestamoCreado(null)
    if (Object.keys(validacion).length > 0) return

    setGuardando(true)
    try {
      const respuesta = await api.post('/prestamos/', {
        dni_prestatario: formulario.dni.trim(),
        material_id: materialSeleccionado.id,
        tiempo_prestamo_dias: Number(formulario.dias),
        checklist_inicial: formulario.checklist.map((item) => ({
          elemento: item.elemento.trim(),
          condicion: item.condicion.trim(),
          observacion: item.observacion.trim(),
        })),
        garantia_documento_identidad_recibido: formulario.documentoIdentidadRecibido,
        garantia_compromiso_firmado_recibido: formulario.compromisoFirmadoRecibido,
      })
      setPrestamoCreado(respuesta)
      setFormulario(FORMULARIO_INICIAL)
      await cargarMateriales()
    } catch (errorApi) {
      setError(mensajeApi(errorApi))
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
            <Campo
              etiqueta="DNI del prestatario"
              valor={formulario.dni}
              onCambio={(evento) => actualizar('dni', evento.target.value)}
              error={errores.dni}
              ayuda="El sistema verificará que el usuario esté activo y cumpla el Tier requerido."
              inputMode="numeric"
              autoComplete="off"
              maxLength={8}
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
              <fieldset className="grid gap-3 rounded-xl border border-acento-300 bg-acento-50/50 p-4 dark:border-acento-700/60 dark:bg-acento-500/10">
                <legend className="px-2 text-sm font-bold text-acento-800 dark:text-acento-300">
                  Garantía obligatoria para material de alto valor
                </legend>
                <p className="text-xs text-texto-suave">
                  Verifica presencialmente los documentos. El sistema guarda constancia de recepción,
                  no copias de documentos personales.
                </p>
                <label className="flex items-start gap-2 text-sm text-texto">
                  <input
                    type="checkbox"
                    checked={formulario.documentoIdentidadRecibido}
                    onChange={(evento) => actualizar('documentoIdentidadRecibido', evento.target.checked)}
                    className="mt-0.5 size-4 accent-marca-600"
                  />
                  Documento de identidad recibido y revisado
                </label>
                {errores.garantia_documento_identidad_recibido && (
                  <ErrorAlerta mensaje={errores.garantia_documento_identidad_recibido} />
                )}
                <label className="flex items-start gap-2 text-sm text-texto">
                  <input
                    type="checkbox"
                    checked={formulario.compromisoFirmadoRecibido}
                    onChange={(evento) => actualizar('compromisoFirmadoRecibido', evento.target.checked)}
                    className="mt-0.5 size-4 accent-marca-600"
                  />
                  Compromiso de responsabilidad firmado y recibido
                </label>
                {errores.garantia_compromiso_firmado_recibido && (
                  <ErrorAlerta mensaje={errores.garantia_compromiso_firmado_recibido} />
                )}
              </fieldset>
            )}

            <div className="flex flex-wrap gap-2">
              <Boton tipo="submit" cargando={guardando}>
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