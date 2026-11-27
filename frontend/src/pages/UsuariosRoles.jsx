import { useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Ban, CalendarCheck2, CircleCheck, ClipboardCheck, Eye, Search, Sparkles, UserRound } from 'lucide-react'

import { api } from '../api/client'
import SesionContext from '../contextos/SesionContext'
import useTituloPagina from '../hooks/useTituloPagina'
import Campo from '../components/ui/Campo'
import Tarjeta from '../components/ui/Tarjeta'
import Skeleton from '../components/ui/Skeleton'
import ErrorAlerta from '../components/ui/ErrorAlerta'
import EstadoVacio from '../components/ui/EstadoVacio'
import ControlesPaginacion from '../components/ui/ControlesPaginacion'
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
  useTituloPagina('Usuarios')
  const { usuario: usuarioAutenticado } = useContext(SesionContext)
  const navigate = useNavigate()
  const [usuarios, setUsuarios] = useState([])
  const [totalUsuarios, setTotalUsuarios] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [cargando, setCargando] = useState(true)
  const [guardandoId, setGuardandoId] = useState(null)
  const [cambiandoEstadoId, setCambiandoEstadoId] = useState(null)
  const [confirmacionEstado, setConfirmacionEstado] = useState(null)
  const [perfilSeleccionado, setPerfilSeleccionado] = useState(null)
  const [error, setError] = useState('')
  const [mensajeExito, setMensajeExito] = useState('')
  const [busquedaNombre, setBusquedaNombre] = useState('')

  useEffect(() => {
    const temporizador = setTimeout(() => cargarUsuarios(pagina, busquedaNombre), busquedaNombre ? 300 : 0)
    return () => clearTimeout(temporizador)
  }, [pagina, busquedaNombre])

  async function cargarUsuarios(paginaSolicitada = pagina, q = busquedaNombre) {
    setCargando(true)
    setError('')
    try {
      const params = new URLSearchParams({ page: String(paginaSolicitada), page_size: '25' })
      if (q.trim()) params.set('q', q.trim())
      const datos = await api.get(`/usuarios/?${params}`)
      setUsuarios(Array.isArray(datos.results) ? datos.results : [])
      setTotalUsuarios(Number(datos.count) || 0)
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

  const usuariosFiltrados = usuarios

  function renderizarAvatar(usuario) {
    const iniciales = `${usuario.nombre?.[0] || ''}${usuario.apellido?.[0] || ''}`.toUpperCase()
    return usuario.foto_perfil ? (
      <img
        src={usuario.foto_perfil}
        alt=""
        className="size-10 shrink-0 rounded-full border border-borde object-cover shadow-xs"
        width="40"
        height="40"
        loading="lazy"
      />
    ) : (
      <span
        aria-hidden="true"
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-marca-100 text-xs font-bold text-marca-800 dark:bg-marca-500/15 dark:text-marca-300"
      >
        {iniciales || <UserRound className="size-4" />}
      </span>
    )
  }

  function renderizarRol(usuario, esCuentaPropia) {
    return esCuentaPropia || usuario.rol === 'prestatario' ? (
      <span className="text-sm font-medium text-texto">
        {ETIQUETAS_ROL[usuario.rol] || usuario.rol}
      </span>
    ) : (
      <Campo
        opciones={OPCIONES_ROL}
        valor={usuario.rol}
        onCambio={(evento) => cambiarRol(usuario.id, evento.target.value)}
        deshabilitado={guardandoId === usuario.id}
        className="w-full max-w-48"
      />
    )
  }

  function renderizarEstado(usuario) {
    return usuario.estado === 'activo' ? (
      <BadgeEstado estado="activo" texto="Activo" />
    ) : (
      <span className="inline-flex rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold capitalize text-rose-800 dark:bg-rose-950/50 dark:text-rose-300">
        {usuario.estado}
      </span>
    )
  }

  function renderizarAcciones(usuario, esCuentaPropia) {
    const estaActivo = usuario.estado === 'activo'
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Boton
          variante="accion"
          tamanio="pequeno"
          icono={Eye}
          onClick={() => setPerfilSeleccionado(usuario)}
          aria-label={`Ver perfil de ${usuario.nombre} ${usuario.apellido}`}
        >
          Ver perfil
        </Boton>
        {!esCuentaPropia && (
          <Boton
            variante={estaActivo ? 'peligro' : 'primario'}
            tamanio="pequeno"
            icono={estaActivo ? Ban : CircleCheck}
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
    )
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8">
      <ExitoModal mensaje={mensajeExito} onCerrar={() => setMensajeExito('')} />
      <header className="mb-5">
        <h2 className="text-xl font-bold text-texto">Usuarios y roles</h2>
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

      {!cargando && totalUsuarios === 0 && !busquedaNombre && (
        <EstadoVacio titulo="Sin usuarios para gestionar" mensaje="No se encontraron usuarios registrados." />
      )}

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <label htmlFor="buscar-usuario-nombre" className="sr-only">
            Buscar usuario por nombre
          </label>
          <div className="relative w-full sm:max-w-sm">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-texto-suave" />
            <input
              id="buscar-usuario-nombre"
              type="search"
              value={busquedaNombre}
              onChange={(evento) => { setBusquedaNombre(evento.target.value); setPagina(1) }}
              placeholder="Buscar usuario por nombre…"
              className="w-full rounded-lg border border-borde bg-superficie py-2 pl-9 pr-3 text-sm text-texto placeholder:text-texto-suave focus-visible:outline-2 focus-visible:outline-acento-600"
            />
          </div>
          <p className="text-xs text-texto-suave" aria-live="polite">
            {totalUsuarios} usuarios
          </p>
      </div>

      {!cargando && totalUsuarios > 0 && usuariosFiltrados.length === 0 && (
        <EstadoVacio titulo="No se encontraron usuarios" mensaje="Prueba con otro nombre. La búsqueda ignora mayúsculas y tildes." />
      )}

      {!cargando && usuariosFiltrados.length > 0 && (
        <div className="space-y-3 lg:hidden">
          {usuariosFiltrados.map((usuario) => {
            const esCuentaPropia = usuario.id === usuarioAutenticado?.id
            return (
              <Tarjeta key={usuario.id} className="p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    {renderizarAvatar(usuario)}
                    <div className="min-w-0">
                      <h3 className="break-words font-bold text-texto">{usuario.nombre} {usuario.apellido}</h3>
                      <p className="mt-0.5 break-all text-sm text-texto-suave">{usuario.email}</p>
                    </div>
                  </div>
                  <div className="shrink-0">{renderizarEstado(usuario)}</div>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-borde pt-3">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-texto-suave">Tipo</dt>
                    <dd className="mt-1 text-sm text-texto">
                      {ETIQUETAS_TIPO[usuario.tipo] || usuario.tipo}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-texto-suave">Rol actual</dt>
                    <dd className="mt-1">{renderizarRol(usuario, esCuentaPropia)}</dd>
                  </div>
                </dl>

                <div className="mt-4 border-t border-borde pt-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-texto-suave">Acciones</p>
                  {renderizarAcciones(usuario, esCuentaPropia)}
                </div>
              </Tarjeta>
            )
          })}
        </div>
      )}

      {!cargando && usuariosFiltrados.length > 0 && (
        <div className="hidden lg:block">
          <Tarjeta className="overflow-hidden">
            <table className="w-full table-fixed text-sm">
              <colgroup>
                <col className="w-[20%]" />
                <col className="w-[19%]" />
                <col className="w-[14%]" />
                <col className="w-[18%]" />
                <col className="w-[12%]" />
                <col className="w-[17%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-borde bg-superficie-alta/70 text-left text-xs uppercase tracking-wide text-texto-suave">
                  <th scope="col" className="px-3 py-3 font-bold">Usuario</th>
                  <th scope="col" className="px-3 py-3 font-bold">Email</th>
                  <th scope="col" className="px-3 py-3 font-bold">Tipo</th>
                  <th scope="col" className="px-3 py-3 font-bold">Rol actual</th>
                  <th scope="col" className="px-3 py-3 font-bold">Estado</th>
                  <th scope="col" className="px-3 py-3 font-bold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {usuariosFiltrados.map((usuario) => {
                  const esCuentaPropia = usuario.id === usuarioAutenticado?.id
                  return (
                    <tr key={usuario.id} className="text-texto transition-colors hover:bg-superficie-alta/40">
                      <td className="px-3 py-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                          {renderizarAvatar(usuario)}
                          <span className="min-w-0 whitespace-normal break-words font-semibold">{usuario.nombre} {usuario.apellido}</span>
                        </div>
                      </td>
                      <td className="whitespace-normal break-words px-3 py-3 text-xs">{usuario.email}</td>
                      <td className="whitespace-normal px-3 py-3">
                        {ETIQUETAS_TIPO[usuario.tipo] || usuario.tipo}
                      </td>
                      <td className="px-3 py-3">
                        {renderizarRol(usuario, esCuentaPropia)}
                      </td>
                      <td className="px-3 py-3">{renderizarEstado(usuario)}</td>
                      <td className="px-3 py-3">
                        {renderizarAcciones(usuario, esCuentaPropia)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Tarjeta>
        </div>
      )}

      {!cargando && <ControlesPaginacion pagina={pagina} total={totalUsuarios} onCambiar={setPagina} cargando={cargando} />}

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
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-borde bg-white p-6 shadow-2xl dark:bg-superficie sm:p-7"
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-4">
                <div className="shrink-0 [&_img]:size-16 [&_img]:border-2 [&_img]:border-marca-200 [&_img]:shadow-sm [&_span]:size-16 [&_span]:text-lg">
                  {renderizarAvatar(perfilSeleccionado)}
                </div>
                <div className="min-w-0">
                  <h3 id="detalle-perfil-titulo" className="break-words text-xl font-bold text-texto sm:text-2xl">
                    {perfilSeleccionado.nombre} {perfilSeleccionado.apellido}
                  </h3>
                  <p className="mt-1 break-all text-sm text-texto-suave">{perfilSeleccionado.email}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-full bg-marca-100 px-2.5 py-1 text-xs font-semibold text-marca-800 dark:bg-marca-500/15 dark:text-marca-300">
                      {ETIQUETAS_ROL[perfilSeleccionado.rol] || perfilSeleccionado.rol}
                    </span>
                    {renderizarEstado(perfilSeleccionado)}
                  </div>
                </div>
              </div>
              <Boton variante="secundario" tamanio="pequeno" onClick={() => setPerfilSeleccionado(null)}>
                Cerrar
              </Boton>
            </div>
            <dl className="grid gap-3 sm:grid-cols-2">
              {[
                ['DNI', perfilSeleccionado.dni],
                ['Teléfono', perfilSeleccionado.telefono || 'Sin teléfono registrado'],
                ['Tipo de usuario', ETIQUETAS_TIPO[perfilSeleccionado.tipo] || perfilSeleccionado.tipo],
                ['Facultad', perfilSeleccionado.facultad],
                ['Departamento / carrera', perfilSeleccionado.departamento_carrera || 'Sin especificar'],
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
            {perfilSeleccionado.rol === 'prestatario' && (
              <>
                <div className="mt-5">
                  <h4 className="mb-3 text-sm font-bold text-texto">Límites y actividad</h4>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      {
                        etiqueta: 'Préstamos activos',
                        valor: perfilSeleccionado.prestamos_activos ?? 0,
                        limite: perfilSeleccionado.maximo_prestamos_activos ?? 0,
                        icono: ClipboardCheck,
                        color: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
                        sufijo: 'en curso',
                      },
                      {
                        etiqueta: 'Reservas activas',
                        valor: perfilSeleccionado.reservas_activas ?? 0,
                        limite: perfilSeleccionado.maximo_reservas_activas ?? 0,
                        icono: CalendarCheck2,
                        color: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
                        sufijo: 'activas',
                      },
                      {
                        etiqueta: 'Puntos ganados esta semana',
                        valor: perfilSeleccionado.reputacion_puntos_ganados_semana ?? 0,
                        limite: perfilSeleccionado.reputacion_tope_semanal ?? 0,
                        icono: Sparkles,
                        color: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
                        sufijo: 'puntos',
                      },
                    ].map(({ etiqueta, valor, limite, icono: Icono, color, sufijo }) => (
                      <article key={etiqueta} className="rounded-xl border border-borde bg-superficie p-4">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-semibold leading-5 text-texto-suave">{etiqueta}</p>
                          <span className={`rounded-lg p-2 ${color}`}><Icono className="size-4" aria-hidden="true" /></span>
                        </div>
                        <p className="mt-3 text-2xl font-bold tabular-nums text-texto">
                          {etiqueta === 'Puntos ganados esta semana' ? `+${valor}` : valor}
                          <span className="ml-1 text-sm font-medium text-texto-suave">/ {limite} {sufijo === 'puntos' ? 'pts' : ''}</span>
                        </p>
                      </article>
                    ))}
                  </div>
                </div>
                <ResumenTier tier={perfilSeleccionado.reputacion_tier} className="mt-4" />
              </>
            )}
            {perfilSeleccionado.rol === 'prestatario' && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-borde bg-superficie p-4">
                <p className="text-sm text-texto-suave">Consulta el historial completo de préstamos de este usuario.</p>
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
