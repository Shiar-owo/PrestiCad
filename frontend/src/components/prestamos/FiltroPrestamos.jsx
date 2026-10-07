const ESTADOS = [
  ['todos', 'Todos'],
  ['activo', 'Activo'],
  ['reservado', 'Reservado'],
  ['vencido', 'Vencido'],
  ['devuelto', 'Devuelto'],
]

export default function FiltroPrestamos({ estado, onCambiar }) {
  return (
    <div className="prestamos-filtro">
      <label htmlFor="filtro-estado-prestamo">Filtrar por estado</label>
      <select
        id="filtro-estado-prestamo"
        onChange={(evento) => onCambiar(evento.target.value)}
        value={estado}
      >
        {ESTADOS.map(([valor, etiqueta]) => (
          <option key={valor} value={valor}>{etiqueta}</option>
        ))}
      </select>
    </div>
  )
}
