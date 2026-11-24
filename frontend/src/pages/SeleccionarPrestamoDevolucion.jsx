import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { RotateCcw } from 'lucide-react'

import { api } from '../api/client'
import useTituloPagina from '../hooks/useTituloPagina'
import Campo from '../components/ui/Campo'
import SelectorPrestatario from '../components/prestamos/SelectorPrestatario'
import BadgeEstado from '../components/ui/BadgeEstado'
import Boton from '../components/ui/Boton'
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
      <div className="space-y-3" role="status" aria-live="polite">
        <p className="text-sm text-texto-suave">Cargando préstamos pendientes de devolución…</p>
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
    )
  }

  if (consulta.error && !consulta.datos) {
    return (
      <section aria-label="Registrar devolución" className="grid gap-4">
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

  return (
    <section aria-label="Registrar devolución" aria-busy={consulta.cargando}>
      <header className="mb-5">
        <h2 className="text-xl font-bold text-texto">Registrar devolución</h2>
        <p className="mt-1 text-sm text-texto-suave">
          Selecciona un préstamo activo o vencido para revisar el checklist del ejemplar y registrar su devolución.
        </p>
      </header>

      <div className="my-4 grid gap-4 sm:max-w-3xl sm:grid-cols-[18rem_minmax(0,24rem)] sm:items-start">
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
            valor={dniEntrada}
            etiqueta="Buscar por prestatario"
            ayuda="Escribe el DNI para filtrar los préstamos pendientes del prestatario."
            onCambio={(valor) => {
              setDniEntrada(valor)
              setDniFiltro('')
              setPagina(1)
            }}
            onSeleccionar={(prestatario) => {
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
        <ul className="mt-4 grid gap-3">
          {results.map((prestamo) => (
            <li
              key={prestamo.id}
              className="flex flex-col justify-between gap-4 rounded-xl border border-borde bg-white p-4 dark:bg-superficie sm:flex-row sm:items-center"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-texto">{prestamo.material_nombre}</span>
                  <BadgeEstado estado={prestamo.estado} />
                </div>
                <p className="text-sm text-texto-suave">
                  Prestatario: <strong className="font-medium text-texto">{prestamo.prestatario_nombre}</strong> · Código de Material: {prestamo.material_codigo}
                  {prestamo.codigo_ejemplar && <> · Código de Ejemplar: {prestamo.codigo_ejemplar}</>}
                </p>
                <p className="text-xs text-texto-suave">
                  Entrega: {fechaLegible(prestamo.fecha_entrega)} · Fecha límite: {fechaLegible(prestamo.fecha_limite)}
                </p>
              </div>
              <div className="shrink-0">
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
