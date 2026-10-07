import { useEffect, useState } from 'react'

import { api } from '../api/client'
import FiltroPrestamos from '../components/prestamos/FiltroPrestamos'
import {
  construirRutaHistorial,
  TAMANO_PAGINA_HISTORIAL,
  validarRespuestaHistorial,
} from './historialPrestamos'
import ListaHistorialPrestamos from './ListaHistorialPrestamos'
import './historialPrestamos.css'

const CONSULTA_INICIAL = { cargando: true, error: '', datos: null }

export default function HistorialPrestamos() {
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
    return <p aria-live="polite">Cargando historial de préstamos…</p>
  }

  if (consulta.error) {
    return (
      <section aria-label="Historial de préstamos">
        <h3>Historial de préstamos</h3>
        <p className="error" role="alert">{consulta.error}</p>
        <button
          className="boton-secundario"
          onClick={() => setIntento((valor) => valor + 1)}
          type="button"
        >
          Reintentar
        </button>
      </section>
    )
  }

  const { count, next, previous, results } = consulta.datos
  const totalPaginas = Math.max(1, Math.ceil(count / TAMANO_PAGINA_HISTORIAL))

  return (
    <section className="prestamos-historial" aria-label="Historial de préstamos">
      <h3>Historial de préstamos</h3>
      <FiltroPrestamos estado={estado} onCambiar={cambiarEstado} />
      {results.length === 0 ? (
        <p className="prestamos-lista__vacio">
          {estado === 'todos'
            ? 'Aún no hay préstamos registrados.'
            : 'No hay préstamos con este estado.'}
        </p>
      ) : (
        <ListaHistorialPrestamos
          key={`${estado}-${pagina}`}
          prestamos={results}
        />
      )}
      {count > 0 && (
        <nav className="prestamos-historial__paginacion" aria-label="Páginas del historial">
          <button
            className="boton-secundario"
            disabled={!previous}
            onClick={() => setPagina((actual) => actual - 1)}
            type="button"
          >
            Anterior
          </button>
          <span aria-live="polite">Página {pagina} de {totalPaginas} · {count} préstamos</span>
          <button
            className="boton-secundario"
            disabled={!next}
            onClick={() => setPagina((actual) => actual + 1)}
            type="button"
          >
            Siguiente
          </button>
        </nav>
      )}
    </section>
  )
}
