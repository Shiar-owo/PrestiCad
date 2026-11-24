const PRESENTACION_TIER = {
  avanzado: {
    etiqueta: 'Avanzado',
    estilo: 'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-700/60',
    descripcion: 'Acceso a materiales de todos los Tiers y prioridad en la cola de reservas.',
  },
  estandar: {
    etiqueta: 'Estándar',
    estilo: 'bg-blue-50 text-blue-800 ring-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-700/60',
    descripcion: 'Acceso estándar; las prórrogas requieren aprobación.',
  },
  restringido: {
    etiqueta: 'Restringido',
    estilo: 'bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-700/60',
    descripcion: 'Acceso limitado a materiales básicos y sin prórrogas.',
  },
}

function ResumenTier({ tier, className = '' }) {
  const presentacion = PRESENTACION_TIER[tier]
  const etiqueta = presentacion?.etiqueta || tier || 'Sin tier'

  return (
    <section
      className={`rounded-xl border border-borde bg-superficie p-4 ${className}`}
      aria-label="Nivel de reputación"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-texto-suave">Tier de reputación</h3>
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${presentacion?.estilo || 'bg-superficie-alta text-texto ring-borde'}`}>
          {etiqueta}
        </span>
      </div>
      <p className="mt-2 text-sm text-texto">
        {presentacion?.descripcion || 'Consulta las condiciones de acceso con el gestor de almacén.'}
      </p>
    </section>
  )
}

export default ResumenTier
