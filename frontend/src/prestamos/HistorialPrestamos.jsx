import { useContext, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'

import { api } from '../api/client'
import SesionContext from '../contextos/SesionContext'
import useTituloPagina from '../hooks/useTituloPagina'
import FiltroPrestamos from '../components/prestamos/FiltroPrestamos'
import SelectorPrestatario from '../components/prestamos/SelectorPrestatario'
import {
  construirRutaHistorial,
  iniciarCargaHistorial,
  TAMANO_PAGINA_HISTORIAL,
  validarRespuestaHistorial,
} from './historialPrestamos'
import ListaHistorialPrestamos from './ListaHistorialPrestamos'
import Boton from '../components/ui/Boton'
import Skeleton from '../components/ui/Skeleton'
import ErrorAlerta from '../components/ui/ErrorAlerta'
import EstadoVacio from '../components/ui/EstadoVacio'

const CONSULTA_INICIAL = { cargando: true, error: '', datos: null }

export default function HistorialPrestamos() {
  useTituloPagina('Historial de préstamos')
  const { usuario } = useContext(SesionContext)
  const navigate = useNavigate()
  const [estado, setEstado] = useState('todos')
  const [dniEntrada, setDniEntrada] = useState('')
  const [dniFiltro, setDniFiltro] = useState('')
  const [pagina, setPagina] = useState(1)
  const [intento, setIntento] = useState(0)
  const [consulta, setConsulta] = useState(CONSULTA_INICIAL)
  const [prestamoSeleccionado, setPrestamoSeleccionado] = useState(null)
  const navegacionPendiente = useRef('')

  useEffect(() => {
    let activa = true
    setConsulta(iniciarCargaHistorial)

    api.get(construirRutaHistorial({ estado, pagina, dni: dniFiltro }))
      .then(validarRespuestaHistorial)
      .then((datos) => {
        if (activa) {
          if (navegacionPendiente.current) {
            const indice = navegacionPendiente.current === 'anterior' ? datos.results.length - 1 : 0
            setPrestamoSeleccionado(datos.results[indice] || null)
            navegacionPendiente.current = ''
          }
          setConsulta({ cargando: false, error: '', datos })
        }
      })
      .catch(() => {
        if (activa) {
          const conservarDatos = Boolean(navegacionPendiente.current || prestamoSeleccionado)
          navegacionPendiente.current = ''
          setConsulta({
            cargando: false,
            error: 'No fue posible consultar el historial. Intenta nuevamente.',
            datos: conservarDatos ? consulta.datos : null,
          })
        }
      })

    return () => {
      activa = false
    }
  }, [estado, pagina, dniFiltro, intento])

  function cambiarEstado(nuevoEstado) {
    setPrestamoSeleccionado(null)
    navegacionPendiente.current = ''
    setEstado(nuevoEstado)
    setPagina(1)
  }

  function cambiarPaginaDesdeDetalle(direccion) {
    const hayPagina = direccion === 'anterior' ? consulta.datos.previous : consulta.datos.next
    if (!hayPagina) return

    navegacionPendiente.current = direccion
    setPagina((actual) => actual + (direccion === 'anterior' ? -1 : 1))
  }

  function cambiarPaginaDesdeLista(direccion) {
    setPrestamoSeleccionado(null)
    navegacionPendiente.current = ''
    setPagina((actual) => actual + (direccion === 'anterior' ? -1 : 1))
  }

  if (consulta.cargando && !consulta.datos && !prestamoSeleccionado) {
    return (
      <div className="space-y-3" role="status" aria-live="polite">
        <p className="text-sm text-texto-suave">Cargando historial de préstamos…</p>
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
    )
  }

  if (consulta.error && !prestamoSeleccionado) {
    return (
      <section aria-label="Historial de préstamos" className="grid gap-4">
        <div>
          <h2 className="text-xl font-bold text-texto">Historial de préstamos</h2>
          <p className="mt-1 text-sm text-texto-suave">
            Consulta y filtra el historial de préstamos del sistema.
          </p>
        </div>
        <ErrorAlerta mensaje={consulta.error} />
        <Boton variante="secundario" className="w-full sm:w-auto" onClick={() => setIntento((valor) => valor + 1)}>
          Reintentar
        </Boton>
      </section>
    )
  }

  const { count, next, previous, results } = consulta.datos
  const totalPaginas = Math.max(1, Math.ceil(count / TAMANO_PAGINA_HISTORIAL))

  return (
    <section aria-label="Historial de préstamos" aria-busy={consulta.cargando}>
      <header className="mb-5">
        <h2 className="text-xl font-bold text-texto">Historial de préstamos</h2>
        <p className="mt-1 text-sm text-texto-suave">
          Consulta y filtra el historial de préstamos del sistema.
        </p>
      </header>

      <div className="my-4 grid gap-4 sm:max-w-3xl sm:grid-cols-[15rem_minmax(0,24rem)] sm:items-start">
        <FiltroPrestamos estado={estado} onCambiar={cambiarEstado} />
        <div className="grid gap-3">
          <SelectorPrestatario
            valor={dniEntrada}
            etiqueta="Buscar historial por prestatario"
            ayuda="Escribe el DNI para elegir un prestatario y filtrar sus préstamos."
            onCambio={(valor) => {
              setPrestamoSeleccionado(null)
              navegacionPendiente.current = ''
              setDniEntrada(valor)
              setDniFiltro('')
              setPagina(1)
            }}
            onSeleccionar={(prestatario) => {
              setPrestamoSeleccionado(null)
              navegacionPendiente.current = ''
              setDniEntrada(prestatario.dni)
              setDniFiltro(prestatario.dni)
              setPagina(1)
            }}
          />
          {dniFiltro && (
            <Boton
              variante="secundario"
              tipo="button"
              className="w-fit"
              onClick={() => {
                setPrestamoSeleccionado(null)
                navegacionPendiente.current = ''
                setDniEntrada('')
                setDniFiltro('')
                setPagina(1)
              }}
            >
              Quitar filtro de prestatario
            </Boton>
          )}
        </div>
      </div>

      {consulta.cargando && consulta.datos && (
        <p className="mb-3 text-xs text-texto-suave" role="status" aria-live="polite">
          Actualizando el historial…
        </p>
      )}

      {results.length === 0 ? (
        <div className="mt-6">
          <EstadoVacio
            titulo={dniFiltro
              ? 'Sin préstamos para este prestatario'
              : estado === 'todos' ? 'Aún no hay préstamos registrados' : 'Sin préstamos con este estado'}
            mensaje={
              dniFiltro
                ? 'No se encontraron préstamos que coincidan con los filtros aplicados.'
                : estado === 'todos'
                ? 'Los préstamos del sistema aparecerán aquí al registrar una entrega.'
                : 'Prueba con otro filtro de estado.'
            }
          />
        </div>
      ) : (
        <ListaHistorialPrestamos
          prestamos={results}
          seleccionado={prestamoSeleccionado}
          onSeleccionar={setPrestamoSeleccionado}
          onAnteriorPagina={() => cambiarPaginaDesdeDetalle('anterior')}
          onSiguientePagina={() => cambiarPaginaDesdeDetalle('siguiente')}
          hayPaginaAnterior={Boolean(previous)}
          hayPaginaSiguiente={Boolean(next)}
          puedeEditarGarantia={usuario?.rol === 'gestor'}
          onDevolucion={
            usuario?.rol === 'gestor'
              ? (prestamoId) => navigate(`/panel/devolucion/${prestamoId}`)
              : null
          }
        />
      )}

      {consulta.error && prestamoSeleccionado && (
        <div className="mt-4 grid gap-3">
          <ErrorAlerta mensaje={consulta.error} />
          <Boton variante="secundario" tipo="button" className="w-fit" onClick={() => setIntento((valor) => valor + 1)}>
            Reintentar
          </Boton>
        </div>
      )}

      {count > 0 && !prestamoSeleccionado && (
        <nav className="mt-6 flex flex-wrap items-center justify-center gap-3" aria-label="Páginas del historial">
          <Boton
            variante="secundario"
            tipo="button"
            deshabilitado={!previous}
            onClick={() => cambiarPaginaDesdeLista('anterior')}
          >
            Anterior
          </Boton>
          <span className="text-sm text-texto-suave" aria-live="polite">
            Página {pagina} de {totalPaginas} · {count} préstamos
          </span>
          <Boton
            variante="secundario"
            tipo="button"
            deshabilitado={!next}
            onClick={() => cambiarPaginaDesdeLista('siguiente')}
          >
            Siguiente
          </Boton>
        </nav>
      )}
    </section>
  )
}
