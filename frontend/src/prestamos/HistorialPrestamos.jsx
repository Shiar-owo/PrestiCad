import { useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'

import { api } from '../api/client'
import SesionContext from '../contextos/SesionContext'
import useTituloPagina from '../hooks/useTituloPagina'
import FiltroPrestamos from '../components/prestamos/FiltroPrestamos'
import {
  construirRutaHistorial,
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
  const [pagina, setPagina] = useState(1)
  const [intento, setIntento] = useState(0)
  const [consulta, setConsulta] = useState(CONSULTA_INICIAL)

  useEffect(() => {
    let activa = true
    setConsulta({ cargando: true, error: '', datos: null })

    api.get(construirRutaHistorial({ estado, pagina }))
      .then(validarRespuestaHistorial)
      .then((datos) => {
        if (activa) setConsulta({ cargando: false, error: '', datos })
      })
      .catch(() => {
        if (activa) {
          setConsulta({
            cargando: false,
            error: 'No fue posible consultar el historial. Intenta nuevamente.',
            datos: null,
          })
        }
      })

    return () => {
      activa = false
    }
  }, [estado, pagina, intento])

  function cambiarEstado(nuevoEstado) {
    setEstado(nuevoEstado)
    setPagina(1)
  }

  if (consulta.cargando) {
    return (
      <div className="space-y-3" role="status" aria-live="polite">
        <p className="text-sm text-texto-suave">Cargando historial de préstamos…</p>
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
    )
  }

  if (consulta.error) {
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
    <section aria-label="Historial de préstamos">
      <header className="mb-5">
        <h2 className="text-xl font-bold text-texto">Historial de préstamos</h2>
        <p className="mt-1 text-sm text-texto-suave">
          Consulta y filtra el historial de préstamos del sistema.
        </p>
      </header>

      <FiltroPrestamos estado={estado} onCambiar={cambiarEstado} />

      {results.length === 0 ? (
        <div className="mt-6">
          <EstadoVacio
            titulo={estado === 'todos' ? 'Aún no hay préstamos registrados' : 'Sin préstamos con este estado'}
            mensaje={
              estado === 'todos'
                ? 'Los préstamos del sistema aparecerán aquí al registrar una entrega.'
                : 'Prueba con otro filtro de estado.'
            }
          />
        </div>
      ) : (
        <ListaHistorialPrestamos
          key={`${estado}-${pagina}`}
          prestamos={results}
          onDevolucion={
            usuario?.rol === 'gestor'
              ? (prestamoId) => navigate(`/panel/devolucion/${prestamoId}`)
              : null
          }
        />
      )}

      {count > 0 && (
        <nav className="mt-6 flex flex-wrap items-center justify-center gap-3" aria-label="Páginas del historial">
          <Boton
            variante="secundario"
            tipo="button"
            deshabilitado={!previous}
            onClick={() => setPagina((actual) => actual - 1)}
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
            onClick={() => setPagina((actual) => actual + 1)}
          >
            Siguiente
          </Boton>
        </nav>
      )}
    </section>
  )
}