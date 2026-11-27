import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { ClipboardCheck, RotateCcw } from 'lucide-react'

import { api } from '../api/client'
import useTituloPagina from '../hooks/useTituloPagina'
import Campo from '../components/ui/Campo'
import SelectorPrestatario from '../components/prestamos/SelectorPrestatario'
import BadgeEstado from '../components/ui/BadgeEstado'
import Boton from '../components/ui/Boton'
import Tarjeta from '../components/ui/Tarjeta'
import Skeleton from '../components/ui/Skeleton'
import ErrorAlerta from '../components/ui/ErrorAlerta'
import EstadoVacio from '../components/ui/EstadoVacio'
import {
  construirRutaHistorial,
  iniciarCargaHistorial,
  TAMANO_PAGINA_HISTORIAL,
  validarRespuestaHistorial,
} from '../prestamos/historialPrestamos'

const CONSULTA_INICIAL = { cargando: true, error: '', datos: null }

const OPCIONES_ESTADO_PENDIENTE = [
  { valor: 'devoluble', etiqueta: 'Todos los pendientes (activos y vencidos)' },
  { valor: 'activo', etiqueta: 'Solo activos' },
  { valor: 'vencido', etiqueta: 'Solo vencidos' },
]

function fechaLegible(valor) {
  if (!valor) return '—'
  const fecha = new Date(valor)
  if (Number.isNaN(fecha.getTime())) return valor
  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(fecha)
}

export default function SeleccionarPrestamoDevolucion() {
  useTituloPagina('Registrar devolución')
  const navigate = useNavigate()
  const [estado, setEstado] = useState('devoluble')
  const [dniEntrada, setDniEntrada] = useState('')
  const [nombreEntrada, setNombreEntrada] = useState('')
  const [dniFiltro, setDniFiltro] = useState('')
  const [pagina, setPagina] = useState(1)
  const [intento, setIntento] = useState(0)
  const [consulta, setConsulta] = useState(CONSULTA_INICIAL)

  useEffect(() => {
    let activa = true
    setConsulta(iniciarCargaHistorial)

    api
      .get(construirRutaHistorial({ estado, pagina, dni: dniFiltro }))
      .then(validarRespuestaHistorial)
      .then((datos) => {
        if (activa) {
          setConsulta({ cargando: false, error: '', datos })
        }
      })
      .catch(() => {
        if (activa) {
          setConsulta({
            cargando: false,
            error: 'No fue posible consultar los préstamos pendientes de devolución.',
            datos: null,
          })
        }
      })

    return () => {
      activa = false
    }
  }, [estado, pagina, dniFiltro, intento])

  if (consulta.cargando && !consulta.datos) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-3" role="status" aria-live="polite">
        <p className="text-sm text-texto-suave">Cargando préstamos pendientes de devolución…</p>
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
    )
  }

  if (consulta.error && !consulta.datos) {
    return (
      <section aria-label="Registrar devolución" className="mx-auto grid w-full max-w-6xl gap-4">
        <header>
          <h2 className="text-xl font-bold text-texto">Registrar devolución</h2>
          <p className="mt-1 text-sm text-texto-suave">
            Selecciona el préstamo pendiente para inspeccionar el ejemplar y registrar su devolución.
          </p>
        </header>
        <ErrorAlerta mensaje={consulta.error} />
        <Boton
          variante="secundario"
          className="w-full sm:w-auto"
          onClick={() => setIntento((valor) => valor + 1)}
        >
          Reintentar
        </Boton>
      </section>
    )
  }

  const { count, next, previous, results } = consulta.datos
  const totalPaginas = Math.max(1, Math.ceil(count / TAMANO_PAGINA_HISTORIAL))

  function seleccionarPrestatario(prestatario, modo) {
    setDniEntrada(prestatario.dni)
    setNombreEntrada(modo === 'nombre' ? prestatario.nombre_completo : '')
    setDniFiltro(prestatario.dni)
    setPagina(1)
  }

  return (
    <section aria-label="Registrar devolución" aria-busy={consulta.cargando} className="mx-auto w-full max-w-6xl">
      <header className="mb-6 flex flex-col gap-4 rounded-2xl border border-borde bg-gradient-to-r from-superficie via-superficie to-acento-50 p-5 shadow-sm sm:flex-row sm:items-center sm:p-6 dark:to-superficie-alta">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-marca-600/15 text-marca-700 dark:bg-marca-500/15 dark:text-marca-300">
          <ClipboardCheck aria-hidden="true" className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wider text-acento-700 dark:text-acento-300">Gestión de préstamos</p>
          <h2 className="mt-1 text-2xl font-bold text-texto">Registrar devolución</h2>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-texto-suave">
            Selecciona un préstamo activo o vencido para revisar el checklist del ejemplar y registrar su devolución.
          </p>
        </div>
      </header>

      <Tarjeta className="space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-borde pb-3">
          <div>
            <h3 className="text-base font-bold text-texto">Filtrar préstamos</h3>
            <p className="mt-0.5 text-xs text-texto-suave">Limita la lista por estado o prestatario.</p>
          </div>
          <span className="rounded-full bg-superficie-alta px-3 py-1 text-xs font-semibold text-texto-suave">
            {count} {count === 1 ? 'préstamo pendiente' : 'préstamos pendientes'}
          </span>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Campo
            etiqueta="Estado del préstamo"
            opciones={OPCIONES_ESTADO_PENDIENTE}
            valor={estado}
            onCambio={(evento) => {
              setEstado(evento.target.value)
              setPagina(1)
            }}
          />
          <div className="grid gap-3">
            <SelectorPrestatario
              modo="nombre"
              incluirInactivos
              valor={nombreEntrada}
              etiqueta="Buscar por nombre"
              ayuda="Escribe un nombre y elige al prestatario; las opciones muestran su DNI."
              onCambio={(valor) => {
                setNombreEntrada(valor)
                if (dniFiltro) {
                  setDniEntrada('')
                  setDniFiltro('')
                  setPagina(1)
                }
              }}
              onSeleccionar={(prestatario) => seleccionarPrestatario(prestatario, 'nombre')}
            />
          </div>
          <div className="grid gap-3">
            <SelectorPrestatario
              incluirInactivos
              valor={dniEntrada}
              etiqueta="Buscar por DNI"
              ayuda="Escribe el DNI para elegir al prestatario o completa los 8 dígitos."
              onCambio={(valor) => {
                setDniEntrada(valor)
                setNombreEntrada('')
                const filtro = valor.length === 8 ? valor : ''
                if (filtro !== dniFiltro) {
                  setDniFiltro(filtro)
                  setPagina(1)
                }
              }}
              onSeleccionar={(prestatario) => seleccionarPrestatario(prestatario, 'dni')}
            />
            {dniFiltro && (
              <Boton
                variante="secundario"
                tipo="button"
                className="w-fit"
                onClick={() => {
                  setDniEntrada('')
                  setNombreEntrada('')
                  setDniFiltro('')
                  setPagina(1)
                }}
              >
                Quitar filtro de prestatario
              </Boton>
            )}
          </div>
        </div>
      </Tarjeta>

      {consulta.cargando && consulta.datos && (
        <p className="mb-3 text-xs text-texto-suave" role="status" aria-live="polite">
          Actualizando listado…
        </p>
      )}

      {results.length === 0 ? (
        <div className="mt-6">
          <EstadoVacio
            titulo={
              dniFiltro
                ? 'Sin préstamos pendientes para este prestatario'
                : 'No hay préstamos pendientes de devolución'
            }
            mensaje={
              dniFiltro
                ? 'El prestatario indicado no tiene préstamos activos o vencidos con este filtro.'
                : 'Cuando existan préstamos activos o vencidos aparecerán aquí para registrar su devolución.'
            }
          />
        </div>
      ) : (
        <ul className="mt-5 grid gap-4 lg:grid-cols-2">
          {results.map((prestamo) => (
            <li
              key={prestamo.id}
              className="group flex flex-col justify-between gap-4 rounded-2xl border border-borde bg-superficie p-5 shadow-sm transition hover:border-acento-400 hover:shadow-md"
            >
              <div className="min-w-0 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-borde pb-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-texto-suave">Préstamo #{prestamo.id}</p>
                    <h3 className="mt-1 break-words text-lg font-bold text-texto">{prestamo.material_nombre}</h3>
                  </div>
                  <BadgeEstado estado={prestamo.estado} />
                </div>
                <dl className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-xl bg-superficie-alta/60 p-3">
                    <dt className="text-xs font-semibold text-texto-suave">Prestatario</dt>
                    <dd className="mt-1 break-words text-sm font-semibold text-texto">{prestamo.prestatario_nombre}</dd>
                  </div>
                  <div className="rounded-xl bg-superficie-alta/60 p-3">
                    <dt className="text-xs font-semibold text-texto-suave">Material / ejemplar</dt>
                    <dd className="mt-1 break-words text-sm font-semibold text-texto">
                      {prestamo.material_codigo}{prestamo.codigo_ejemplar && <span className="font-mono"> · {prestamo.codigo_ejemplar}</span>}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-superficie-alta/60 p-3">
                    <dt className="text-xs font-semibold text-texto-suave">Fecha de entrega</dt>
                    <dd className="mt-1 text-sm text-texto">{fechaLegible(prestamo.fecha_entrega)}</dd>
                  </div>
                  <div className="rounded-xl bg-acento-50 p-3 dark:bg-acento-500/10">
                    <dt className="text-xs font-semibold text-acento-800 dark:text-acento-300">Fecha límite</dt>
                    <dd className="mt-1 text-sm font-semibold text-acento-900 dark:text-acento-200">{fechaLegible(prestamo.fecha_limite)}</dd>
                  </div>
                </dl>
              </div>
              <div className="flex justify-end border-t border-borde pt-3">
                <Boton
                  tipo="button"
                  icono={RotateCcw}
                  onClick={() => navigate(`/panel/devolucion/${prestamo.id}`)}
                >
                  Registrar devolución
                </Boton>
              </div>
            </li>
          ))}
        </ul>
      )}

      {count > 0 && (
        <nav className="mt-6 flex flex-wrap items-center justify-center gap-3" aria-label="Páginas de préstamos pendientes">
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
