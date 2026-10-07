import { useEffect, useState } from 'react'

import { api, ErrorApi } from '../api/client'
import { validarNombre, validarTelefono } from '../validaciones'

const ETIQUETAS_TIPO = {
  alumno: 'Alumno',
  docente: 'Docente',
  administrativo: 'Administrativo',
}

const ETIQUETAS_TIER = {
  avanzado: 'Avanzado',
  estandar: 'Estándar',
  restringido: 'Restringido',
}

function Campo({ etiqueta, error, children }) {
  return (
    <label>
      <span>{etiqueta}</span>
      {children}
      {error && <span className="error">{error}</span>}
    </label>
  )
}

function FormularioPerfil({ perfil, onGuardar, guardando = false, mensajeExito }) {
  const [nombre, setNombre] = useState(perfil.nombre)
  const [telefono, setTelefono] = useState(perfil.telefono || '')
  const [errores, setErrores] = useState({})

  useEffect(() => {
    setNombre(perfil.nombre)
    setTelefono(perfil.telefono || '')
    setErrores({})
  }, [perfil.nombre, perfil.telefono])

  function manejarEnvio(evento) {
    evento.preventDefault()

    const erroresFormulario = {}
    const errorNombre = validarNombre(nombre)
    const errorTelefono = validarTelefono(telefono)

    if (errorNombre) erroresFormulario.nombre = errorNombre
    if (errorTelefono) erroresFormulario.telefono = errorTelefono

    setErrores(erroresFormulario)
    if (Object.keys(erroresFormulario).length > 0 || !onGuardar) return

    onGuardar({ nombre: nombre.trim(), telefono: telefono.trim() })
  }

  return (
    <section className="perfil">
      <h2>Mi perfil</h2>

      <dl className="perfil__datos">
        <div>
          <dt>Nombre</dt>
          <dd>{perfil.nombre}</dd>
        </div>
        <div>
          <dt>Apellido</dt>
          <dd>{perfil.apellido}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{perfil.email}</dd>
        </div>
        <div>
          <dt>DNI</dt>
          <dd>{perfil.dni}</dd>
        </div>
        <div>
          <dt>Teléfono</dt>
          <dd>{perfil.telefono || 'Sin teléfono registrado'}</dd>
        </div>
        <div>
          <dt>Tipo de usuario</dt>
          <dd>{ETIQUETAS_TIPO[perfil.tipo] || perfil.tipo}</dd>
        </div>
        <div>
          <dt>Puntaje de reputación</dt>
          <dd>{perfil.reputacion_puntaje}</dd>
        </div>
        <div>
          <dt>Tier</dt>
          <dd>{ETIQUETAS_TIER[perfil.reputacion_tier] || perfil.reputacion_tier}</dd>
        </div>
      </dl>

      <form className="perfil__formulario" onSubmit={manejarEnvio} noValidate>
        <h3>Actualizar datos</h3>

        {mensajeExito && <p className="exito" role="status">{mensajeExito}</p>}

        <Campo etiqueta="Nombre" error={errores.nombre}>
          <input
            type="text"
            value={nombre}
            aria-invalid={Boolean(errores.nombre)}
            onChange={(evento) => setNombre(evento.target.value)}
          />
        </Campo>

        <Campo etiqueta="Apellido (solo lectura)">
          <input type="text" value={perfil.apellido} readOnly />
        </Campo>

        <Campo etiqueta="Email (solo lectura)">
          <input type="email" value={perfil.email} readOnly />
        </Campo>

        <Campo etiqueta="DNI (solo lectura)">
          <input type="text" value={perfil.dni} readOnly />
        </Campo>

        <Campo etiqueta="Tipo de usuario (solo lectura)">
          <input
            type="text"
            value={ETIQUETAS_TIPO[perfil.tipo] || perfil.tipo}
            readOnly
          />
        </Campo>

        <Campo etiqueta="Teléfono (opcional)" error={errores.telefono}>
          <input
            type="tel"
            maxLength={20}
            value={telefono}
            aria-invalid={Boolean(errores.telefono)}
            onChange={(evento) => setTelefono(evento.target.value)}
          />
        </Campo>

        {onGuardar && (
          <button type="submit" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </button>
        )}
      </form>
    </section>
  )
}

function mensajeErrorApi(error, mensajePredeterminado) {
  if (!(error instanceof ErrorApi)) return mensajePredeterminado
  if (error.status === 401) return 'Tu sesión venció. Inicia sesión nuevamente.'

  const datos = error.datos
  if (datos?.detail) return datos.detail

  if (datos && typeof datos === 'object') {
    const primerError = Object.values(datos).flat()[0]
    if (typeof primerError === 'string') return primerError
  }

  if (error.status === 403) {
    return 'No se pudo validar la solicitud. Recarga el perfil e inténtalo otra vez.'
  }

  return mensajePredeterminado
}

function PerfilUsuario({ onPerfilActualizado }) {
  const [perfil, setPerfil] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [mensajeExito, setMensajeExito] = useState('')
  const [intentoCarga, setIntentoCarga] = useState(0)

  useEffect(() => {
    let activo = true
    setCargando(true)
    setError('')

    api.get('/usuarios/perfil/')
      .then((datos) => {
        if (activo) {
          setPerfil(datos)
          onPerfilActualizado?.(datos)
        }
      })
      .catch((fallo) => {
        if (activo) setError(mensajeErrorApi(fallo, 'No se pudo cargar tu perfil.'))
      })
      .finally(() => {
        if (activo) setCargando(false)
      })

    return () => {
      activo = false
    }
  }, [intentoCarga])

  async function guardarPerfil(datos) {
    setGuardando(true)
    setError('')
    setMensajeExito('')

    try {
      const perfilActualizado = await api.put('/usuarios/perfil/', datos)
      setPerfil(perfilActualizado)
      onPerfilActualizado?.(perfilActualizado)
      setMensajeExito('Los cambios se guardaron correctamente.')
    } catch (fallo) {
      setError(mensajeErrorApi(fallo, 'No se pudieron guardar los cambios.'))
    } finally {
      setGuardando(false)
    }
  }

  if (cargando) {
    return (
      <section className="perfil">
        <h2>Mi perfil</h2>
        <p role="status">Cargando perfil…</p>
      </section>
    )
  }

  if (error && !perfil) {
    return (
      <section className="perfil">
        <h2>Mi perfil</h2>
        <div className="error-general" role="alert">{error}</div>
        <button type="button" onClick={() => setIntentoCarga((actual) => actual + 1)}>
          Volver a intentar
        </button>
      </section>
    )
  }

  return (
    <section>
      {error && (
        <div className="error-general" role="alert">
          {error}
        </div>
      )}
      <FormularioPerfil
        perfil={perfil}
        onGuardar={guardarPerfil}
        guardando={guardando}
        mensajeExito={mensajeExito}
      />
    </section>
  )
}

export default PerfilUsuario
