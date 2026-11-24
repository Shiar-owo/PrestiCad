import { useState } from 'react'

import { api, ErrorApi } from '../api/client'
import { validarEmail, validarPassword } from '../validaciones'
import useTituloPagina from '../hooks/useTituloPagina'
import Tarjeta from '../components/ui/Tarjeta'
import Campo from '../components/ui/Campo'
import Boton from '../components/ui/Boton'
import ErrorAlerta from '../components/ui/ErrorAlerta'

function Login({ onLoginExitoso }) {
  useTituloPagina('Iniciar sesión')
  const [datos, setDatos] = useState({ email: '', password: '' })
  const [errores, setErrores] = useState({})
  const [cargando, setCargando] = useState(false)
  const [errorGeneral, setErrorGeneral] = useState('')

  function actualizar(campo, valor) {
    setDatos((previos) => ({ ...previos, [campo]: valor }))
    if (errores[campo]) {
      setErrores((previos) => ({ ...previos, [campo]: '' }))
    }
  }

  async function manejarEnvio(evento) {
    evento.preventDefault()

    const nuevosErrores = {}
    const errorEmail = validarEmail(datos.email)
    const errorPassword = validarPassword(datos.password)

    if (errorEmail) nuevosErrores.email = errorEmail
    if (errorPassword) nuevosErrores.password = errorPassword

    setErrores(nuevosErrores)
    setErrorGeneral('')

    if (Object.keys(nuevosErrores).length > 0) {
      return
    }

    setCargando(true)

    try {
      const respuesta = await api.post('/auth/login/', {
        email: datos.email.trim(),
        password: datos.password,
      })

      if (onLoginExitoso) {
        onLoginExitoso(respuesta.usuario)
      }
    } catch (error) {
      if (error instanceof ErrorApi) {
        if (error.status === 401) {
          setErrorGeneral(error.datos?.detail || 'Email o contraseña incorrectos')
        } else if (error.status === 423) {
          setErrorGeneral(error.datos?.detail || 'La cuenta está bloqueada temporalmente.')
        } else if (error.status === 400 && error.datos) {
          const erroresApi = {}
          if (error.datos.email) erroresApi.email = error.datos.email[0]
          if (error.datos.password) erroresApi.password = error.datos.password[0]
          setErrores(erroresApi)
        } else {
          setErrorGeneral('No se pudo conectar con el servidor.')
        }
      } else {
        setErrorGeneral('Ocurrió un error inesperado.')
      }
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-12">
      <Tarjeta className="p-6">
        <h2 className="text-xl font-bold text-texto">Iniciar sesión</h2>
        <p className="mt-1 text-sm text-texto-suave">Accede con tu correo institucional.</p>

        {errorGeneral && <ErrorAlerta mensaje={errorGeneral} className="mt-4" />}

        <form onSubmit={manejarEnvio} noValidate className="mt-5 grid gap-4">
          <Campo
            etiqueta="Correo electrónico"
            tipo="email"
            valor={datos.email}
            onCambio={(evento) => actualizar('email', evento.target.value)}
            error={errores.email}
            placeholder="ejemplo@unsa.edu.pe"
            deshabilitado={cargando}
            autoComplete="email"
          />
          <Campo
            etiqueta="Contraseña"
            tipo="password"
            valor={datos.password}
            onCambio={(evento) => actualizar('password', evento.target.value)}
            error={errores.password}
            placeholder="Mínimo 8 caracteres"
            deshabilitado={cargando}
            autoComplete="current-password"
          />

          <Boton tipo="submit" cargando={cargando} className="w-full">
            Iniciar sesión
          </Boton>
        </form>
      </Tarjeta>
    </div>
  )
}

export default Login