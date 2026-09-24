// Debe reflejar la misma taxonomía que backend/apps/usuarios/constants.py (ROLES)
const OPCIONES_ROL = [
  { valor: 'prestatario', etiqueta: 'Prestatario' },
  { valor: 'gestor', etiqueta: 'Gestor de Almacén' },
  { valor: 'administrador', etiqueta: 'Administrador' },
]

function RolSelector({ valor, onChange, disabled = false }) {
  return (
    <select
      value={valor}
      disabled={disabled}
      onChange={(evento) => onChange(evento.target.value)}
    >
      {OPCIONES_ROL.map((opcion) => (
        <option key={opcion.valor} value={opcion.valor}>
          {opcion.etiqueta}
        </option>
      ))}
    </select>
  )
}

export default RolSelector