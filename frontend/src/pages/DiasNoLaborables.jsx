import { useState } from 'react'
import { CalendarOff, Plus, Trash2 } from 'lucide-react'

import { api, ErrorApi } from '../api/client'
import useTituloPagina from '../hooks/useTituloPagina'
import {
  invalidarCacheDiasNoLaborables,
  useDiasNoLaborables,
} from '../reservas/diasNoLaborables'
import Boton from '../components/ui/Boton'
import Campo from '../components/ui/Campo'
import ErrorAlerta from '../components/ui/ErrorAlerta'
import EstadoVacio from '../components/ui/EstadoVacio'
import ExitoModal from '../components/ui/ExitoModal'
import SelectorFechaHoraDesplegable from '../components/ui/SelectorFechaHoraDesplegable'
import Skeleton from '../components/ui/Skeleton'
import Tarjeta from '../components/ui/Tarjeta'

const MOTIVOS_SUGERIDOS = [
  'Feriado nacional',
  'Feriado institucional',
  'Cierre de almacén',
  'Mantenimiento de laboratorio',
]

function formatearFechaLarga(iso) {
  if (!iso) return ''
  const [anio, mes, dia] = iso.split('-').map(Number)
  const fecha = new Date(anio, mes - 1, dia)
  if (Number.isNaN(fecha.getTime())) return iso
  return new Intl.DateTimeFormat('es-PE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(fecha)
}

function obtenerHoyIso() {
  const hoy = new Date()
  const y = hoy.getFullYear()
  const m = String(hoy.getMonth() + 1).padStart(2, '0')
  const d = String(hoy.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function extraerMensajeError(fallo, respaldo) {
  if (fallo instanceof ErrorApi && fallo.datos) {
    if (typeof fallo.datos.detail === 'string') return fallo.datos.detail
    const primero = Object.values(fallo.datos).flat()[0]
    if (primero) return String(primero)
  }
  return respaldo
}

export default function DiasNoLaborables() {
  useTituloPagina('Calendario')
  const { diasNoLaborables, cargando, recargar } = useDiasNoLaborables()
  const [fecha, setFecha] = useState('')
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [eliminandoId, setEliminandoId] = useState(null)
  const [diaAEliminar, setDiaAEliminar] = useState(null)
  const [error, setError] = useState('')
  const [erroresCampo, setErroresCampo] = useState({})
  const [mensajeExito, setMensajeExito] = useState('')

  const hoyIso = obtenerHoyIso()

  async function manejarRegistro(evento) {
    evento.preventDefault()
    const erroresLocales = {}
    if (!fecha) erroresLocales.fecha = 'Selecciona una fecha laborable para inhabilitar.'
    if (!motivo.trim()) erroresLocales.motivo = 'Indica el motivo (ej. Feriado nacional).'
    if (Object.keys(erroresLocales).length > 0) {
      setErroresCampo(erroresLocales)
      return
    }

    setGuardando(true)
    setError('')
    setErroresCampo({})
    try {
      const respuesta = await api.post('/dias-no-laborables/', {
        fecha,
        motivo: motivo.trim(),
      })
      invalidarCacheDiasNoLaborables()
      await recargar({ forzar: true })
      const avisoReservas = respuesta?.reservas_afectadas > 0
        ? ` Aviso: existen ${respuesta.reservas_afectadas} reserva(s) confirmada(s) previamente para esa fecha.`
        : ''
      setMensajeExito(
        `Se inhabilitó el ${formatearFechaLarga(fecha)} (${motivo.trim()}).${avisoReservas}`,
      )
      setFecha('')
      setMotivo('')
    } catch (fallo) {
      setError(extraerMensajeError(fallo, 'No se pudo inhabilitar el día indicado.'))
    } finally {
      setGuardando(false)
    }
  }

  async function confirmarEliminacion() {
    if (!diaAEliminar) return
    setEliminandoId(diaAEliminar.id)
    setError('')
    try {
      await api.delete(`/dias-no-laborables/${diaAEliminar.id}/`)
      invalidarCacheDiasNoLaborables()
      await recargar({ forzar: true })
      setMensajeExito(
        `El ${formatearFechaLarga(diaAEliminar.fecha)} volvió a quedar habilitado como día laborable.`,
      )
      setDiaAEliminar(null)
    } catch (fallo) {
      setError(extraerMensajeError(fallo, 'No se pudo rehabilitar el día seleccionado.'))
      setDiaAEliminar(null)
    } finally {
      setEliminandoId(null)
    }
  }

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-8 space-y-6">
      <ExitoModal mensaje={mensajeExito} onCerrar={() => setMensajeExito('')} />

      <header>
        <div className="flex items-center gap-2.5">
          <span className="flex size-10 items-center justify-center rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
            <CalendarOff className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-xl font-bold text-texto">Calendario de días no laborables</h2>
            <p className="mt-0.5 text-sm text-texto-suave">
              Inhabilita días específicos (feriados, cierres o mantenimiento) para impedir reservas y devoluciones en esas fechas.
            </p>
          </div>
        </div>
      </header>

      {error && <ErrorAlerta mensaje={error} />}

      <Tarjeta className="p-5">
        <h3 className="text-base font-bold text-texto">Inhabilitar nueva fecha</h3>
        <p className="mt-1 text-xs text-texto-suave">
          Los sábados y domingos ya están bloqueados automáticamente por defecto.
        </p>

        <form onSubmit={manejarRegistro} className="mt-4 grid gap-4 sm:grid-cols-2" noValidate>
          <SelectorFechaHoraDesplegable
            id="fecha-dia-no-laborable"
            etiqueta="Fecha a inhabilitar *"
            soloFecha
            valor={fecha}
            minFecha={hoyIso}
            diasNoLaborables={diasNoLaborables}
            error={erroresCampo.fecha}
            placeholder="Selecciona un día laborable..."
            onCambio={(nuevaFecha) => {
              setFecha(nuevaFecha)
              setErroresCampo((actual) => ({ ...actual, fecha: undefined }))
            }}
          />

          <div className="space-y-2">
            <Campo
              etiqueta="Motivo *"
              valor={motivo}
              onCambio={(evento) => {
                setMotivo(evento.target.value)
                setErroresCampo((actual) => ({ ...actual, motivo: undefined }))
              }}
              error={erroresCampo.motivo}
              maxLength={200}
              placeholder="Ej. Feriado nacional - Fiestas Patrias"
              requerido
            />
            <div className="flex flex-wrap gap-1.5">
              {MOTIVOS_SUGERIDOS.map((sugerencia) => (
                <button
                  key={sugerencia}
                  type="button"
                  onClick={() => {
                    setMotivo(sugerencia)
                    setErroresCampo((actual) => ({ ...actual, motivo: undefined }))
                  }}
                  className="rounded-md border border-borde bg-superficie-alta px-2 py-0.5 text-[11px] font-medium text-texto-suave transition-colors hover:border-marca-400 hover:text-texto"
                >
                  {sugerencia}
                </button>
              ))}
            </div>
          </div>

          <div className="sm:col-span-2 flex justify-end">
            <Boton tipo="submit" icono={Plus} cargando={guardando}>
              Inhabilitar día
            </Boton>
          </div>
        </form>
      </Tarjeta>

      <Tarjeta className="overflow-hidden">
        <div className="border-b border-borde px-5 py-3.5">
          <h3 className="text-base font-bold text-texto">
            Días inhabilitados registrados ({diasNoLaborables.length})
          </h3>
        </div>

        {cargando ? (
          <div className="space-y-3 p-5" role="status" aria-live="polite">
            <Skeleton className="h-10 rounded-lg" />
            <Skeleton className="h-10 rounded-lg" />
          </div>
        ) : diasNoLaborables.length === 0 ? (
          <div className="p-6">
            <EstadoVacio
              titulo="No hay días inhabilitados"
              mensaje="Todos los días de lunes a viernes se encuentran habilitados para reservas y préstamos."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-borde text-left text-xs uppercase tracking-wide text-texto-suave">
                  <th className="px-4 py-3 font-semibold">Fecha</th>
                  <th className="px-4 py-3 font-semibold">Motivo</th>
                  <th className="px-4 py-3 font-semibold">Registrado por</th>
                  <th className="px-4 py-3 font-semibold">Vigencia</th>
                  <th className="px-4 py-3 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {diasNoLaborables.map((dia) => {
                  const esPasado = dia.fecha < hoyIso
                  return (
                    <tr key={dia.id} className="text-texto">
                      <td className="px-4 py-3 font-semibold capitalize whitespace-nowrap">
                        {formatearFechaLarga(dia.fecha)}
                        <span className="block font-mono text-xs font-normal text-texto-suave">
                          {dia.fecha}
                        </span>
                      </td>
                      <td className="px-4 py-3">{dia.motivo}</td>
                      <td className="px-4 py-3 text-texto-suave">
                        {dia.creado_por_nombre || 'Administración'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            esPasado
                              ? 'bg-superficie-alta text-texto-suave'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300'
                          }`}
                        >
                          {esPasado ? 'Pasado' : 'Activo'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Boton
                          variante="peligro"
                          tamanio="pequeno"
                          icono={Trash2}
                          cargando={eliminandoId === dia.id}
                          deshabilitado={eliminandoId !== null}
                          onClick={() => setDiaAEliminar(dia)}
                        >
                          Habilitar
                        </Boton>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>

      {diaAEliminar && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(evento) => {
            if (evento.target === evento.currentTarget && !eliminandoId) {
              setDiaAEliminar(null)
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirmar-habilitar-dia-titulo"
            className="w-full max-w-md rounded-xl border border-borde bg-white p-6 shadow-xl dark:bg-superficie"
          >
            <h3 id="confirmar-habilitar-dia-titulo" className="text-lg font-bold text-texto">
              Rehabilitar día laborable
            </h3>
            <p className="mt-2 text-sm text-texto-suave">
              ¿Deseas volver a habilitar el{' '}
              <strong className="text-texto capitalize">{formatearFechaLarga(diaAEliminar.fecha)}</strong>{' '}
              ({diaAEliminar.motivo}) para reservas y préstamos?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Boton
                variante="secundario"
                tamanio="pequeno"
                deshabilitado={Boolean(eliminandoId)}
                onClick={() => setDiaAEliminar(null)}
              >
                Cancelar
              </Boton>
              <Boton
                variante="primario"
                tamanio="pequeno"
                cargando={Boolean(eliminandoId)}
                onClick={confirmarEliminacion}
              >
                Confirmar habilitación
              </Boton>
            </div>
          </section>
        </div>
      )}
    </section>
  )
}
