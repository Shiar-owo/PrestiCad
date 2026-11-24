import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import { api } from '../api/client'
import useTituloPagina from '../hooks/useTituloPagina'
import Boton from '../components/ui/Boton'
import Campo from '../components/ui/Campo'
import Skeleton from '../components/ui/Skeleton'
import ErrorAlerta from '../components/ui/ErrorAlerta'
import EstadoVacio from '../components/ui/EstadoVacio'
import BadgeEstado from '../components/ui/BadgeEstado'

const TAMANO_PAGINA = 25
const CONSULTA_INICIAL = { cargando: true, error: '', datos: null }
const ETIQUETAS_RESULTADO = {
  a_tiempo: 'A tiempo',
  tardio: 'Tardío',
  danado: 'Dañado',
  pendiente: 'Pendiente',
}
const ESTADOS_RESULTADO = {
  a_tiempo: 'disponible',
  tardio: 'vencido',
  danado: 'en_mantenimiento',
  pendiente: 'activo',
}

function fechaLegible(valor) {
  if (!valor) return '—'
  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(valor))
}

function porcentajeLegible(valor) {
  return `${Number(valor || 0).toLocaleString('es-PE', { maximumFractionDigits: 2 })}%`
}

export default function HistorialMaterial() {
  useTituloPagina('Historial de préstamos por material')
  const { materialId } = useParams()
  const navigate = useNavigate()
  const [material, setMaterial] = useState(null)
  const [cargandoMaterial, setCargandoMaterial] = useState(true)
  const [errorMaterial, setErrorMaterial] = useState('')
  const [instanciaSeleccionada, setInstanciaSeleccionada] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [pagina, setPagina] = useState(1)
  const [intento, setIntento] = useState(0)
  const [consulta, setConsulta] = useState(CONSULTA_INICIAL)

  const rangoInvalido = Boolean(fechaDesde && fechaHasta && fechaDesde > fechaHasta)

  useEffect(() => {
    let activa = true
    setCargandoMaterial(true)
    setErrorMaterial('')
    setInstanciaSeleccionada('')

    api.get(`/materiales/${materialId}/`)
      .then((datos) => {
        if (activa) {
          setMaterial(datos)
          setCargandoMaterial(false)
        }
      })
      .catch(() => {
        if (activa) {
          setMaterial(null)
          setErrorMaterial('No se pudo cargar la lista de ejemplares del material.')
          setCargandoMaterial(false)
        }
      })

    return () => {
      activa = false
    }
  }, [materialId])

  useEffect(() => {
    let activa = true

    if (!instanciaSeleccionada) {
      setConsulta({ cargando: false, error: '', datos: null })
      return undefined
    }

    if (rangoInvalido) {
      setConsulta({
        cargando: false,
        error: 'La fecha inicial no puede ser posterior a la fecha final.',
        datos: null,
      })
      return undefined
    }

    const parametros = new URLSearchParams({ page: String(pagina), page_size: String(TAMANO_PAGINA) })
    parametros.set('instancia_id', instanciaSeleccionada)
    if (fechaDesde) parametros.set('desde', fechaDesde)
    if (fechaHasta) parametros.set('hasta', fechaHasta)

    setConsulta({ cargando: true, error: '', datos: null })
    api.get(`/materiales/${materialId}/historial/?${parametros.toString()}`)
      .then((datos) => {
        if (!Array.isArray(datos.results) || !datos.resumen) {
          throw new Error('Respuesta de historial inválida')
        }
        if (activa) setConsulta({ cargando: false, error: '', datos })
      })
      .catch((fallo) => {
        if (activa) {
          setConsulta({
            cargando: false,
            error: fallo.datos?.detail || 'No fue posible consultar el historial. Intenta nuevamente.',
            datos: null,
          })
        }
      })

    return () => {
      activa = false
    }
  }, [materialId, instanciaSeleccionada, fechaDesde, fechaHasta, pagina, intento, rangoInvalido])

  function cambiarFecha(setFecha, valor) {
    setFecha(valor)
    setPagina(1)
  }

  function limpiarFiltros() {
    setFechaDesde('')
    setFechaHasta('')
    setPagina(1)
  }

  if (cargandoMaterial || consulta.cargando) {
    return (
      <section aria-label="Historial de préstamos del material" className="space-y-4" role="status" aria-live="polite">
        <p className="text-sm text-texto-suave">Cargando historial de préstamos…</p>
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </section>
    )
  }

  const datos = consulta.datos
  const resumen = datos?.resumen
  const resultados = datos?.results || []
  const totalPaginas = Math.max(1, Math.ceil((datos?.count || 0) / TAMANO_PAGINA))
  const tieneFiltros = Boolean(fechaDesde || fechaHasta)

  return (
    <section aria-label="Historial de préstamos del material">
      <header className="mb-5">
        <Boton
          variante="secundario"
          tamanio="pequeno"
          tipo="button"
          className="mb-4"
          onClick={() => navigate('/panel/inventario')}
        >
          Volver al inventario
        </Boton>
        <h2 className="text-xl font-bold text-texto">Historial de préstamos</h2>
        <p className="mt-1 text-sm text-texto-suave">
          {material
            ? <>{material.nombre} · Código: {material.codigo_material || material.codigo_inventario}</>
            : `Material ${materialId}`}
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo
          etiqueta="Ejemplar"
          opciones={[
            {
              valor: '',
              etiqueta: material?.instancias?.length
                ? 'Selecciona un ejemplar'
                : 'No hay ejemplares registrados',
            },
            ...(material?.instancias || []).map((instancia) => ({
              valor: instancia.id,
              etiqueta: [instancia.codigo_ejemplar, instancia.numero_serie]
                .filter(Boolean)
                .join(' · '),
            })),
          ]}
          valor={instanciaSeleccionada}
          deshabilitado={!material?.instancias?.length}
          onCambio={(evento) => {
            const nuevaInstancia = evento.target.value
            setInstanciaSeleccionada(nuevaInstancia)
            setConsulta({ cargando: Boolean(nuevaInstancia), error: '', datos: null })
            setPagina(1)
          }}
        />
        {instanciaSeleccionada && (
          <>
            <Campo
              etiqueta="Entregado desde"
              tipo="date"
              valor={fechaDesde}
              onCambio={(evento) => cambiarFecha(setFechaDesde, evento.target.value)}
            />
            <Campo
              etiqueta="Entregado hasta"
              tipo="date"
              valor={fechaHasta}
              onCambio={(evento) => cambiarFecha(setFechaHasta, evento.target.value)}
            />
          </>
        )}
      </div>
      {instanciaSeleccionada && tieneFiltros && (
        <Boton
          variante="fantasma"
          tamanio="pequeno"
          tipo="button"
          className="mt-2"
          onClick={limpiarFiltros}
        >
          Limpiar período
        </Boton>
      )}

      {errorMaterial ? (
        <div className="mt-5">
          <ErrorAlerta mensaje={errorMaterial} />
        </div>
      ) : !instanciaSeleccionada ? (
        <div className="mt-5">
          <EstadoVacio
            titulo={material?.instancias?.length ? 'Selecciona un ejemplar' : 'Sin ejemplares individuales'}
            mensaje={material?.instancias?.length
              ? 'El historial y sus estadísticas se mostrarán después de elegir un ejemplar.'
              : 'Este material no tiene ejemplares individuales registrados para consultar su historial.'}
          />
        </div>
      ) : consulta.error ? (
        <div className="mt-5 grid gap-3">
          <ErrorAlerta mensaje={consulta.error} />
          {!rangoInvalido && (
            <Boton
              variante="secundario"
              tipo="button"
              className="w-fit"
              onClick={() => setIntento((actual) => actual + 1)}
            >
              Reintentar
            </Boton>
          )}
        </div>
      ) : (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Resumen etiqueta="Préstamos" valor={resumen.total_prestamos} />
            <Resumen etiqueta="Devoluciones" valor={resumen.total_devoluciones} />
            <Resumen etiqueta="Devueltos a tiempo" valor={porcentajeLegible(resumen.porcentaje_a_tiempo)} />
            <Resumen etiqueta="Devueltos tarde" valor={porcentajeLegible(resumen.porcentaje_tardias)} />
          </div>

          {resultados.length === 0 ? (
            <div className="mt-6">
              <EstadoVacio
                titulo={tieneFiltros ? 'Sin préstamos en este período' : 'Aún no hay préstamos para este material'}
                mensaje={tieneFiltros
                  ? 'Cambia o limpia las fechas para consultar otro período.'
                  : 'El historial aparecerá aquí cuando se registren préstamos.'}
              />
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto rounded-xl border border-borde bg-white dark:bg-superficie">
              <table className="w-full min-w-[760px] text-sm">
                <caption className="sr-only">Préstamos registrados para este material</caption>
                <thead>
                  <tr className="border-b border-borde text-left text-xs font-semibold uppercase tracking-wide text-texto-suave">
                    <th scope="col" className="px-4 py-3">Prestatario</th>
                    <th scope="col" className="px-4 py-3">Entrega</th>
                    <th scope="col" className="px-4 py-3">Fecha límite</th>
                    <th scope="col" className="px-4 py-3">Devolución</th>
                    <th scope="col" className="px-4 py-3">Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {resultados.map((prestamo) => (
                    <tr key={prestamo.id} className="border-b border-borde last:border-b-0 text-texto">
                      <td className="px-4 py-3 font-medium">{prestamo.prestatario}</td>
                      <td className="whitespace-nowrap px-4 py-3">{fechaLegible(prestamo.fecha_entrega)}</td>
                      <td className="whitespace-nowrap px-4 py-3">{fechaLegible(prestamo.fecha_limite)}</td>
                      <td className="whitespace-nowrap px-4 py-3">{fechaLegible(prestamo.fecha_devolucion)}</td>
                      <td className="px-4 py-3">
                        <BadgeEstado
                          estado={ESTADOS_RESULTADO[prestamo.resultado] || 'desconocido'}
                          texto={ETIQUETAS_RESULTADO[prestamo.resultado] || prestamo.resultado}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {datos.count > 0 && (
            <nav className="mt-6 flex flex-wrap items-center justify-center gap-3" aria-label="Páginas del historial del material">
              <Boton
                variante="secundario"
                tipo="button"
                deshabilitado={!datos.previous}
                onClick={() => setPagina((actual) => actual - 1)}
              >
                Anterior
              </Boton>
              <span className="text-sm text-texto-suave" aria-live="polite">
                Página {pagina} de {totalPaginas} · {datos.count} préstamos
              </span>
              <Boton
                variante="secundario"
                tipo="button"
                deshabilitado={!datos.next}
                onClick={() => setPagina((actual) => actual + 1)}
              >
                Siguiente
              </Boton>
            </nav>
          )}
        </>
      )}
    </section>
  )
}

function Resumen({ etiqueta, valor }) {
  return (
    <div className="rounded-xl border border-borde bg-white p-4 dark:bg-superficie">
      <p className="text-sm text-texto-suave">{etiqueta}</p>
      <p className="mt-1 text-2xl font-bold text-texto">{valor}</p>
    </div>
  )
}
