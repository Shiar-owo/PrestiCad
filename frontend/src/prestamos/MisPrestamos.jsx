import { useEffect, useReducer, useState } from 'react'

import { api } from '../api/client'
import ListaPrestamos from '../components/prestamos/ListaPrestamos'
import {
  ESTADO_CONSULTA_INICIAL,
  reducirConsultaPrestamos,
} from './consultaPrestamos'

export default function MisPrestamos() {
  const [consulta, dispatch] = useReducer(
    reducirConsultaPrestamos,
    ESTADO_CONSULTA_INICIAL,
  )
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let activa = true
    dispatch({ tipo: 'iniciar' })

    api.get('/prestamos/mis-prestamos/')
      .then((prestamos) => {
        if (!Array.isArray(prestamos)) {
          throw new Error('La respuesta de préstamos no tiene el formato esperado.')
        }
        if (activa) dispatch({ tipo: 'exito', prestamos })
      })
      .catch(() => {
        if (activa) {
          dispatch({
            tipo: 'error',
            mensaje: 'No fue posible consultar tus préstamos. Intenta nuevamente.',
          })
        }
      })

    return () => {
      activa = false
    }
  }, [intento])

  if (consulta.cargando) {
    return <p aria-live="polite">Cargando tus préstamos…</p>
  }

  if (consulta.error) {
    return (
      <section aria-label="Consulta de préstamos">
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

  return <ListaPrestamos prestamos={consulta.prestamos} />
}
