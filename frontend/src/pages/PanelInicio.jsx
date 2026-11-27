import { useContext } from 'react'
import { Link } from 'react-router'
import {
  ArrowUpRight,
  CalendarCheck2,
  ClipboardCheck,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react'

import SesionContext from '../contextos/SesionContext'
import useTituloPagina from '../hooks/useTituloPagina'
import { ETIQUETAS_ROL } from '../constantes/roles'
import Tarjeta from '../components/ui/Tarjeta'
import TarjetaReputacion from '../components/ui/TarjetaReputacion'
import { ACCESOS_POR_ROL } from '../navegacion/accesos'

const MENSAJES_BIENVENIDA = {
  prestatario: 'Consulta tus préstamos, revisa tus reservas y sigue tu reputación.',
  gestor: 'Administra préstamos, reservas e inventario desde un solo lugar.',
  administrador: 'Gestiona las operaciones y la configuración de PrestiCad.',
}

function IndicadorInicio({ icono: Icono, etiqueta, valor, detalle, tono = 'marca' }) {
  const tonos = {
    marca: 'bg-marca-100 text-marca-700 dark:bg-marca-500/15 dark:text-marca-300',
    acento: 'bg-acento-100 text-acento-700 dark:bg-acento-500/15 dark:text-acento-300',
    neutro: 'bg-superficie-alta text-texto-suave',
  }

  return (
    <Tarjeta className="flex min-h-36 flex-col justify-between p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-texto-suave">{etiqueta}</p>
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${tonos[tono]}`}>
          <Icono aria-hidden="true" className="size-4" />
        </span>
      </div>
      <div>
        <p className="text-2xl font-extrabold tracking-tight text-texto">{valor}</p>
        {detalle && <p className="mt-1 text-xs text-texto-suave">{detalle}</p>}
      </div>
    </Tarjeta>
  )
}

function PanelInicio() {
  useTituloPagina('Inicio')
  const { usuario } = useContext(SesionContext)

  if (!usuario) {
    return null
  }

  const nombreRol = ETIQUETAS_ROL[usuario.rol] || usuario.rol
  const accesos = ACCESOS_POR_ROL[usuario.rol] || []
  const nombre = `${usuario.nombre || ''} ${usuario.apellido || ''}`.trim() || 'bienvenido'
  const iniciales = `${usuario.nombre?.[0] || ''}${usuario.apellido?.[0] || ''}`.toUpperCase()
  const esPrestatario = usuario.rol === 'prestatario'
  const mensajeBienvenida = MENSAJES_BIENVENIDA[usuario.rol] || 'Bienvenido a PrestiCad.'

  return (
    <div className="space-y-8 pb-4">
      <section
        aria-labelledby="titulo-bienvenida"
        className="overflow-hidden rounded-2xl border border-white bg-gradient-to-r from-superficie via-superficie to-acento-50 p-6 shadow-sm sm:p-8 dark:to-superficie-alta"
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4 sm:gap-5">
            {usuario.foto_perfil ? (
              <img
                src={usuario.foto_perfil}
                alt={`Foto de perfil de ${nombre}`}
                className="size-16 shrink-0 rounded-full border-2 border-white object-cover shadow-sm sm:size-26"
              />
            ) : (
              <span
                aria-hidden="true"
                className="flex size-16 shrink-0 items-center justify-center rounded-full border-2 border-white bg-marca-600 text-lg font-bold text-white shadow-sm sm:size-18"
              >
                {iniciales || <UserRound className="size-6" />}
              </span>
            )}
            <div className="min-w-0">
              <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-acento-200 bg-acento-100 px-3 py-1 text-sm font-semibold text-acento-800 dark:border-acento-500/30 dark:bg-acento-500/15 dark:text-acento-300">
                <Sparkles aria-hidden="true" className="size-4 text-marca-600 dark:text-marca-400" />
                Panel de inicio
              </p>
              <h1 id="titulo-bienvenida" className="text-2xl font-extrabold tracking-tight text-texto sm:text-3xl">
                Hola, {nombre}
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-texto-suave sm:text-base">
                {mensajeBienvenida}
              </p>
            </div>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-marca-200 bg-marca-100 px-3 py-1.5 text-sm font-semibold text-marca-800 dark:border-marca-500/30 dark:bg-marca-500/15 dark:text-marca-300">
            <UserRound aria-hidden="true" className="size-4" />
            {nombreRol}
          </span>
        </div>
      </section>

      <section aria-labelledby="titulo-resumen">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="titulo-resumen" className="text-xl font-bold text-texto">
              Tu resumen
            </h2>
            <p className="mt-1 text-sm text-texto-suave">
              {esPrestatario ? 'Tu actividad y reputación actual.' : 'Información de tu cuenta.'}
            </p>
          </div>
        </div>

        {esPrestatario ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <IndicadorInicio
              icono={ClipboardCheck}
              etiqueta="Préstamos activos"
              valor={`${usuario.prestamos_activos ?? 0} / ${usuario.maximo_prestamos_activos ?? '—'}`}
              detalle="En uso / límite permitido"
              tono="marca"
            />
            <IndicadorInicio
              icono={CalendarCheck2}
              etiqueta="Reservas activas"
              valor={`${usuario.reservas_activas ?? 0} / ${usuario.maximo_reservas_activas ?? '—'}`}
              detalle="En uso / límite permitido"
              tono="acento"
            />
            <IndicadorInicio
              icono={Sparkles}
              etiqueta="Puntos ganados esta semana"
              valor={`+${usuario.reputacion_puntos_ganados_semana ?? 0} / ${usuario.reputacion_tope_semanal ?? '—'}`}
              detalle="Puntos ganados / tope semanal"
              tono="neutro"
            />
            {usuario.reputacion_tier && (
              <TarjetaReputacion
                tier={usuario.reputacion_tier}
                puntaje={usuario.reputacion_puntaje}
                puntosGanadosSemana={usuario.reputacion_puntos_ganados_semana}
                topeSemanal={usuario.reputacion_tope_semanal}
                compacta
                mostrarProgresoSemanal={false}
              />
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:max-w-2xl">
            <IndicadorInicio
              icono={UserRound}
              etiqueta="Rol asignado"
              valor={nombreRol}
              detalle="Permisos de tu cuenta"
              tono="acento"
            />
            <IndicadorInicio
              icono={ShieldCheck}
              etiqueta="Estado de la cuenta"
              valor={usuario.estado === 'activo' ? 'Activa' : usuario.estado}
              detalle="Estado actual de acceso"
              tono={usuario.estado === 'activo' ? 'marca' : 'neutro'}
            />
          </div>
        )}
      </section>

      <section aria-labelledby="titulo-accesos">
        <div className="mb-4">
          <h2 id="titulo-accesos" className="text-xl font-bold text-texto">
            Accesos rápidos
          </h2>
          <p className="mt-1 text-sm text-texto-suave">
            {esPrestatario ? 'Continúa con tus gestiones personales.' : 'Ve directamente a una sección de trabajo.'}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {accesos.map(({ id, etiqueta, a, descripcion, icono: Icono }) => (
            <Link
              key={id}
              to={a}
              className="group flex min-h-28 items-center justify-between gap-4 rounded-xl border border-borde bg-superficie p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:border-acento-400 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento-600"
            >
              <span className="flex min-w-0 items-center gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-marca-600/12 text-marca-700 transition-colors group-hover:bg-marca-600/20 dark:text-marca-300">
                  <Icono aria-hidden="true" className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-base font-bold text-texto">{etiqueta}</span>
                  <span className="mt-1 block text-sm text-texto-suave">{descripcion}</span>
                </span>
              </span>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full text-texto-suave transition-colors group-hover:bg-acento-100 group-hover:text-acento-700 dark:group-hover:bg-acento-500/15 dark:group-hover:text-acento-300">
                <ArrowUpRight aria-hidden="true" className="size-4" />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}

export default PanelInicio
