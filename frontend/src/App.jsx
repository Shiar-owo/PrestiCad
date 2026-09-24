import './estilos.css'
import Login from './pages/Login'
import RegistroUsuario from './pages/RegistroUsuario'

function App() {
  return (
    <main>
      <h1>PrestiCad</h1>
      <p>Sistema de Préstamos Académicos</p>
      <Login />
      <RegistroUsuario />
    </main>
  )
}

export default App