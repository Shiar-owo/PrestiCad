import RegistroUsuario from './RegistroUsuario'
import UsuariosRoles from './UsuariosRoles'

const ETIQUETAS_ROL = {
  prestatario: 'Prestatario',
  gestor: 'Gestor de Almacén',
  administrador: 'Administrador',
}

const ETIQUETAS_TIER = {
  avanzado: 'Avanzado',
  estandar: 'Estándar',
  restringido: 'Restringido',
}

function PanelPrestatario({ usuario }) {
  return (
    <div className="dashboard__panel">
      <h3>Panel de Prestatario</h3>
      <p>Bienvenido al catálogo de préstamos de la universidad.</p>
      <div className="dashboard__tarjetas">
        <div className="dashboard__tarjeta">
          <h4>Nivel de Reputación</h4>
          <p>{ETIQUETAS_TIER[usuario.reputacion_tier] || usuario.reputacion_tier}</p>
        </div>
        <div className="dashboard__tarjeta">
          <h4>Estado de Cuenta</h4>
          <p>{usuario.estado === 'activo' ? 'Activo' : usuario.estado}</p>
        </div>
      </div>
    </div>
  )
}

function PanelGestor() {
  return (
    <div className="dashboard__panel">
      <h3>Panel de Gestor de Almacén</h3>
      <p>Control de inventario, recepción de devoluciones y entrega de materiales.</p>
      <div className="dashboard__tarjetas">
        <div className="dashboard__tarjeta">
          <h4>Inventario</h4>
          <p>Consulta y registro de materiales en almacén.</p>
        </div>
        <div className="dashboard__tarjeta">
          <h4>Préstamos activos</h4>
          <p>Revisión de solicitudes y entregas en curso.</p>
        </div>
      </div>
    </div>
  )
}

function PanelAdministrador() {
  return (
    <div className="dashboard__panel">
      <h3>Panel de Administrador</h3>
      <p>Gestión global de usuarios, asignación de roles y permisos del sistema.</p>
      <UsuariosRoles />
      <hr style={{ margin: '2rem 0' }} />
      <RegistroUsuario />
    </div>
  )
}

function Dashboard({ usuario, onCerrarSesion }) {
  const nombreRol = ETIQUETAS_ROL[usuario.rol] || usuario.rol

  return (
    <section className="dashboard">
      <header className="dashboard__cabecera">
        <div>
          <h2>Bienvenido, {usuario.nombre} {usuario.apellido}</h2>
          <p className="dashboard__subtitulo">
            Sesión iniciada como <strong>{nombreRol}</strong> ({usuario.email})
          </p>
        </div>
        <button type="button" onClick={onCerrarSesion} className="boton-secundario">
          Cerrar sesión
        </button>
      </header>

      <main className="dashboard__contenido">
        {usuario.rol === 'prestatario' && <PanelPrestatario usuario={usuario} />}
        {usuario.rol === 'gestor' && <PanelGestor />}
        {usuario.rol === 'administrador' && <PanelAdministrador />}
      </main>
    </section>
  )
}

export default Dashboard
