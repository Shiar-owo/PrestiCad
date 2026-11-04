import { useEffect, useState } from 'react'
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
  const esExcepcion = detalle?.es_excepcion ?? prestamo.es_excepcion
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
          <section className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-borde bg-white dark:bg-superficie">
              <thead className="bg-superficie/50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-texto-suave uppercase tracking-wider">
                    Campo
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-texto-suave uppercase tracking-wider">
                    Valor
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {detalle.prestatario_nombre && (
                  <tr className="hover:bg-superficie-alta/50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-texto-suave">Prestatario</td>
                    <td className="px-4 py-3 text-sm text-texto">
                      {detalle.prestatario_nombre} · DNI {detalle.prestatario_dni}
                    </td>
                  </tr>
                )}
                <tr className="hover:bg-superficie-alta/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-texto-suave">Fecha de entrega</td>
                  <td className="px-4 py-3 text-sm text-texto">{mostrarFecha(detalle.fecha_entrega)}</td>
                </tr>
                <tr className="hover:bg-superficie-alta/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-texto-suave">Fecha límite</td>
                  <td className="px-4 py-3 text-sm text-texto">{mostrarFecha(detalle.fecha_limite)}</td>
                </tr>
                <tr className="hover:bg-superficie-alta/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-texto-suave">Duración</td>
                  <td className="px-4 py-3 text-sm text-texto">
                    {detalle.tiempo_prestamo_minutos
                      ? formatearDuracionMinutos(detalle.tiempo_prestamo_minutos)
                      : `${detalle.tiempo_prestamo_dias} días`}
                  </td>
                </tr>
                <tr className="hover:bg-superficie-alta/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-texto-suave">Estado</td>
                  <td className="px-4 py-3 text-sm">
                    <BadgeEstado estado={estado} texto={textoEstadoPrestamo({ es_excepcion: esExcepcion }, estado)} />
                  </td>
                </tr>
                {esExcepcion && (
                  <tr className="hover:bg-superficie-alta/50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-texto-suave">Tipo de préstamo</td>
                    <td className="px-4 py-3 text-sm text-texto">Excepción académica</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          <section className="mt-6 overflow-x-auto">
            <table className="min-w-full divide-y divide-borde bg-white dark:bg-superficie">
              <thead className="bg-superficie/50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-texto-suave uppercase tracking-wider">
                    Campo
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-texto-suave uppercase tracking-wider">
                    Valor
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                <tr className="hover:bg-superficie-alta/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-texto-suave">Material</td>
                  <td className="px-4 py-3 text-sm text-texto">
                    {material?.nombre || prestamo.material_nombre}
                  </td>
                </tr>
                <tr className="hover:bg-superficie-alta/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-texto-suave">Código de Material</td>
                  <td className="px-4 py-3 text-sm text-texto-suave font-mono">
                    {material?.codigo_material || material?.codigo_inventario || prestamo.material_codigo}
                  </td>
                </tr>
                <tr className="hover:bg-superficie-alta/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-texto-suave">Descripción</td>
                  <td className="px-4 py-3 text-sm text-texto">{material?.descripcion || 'Sin descripción'}</td>
                </tr>
                <tr className="hover:bg-superficie-alta/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-texto-suave">Tipo</td>
                  <td className="px-4 py-3 text-sm text-texto">{material?.tipo || 'No especificado'}</td>
                </tr>
                <tr className="hover:bg-superficie-alta/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-texto-suave">Marca y modelo</td>
                  <td className="px-4 py-3 text-sm text-texto">
                    {[material?.marca, material?.modelo].filter(Boolean).join(' · ') || 'No especificados'}
                  </td>
                </tr>
                <tr className="hover:bg-superficie-alta/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-texto-suave">Número de serie general</td>
                  <td className="px-4 py-3 text-sm text-texto">{material?.numero_serie || 'No registrado'}</td>
                </tr>
                <tr className="hover:bg-superficie-alta/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-texto-suave">Color general</td>
                  <td className="px-4 py-3 text-sm text-texto">{material?.color || 'No registrado'}</td>
                </tr>
                <tr className="hover:bg-superficie-alta/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-texto-suave">Estado</td>
                  <td className="px-4 py-3 text-sm text-texto">
                    {ETIQUETAS_ESTADO[material?.estado] || material?.estado || 'No registrado'}
                  </td>
                </tr>
                <tr className="hover:bg-superficie-alta/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-texto-suave">Alto valor</td>
                  <td className="px-4 py-3 text-sm text-texto">
                    {esMaterialAltoValor(material) ? 'Sí' : 'No'}
                  </td>
                </tr>
                <tr className="hover:bg-superficie-alta/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-texto-suave">Tier mínimo</td>
                  <td className="px-4 py-3 text-sm text-texto">{material?.tier_minimo_requerido}</td>
                </tr>
                {material?.tiempo_maximo_prestamo && (
                  <tr className="hover:bg-superficie-alta/50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-texto-suave">Tiempo máximo del material</td>
                    <td className="px-4 py-3 text-sm text-texto">
                      {formatearDuracionMinutos(material.tiempo_maximo_prestamo)}
                    </td>
                  </tr>
                )}
                <tr className="hover:bg-superficie-alta/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-texto-suave">Bonificación por entrega a tiempo</td>
                  <td className="px-4 py-3 text-sm text-texto">{material?.bonificacion_tiempo} puntos</td>
                </tr>
                <tr className="hover:bg-superficie-alta/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-texto-suave">Deducción por tardanza</td>
                  <td className="px-4 py-3 text-sm text-texto">{material?.deduccion_tardanza} puntos por día</td>
                </tr>
                <tr className="hover:bg-superficie-alta/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-texto-suave">Deducción por daño parcial</td>
                  <td className="px-4 py-3 text-sm text-texto">{material?.deduccion_dano_parcial} puntos</td>
                </tr>
                <tr className="hover:bg-superficie-alta/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-texto-suave">Deducción por daño total</td>
                  <td className="px-4 py-3 text-sm text-texto">{material?.deduccion_dano_total} puntos</td>
                </tr>
                <tr className="hover:bg-superficie-alta/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-texto-suave">Costos reparación / reposición</td>
                  <td className="px-4 py-3 text-sm text-texto">
                    {material?.costo_reparacion ?? 'No definido'} / {material?.costo_reposicion ?? 'No definido'}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="mt-6 overflow-x-auto">
            <table className="min-w-full divide-y divide-borde bg-white dark:bg-superficie">
              <thead className="bg-superficie/50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-texto-suave uppercase tracking-wider">
                    Campo
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-texto-suave uppercase tracking-wider">
                    Valor
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {instancia ? (
                  <>
                    <tr className="hover:bg-superficie-alta/50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-texto-suave">Código de Ejemplar</td>
                      <td className="px-4 py-3 text-sm text-texto font-mono">{instancia.codigo_ejemplar}</td>
                    </tr>
                    <tr className="hover:bg-superficie-alta/50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-texto-suave">Estado del ejemplar</td>
                      <td className="px-4 py-3 text-sm text-texto">{instancia.estado_display || instancia.estado}</td>
                    </tr>
                    <tr className="hover:bg-superficie-alta/50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-texto-suave">Número de serie</td>
                      <td className="px-4 py-3 text-sm text-texto">{instancia.numero_serie || 'No registrado'}</td>
                    </tr>
                    <tr className="hover:bg-superficie-alta/50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-texto-suave">Color</td>
                      <td className="px-4 py-3 text-sm text-texto">{instancia.color || 'No registrado'}</td>
                    </tr>
                    <tr className="hover:bg-superficie-alta/50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-texto-suave">Observaciones del ejemplar</td>
                      <td className="px-4 py-3 text-sm text-texto">{instancia.observaciones || 'Sin observaciones'}</td>
                    </tr>
                    <tr className="hover:bg-superficie-alta/50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-texto-suave">Ubicación</td>
                      <td className="px-4 py-3 text-sm text-texto">{instancia.ubicacion || 'No registrada'}</td>
                    </tr>
                  </>
                ) : (
                  <tr className="hover:bg-superficie-alta/50 transition-colors">
                    <td className="px-4 py-3 text-sm text-texto-suave" colSpan={2}>
                      Este préstamo no tiene una instancia individual asociada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
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
                      <p className="mt-1 text-sm text-texto-suave">Observación del checklist: {elemento.observacion}</p>
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
            {!esExcepcion && !esMaterialAltoValor(material) ? (
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
