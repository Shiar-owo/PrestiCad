import Campo from '../ui/Campo'

const OPCIONES = [
  { valor: 'todos', etiqueta: 'Todos' },
  { valor: 'activo', etiqueta: 'Activo' },
  { valor: 'reservado', etiqueta: 'Reservado' },
  { valor: 'vencido', etiqueta: 'Vencido' },
  { valor: 'devuelto', etiqueta: 'Devuelto' },
]

export default function FiltroPrestamos({ estado, onCambiar }) {
  return (
    <Campo
      etiqueta="Filtrar por estado"
      opciones={OPCIONES}
      valor={estado}
      onCambio={(evento) => onCambiar(evento.target.value)}
      className="w-full sm:w-60"
    />
  )
}