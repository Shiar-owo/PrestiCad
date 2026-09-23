import { useState } from 'react'

const TIPOS_USUARIO = [
  { valor: 'alumno', etiqueta: 'Alumno' },
  { valor: 'docente', etiqueta: 'Docente' },
  { valor: 'administrativo', etiqueta: 'Administrativo' },
]

function Campo({ etiqueta, children }) {
  return (
    <label>
      <span>{etiqueta}</span>
      {children}
    </label>
  )
}

function RegistroUsuario() {
  const [datos, setDatos] = useState({
    nombre: '',
    apellido: '',
    email: '',
    dni: '',
    telefono: '',
    tipo: 'alumno',
    facultad: '',
    departamentoCarrera: '',
    password: '',
    confirmarPassword: '',
  })

  function actualizar(campo, valor) {
    setDatos((previos) => ({ ...previos, [campo]: valor }))
  }

  function manejarEnvio(evento) {
    evento.preventDefault()
    // TODO (T01.07): validar el formulario.
    // TODO (T01.08): enviar al endpoint POST /api/usuarios.
  }

  return (
    <section>
      <h2>Registrar usuario</h2>
      <form onSubmit={manejarEnvio}>
        <Campo etiqueta="Nombre">
          <input
            type="text"
            value={datos.nombre}
            onChange={(e) => actualizar('nombre', e.target.value)}
          />
        </Campo>

        <Campo etiqueta="Apellido">
          <input
            type="text"
            value={datos.apellido}
            onChange={(e) => actualizar('apellido', e.target.value)}
          />
        </Campo>

        <Campo etiqueta="Email institucional">
          <input
            type="email"
            value={datos.email}
            onChange={(e) => actualizar('email', e.target.value)}
          />
        </Campo>

        <Campo etiqueta="DNI">
          <input
            type="text"
            maxLength={8}
            value={datos.dni}
            onChange={(e) => actualizar('dni', e.target.value)}
          />
        </Campo>

        <Campo etiqueta="Teléfono (opcional)">
          <input
            type="tel"
            value={datos.telefono}
            onChange={(e) => actualizar('telefono', e.target.value)}
          />
        </Campo>

        <Campo etiqueta="Tipo de usuario">
          <select
            value={datos.tipo}
            onChange={(e) => actualizar('tipo', e.target.value)}
          >
            {TIPOS_USUARIO.map((tipo) => (
              <option key={tipo.valor} value={tipo.valor}>
                {tipo.etiqueta}
              </option>
            ))}
          </select>
        </Campo>

        <Campo etiqueta="Facultad">
          <input
            type="text"
            value={datos.facultad}
            onChange={(e) => actualizar('facultad', e.target.value)}
          />
        </Campo>

        <Campo etiqueta="Departamento / Carrera">
          <input
            type="text"
            value={datos.departamentoCarrera}
            onChange={(e) => actualizar('departamentoCarrera', e.target.value)}
          />
        </Campo>

        <Campo etiqueta="Contraseña inicial">
          <input
            type="password"
            value={datos.password}
            onChange={(e) => actualizar('password', e.target.value)}
          />
        </Campo>

        <Campo etiqueta="Confirmar contraseña">
          <input
            type="password"
            value={datos.confirmarPassword}
            onChange={(e) => actualizar('confirmarPassword', e.target.value)}
          />
        </Campo>

        <button type="submit">Registrar</button>
      </form>
    </section>
  )
}

export default RegistroUsuario