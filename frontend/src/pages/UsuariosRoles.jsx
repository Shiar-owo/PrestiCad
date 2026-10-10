import { useEffect, useState } from 'react'

import { api } from '../api/client'
import useTituloPagina from '../hooks/useTituloPagina'
import Campo from '../components/ui/Campo'
import Tarjeta from '../components/ui/Tarjeta'
import Skeleton from '../components/ui/Skeleton'
import ErrorAlerta from '../components/ui/ErrorAlerta'
import EstadoVacio from '../components/ui/EstadoVacio'
import BadgeEstado from '../components/ui/BadgeEstado'
import Boton from '../components/ui/Boton'

const OPCIONES_ROL = [
  { valor: 'prestatario', etiqueta: 'Prestatario' },
  { valor: 'gestor', etiqueta: 'Gestor de Almacén' },
  { valor: 'administrador', etiqueta: 'Administrador' },
]

const ETIQUETAS_TIPO = {
  alumno: 'Alumno',
  docente: 'Docente',
  administrativo: 'Administrativo',
}

const ETIQUETAS_ROL = Object.fromEntries(OPCIONES_ROL.map(({ valor, etiqueta }) => [valor, etiqueta]))
const ETIQUETAS_TIER = {
  avanzado: 'Avanzado',
  estandar: 'Estándar',
  restringido: 'Restringido',
}

function UsuariosRoles() {
  useTituloPagina('Gestionar roles')
  const [usuarios, setUsuarios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [guardandoId, setGuardandoId] = useState(null)
  const [perfilSeleccionado, setPerfilSeleccionado] = useState(null)
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
                  <th className="px-4 py-3 font-semibold">Perfil</th>
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
                    <td className="px-4 py-3">
                      <Boton
                        variante="secundario"
                        tamanio="pequeno"
                        onClick={() => setPerfilSeleccionado(usuario)}
                        aria-label={`Ver perfil de ${usuario.nombre} ${usuario.apellido}`}
                      >
                        Ver perfil
                      </Boton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Tarjeta>
      )}

      {perfilSeleccionado && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(evento) => {
            if (evento.target === evento.currentTarget) setPerfilSeleccionado(null)
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="detalle-perfil-titulo"
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-borde bg-white p-6 shadow-xl dark:bg-superficie"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 id="detalle-perfil-titulo" className="text-xl font-bold text-texto">
                  Perfil de {perfilSeleccionado.nombre} {perfilSeleccionado.apellido}
                </h3>
                <p className="mt-1 text-sm text-texto-suave">Información registrada del usuario.</p>
              </div>
              <Boton variante="secundario" tamanio="pequeno" onClick={() => setPerfilSeleccionado(null)}>
                Cerrar
              </Boton>
            </div>
            <dl className="grid gap-3 sm:grid-cols-2">
              {[
                ['Email', perfilSeleccionado.email],
                ['DNI', perfilSeleccionado.dni],
                ['Teléfono', perfilSeleccionado.telefono || 'Sin teléfono registrado'],
                ['Tipo de usuario', ETIQUETAS_TIPO[perfilSeleccionado.tipo] || perfilSeleccionado.tipo],
                ['Facultad', perfilSeleccionado.facultad],
                ['Departamento / carrera', perfilSeleccionado.departamento_carrera || 'Sin especificar'],
                ['Rol', ETIQUETAS_ROL[perfilSeleccionado.rol] || perfilSeleccionado.rol],
                ['Estado', perfilSeleccionado.estado],
                ['Puntaje de reputación', perfilSeleccionado.reputacion_puntaje],
                ['Tier de reputación', ETIQUETAS_TIER[perfilSeleccionado.reputacion_tier] || perfilSeleccionado.reputacion_tier],
              ].map(([etiqueta, valor]) => (
                <div key={etiqueta} className="rounded-lg border border-borde bg-superficie p-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-texto-suave">{etiqueta}</dt>
                  <dd className="mt-1 break-words text-sm font-semibold text-texto">{valor}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      )}
    </section>
  )
}

export default UsuariosRoles
