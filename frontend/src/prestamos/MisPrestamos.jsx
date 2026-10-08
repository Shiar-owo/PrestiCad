import { useEffect, useReducer, useState } from 'react'

import { api } from '../api/client'
import useTituloPagina from '../hooks/useTituloPagina'
import ListaPrestamos from '../components/prestamos/ListaPrestamos'
import Boton from '../components/ui/Boton'
import Skeleton from '../components/ui/Skeleton'
import ErrorAlerta from '../components/ui/ErrorAlerta'
import {
  ESTADO_CONSULTA_INICIAL,
  reducirConsultaPrestamos,
} from './consultaPrestamos'

export default function MisPrestamos() {
  useTituloPagina('Mis préstamos')
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
    return (
      <div className="space-y-3" role="status" aria-live="polite">
        <p className="text-sm text-texto-suave">Cargando tus préstamos…</p>
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
    )
  }

  if (consulta.error) {
    return (
      <section aria-label="Consulta de préstamos" className="grid gap-4">
        <ErrorAlerta mensaje={consulta.error} />
        <Boton variante="secundario" className="w-full sm:w-auto" onClick={() => setIntento((valor) => valor + 1)}>
          Reintentar
        </Boton>
      </section>
    )
  }

  return <ListaPrestamos prestamos={consulta.prestamos} />
}