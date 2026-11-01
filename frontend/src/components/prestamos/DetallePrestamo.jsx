import { useEffect, useState } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, RotateCcw, Trash2, Upload } from 'lucide-react'

import { api, ErrorApi } from '../../api/client'
import { ETIQUETAS_ESTADO } from '../../constantes/catalogo'
import BadgeEstado from '../ui/BadgeEstado'
import Boton from '../ui/Boton'
import ErrorAlerta from '../ui/ErrorAlerta'
import Skeleton from '../ui/Skeleton'
import Tarjeta from '../ui/Tarjeta'

function mostrarFecha(fecha) {
  const valor = new Date(fecha)
  if (Number.isNaN(valor.getTime())) return fecha

  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(valor)
}

function CampoDetalle({ etiqueta, children }) {
  return (
    <div className="rounded-xl border border-borde bg-superficie p-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-texto-suave">
        {etiqueta}
      </dt>
      <dd className="mt-1 break-words text-sm font-medium text-texto">{children}</dd>
    </div>
  )
}

const DOCUMENTOS_GARANTIA = [
  {
    tipo: 'documento-identidad',
    campo: 'documento_identidad_disponible',
    etiqueta: 'Documento de identidad',
    nombreArchivo: 'documento_identidad',
  },
  {
    tipo: 'compromiso',
    campo: 'compromiso_responsabilidad_disponible',
    etiqueta: 'Compromiso de responsabilidad',
    nombreArchivo: 'compromiso_responsabilidad',
  },
]

function mensajeError(error, accion) {
  if (error instanceof ErrorApi && error.datos) {
    if (typeof error.datos.detail === 'string') return error.datos.detail
    const mensaje = Object.values(error.datos).flat()[0]
    if (mensaje) return String(mensaje)
  }
  return `No se pudo ${accion} el documento. Intenta nuevamente.`
}

export default function DetallePrestamo({
  prestamo,
  onVolver,
  etiquetaVolver = 'Volver a mis préstamos',
  onDevolucion = null,
  puedeEditarGarantia = false,
  onAnterior = null,
  onSiguiente = null,
  hayAnterior = false,
  haySiguiente = false,
}) {
  const [detalle, setDetalle] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [intento, setIntento] = useState(0)
  const [archivos, setArchivos] = useState({})
  const [accion, setAccion] = useState('')
  const [error, setError] = useState('')
  const [errorArchivos, setErrorArchivos] = useState({})

  useEffect(() => {
    let activa = true
    setCargando(true)
    setDetalle(null)
    setError('')
    setArchivos({})
    setErrorArchivos({})

    api.get(`/prestamos/${prestamo.id}/historial/`)
      .then((datos) => {
        if (activa) setDetalle(datos)
      })
      .catch(() => {
        if (activa) setError('No se pudo cargar el detalle completo del préstamo.')
      })
      .finally(() => {
        if (activa) setCargando(false)
      })

    return () => {
      activa = false
    }
  }, [prestamo.id, intento])

  async function gestionarDocumento(documento, eliminar = false) {
    const archivo = archivos[documento.nombreArchivo]
    if (!eliminar && !archivo) {
      setErrorArchivos((actual) => ({
        ...actual,
        [documento.nombreArchivo]: 'Selecciona un archivo PDF para reemplazar el documento.',
      }))
      return
    }
    if (eliminar && !window.confirm(
      `¿Eliminar ${documento.etiqueta.toLowerCase()}? Debe quedar al menos un PDF de garantía.`,
    )) return

    setAccion(documento.tipo)
    setError('')
    setErrorArchivos((actual) => ({ ...actual, [documento.nombreArchivo]: '' }))
    try {
      const formulario = new FormData()
      if (eliminar) formulario.append('eliminar', 'true')
      else formulario.append('archivo', archivo)
      await api.patch(`/prestamos/${prestamo.id}/garantia/${documento.tipo}/`, formulario)
      setArchivos((actual) => ({ ...actual, [documento.nombreArchivo]: null }))
      setIntento((actual) => actual + 1)
    } catch (errorApi) {
      setErrorArchivos((actual) => ({
        ...actual,
        [documento.nombreArchivo]: mensajeError(errorApi, eliminar ? 'eliminar' : 'reemplazar'),
      }))
    } finally {
      setAccion('')
    }
  }

  const estado = detalle?.estado ?? prestamo.estado_visible ?? prestamo.estado
  const material = detalle?.material
  const instancia = detalle?.instancia
  const documentos = detalle?.documentos_garantia
  const totalDocumentos = DOCUMENTOS_GARANTIA.filter((documento) => (
    documentos?.[documento.campo]
  )).length

  return (
    <Tarjeta className="p-6" aria-labelledby="prestamo-detalle-titulo">
      <Boton
        variante="fantasma"
        tamanio="pequeno"
        tipo="button"
        icono={ArrowLeft}
        onClick={onVolver}
      >
        {etiquetaVolver}
      </Boton>
      {(onAnterior || onSiguiente) && (
        <nav className="mt-3 flex flex-wrap gap-2" aria-label="Navegar entre préstamos">
          <Boton
            variante="secundario"
            tamanio="pequeno"
            tipo="button"
            icono={ChevronLeft}
            deshabilitado={!hayAnterior}
            onClick={onAnterior}
          >
            Préstamo anterior
          </Boton>
          <Boton
            variante="secundario"
            tamanio="pequeno"
            tipo="button"
            icono={ChevronRight}
            deshabilitado={!haySiguiente}
            onClick={onSiguiente}
          >
            Préstamo siguiente
          </Boton>
        </nav>
      )}
      <h3 id="prestamo-detalle-titulo" className="mt-4 text-lg font-bold text-texto">
        Detalle del préstamo
      </h3>

      {cargando && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2" role="status" aria-live="polite">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
          <p className="text-sm text-texto-suave">Cargando ficha e historial del ejemplar…</p>
        </div>
      )}
      {error && (
        <div className="mt-4 grid gap-3">
          <ErrorAlerta mensaje={error} />
          <Boton
            variante="secundario"
            tipo="button"
            className="w-fit"
            onClick={() => setIntento((actual) => actual + 1)}
          >
            Reintentar
          </Boton>
        </div>
      )}

      {!cargando && detalle && (
        <>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {detalle.prestatario_nombre && (
              <CampoDetalle etiqueta="Prestatario">
                {detalle.prestatario_nombre} · DNI {detalle.prestatario_dni}
              </CampoDetalle>
            )}
            <CampoDetalle etiqueta="Fecha de entrega">{mostrarFecha(detalle.fecha_entrega)}</CampoDetalle>
            <CampoDetalle etiqueta="Fecha límite">{mostrarFecha(detalle.fecha_limite)}</CampoDetalle>
            <CampoDetalle etiqueta="Duración">{detalle.tiempo_prestamo_dias} días</CampoDetalle>
            <CampoDetalle etiqueta="Estado"><BadgeEstado estado={estado} /></CampoDetalle>
          </dl>

          <section className="mt-6 rounded-xl border border-borde p-4" aria-labelledby="titulo-ficha-prestamo">
            <h4 id="titulo-ficha-prestamo" className="font-bold text-texto">Ficha del material</h4>
            {material?.foto && (
              <img
                src={material.foto}
                alt={`Foto de ${material.nombre}`}
                className="mt-3 h-44 w-44 rounded-lg border border-borde object-cover"
              />
            )}
            <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <CampoDetalle etiqueta="Material">{material?.nombre || prestamo.material_nombre}</CampoDetalle>
              <CampoDetalle etiqueta="Código de Material">
                {material?.codigo_material || material?.codigo_inventario || prestamo.material_codigo}
              </CampoDetalle>
              <CampoDetalle etiqueta="Descripción">{material?.descripcion || 'Sin descripción'}</CampoDetalle>
              <CampoDetalle etiqueta="Tipo">{material?.tipo || 'No especificado'}</CampoDetalle>
              <CampoDetalle etiqueta="Marca y modelo">
                {[material?.marca, material?.modelo].filter(Boolean).join(' · ') || 'No especificados'}
              </CampoDetalle>
              <CampoDetalle etiqueta="Número de serie general">
                {material?.numero_serie || 'No registrado'}
              </CampoDetalle>
              <CampoDetalle etiqueta="Color general">{material?.color || 'No registrado'}</CampoDetalle>
              <CampoDetalle etiqueta="Estado">
                {ETIQUETAS_ESTADO[material?.estado] || material?.estado || 'No registrado'}
              </CampoDetalle>
              <CampoDetalle etiqueta="Alto valor">
                {material?.es_alto_valor ? 'Sí' : 'No'}
              </CampoDetalle>
              <CampoDetalle etiqueta="Tier mínimo">{material?.tier_minimo_requerido}</CampoDetalle>
              <CampoDetalle etiqueta="Bonificación por entrega a tiempo">
                {material?.bonificacion_tiempo} puntos
              </CampoDetalle>
              <CampoDetalle etiqueta="Deducción por tardanza">
                {material?.deduccion_tardanza} puntos por día
              </CampoDetalle>
              <CampoDetalle etiqueta="Deducción por daño parcial">
                {material?.deduccion_dano_parcial} puntos
              </CampoDetalle>
              <CampoDetalle etiqueta="Deducción por daño total">
                {material?.deduccion_dano_total} puntos
              </CampoDetalle>
              <CampoDetalle etiqueta="Costos de reparación y reposición">
                {material?.costo_reparacion ?? 'No definido'} / {material?.costo_reposicion ?? 'No definido'}
              </CampoDetalle>
            </dl>
          </section>

          <section className="mt-6 rounded-xl border border-borde p-4" aria-labelledby="titulo-instancia-prestamo">
            <h4 id="titulo-instancia-prestamo" className="font-bold text-texto">
              Ejemplar entregado
            </h4>
            {instancia ? (
              <>
                {instancia.foto && (
                  <img
                    src={instancia.foto}
                    alt={`Foto de ${instancia.codigo_ejemplar}`}
                    className="mt-3 h-40 w-40 rounded-lg border border-borde object-cover"
                  />
                )}
                <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <CampoDetalle etiqueta="Código de Ejemplar">{instancia.codigo_ejemplar}</CampoDetalle>
                  <CampoDetalle etiqueta="Estado del ejemplar">
                    {instancia.estado_display || instancia.estado}
                  </CampoDetalle>
                  <CampoDetalle etiqueta="Número de serie">{instancia.numero_serie || 'No registrado'}</CampoDetalle>
                  <CampoDetalle etiqueta="Color">{instancia.color || 'No registrado'}</CampoDetalle>
                  <CampoDetalle etiqueta="Observaciones">{instancia.observaciones || 'No registrado'}</CampoDetalle>
                  <CampoDetalle etiqueta="Ubicación">{instancia.ubicacion || 'No registrada'}</CampoDetalle>
                  <CampoDetalle etiqueta="Observaciones">{instancia.observaciones || 'Sin observaciones'}</CampoDetalle>
                </dl>
              </>
            ) : (
              <p className="mt-2 text-sm text-texto-suave">
                Este préstamo no tiene una instancia individual asociada.
              </p>
            )}
          </section>

          <section className="mt-6 rounded-xl border border-borde p-4" aria-labelledby="titulo-checklist-inicial">
            <h4 id="titulo-checklist-inicial" className="font-bold text-texto">Checklist al entregar</h4>
            {detalle.checklist_inicial?.length ? (
              <ul className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2">
                {detalle.checklist_inicial.map((elemento, indice) => (
                  <li key={`${elemento.elemento}-${indice}`} className="min-w-0 rounded-lg bg-superficie p-3">
                    <p className="font-semibold text-texto">{elemento.elemento}</p>
                    {elemento.foto_url && (
                      <figure className="mt-2 aspect-[4/3] w-full max-w-sm overflow-hidden rounded-lg border border-borde bg-superficie">
                        <img
                          src={elemento.foto_url}
                          alt={`Foto de ${elemento.elemento}`}
                          className="h-full w-full object-contain"
                        />
                      </figure>
                    )}
                    {elemento.observacion && (
                      <p className="mt-1 text-sm text-texto-suave">Observación: {elemento.observacion}</p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-texto-suave">No se registró checklist inicial.</p>
            )}
          </section>

          <section className="mt-6 rounded-xl border border-borde p-4" aria-labelledby="titulo-documentos-garantia">
            <h4 id="titulo-documentos-garantia" className="font-bold text-texto">Documentos de garantía</h4>
            {!material?.es_alto_valor ? (
              <p className="mt-2 text-sm text-texto-suave">Este material no requiere documentos de garantía.</p>
            ) : (
              <ul className="mt-3 grid gap-4">
                {DOCUMENTOS_GARANTIA.map((documento) => {
                  const disponible = Boolean(documentos?.[documento.campo])
                  const otroDisponible = totalDocumentos > Number(disponible)
                  const archivo = archivos[documento.nombreArchivo]

                  return (
                    <li key={documento.tipo} className="rounded-lg bg-superficie p-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="font-semibold text-texto">{documento.etiqueta}</p>
                        {disponible ? (
                          <a
                            href={`/api/prestamos/${prestamo.id}/garantia/${documento.tipo}/`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm font-semibold text-acento-700 underline dark:text-acento-300"
                          >
                            Visualizar PDF
                          </a>
                        ) : (
                          <span className="text-sm text-texto-suave">No disponible</span>
                        )}
                      </div>
                      {puedeEditarGarantia && (
                        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
                          <label className="grid gap-1 text-sm font-semibold text-texto">
                            Reemplazar archivo PDF
                            <input
                              key={`${documento.tipo}-${intento}`}
                              type="file"
                              accept="application/pdf,.pdf"
                              onChange={(evento) => setArchivos((actual) => ({
                                ...actual,
                                [documento.nombreArchivo]: evento.target.files?.[0] ?? null,
                              }))}
                              className="w-full rounded-lg border border-borde bg-white px-3 py-2 text-sm dark:bg-superficie"
                            />
                          </label>
                          <Boton
                            tipo="button"
                            icono={Upload}
                            cargando={accion === documento.tipo}
                            deshabilitado={!archivo || Boolean(accion)}
                            onClick={() => gestionarDocumento(documento)}
                          >
                            Reemplazar
                          </Boton>
                          {disponible && otroDisponible && (
                            <Boton
                              variante="peligro"
                              tipo="button"
                              icono={Trash2}
                              deshabilitado={Boolean(accion)}
                              onClick={() => gestionarDocumento(documento, true)}
                            >
                              Eliminar
                            </Boton>
                          )}
                        </div>
                      )}
                      {disponible && !otroDisponible && puedeEditarGarantia && (
                        <p className="mt-2 text-xs text-texto-suave">
                          No se puede eliminar: debe permanecer al menos un PDF de garantía.
                        </p>
                      )}
                      {errorArchivos[documento.nombreArchivo] && (
                        <ErrorAlerta mensaje={errorArchivos[documento.nombreArchivo]} className="mt-2" />
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {onDevolucion && (
            <Boton
              tipo="button"
              icono={RotateCcw}
              className="mt-4"
              onClick={onDevolucion}
            >
              Registrar devolución
            </Boton>
          )}
        </>
      )}
    </Tarjeta>
  )
}
