import Boton from './Boton'

export default function ControlesPaginacion({ pagina, total, tamano = 25, onCambiar, cargando = false }) {
  const paginas = Math.max(1, Math.ceil(total / tamano))
  if (total <= 0) return null
  const desde = (pagina - 1) * tamano + 1
  const hasta = Math.min(pagina * tamano, total)
  return (
    <nav className="mt-4 flex flex-wrap items-center justify-between gap-3" aria-label="Paginación">
      <p className="text-sm text-texto-suave" aria-live="polite">Mostrando {desde}–{hasta} de {total}</p>
      <div className="flex items-center gap-2">
        <Boton variante="secundario" tamanio="pequeno" deshabilitado={cargando || pagina <= 1} onClick={() => onCambiar(pagina - 1)}>Anterior</Boton>
        <span className="min-w-24 text-center text-sm font-medium text-texto">Página {pagina} de {paginas}</span>
        <Boton variante="secundario" tamanio="pequeno" deshabilitado={cargando || pagina >= paginas} onClick={() => onCambiar(pagina + 1)}>Siguiente</Boton>
      </div>
    </nav>
  )
}
