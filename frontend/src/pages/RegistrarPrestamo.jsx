import { useEffect, useMemo, useState } from 'react'

import { api, ErrorApi } from '../api/client'
import {
  calcularFechaLimiteEstimada,
  validarFormularioPrestamo,
} from '../validacionesPrestamo'

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
    (material) => material.id === formulario.materialId,
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
    <section className="prestamo-registro" aria-labelledby="titulo-registro-prestamo">
      <h3 id="titulo-registro-prestamo">Registrar entrega de préstamo</h3>
      <p>
        Confirma la identidad y elegibilidad del prestatario antes de entregar el material.
      </p>

      {error && <p className="error-general" role="alert">{error}</p>}
      {prestamoCreado && (
        <div className="exito" role="status">
          <p>Préstamo registrado como activo para {prestamoCreado.usuario_nombre}.</p>
          <p>Fecha límite de devolución: <strong>{fechaLegible(prestamoCreado.fecha_limite)}</strong></p>
        </div>
      )}
      {cargando && <p>Cargando materiales disponibles…</p>}
      {!cargando && materiales.length === 0 && (
        <p>No hay unidades disponibles para prestar en este momento.</p>
      )}

      {!cargando && materiales.length > 0 && (
        <form className="prestamo-registro__formulario" onSubmit={registrar} noValidate>
          <label>
            <span>DNI del prestatario</span>
            <input
              inputMode="numeric"
              autoComplete="off"
              maxLength={8}
              value={formulario.dni}
              aria-invalid={Boolean(errores.dni)}
              onChange={(evento) => actualizar('dni', evento.target.value)}
              required
            />
            {errores.dni && <small className="error">{errores.dni}</small>}
            <small>El sistema verificará que el usuario esté activo y cumpla el Tier requerido.</small>
          </label>

          <label>
            <span>Material disponible</span>
            <select
              value={formulario.materialId}
              aria-invalid={Boolean(errores.material)}
              onChange={(evento) => actualizar('materialId', evento.target.value)}
              required
            >
              <option value="">Selecciona un material</option>
              {materiales.map((material) => (
                <option key={material.id} value={material.id}>
                  {material.nombre} — {material.codigo_inventario} ({material.unidades_disponibles} disponibles)
                </option>
              ))}
            </select>
            {errores.material && <small className="error">{errores.material}</small>}
          </label>

          <label>
            <span>Duración del préstamo (días)</span>
            <input
              type="number"
              min="1"
              step="1"
              value={formulario.dias}
              aria-invalid={Boolean(errores.dias)}
              onChange={(evento) => actualizar('dias', evento.target.value)}
              required
            />
            {errores.dias && <small className="error">{errores.dias}</small>}
          </label>
          {fechaLimiteEstimada && (
            <p className="prestamo-registro__fecha">
              Fecha límite estimada: <strong>{fechaLegible(fechaLimiteEstimada)}</strong>
              <small> La fecha confirmada por el servidor aparecerá al registrar.</small>
            </p>
          )}

          <fieldset className="prestamo-registro__checklist">
            <legend>Checklist del estado inicial</legend>
            {formulario.checklist.map((item, indice) => (
              <div className="prestamo-registro__fila" key={`checklist-${indice}`}>
                <label>
                  <span>Elemento</span>
                  <input
                    value={item.elemento}
                    maxLength={100}
                    onChange={(evento) => actualizarChecklist(indice, 'elemento', evento.target.value)}
                    required
                  />
                </label>
                <label>
                  <span>Condición</span>
                  <input
                    value={item.condicion}
                    maxLength={500}
                    onChange={(evento) => actualizarChecklist(indice, 'condicion', evento.target.value)}
                    required
                  />
                </label>
                <label>
                  <span>Observación (opcional)</span>
                  <input
                    value={item.observacion}
                    maxLength={500}
                    onChange={(evento) => actualizarChecklist(indice, 'observacion', evento.target.value)}
                  />
                </label>
                {formulario.checklist.length > 1 && (
                  <button
                    className="boton-secundario"
                    type="button"
                    onClick={() => quitarElementoChecklist(indice)}
                  >Quitar elemento</button>
                )}
              </div>
            ))}
            {errores.checklist && <small className="error">{errores.checklist}</small>}
            <button className="boton-secundario" type="button" onClick={agregarElementoChecklist}>
              Agregar elemento
            </button>
          </fieldset>

          {materialSeleccionado?.es_alto_valor && (
            <fieldset className="prestamo-registro__garantia">
              <legend>Garantía obligatoria para material de alto valor</legend>
              <p>
                Verifica presencialmente los documentos. El sistema guarda constancia de recepción,
                no copias de documentos personales.
              </p>
              <label className="prestamo-registro__opcion">
                <input
                  type="checkbox"
                  checked={formulario.documentoIdentidadRecibido}
                  onChange={(evento) => actualizar('documentoIdentidadRecibido', evento.target.checked)}
                />
                <span>Documento de identidad recibido y revisado</span>
              </label>
              {errores.garantia_documento_identidad_recibido && (
                <small className="error">{errores.garantia_documento_identidad_recibido}</small>
              )}
              <label className="prestamo-registro__opcion">
                <input
                  type="checkbox"
                  checked={formulario.compromisoFirmadoRecibido}
                  onChange={(evento) => actualizar('compromisoFirmadoRecibido', evento.target.checked)}
                />
                <span>Compromiso de responsabilidad firmado y recibido</span>
              </label>
              {errores.garantia_compromiso_firmado_recibido && (
                <small className="error">{errores.garantia_compromiso_firmado_recibido}</small>
              )}
            </fieldset>
          )}

          <div className="prestamo-registro__acciones">
            <button type="submit" disabled={guardando}>
              {guardando ? 'Registrando…' : 'Confirmar entrega'}
            </button>
            <button className="boton-secundario" type="button" onClick={cargarMateriales} disabled={guardando}>
              Actualizar disponibilidad
            </button>
          </div>
        </form>
      )}
    </section>
  )
}

export default RegistrarPrestamo
