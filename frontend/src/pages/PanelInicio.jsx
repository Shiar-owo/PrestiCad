import { useContext } from 'react'
import { Link } from 'react-router'
import { ArrowUpRight } from 'lucide-react'

import SesionContext from '../contextos/SesionContext'
import useTituloPagina from '../hooks/useTituloPagina'
import { ETIQUETAS_ROL } from '../constantes/roles'
import Tarjeta from '../components/ui/Tarjeta'
import TarjetaReputacion from '../components/ui/TarjetaReputacion'
import { ACCESOS_POR_ROL } from '../navegacion/accesos'

function PanelInicio() {
  useTituloPagina('Inicio')
  const { usuario } = useContext(SesionContext)

  if (!usuario) {
    return null
  }

  const nombreRol = ETIQUETAS_ROL[usuario.rol] || usuario.rol
  const accesos = ACCESOS_POR_ROL[usuario.rol] || []

  return (
    <div className="space-y-8">
      <section aria-labelledby="titulo-resumen">
        <h2 id="titulo-resumen" className="mb-3 text-xl font-bold text-texto">
          Resumen de tu cuenta
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Tarjeta className="p-5">
            <p className="text-sm font-semibold text-texto-suave">Rol asignado</p>
            <p className="mt-1 text-lg font-bold text-texto">{nombreRol}</p>
          </Tarjeta>
          <Tarjeta className="p-5">
            <p className="text-sm font-semibold text-texto-suave">Estado de la cuenta</p>
            {usuario.estado === 'activo' ? (
              <span className="mt-2 inline-flex rounded-full bg-marca-100 px-2.5 py-0.5 text-sm font-bold text-marca-800 dark:bg-marca-500/15 dark:text-marca-300">
                Activa
              </span>
            ) : (
              <p className="mt-1 text-lg font-bold text-texto">{usuario.estado}</p>
            )}
          </Tarjeta>
          {!['gestor', 'administrador'].includes(usuario.rol) && usuario.reputacion_tier && (
            <TarjetaReputacion
              tier={usuario.reputacion_tier}
              puntaje={usuario.reputacion_puntaje}
              puntosGanadosSemana={usuario.reputacion_puntos_ganados_semana}
              topeSemanal={usuario.reputacion_tope_semanal}
              compacta
            />
          )}
        </div>
      </section>

      <section aria-labelledby="titulo-accesos">
        <h2 id="titulo-accesos" className="mb-3 text-xl font-bold text-texto">
          Accesos rápidos
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accesos.map(({ id, etiqueta, a, descripcion, icono: Icono }) => (
            <Link
              key={id}
              to={a}
              className="group flex items-start justify-between gap-3 rounded-xl border border-borde bg-superficie p-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento-600 hover:border-acento-400 hover:bg-superficie-alta"
            >
              <span className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-marca-600/15 text-marca-700 dark:bg-marca-500/15 dark:text-marca-300">
                  <Icono aria-hidden="true" className="size-5" />
                </span>
                <span className="block">
                  <span className="block text-sm font-semibold text-texto">{etiqueta}</span>
                  <span className="mt-0.5 block text-xs text-texto-suave">{descripcion}</span>
                </span>
              </span>
              <ArrowUpRight
                aria-hidden="true"
                className="mt-0.5 size-4 text-texto-suave transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              />
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}

export default PanelInicio
