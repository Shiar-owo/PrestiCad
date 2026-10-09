import { useEffect } from 'react'
import {
  Award,
  Box,
  Cpu,
  FileText,
  Info,
  ShieldAlert,
  Sparkles,
  Tag,
  Wrench,
  X,
} from 'lucide-react'

import { obtenerDatosFichaTecnica } from '../catalogo/fichaTecnica'
import BadgeEstado from './ui/BadgeEstado'
import Boton from './ui/Boton'

function ItemEspecificacion({ etiqueta, valor, mono = false, icono: Icono = null }) {
  return (
    <div className="flex flex-col rounded-xl border border-borde bg-superficie p-3">
      <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-texto-suave">
        {Icono && <Icono className="size-3.5 text-acento-600 dark:text-acento-400" aria-hidden="true" />}
        {etiqueta}
      </span>
      <span
        className={`mt-1 text-sm font-semibold text-texto break-words ${mono ? 'font-mono' : ''}`}
      >
        {valor}
      </span>
    </div>
  )
}

function ItemRegla({ etiqueta, valor, descripcion = '', tipo = 'neutral' }) {
  const estilosValor = {
    positivo: 'text-marca-700 dark:text-marca-400',
    negativo: 'text-error',
    neutral: 'text-texto',
  }

  return (
    <div className="flex flex-col justify-between rounded-xl border border-borde bg-superficie p-3">
      <span className="text-xs font-semibold uppercase tracking-wider text-texto-suave">
        {etiqueta}
      </span>
      <span className={`mt-1 text-sm font-bold ${estilosValor[tipo]}`}>{valor}</span>
      {descripcion && <span className="mt-0.5 text-xs text-texto-suave">{descripcion}</span>}
    </div>
  )
}

function FichaTecnicaModal({ material, onCerrar }) {
  const ficha = obtenerDatosFichaTecnica(material)

  useEffect(() => {
    function manejarTecla(evento) {
      if (evento.key === 'Escape') {
        onCerrar()
      }
    }

    window.addEventListener('keydown', manejarTecla)
    const estiloOverflowPrevio = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      window.removeEventListener('keydown', manejarTecla)
      document.body.style.overflow = estiloOverflowPrevio
    }
  }, [onCerrar])

  if (!ficha) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ficha-tecnica-titulo"
      onClick={(evento) => {
        if (evento.target === evento.currentTarget) {
          onCerrar()
        }
      }}
    >
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-borde bg-superficie shadow-2xl">
        {/* Cabecera del modal */}
        <header className="flex items-start justify-between gap-4 border-b border-borde bg-superficie-alta/60 px-6 py-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-md bg-acento-100 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-acento-800 dark:bg-acento-950 dark:text-acento-300">
                <Tag className="size-3" aria-hidden="true" />
                {ficha.tipoLegible}
              </span>
              <span className="font-mono text-xs text-texto-suave">
                Código: {ficha.codigoInventario}
              </span>
            </div>
            <h3
              id="ficha-tecnica-titulo"
              className="mt-1.5 text-xl font-bold tracking-tight text-texto sm:text-2xl"
            >
              {ficha.nombre}
            </h3>
          </div>

          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar ficha técnica"
            className="rounded-lg p-1.5 text-texto-suave transition-colors hover:bg-superficie-alta hover:text-texto focus-visible:outline-2 focus-visible:outline-acento-600"
          >
            <X className="size-6" aria-hidden="true" />
          </button>
        </header>

        {/* Contenido con scroll */}
        <div className="space-y-6 overflow-y-auto p-6">
          {/* Vista previa de fotografía y estado general */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="relative flex h-52 items-center justify-center overflow-hidden rounded-xl border border-borde bg-superficie-alta">
              {ficha.foto ? (
                <img
                  src={ficha.foto}
                  alt={ficha.nombre}
                  className="h-full w-full object-contain p-2"
                  loading="lazy"
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-4 text-center text-texto-suave">
                  <Box className="size-12 opacity-40" aria-hidden="true" />
                  <span className="mt-2 text-xs">Sin fotografía registrada</span>
                </div>
              )}
            </div>

            <div className="flex flex-col justify-between gap-3">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-texto-suave">
                    Estado operativo:
                  </span>
                  <BadgeEstado estado={ficha.estado} />
                </div>

                <div className="rounded-xl border border-borde bg-superficie p-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-texto-suave">
                    Disponibilidad en almacén:
                  </span>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span
                      className={`text-lg font-bold ${
                        ficha.hayDisponibilidad
                          ? 'text-marca-700 dark:text-marca-400'
                          : 'text-error'
                      }`}
                    >
                      {ficha.unidadesDisponibles}{' '}
                      {ficha.unidadesDisponibles === 1 ? 'unidad' : 'unidades'}
                    </span>
                    <span className="text-xs text-texto-suave">
                      de {ficha.stockTotal} {ficha.stockTotal === 1 ? 'total' : 'totales'}
                    </span>
                  </div>
                </div>

                {ficha.esAltoValor && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
                    <ShieldAlert
                      className="size-5 shrink-0 text-amber-600 dark:text-amber-400"
                      aria-hidden="true"
                    />
                    <div className="text-xs">
                      <p className="font-bold">Equipo de Alto Valor</p>
                      <p className="mt-0.5 text-amber-800 dark:text-amber-300">
                        Exige garantía o compromiso especial de entrega al solicitarse (RN05).
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Descripción general si está presente */}
          {ficha.descripcion && (
            <div>
              <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-texto-suave">
                <FileText className="size-3.5 text-acento-600 dark:text-acento-400" aria-hidden="true" />
                Descripción del material
              </h4>
              <p className="mt-2 rounded-xl border border-borde bg-superficie p-3.5 text-sm leading-relaxed text-texto">
                {ficha.descripcion}
              </p>
            </div>
          )}

          {/* Sección de Especificaciones de Hardware (Ficha técnica) */}
          <div>
            <h4 className="flex items-center gap-2 border-b border-borde pb-2 text-sm font-bold uppercase tracking-wider text-texto">
              <Cpu className="size-4 text-acento-600 dark:text-acento-400" aria-hidden="true" />
              Especificaciones Técnicas del Hardware
            </h4>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <ItemEspecificacion etiqueta="Marca" valor={ficha.marca} />
              <ItemEspecificacion etiqueta="Modelo" valor={ficha.modelo} />
              <ItemEspecificacion
                etiqueta="N° de Serie"
                valor={ficha.numeroSerie}
                mono={ficha.numeroSerie !== 'No registrado'}
              />
              <ItemEspecificacion etiqueta="Color" valor={ficha.color} />
              <ItemEspecificacion etiqueta="Estado Físico" valor={ficha.estadoFisico} />
              <ItemEspecificacion etiqueta="Categoría" valor={ficha.tipoLegible} />
            </div>
          </div>

          {/* Sección de Reglas de Préstamo y Reputación (RN06) */}
          <div>
            <h4 className="flex items-center gap-2 border-b border-borde pb-2 text-sm font-bold uppercase tracking-wider text-texto">
              <Award className="size-4 text-marca-600 dark:text-marca-400" aria-hidden="true" />
              Condiciones de Préstamo y Reputación
            </h4>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <ItemRegla
                etiqueta="Tier Mínimo Requerido"
                valor={ficha.tierMinimoLegible}
                descripcion="Nivel mínimo para solicitar este material"
                tipo="neutral"
              />
              <ItemRegla
                etiqueta="Entrega Puntual"
                valor={`+${ficha.bonificacionTiempo} pts`}
                descripcion="Bonificación por devolver a tiempo"
                tipo="positivo"
              />
              <ItemRegla
                etiqueta="Tardanza (por día)"
                valor={`-${ficha.deduccionTardanza} pts`}
                descripcion="Deducción de reputación diaria"
                tipo="negativo"
              />
              <ItemRegla
                etiqueta="Daño Parcial"
                valor={`-${ficha.deduccionDanoParcial} pts`}
                descripcion="Deducción ante desperfectos reparables"
                tipo="negativo"
              />
              <ItemRegla
                etiqueta="Daño Total"
                valor={`-${ficha.deduccionDanoTotal} pts`}
                descripcion="Deducción por pérdida o rotura total"
                tipo="negativo"
              />
              {ficha.costoReparacionTexto && (
                <ItemRegla
                  etiqueta="Costo Reparación"
                  valor={ficha.costoReparacionTexto}
                  descripcion="Estimado ante daño parcial"
                  tipo="neutral"
                />
              )}
              {ficha.costoReposicionTexto && (
                <ItemRegla
                  etiqueta="Costo Reposición"
                  valor={ficha.costoReposicionTexto}
                  descripcion="Estimado ante daño irreparable"
                  tipo="neutral"
                />
              )}
            </div>
          </div>
        </div>

        {/* Pie de modal con botón de cierre */}
        <footer className="flex items-center justify-end border-t border-borde bg-superficie-alta/60 px-6 py-4">
          <Boton variante="secundario" tipo="button" onClick={onCerrar}>
            Cerrar ficha técnica
          </Boton>
        </footer>
      </div>
    </div>
  )
}

export default FichaTecnicaModal
