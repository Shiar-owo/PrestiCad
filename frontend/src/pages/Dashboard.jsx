import { useState } from 'react'

import CatalogoMateriales from './CatalogoMateriales'
import Materiales from './Materiales'
import PerfilUsuario from './PerfilUsuario'
import RegistrarPrestamo from './RegistrarPrestamo'
import MisPrestamos from '../prestamos/MisPrestamos'
import HistorialPrestamos from '../prestamos/HistorialPrestamos'

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

function PanelPrestatario({ usuario, onPerfilActualizado }) {
  const [seccion, setSeccion] = useState('inicio')

  return (
    <div className="dashboard__panel">
      <nav aria-label="Opciones del prestatario" className="navegacion-auth">
        <button
          type="button"
          className={seccion === 'inicio' ? 'activo' : 'boton-secundario'}
          onClick={() => setSeccion('inicio')}
        >
          Inicio
        </button>
        <button
          type="button"
          className={seccion === 'prestamos' ? 'activo' : 'boton-secundario'}
          onClick={() => setSeccion('prestamos')}
        >
          Mis préstamos
        </button>
        <button
          type="button"
          className={seccion === 'perfil' ? 'activo' : 'boton-secundario'}
          onClick={() => setSeccion('perfil')}
        >
          Mi perfil
        </button>
      </nav>

      {seccion === 'perfil' ? (
        <PerfilUsuario onPerfilActualizado={onPerfilActualizado} />
      ) : seccion === 'prestamos' ? (
        <MisPrestamos />
      ) : (
        <>
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
          <hr style={{ margin: '2rem 0' }} />
          <CatalogoMateriales />
        </>
      )}
    </div>
  )
}

function PanelGestor() {
  const [seccion, setSeccion] = useState('gestion')

  return (
    <div className="dashboard__panel">
      <h3>Panel de Gestor de Almacén</h3>
      <p>Control de inventario, recepción de devoluciones y entrega de materiales.</p>
      <nav aria-label="Secciones de almacén" className="navegacion-auth">
        <button
          type="button"
          className={seccion === 'gestion' ? 'activo' : 'boton-secundario'}
          onClick={() => setSeccion('gestion')}
        >
          Gestión de inventario
        </button>
        <button
          type="button"
          className={seccion === 'catalogo' ? 'activo' : 'boton-secundario'}
          onClick={() => setSeccion('catalogo')}
        >
          Vista catálogo (búsqueda)
        </button>
        <button
          type="button"
          className={seccion === 'prestamo' ? 'activo' : 'boton-secundario'}
          onClick={() => setSeccion('prestamo')}
        >
          Registrar entrega
        </button>
        <button
          type="button"
          className={seccion === 'historial' ? 'activo' : 'boton-secundario'}
          onClick={() => setSeccion('historial')}
        >
          Historial de préstamos
        </button>
      </nav>
      <hr style={{ margin: '1.5rem 0' }} />
      {seccion === 'gestion' ? (
        <Materiales />
      ) : seccion === 'catalogo' ? (
        <CatalogoMateriales />
      ) : seccion === 'historial' ? (
        <HistorialPrestamos />
      ) : (
        <RegistrarPrestamo />
      )}
    </div>
  )
}

function PanelAdministrador() {
  const [seccion, setSeccion] = useState('gestion')

  return (
    <div className="dashboard__panel">
      <h3>Panel de Administrador</h3>
      <p>Gestión global de usuarios, asignación de roles y permisos del sistema.</p>
      <nav aria-label="Secciones de administrador" className="navegacion-auth">
        <button
          type="button"
          className={seccion === 'gestion' ? 'activo' : 'boton-secundario'}
          onClick={() => setSeccion('gestion')}
        >
          Gestión de inventario
        </button>
        <button
          type="button"
          className={seccion === 'catalogo' ? 'activo' : 'boton-secundario'}
          onClick={() => setSeccion('catalogo')}
        >
          Vista catálogo (búsqueda)
        </button>
        <button
          type="button"
          className={seccion === 'historial' ? 'activo' : 'boton-secundario'}
          onClick={() => setSeccion('historial')}
        >
          Historial de préstamos
        </button>
      </nav>
      <hr style={{ margin: '1.5rem 0' }} />
      {seccion === 'gestion' ? (
        <Materiales />
      ) : seccion === 'catalogo' ? (
        <CatalogoMateriales />
      ) : (
        <HistorialPrestamos />
      )}
    </div>
  )
}

function Dashboard({ usuario, onPerfilActualizado }) {
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
      </header>

      <main className="dashboard__contenido">
        {usuario.rol === 'prestatario' && (
          <PanelPrestatario usuario={usuario} onPerfilActualizado={onPerfilActualizado} />
        )}
        {usuario.rol === 'gestor' && <PanelGestor />}
        {usuario.rol === 'administrador' && <PanelAdministrador />}
      </main>
    </section>
  )
}

export default Dashboard
