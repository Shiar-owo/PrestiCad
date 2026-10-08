import { useEffect, useState } from 'react'

import { api } from './api/client'
import './estilos.css'
import useTema from './hooks/useTema'
import SesionContext from './contextos/SesionContext'
import Encabezado from './components/layout/Encabezado'
import Rutas from './router/rutas'

function App() {
  const [usuario, setUsuario] = useState(null)
  const [cargandoSesion, setCargandoSesion] = useState(true)
  const { tema, alternarTema } = useTema()

  useEffect(() => {
    api
      .get('/auth/me/')
      .then(setUsuario)
      .catch(() => setUsuario(null))
      .finally(() => setCargandoSesion(false))
  }, [])

  function cerrarSesion() {
    return api
      .post('/auth/logout/', {})
      .catch(() => {
        // Se limpia la sesión local aunque falle la conexión.
      })
      .finally(() => setUsuario(null))
  }

  const valorContexto = {
    usuario,
    cargandoSesion,
    iniciarSesion: setUsuario,
    actualizarPerfil: (perfil) =>
      setUsuario((actual) => (actual ? { ...actual, ...perfil } : actual)),
    cerrarSesion,
  }

  return (
    <SesionContext.Provider value={valorContexto}>
      <Encabezado tema={tema} onAlternarTema={alternarTema} />
      <Rutas />
    </SesionContext.Provider>
  )
}

export default App