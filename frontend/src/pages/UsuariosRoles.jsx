import { useEffect, useState } from 'react'

import { api } from '../api/client'
import useTituloPagina from '../hooks/useTituloPagina'
import Campo from '../components/ui/Campo'
import Tarjeta from '../components/ui/Tarjeta'
import Skeleton from '../components/ui/Skeleton'
import ErrorAlerta from '../components/ui/ErrorAlerta'
import EstadoVacio from '../components/ui/EstadoVacio'
import BadgeEstado from '../components/ui/BadgeEstado'

const OPCIONES_ROL = [
  { valor: 'prestatario', etiqueta: 'Prestatario' },
  { valor: 'gestor', etiqueta: 'Gestor de Almacén' },
  { valor: 'administrador', etiqueta: 'Administrador' },
]

function UsuariosRoles() {
  useTituloPagina('Gestionar roles')
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
      <header className="mb-5">
        <h2 className="text-xl font-bold text-texto">Gestionar roles y permisos</h2>
        <p className="mt-1 text-sm text-texto-suave">
          Asigna y actualiza los roles de los usuarios del sistema.
        </p>
      </header>

      {error && <ErrorAlerta mensaje={error} className="mb-4" />}

      {cargando && (
        <div className="space-y-3" role="status" aria-live="polite">
          {Array.from({ length: 5 }).map((_, indice) => (
            <Skeleton key={indice} className="h-12 rounded-lg" />
          ))}
        </div>
      )}

      {!cargando && usuarios.length === 0 && (
        <EstadoVacio titulo="Sin usuarios para gestionar" mensaje="No se encontraron usuarios registrados." />
      )}

      {!cargando && usuarios.length > 0 && (
        <Tarjeta className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-borde text-left text-xs uppercase tracking-wide text-texto-suave">
                  <th className="px-4 py-3 font-semibold">Nombre</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Tipo</th>
                  <th className="px-4 py-3 font-semibold">Rol actual</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {usuarios.map((usuario) => (
                  <tr key={usuario.id} className="text-texto">
                    <td className="px-4 py-3 font-semibold">
                      {usuario.nombre} {usuario.apellido}
                    </td>
                    <td className="px-4 py-3">{usuario.email}</td>
                    <td className="px-4 py-3">{usuario.tipo}</td>
                    <td className="px-4 py-3">
                      <Campo
                        opciones={OPCIONES_ROL}
                        valor={usuario.rol}
                        onCambio={(evento) => cambiarRol(usuario.id, evento.target.value)}
                        deshabilitado={guardandoId === usuario.id}
                        className="w-48"
                      />
                    </td>
                    <td className="px-4 py-3">
                      {usuario.estado === 'activo' ? (
                        <BadgeEstado estado="activo" />
                      ) : (
                        <span className="text-sm font-semibold text-error">{usuario.estado}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Tarjeta>
      )}
    </section>
  )
}

export default UsuariosRoles