import { useContext } from 'react'
import { Navigate, Route, Routes } from 'react-router'

import SesionContext from '../contextos/SesionContext'
import PanelPrivado from '../components/layout/PanelPrivado'
import { RedirigirAutenticado, RequerirRol, RequerirSesion } from './Guards'
import CatalogoMateriales from '../pages/CatalogoMateriales'
import Login from '../pages/Login'
import RegistroUsuario from '../pages/RegistroUsuario'
import PanelInicio from '../pages/PanelInicio'
import MisPrestamos from '../prestamos/MisPrestamos'
import HistorialPrestamos from '../prestamos/HistorialPrestamos'
import Materiales from '../pages/Materiales'
import RegistrarPrestamo from '../pages/RegistrarPrestamo'
import DevolucionPrestamo from '../pages/DevolucionPrestamo'
import PerfilUsuario from '../pages/PerfilUsuario'
import UsuariosRoles from '../pages/UsuariosRoles'
import Pagina404 from '../pages/Pagina404'

function RutaLogin() {
  const { iniciarSesion } = useContext(SesionContext)
  return <Login onLoginExitoso={iniciarSesion} />
}

function RutaPerfil() {
  const { actualizarPerfil } = useContext(SesionContext)
  return <PerfilUsuario onPerfilActualizado={actualizarPerfil} />
}

function Rutas() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/catalogo" replace />} />

      <Route path="/catalogo" element={<CatalogoMateriales />} />

      <Route
        path="/login"
        element={
          <RedirigirAutenticado>
            <RutaLogin />
          </RedirigirAutenticado>
        }
      />
      <Route
        path="/registro"
        element={
          <RedirigirAutenticado>
            <RegistroUsuario />
          </RedirigirAutenticado>
        }
      />

      <Route
        path="/panel"
        element={
          <RequerirSesion>
            <PanelPrivado />
          </RequerirSesion>
        }
      >
        <Route index element={<PanelInicio />} />
        <Route
          path="prestamos"
          element={
            <RequerirRol roles={['prestatario']}>
              <MisPrestamos />
            </RequerirRol>
          }
        />
        <Route path="perfil" element={<RutaPerfil />} />
        <Route
          path="inventario"
          element={
            <RequerirRol roles={['gestor', 'administrador']}>
              <Materiales />
            </RequerirRol>
          }
        />
        <Route
          path="catalogo"
          element={
            <RequerirRol roles={['gestor', 'administrador']}>
              <CatalogoMateriales />
            </RequerirRol>
          }
        />
        <Route
          path="prestamo"
          element={
            <RequerirRol roles={['gestor']}>
              <RegistrarPrestamo />
            </RequerirRol>
          }
        />
        <Route
          path="devolucion/:prestamoId"
          element={
            <RequerirRol roles={['gestor']}>
              <DevolucionPrestamo />
            </RequerirRol>
          }
        />
        <Route
          path="historial"
          element={
            <RequerirRol roles={['gestor', 'administrador']}>
              <HistorialPrestamos />
            </RequerirRol>
          }
        />
      </Route>

      <Route
        path="/admin/roles"
        element={
          <RequerirSesion>
            <RequerirRol roles={['administrador']}>
              <UsuariosRoles />
            </RequerirRol>
          </RequerirSesion>
        }
      />

      <Route path="*" element={<Pagina404 />} />
    </Routes>
  )
}

export default Rutas