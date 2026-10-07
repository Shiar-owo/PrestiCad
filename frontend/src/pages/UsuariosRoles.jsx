import { useEffect, useState } from 'react'

import { api } from '../api/client'
import RolSelector from '../components/RolSelector'

function UsuariosRoles() {
  const [usuarios, setUsuarios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [guardandoId, setGuardandoId] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    cargarUsuarios()
  }, [])

  async function cargarUsuarios() {
    setCargando(true)
    setError('')
    try {
      setUsuarios(await api.get('/usuarios/'))
    } catch (fallo) {
      setError(fallo.status === 403
        ? 'Solo un administrador puede gestionar roles.'
        : 'No se pudo cargar la lista de usuarios.')
    } finally {
      setCargando(false)
    }
  }

  async function cambiarRol(usuarioId, nuevoRol) {
    setError('')
    setGuardandoId(usuarioId)
    try {
      const actualizado = await api.put(`/usuarios/${usuarioId}/rol/`, { rol: nuevoRol })
      setUsuarios((actuales) => actuales.map((usuario) =>
        usuario.id === usuarioId ? { ...usuario, rol: actualizado.rol } : usuario,
      ))
    } catch {
      setError('No se pudo cambiar el rol. Actualiza la lista e inténtalo otra vez.')
    } finally {
      setGuardandoId(null)
    }
  }

  return (
    <section>
      <h2>Gestionar roles y permisos</h2>
      {error && <p role="alert" className="error">{error}</p>}
      {cargando && <p>Cargando usuarios…</p>}
      {!cargando && !error && (
        <table>
          <thead>
            <tr><th>Nombre</th><th>Email</th><th>Tipo</th><th>Rol actual</th><th>Estado</th></tr>
          </thead>
          <tbody>
            {usuarios.map((usuario) => (
              <tr key={usuario.id}>
                <td>{usuario.nombre} {usuario.apellido}</td>
                <td>{usuario.email}</td>
                <td>{usuario.tipo}</td>
                <td>
                  <RolSelector
                    valor={usuario.rol}
                    disabled={guardandoId === usuario.id}
                    onChange={(nuevoRol) => cambiarRol(usuario.id, nuevoRol)}
                  />
                </td>
                <td>{usuario.estado}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

export default UsuariosRoles
