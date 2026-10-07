const VARIANTES_POR_ESTADO = {
  disponible: 'exito',
  prestado: 'aviso',
  reservado: 'info',
  en_mantenimiento: 'error',
  activo: 'exito',
  vencido: 'error',
  devuelto: 'neutro',
  desconocido: 'neutro',
}

const ETIQUETAS = {
  disponible: 'Disponible',
  prestado: 'Prestado',
  reservado: 'Reservado',
  en_mantenimiento: 'En mantenimiento',
  activo: 'Activo',
  vencido: 'Vencido',
  devuelto: 'Devuelto',
  desconocido: 'Estado desconocido',
}

const ESTILOS = {
  exito:
    'bg-marca-50 text-marca-700 ring-marca-200 dark:bg-marca-500/15 dark:text-marca-300 dark:ring-marca-700/60',
  info: 'bg-acento-50 text-acento-700 ring-acento-200 dark:bg-acento-500/15 dark:text-acento-300 dark:ring-acento-700/60',
  aviso:
    'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-700/60',
  error: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-700/60',
  neutro: 'bg-acento-50 text-acento-700 ring-acento-200 dark:bg-acento-500/15 dark:text-acento-300 dark:ring-acento-700/60',
}

function BadgeEstado({ estado, texto = '' }) {
  const variante = VARIANTES_POR_ESTADO[estado] || 'neutro'
  const etiqueta = texto || ETIQUETAS[estado] || estado

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${ESTILOS[variante]}`}
    >
      {etiqueta}
    </span>
  )
}

export default BadgeEstado