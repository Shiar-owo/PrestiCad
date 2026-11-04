import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, RotateCcw, Trash2, Upload } from 'lucide-react'

import { api, ErrorApi } from '../../api/client'
import { ETIQUETAS_ESTADO, esMaterialAltoValor } from '../../constantes/catalogo'
import { formatearDuracionMinutos } from '../../constantes/checklistPrestamo'
import { textoEstadoPrestamo } from '../../prestamos/estadoPrestamo'
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
  const fileInputRef = useRef({})

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
  const esExcepcion = detalle?.es_excepcion ?? prestamo.es_excepcion
  const material = detalle?.material
  const instancia = detalle?.instancia
  const documentos = detalle?.documentos_garantia
  const totalDocumentos = DOCUMENTOS_GARANTIA.filter((documento) => (
    documentos?.[documento.campo]
  )).length

  return (
    <Tarjeta className="max-w-[1700px] mx-auto p-0" aria-labelledby="prestamo-detalle-titulo">
      <header className="bg-superficie/50 border-b border-borde p-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
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
            <nav className="mt-0 flex flex-wrap gap-1" aria-label="Navegar entre préstamos">
              <Boton
                variante="secundario"
                tamanio="pequeno"
                tipo="button"
                icono={ChevronLeft}
                deshabilitado={!hayAnterior}
                onClick={onAnterior}
              >
                Anterior
              </Boton>
              <Boton
                variante="secundario"
                tamanio="pequeno"
                tipo="button"
                icono={ChevronRight}
                deshabilitado={!haySiguiente}
                onClick={onSiguiente}
              >
                Siguiente
              </Boton>
            </nav>
          )}
        </div>
        <div className="flex items-end gap-2">
          <h3 id="prestamo-detalle-titulo" className="text-base font-bold text-texto">
            Detalle del préstamo
          </h3>
          <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-acento-100 text-acento-800 dark:bg-acento-200 dark:text-acento-900">
            #{prestamo.id}
          </span>
        </div>
      </header>

      {cargando && (
        <div className="p-3 grid gap-2 sm:grid-cols-2" role="status" aria-live="polite">
          <Skeleton className="h-14 rounded-md" />
          <Skeleton className="h-14 rounded-md" />
          <p className="text-xs text-texto-suave">Cargando ficha e historial del ejemplar…</p>
        </div>
      )}
      {error && (
        <div className="p-3 grid gap-2">
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
        <div className="p-3 space-y-3">
          {/* Fila: Datos del préstamo */}
          <section className="rounded-xl border border-borde bg-white dark:bg-superficie p-3">
            <div className="flex items-center gap-1 mb-2">
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-marca-100 text-marca-800 dark:bg-marca-900/30 dark:text-marca-300 text-[11px] font-bold uppercase tracking-wider">
                Datos del préstamo
              </span>
            </div>
            <table className="w-full border-collapse">
              <tbody>
                <tr className="border-b border-borde/50 last:border-0">
                  <td className="w-1/4 p-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-texto-suave block mb-0.5">
                      Prestatario
                    </span>
                    <span className="text-lg font-bold text-texto break-words">
                      {detalle.prestatario_nombre} · DNI {detalle.prestatario_dni}
                    </span>
                  </td>
                  <td className="w-1/4 p-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-texto-suave block mb-0.5">
                      Fecha entrega
                    </span>
                    <span className="text-lg font-bold text-texto">{mostrarFecha(detalle.fecha_entrega)}</span>
                  </td>
                  <td className="w-1/4 p-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-texto-suave block mb-0.5">
                      Fecha límite
                    </span>
                    <span className="text-lg font-bold text-texto">{mostrarFecha(detalle.fecha_limite)}</span>
                  </td>
                  <td className="w-1/4 p-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-texto-suave block mb-0.5">
                      Duración
                    </span>
                    <span className="text-lg font-bold text-texto">
                      {detalle.tiempo_prestamo_minutos
                        ? formatearDuracionMinutos(detalle.tiempo_prestamo_minutos)
                        : detalle.tiempo_prestamo_dias + ' días'}
                    </span>
                  </td>
                </tr>
                <tr className="border-b border-borde/50 last:border-0">
                  <td className="w-1/4 p-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-texto-suave block mb-0.5">
                      Estado
                    </span>
                    <span className="text-base">
                      <BadgeEstado estado={estado} texto={textoEstadoPrestamo({ es_excepcion: esExcepcion }, estado)} className="text-[11px]" />
                    </span>
                  </td>
                  {esExcepcion && (
                    <td className="w-1/4 p-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-texto-suave block mb-0.5">
                        Tipo
                      </span>
                      <span className="text-lg font-bold text-texto">Excepción académica</span>
                    </td>
                  )}
                  <td className="w-1/4 p-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-texto-suave block mb-0.5">
                      Registrado por
                    </span>
                    <span className="text-lg font-bold text-texto">{detalle.prestatario_nombre}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* Dos columnas: Material e Instancia con tamaño uniforme */}
          <div className="grid gap-3 lg:grid-cols-2">
            {/* Columna izquierda: Ficha del material */}
            <section className="rounded-xl border border-borde bg-white dark:bg-superficie p-3">
              <div className="flex items-center gap-1 mb-2">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-marca-100 text-marca-800 dark:bg-marca-900/30 dark:text-marca-300 text-[11px] font-bold uppercase tracking-wider">
                  Ficha del material
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {material?.foto && (
                  <div className="flex justify-center">
                    <div className="h-36 w-36 rounded-lg border border-borde overflow-hidden shadow-sm max-w-[300px]">
                      <img
                        src={material.foto}
                        alt={`Foto de ${material.nombre}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                )}
                <table className="w-full border-collapse text-left">
                  <tbody>
                    <tr className="border-b border-borde/50 last:border-0">
                      <td className="w-1/3 p-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-texto-suave block mb-0.5">
                          Material
                        </span>
                        <span className="text-base font-bold text-texto break-words">
                          {material?.nombre || prestamo.material_nombre}
                        </span>
                      </td>
                      <td className="w-2/3 p-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-texto-suave block mb-0.5">
                          Código Material
                        </span>
                        <span className="text-base font-bold text-texto-suave font-mono break-words">
                          {material?.codigo_material || material?.codigo_inventario || prestamo.material_codigo}
                        </span>
                      </td>
                    </tr>
                    <tr className="border-b border-borde/50 last:border-0">
                      <td className="w-1/3 p-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-texto-suave block mb-0.5">
                          Tipo
                        </span>
                        <span className="text-base font-bold text-texto">{material?.tipo || 'No especificado'}</span>
                      </td>
                      <td className="w-2/3 p-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-texto-suave block mb-0.5">
                          Marca y modelo
                        </span>
                        <span className="text-base font-bold text-texto">
                          {[material?.marca, material?.modelo].filter(Boolean).join(' · ') || 'No especificados'}
                        </span>
                      </td>
                    </tr>
                    <tr className="border-b border-borde/50 last:border-0">
                      <td className="w-1/3 p-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-texto-suave block mb-0.5">
                          Serie
                        </span>
                        <span className="text-base font-semibold text-texto">{material?.numero_serie || 'No registrado'}</span>
                      </td>
                      <td className="w-2/3 p-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-texto-suave block mb-0.5">
                          Color
                        </span>
                        <span className="text-base font-semibold text-texto">{material?.color || 'No registrado'}</span>
                      </td>
                    </tr>
                    <tr className="border-b border-borde/50 last:border-0">
                      <td className="w-1/3 p-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-texto-suave block mb-0.5">
                          Estado
                        </span>
                        <span className="text-sm">
                          <BadgeEstado estado={instancia.estado_display || instancia.estado} texto={instancia.estado_display || instancia.estado} className="text-[10px]" />
                        </span>
                      </td>
                      <td className="w-2/3 p-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-texto-suave block mb-0.5">
                          Número de serie
                        </span>
                        <span className="text-base font-bold text-texto">
                          {instancia.numero_serie || 'No registrado'}
                        </span>
                      </td>
                    </tr>
                    <tr className="border-b border-borde/50 last:border-0">
                      <td className="w-1/3 p-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-texto-suave block mb-0.5">
                          Tier mínimo
                        </span>
                        <span className="text-base font-semibold text-texto">{material?.tier_minimo_requerido}</span>
                      </td>
                      <td className="w-2/3 p-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-texto-suave block mb-0.5">
                          Tiempo máximo
                        </span>
                        <span className="text-base font-semibold text-texto">
                          {material?.tiempo_maximo_prestamo ? formatearDuracionMinutos(material.tiempo_maximo_prestamo) : 'No definido'}
                        </span>
                      </td>
                    </tr>
                    <tr className="border-b border-borde/50 last:border-0">
                      <td className="w-1/3 p-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-texto-suave block mb-0.5">
                          Bonificación
                        </span>
                        <span className="text-base font-semibold text-texto">{material?.bonificacion_tiempo} pts</span>
                      </td>
                      <td className="w-2/3 p-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-texto-suave block mb-0.5">
                          Deducción tardanza
                        </span>
                        <span className="text-base font-semibold text-texto">{material?.deduccion_tardanza} pts/día</span>
                      </td>
                    </tr>
                    <tr className="border-b border-borde/50 last:border-0">
                      <td className="w-1/3 p-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-texto-suave block mb-0.5">
                          Daño parcial
                        </span>
                        <span className="text-base font-semibold text-texto">{material?.deduccion_dano_parcial} pts</span>
                      </td>
                      <td className="w-2/3 p-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-texto-suave block mb-0.5">
                          Daño total
                        </span>
                        <span className="text-base font-semibold text-texto">{material?.deduccion_dano_total} pts</span>
                      </td>
                    </tr>
                    <tr className="border-b border-borde/50 last:border-0">
                      <td className="w-1/3 p-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-texto-suave block mb-0.5">
                          Costos rep./repos.
                        </span>
                        <span className="text-base font-semibold text-texto">
                          {material?.costo_reparacion ?? 'No definido'} / {material?.costo_reposicion ?? 'No definido'}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* Columna derecha: Ejemplar entregado */}
            <section className="rounded-xl border border-borde bg-white dark:bg-superficie p-3">
              <div className="flex items-center gap-1 mb-2">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-marca-100 text-marca-800 dark:bg-marca-900/30 dark:text-marca-300 text-[11px] font-bold uppercase tracking-wider">
                  Ejemplar entregado
                </span>
              </div>
              <div className="flex flex-col gap-2 items-center">
                {instancia ? (
                  <>
                      <div className="flex items-center gap-3">
                      {instancia.foto && (
                        <div className="h-36 w-36 rounded-lg border border-borde overflow-hidden shadow-sm max-w-[300px]">
                          <img
                            src={instancia.foto}
                            alt={`Foto de ${instancia.codigo_ejemplar}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                    </div>
                    <table className="w-full border-collapse text-left">
                      <tbody>
                        <tr className="border-b border-borde/50 last:border-0">
                          <td className="w-1/3 p-1">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-texto-suave block mb-0.5">
                              Código de Ejemplar
                            </span>
                            <span className="text-base font-bold text-texto-suave font-mono break-words">
                              {instancia.codigo_ejemplar}
                            </span>
                          </td>
                          <td className="w-2/3 p-1">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-texto-suave block mb-0.5">
                              Estado
                            </span>
                            <span className="text-sm">
                              <BadgeEstado estado={instancia.estado_display || instancia.estado} texto={instancia.estado_display || instancia.estado} className="text-[10px]" />
                            </span>
                          </td>
                        </tr>
                        <tr className="border-b border-borde/50 last:border-0">
                          <td className="w-1/3 p-1">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-texto-suave block mb-0.5">
                              Color
                            </span>
                            <span className="text-base font-semibold text-texto">{instancia.color || 'No registrado'}</span>
                          </td>
                          <td className="w-2/3 p-1">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-texto-suave block mb-0.5">
                              Ubicación
                            </span>
                            <span className="text-base font-semibold text-texto">{instancia.ubicacion || 'No registrada'}</span>
                          </td>
                        </tr>
                        <tr className="border-b border-borde/50 last:border-0">
                          <td className="w-1/3 p-1">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-texto-suave block mb-0.5">
                              Observaciones
                            </span>
                            <span className="text-sm text-texto-suave">
                              {instancia.observaciones || 'Sin observaciones'}
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </>
                ) : (
                  <div className="rounded border border-borde bg-amarillo-50 dark:bg-amarillo-900/10 p-3 text-center">
                    <p className="text-xs text-amarillo-700 dark:text-amarillo-300">
                      Este préstamo no tiene una instancia individual asociada.
                    </p>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Checklist al entregar - mismo estilo que el resto */}
          <section className="rounded-xl border border-borde bg-white dark:bg-superficie p-3">
            <div className="flex items-center gap-1 mb-2">
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-marca-100 text-marca-800 dark:bg-marca-900/30 dark:text-marca-300 text-[11px] font-bold uppercase tracking-wider">
                Checklist al entregar
              </span>
            </div>
            {detalle.checklist_inicial?.length ? (
              <div className="space-y-1.5">
                {detalle.checklist_inicial.map((elemento, indice) => (
                  <div key={`${elemento.elemento}-${indice}`} className="rounded border border-borde bg-superficie p-2">
                    <div className="flex items-start gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-texto-suave shrink-0">
                        {elemento.elemento}
                      </span>
                    </div>
                    {elemento.foto_url && (
                      <figure className="mt-1 aspect-[4/3] w-full max-w-xs overflow-hidden rounded border border-borde bg-white dark:bg-superficie">
                        <img
                          src={elemento.foto_url}
                          alt={`Foto de ${elemento.elemento}`}
                          className="h-full w-full object-contain"
                        />
                      </figure>
                    )}
                    {elemento.observacion && (
                      <div className="mt-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-texto-suave block mb-0.5">
                          Observación
                        </span>
                        <span className="text-sm text-texto-suave">{elemento.observacion}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs text-texto-suave">No se registró checklist inicial.</p>
            )}
          </section>

          {/* Documentos de garantía */}
          <section className="rounded-xl border border-borde bg-white dark:bg-superficie p-3">
            <div className="flex items-center gap-1 mb-2">
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-marca-100 text-marca-800 dark:bg-marca-900/30 dark:text-marca-300 text-[11px] font-bold uppercase tracking-wider">
                Documentos de garantía
              </span>
            </div>
            {!esExcepcion && !esMaterialAltoValor(material) ? (
              <p className="mt-2 text-xs text-texto-suave">
                Este material no requiere documentos de garantía.
              </p>
            ) : (
              <ul className="mt-2 grid gap-1.5">
                {DOCUMENTOS_GARANTIA.map((documento) => {
                  const disponible = Boolean(documentos?.[documento.campo])
                  const otroDisponible = totalDocumentos > Number(disponible)
                  const archivo = archivos[documento.nombreArchivo]

                  return (
                    <li key={documento.tipo} className="rounded border border-borde bg-white p-2 dark:bg-superficie">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1">
                          <p className="text-base font-semibold text-texto">{documento.etiqueta}</p>
                          {disponible ? (
                            <a
                              href={`/api/prestamos/${prestamo.id}/garantia/${documento.tipo}/`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-base font-semibold text-acento-700 underline dark:text-acento-300"
                            >
                              Visualizar PDF
                            </a>
                          ) : (
                            <span className="text-sm text-texto-suave">No disponible</span>
                          )}
                        </div>
                        {puedeEditarGarantia && (
                          <div className="flex gap-0.5">
                            <label className="cursor-pointer">
                              <input
                                key={`${documento.tipo}-${intento}`}
                                type="file"
                                accept="application/pdf,.pdf"
                                className="sr-only"
                                ref={el => (fileInputRef[documento.tipo] = el)}
                                onChange={(evento) => {
                                  setArchivos((actual) => ({
                                    ...actual,
                                    [documento.nombreArchivo]: evento.target.files?.[0] ?? null,
                                  }))
                                  gestionarDocumento(documento)
                                }}
                              />
                            </label>
                            <Boton
                              tipo="button"
                              variant="secundario"
                              tamanio="pequeno"
                              icono={Upload}
                              cargando={accion === documento.tipo}
                              deshabilitado={Boolean(accion)}
                              onClick={() => fileInputRef[documento.tipo]?.click()}
                            >
                              Reemplazar
                            </Boton>
                            {disponible && otroDisponible && (
                              <Boton
                                tipo="button"
                                variant="peligro"
                                tamanio="pequeno"
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
                          <p className="text-sm text-texto-suave">
                            No se puede eliminar: debe quedar al menos un PDF.
                          </p>
                        )}
                        {errorArchivos[documento.nombreArchivo] && (
                          <ErrorAlerta mensaje={errorArchivos[documento.nombreArchivo]} className="mt-0.5" />
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {onDevolucion && (
            <div className="mt-3 flex justify-end">
              <Boton
                tipo="button"
                icono={RotateCcw}
                className="mt-0"
                onClick={onDevolucion}
              >
                Registrar devolución
              </Boton>
            </div>
          )}
        </div>
      )}
    </Tarjeta>
  )
}
