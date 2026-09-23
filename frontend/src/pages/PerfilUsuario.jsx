import { useEffect, useState } from 'react'

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

function PerfilUsuario({ perfil, onGuardar, guardando = false }) {
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

export default PerfilUsuario
