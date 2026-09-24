import './estilos.css'
import RegistroUsuario from './pages/RegistroUsuario'
import UsuariosRoles from './pages/UsuariosRoles'

function App() {
  return (
    <main>
      <h1>PrestiCad</h1>
      <p>Sistema de Préstamos Académicos</p>
      <RegistroUsuario />
      <UsuariosRoles />
    </main>
  )
}

export default App