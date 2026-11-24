import Spinner from './Spinner'

function Boton({
  children,
  variante = 'primario',
  tamanio = 'mediano',
  cargando = false,
  deshabilitado = false,
  tipo,
  icono: Icono = null,
  className = '',
  ...rest
}) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento-600'

  const variantes = {
    primario: 'bg-marca-700 text-white hover:bg-marca-800 disabled:bg-neutro',
    secundario:
      'border border-borde bg-white text-texto hover:bg-superficie-alta dark:bg-superficie dark:text-texto dark:hover:bg-superficie-alta disabled:text-texto-suave',
    peligro: 'bg-error text-white hover:bg-red-700 disabled:bg-red-300',
    'peligro-secundario':
      'border border-red-300 bg-white text-red-700 hover:bg-red-50 hover:border-red-400 dark:bg-superficie dark:border-red-700/70 dark:text-red-300 dark:hover:bg-red-950/30 disabled:text-red-300',
    fantasma: 'bg-transparent text-acento-600 hover:bg-acento-50 disabled:text-texto-suave',
  }

  const tamanios = {
    pequeno: 'px-3 py-1.5 text-sm',
    mediano: 'px-4 py-2 text-sm',
    grande: 'px-5 py-2.5 text-base',
  }

  return (
    <button
      type={tipo}
      className={`${base} ${variantes[variante]} ${tamanios[tamanio]} ${className}`}
      disabled={deshabilitado || cargando}
      {...rest}
    >
      {cargando && <Spinner etiqueta="" />}
      {Icono && <Icono aria-hidden="true" className="size-4" />}
      {children}
    </button>
  )
}

export default Boton
