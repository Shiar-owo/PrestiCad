import { useEffect, useState } from 'react'
import { api } from '../api/client'
import RolSelector from '../components/RolSelector'

// HU03 (Iniciar sesión) aún no existe en el repo, así que todavía no hay
// sesión/JWT de la que tomar "quién soy". Mientras tanto, esta vista pide
// el id del usuario administrador para poder mandarlo en el header
// X-Usuario-Id que exige el permiso EsAdministrador del backend.
// TODO: reemplazar por el id del usuario autenticado cuando exista login.
function UsuariosRoles() {
  const [usuarios, setUsuarios] = useState([])
  const [idAdmin, setIdAdmin] = useState('')
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
      const datos = await api.get('/usuarios/')
      setUsuarios(datos)
    } catch {
      setError('No se pudo cargar la lista de usuarios.')
    } finally {
      setCargando(false)
    }
  }

  async function cambiarRol(usuarioId, nuevoRol) {
    setError('')
    if (!idAdmin) {
      setError('Ingresa el id de un usuario administrador para poder cambiar roles.')
      return
    }

    const anteriores = usuarios
    setUsuarios((actuales) =>
      actuales.map((u) => (u.id === usuarioId ? { ...u, rol: nuevoRol } : u)),
    )
    setGuardandoId(usuarioId)

    try {
      await api.put(
        `/usuarios/${usuarioId}/rol/`,
        { rol: nuevoRol },
        { headers: { 'X-Usuario-Id': idAdmin } },
      )
    } catch {
      setUsuarios(anteriores) // revertir si el backend rechazó el cambio
      setError('No se pudo cambiar el rol (¿el id de administrador es correcto?).')
    } finally {
      setGuardandoId(null)
    }
  }

  return (
    <section>
      <h2>Gestionar roles y permisos</h2>

      <label>
        Id de usuario administrador (temporal, hasta que exista login):{' '}
        <input
          type="number"
          value={idAdmin}
          onChange={(evento) => setIdAdmin(evento.target.value)}
        />
      </label>

      {error && <p role="alert">{error}</p>}
      {cargando && <p>Cargando usuarios...</p>}

      {!cargando && (
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Tipo</th>
              <th>Rol</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((usuario) => (
              <tr key={usuario.id}>
                <td>{usuario.nombre} {usuario.apellido}</td>
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