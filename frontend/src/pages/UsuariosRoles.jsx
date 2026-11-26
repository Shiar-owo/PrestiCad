import { useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'

import { api } from '../api/client'
import SesionContext from '../contextos/SesionContext'
import useTituloPagina from '../hooks/useTituloPagina'
import Campo from '../components/ui/Campo'
import Tarjeta from '../components/ui/Tarjeta'
import Skeleton from '../components/ui/Skeleton'
import ErrorAlerta from '../components/ui/ErrorAlerta'
import EstadoVacio from '../components/ui/EstadoVacio'
import BadgeEstado from '../components/ui/BadgeEstado'
import ResumenTier from '../components/ui/ResumenTier'
import Boton from '../components/ui/Boton'
import ExitoModal from '../components/ui/ExitoModal'

const OPCIONES_ROL = [
  { valor: 'gestor', etiqueta: 'Gestor de Almacén' },
  { valor: 'administrador', etiqueta: 'Administrador' },
]

const ETIQUETAS_TIPO = {
  alumno: 'Alumno',
  docente: 'Docente',
  administrativo: 'Administrativo',
}

const ETIQUETAS_ROL = {
  prestatario: 'Prestatario',
  ...Object.fromEntries(OPCIONES_ROL.map(({ valor, etiqueta }) => [valor, etiqueta])),
}
function UsuariosRoles() {
  useTituloPagina('Gestionar roles')
  const { usuario: usuarioAutenticado } = useContext(SesionContext)
  const navigate = useNavigate()
  const [usuarios, setUsuarios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [guardandoId, setGuardandoId] = useState(null)
  const [cambiandoEstadoId, setCambiandoEstadoId] = useState(null)
  const [confirmacionEstado, setConfirmacionEstado] = useState(null)
  const [perfilSeleccionado, setPerfilSeleccionado] = useState(null)
  const [error, setError] = useState('')
  const [mensajeExito, setMensajeExito] = useState('')

  useEffect(() => {
    cargarUsuarios()
  }, [])

  async function cargarUsuarios() {
    setCargando(true)
    setError('')
    try {
      const datos = await api.get('/usuarios/')
      setUsuarios(Array.isArray(datos) ? datos : [])
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
      const nombre = usuarios.find((usuario) => usuario.id === usuarioId)?.nombre || 'El usuario'
      setMensajeExito(`El rol de ${nombre} se actualizó correctamente.`)
    } catch (fallo) {
      setError(
        (typeof fallo.datos?.detail === 'string' && fallo.datos.detail)
          || 'No se pudo cambiar el rol. Actualiza la lista e inténtalo otra vez.',
      )
    } finally {
      setGuardandoId(null)
    }
  }

  async function confirmarCambioEstado() {
    if (!confirmacionEstado) return
    const { usuario, nuevoEstado } = confirmacionEstado
    setError('')
    setCambiandoEstadoId(usuario.id)
    try {
      const actualizado = await api.patch(`/usuarios/${usuario.id}/estado/`, { estado: nuevoEstado })
      setUsuarios((actuales) => actuales.map((item) =>
        item.id === usuario.id ? { ...item, estado: actualizado.estado } : item,
      ))
      setPerfilSeleccionado((actual) => (
        actual && actual.id === usuario.id ? { ...actual, estado: actualizado.estado } : actual
      ))
      const nombreCompleto = `${usuario.nombre} ${usuario.apellido}`.trim()
      const notaPrestamos = nuevoEstado === 'inactivo' && actualizado.tiene_prestamos_activos
        ? ' El usuario tiene préstamos vigentes que podrán seguir registrándose como devueltos por gestión.'
        : ''
      setMensajeExito(
        nuevoEstado === 'inactivo'
          ? `La cuenta de ${nombreCompleto} fue desactivada correctamente.${notaPrestamos}`
          : `La cuenta de ${nombreCompleto} fue reactivada correctamente.`,
      )
      setConfirmacionEstado(null)
    } catch (fallo) {
      setError(
        (typeof fallo.datos?.detail === 'string' && fallo.datos.detail)
          || 'No se pudo actualizar el estado del usuario. Inténtalo otra vez.',
      )
      setConfirmacionEstado(null)
    } finally {
      setCambiandoEstadoId(null)
    }
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8">
      <ExitoModal mensaje={mensajeExito} onCerrar={() => setMensajeExito('')} />
      <header className="mb-5">
        <h2 className="text-xl font-bold text-texto">Gestionar usuarios, roles y permisos</h2>
        <p className="mt-1 text-sm text-texto-suave">
          Asigna roles, consulta perfiles y activa o desactiva cuentas del sistema.
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
                  <th className="px-4 py-3 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {usuarios.map((usuario) => {
                  const esCuentaPropia = usuario.id === usuarioAutenticado?.id
                  const estaActivo = usuario.estado === 'activo'
                  return (
                  <tr key={usuario.id} className="text-texto">
                    <td className="px-4 py-3 font-semibold">
                      {usuario.nombre} {usuario.apellido}
                    </td>
                    <td className="px-4 py-3">{usuario.email}</td>
                    <td className="px-4 py-3">{usuario.tipo}</td>
                    <td className="px-4 py-3">
                      {esCuentaPropia || usuario.rol === 'prestatario' ? (
                        <span className="text-sm font-medium">
                          {ETIQUETAS_ROL[usuario.rol] || usuario.rol}
                        </span>
                      ) : (
                        <Campo
                          opciones={OPCIONES_ROL}
                          valor={usuario.rol}
                          onCambio={(evento) => cambiarRol(usuario.id, evento.target.value)}
                          deshabilitado={guardandoId === usuario.id}
                          className="w-48"
                        />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {estaActivo ? (
                        <BadgeEstado estado="activo" texto="Activo" />
                      ) : (
                        <span className="inline-flex rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold capitalize text-rose-800 dark:bg-rose-950/50 dark:text-rose-300">
                          {usuario.estado}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Boton
                          variante="secundario"
                          tamanio="pequeno"
                          onClick={() => setPerfilSeleccionado(usuario)}
                          aria-label={`Ver perfil de ${usuario.nombre} ${usuario.apellido}`}
                        >
                          Ver perfil
                        </Boton>
                        {!esCuentaPropia && (
                          <Boton
                            variante={estaActivo ? 'peligro' : 'secundario'}
                            tamanio="pequeno"
                            cargando={cambiandoEstadoId === usuario.id}
                            deshabilitado={cambiandoEstadoId !== null}
                            onClick={() => setConfirmacionEstado({
                              usuario,
                              nuevoEstado: estaActivo ? 'inactivo' : 'activo',
                            })}
                            aria-label={`${estaActivo ? 'Desactivar' : 'Reactivar'} cuenta de ${usuario.nombre} ${usuario.apellido}`}
                          >
                            {estaActivo ? 'Desactivar' : 'Reactivar'}
                          </Boton>
                        )}
                      </div>
                    </td>
                  </tr>
                  )
                })}
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
                ...(!['gestor', 'administrador'].includes(perfilSeleccionado.rol)
                  ? [['Puntaje de reputación', perfilSeleccionado.reputacion_puntaje]]
                  : []),
              ].map(([etiqueta, valor]) => (
                <div key={etiqueta} className="rounded-lg border border-borde bg-superficie p-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-texto-suave">{etiqueta}</dt>
                  <dd className="mt-1 break-words text-sm font-semibold text-texto">{valor}</dd>
                </div>
              ))}
            </dl>
            {!['gestor', 'administrador'].includes(perfilSeleccionado.rol) && (
              <ResumenTier tier={perfilSeleccionado.reputacion_tier} className="mt-3" />
            )}
            {!['gestor', 'administrador'].includes(perfilSeleccionado.rol) && (
              <div className="mt-4 rounded-lg border border-borde bg-superficie p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-texto-suave mb-2">
                  Préstamos activos
                </p>
                <p className="text-sm font-bold text-texto mb-3">
                  {perfilSeleccionado.prestamos_activos ?? 0} en curso
                </p>
                <Boton
                  variante="secundario"
                  tamanio="pequeno"
                  onClick={() => {
                    setPerfilSeleccionado(null)
                    navigate(
                      `/panel/historial?dni=${encodeURIComponent(perfilSeleccionado.dni)}`,
                    )
                  }}
                >
                  Ver historial de préstamos
                </Boton>
              </div>
            )}
          </section>
        </div>
      )}

      {confirmacionEstado && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(evento) => {
            if (evento.target === evento.currentTarget && !cambiandoEstadoId) {
              setConfirmacionEstado(null)
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirmar-estado-usuario-titulo"
            className="w-full max-w-md rounded-xl border border-borde bg-white p-6 shadow-xl dark:bg-superficie"
          >
            <h3 id="confirmar-estado-usuario-titulo" className="text-lg font-bold text-texto">
              {confirmacionEstado.nuevoEstado === 'inactivo'
                ? 'Desactivar cuenta de usuario'
                : 'Reactivar cuenta de usuario'}
            </h3>
            <p className="mt-2 text-sm text-texto-suave">
              {confirmacionEstado.nuevoEstado === 'inactivo' ? (
                <>
                  ¿Seguro que deseas desactivar a{' '}
                  <strong className="text-texto">
                    {confirmacionEstado.usuario.nombre} {confirmacionEstado.usuario.apellido}
                  </strong>
                  ? El usuario perderá el acceso a su sesión y no podrá solicitar nuevos préstamos ni reservas. Si mantiene préstamos vigentes, el gestor podrá seguir registrando su devolución.
                </>
              ) : (
                <>
                  ¿Deseas reactivar la cuenta de{' '}
                  <strong className="text-texto">
                    {confirmacionEstado.usuario.nombre} {confirmacionEstado.usuario.apellido}
                  </strong>
                  ? Volverá a poder iniciar sesión y operar con normalidad.
                </>
              )}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Boton
                variante="secundario"
                tamanio="pequeno"
                deshabilitado={Boolean(cambiandoEstadoId)}
                onClick={() => setConfirmacionEstado(null)}
              >
                Cancelar
              </Boton>
              <Boton
                variante={confirmacionEstado.nuevoEstado === 'inactivo' ? 'peligro' : 'primario'}
                tamanio="pequeno"
                cargando={Boolean(cambiandoEstadoId)}
                onClick={confirmarCambioEstado}
              >
                {confirmacionEstado.nuevoEstado === 'inactivo' ? 'Confirmar desactivación' : 'Confirmar reactivación'}
              </Boton>
            </div>
          </section>
        </div>
      )}
    </section>
  )
}

export default UsuariosRoles
