import { useContext, useEffect, useReducer, useState } from 'react'
import { ClipboardCheck } from 'lucide-react'

import { api } from '../api/client'
import useTituloPagina from '../hooks/useTituloPagina'
import ListaPrestamos from '../components/prestamos/ListaPrestamos'
import Boton from '../components/ui/Boton'
import Skeleton from '../components/ui/Skeleton'
import ErrorAlerta from '../components/ui/ErrorAlerta'
import ResumenLimitesPrestatario from '../components/prestamos/ResumenLimitesPrestatario'
import { MAXIMO_ACTIVOS_POR_TIER } from '../constantes/catalogo'
import SesionContext from '../contextos/SesionContext'
import {
  ESTADO_CONSULTA_INICIAL,
  reducirConsultaPrestamos,
} from './consultaPrestamos'
import { obtenerEstadoVisible } from './estadoPrestamo'

function CabeceraMisPrestamos({ usuario, prestamosActivos }) {
  return (
    <div className="space-y-5">
      <header className="flex items-start gap-4 rounded-2xl border border-borde bg-gradient-to-r from-superficie via-superficie to-acento-50 p-5 shadow-sm sm:p-6 dark:to-superficie-alta">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-marca-600/15 text-marca-700 dark:bg-marca-500/15 dark:text-marca-300">
          <ClipboardCheck aria-hidden="true" className="size-6" />
        </span>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-acento-700 dark:text-acento-300">Tu actividad</p>
          <h2 className="mt-1 text-2xl font-bold text-texto">Mis Préstamos</h2>
          <p className="mt-1 text-sm text-texto-suave">Revisa el estado y las fechas de devolución de tus ejemplares.</p>
        </div>
      </header>
      <ResumenLimitesPrestatario
        prestamosActivos={prestamosActivos}
        maximoPrestamos={usuario?.maximo_prestamos_activos ?? 3}
        reservasActivas={usuario?.reservas_activas ?? 0}
        maximoReservas={usuario?.maximo_reservas_activas ?? MAXIMO_ACTIVOS_POR_TIER[usuario?.reputacion_tier] ?? 3}
      />
    </div>
  )
}

export default function MisPrestamos() {
  useTituloPagina('Mis Préstamos')
  const { usuario, refrescarSesion } = useContext(SesionContext)
  const [consulta, dispatch] = useReducer(
    reducirConsultaPrestamos,
    ESTADO_CONSULTA_INICIAL,
  )
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let activa = true
    dispatch({ tipo: 'iniciar' })
    refrescarSesion().catch(() => {})

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
  }, [intento, refrescarSesion])

  const prestamosActivos = consulta.cargando || consulta.error
    ? usuario?.prestamos_activos ?? 0
    : consulta.prestamos.filter((prestamo) => (
      ['activo', 'vencido'].includes(obtenerEstadoVisible(prestamo))
    )).length
  const cabecera = <CabeceraMisPrestamos usuario={usuario} prestamosActivos={prestamosActivos} />

  if (consulta.cargando) {
    return (
      <section className="mx-auto w-full max-w-6xl space-y-5" aria-label="Mis Préstamos">
        {cabecera}
        <div className="space-y-3" role="status" aria-live="polite">
        <p className="text-sm text-texto-suave">Cargando tus préstamos…</p>
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
        </div>
      </section>
    )
  }

  if (consulta.error) {
    return (
      <section aria-label="Consulta de préstamos" className="mx-auto grid w-full max-w-6xl gap-5">
        {cabecera}
        <ErrorAlerta mensaje={consulta.error} />
        <Boton variante="secundario" className="w-full sm:w-auto" onClick={() => setIntento((valor) => valor + 1)}>
          Reintentar
        </Boton>
      </section>
    )
  }

  return (
    <section className="mx-auto w-full max-w-6xl space-y-5" aria-label="Mis Préstamos">
      {cabecera}
      <ListaPrestamos prestamos={consulta.prestamos} />
    </section>
  )
}
