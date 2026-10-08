import { useEffect, useState } from 'react'

import { api, ErrorApi } from '../api/client'
import { validarNombre, validarTelefono } from '../validaciones'
import useTituloPagina from '../hooks/useTituloPagina'
import Campo from '../components/ui/Campo'
import Boton from '../components/ui/Boton'
import Tarjeta from '../components/ui/Tarjeta'
import Skeleton from '../components/ui/Skeleton'
import ErrorAlerta from '../components/ui/ErrorAlerta'

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

function Dato({ etiqueta, valor }) {
  return (
    <div className="rounded-xl border border-borde bg-superficie p-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-texto-suave">{etiqueta}</dt>
      <dd className="mt-1 break-words text-sm font-semibold text-texto">{valor}</dd>
    </div>
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
    <section className="grid gap-6">
      <div>
        <h2 className="mb-3 text-xl font-bold text-texto">Mi perfil</h2>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Dato etiqueta="Nombre" valor={perfil.nombre} />
          <Dato etiqueta="Apellido" valor={perfil.apellido} />
          <Dato etiqueta="Email" valor={perfil.email} />
          <Dato etiqueta="DNI" valor={perfil.dni} />
          <Dato etiqueta="Teléfono" valor={perfil.telefono || 'Sin teléfono registrado'} />
          <Dato etiqueta="Tipo de usuario" valor={ETIQUETAS_TIPO[perfil.tipo] || perfil.tipo} />
          <Dato etiqueta="Puntaje de reputación" valor={perfil.reputacion_puntaje} />
          <Dato etiqueta="Tier" valor={ETIQUETAS_TIER[perfil.reputacion_tier] || perfil.reputacion_tier} />
        </dl>
      </div>

      <Tarjeta className="p-6">
        <form onSubmit={manejarEnvio} noValidate className="grid gap-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-bold text-texto">Actualizar datos</h3>
            {mensajeExito && (
              <p className="text-sm font-semibold text-marca-700 dark:text-marca-300" role="status">
                {mensajeExito}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              etiqueta="Nombre"
              valor={nombre}
              onCambio={(evento) => setNombre(evento.target.value)}
              error={errores.nombre}
            />
            <Campo
              etiqueta="Apellido (solo lectura)"
              valor={perfil.apellido}
              readOnly
            />
            <Campo
              etiqueta="Email (solo lectura)"
              tipo="email"
              valor={perfil.email}
              readOnly
            />
            <Campo
              etiqueta="DNI (solo lectura)"
              valor={perfil.dni}
              readOnly
            />
            <Campo
              etiqueta="Tipo de usuario (solo lectura)"
              valor={ETIQUETAS_TIPO[perfil.tipo] || perfil.tipo}
              readOnly
            />
            <Campo
              etiqueta="Teléfono (opcional)"
              tipo="tel"
              valor={telefono}
              onCambio={(evento) => setTelefono(evento.target.value)}
              error={errores.telefono}
              maxLength={20}
            />
          </div>

          {onGuardar && (
            <Boton tipo="submit" cargando={guardando} className="w-full sm:w-auto">
              Guardar cambios
            </Boton>
          )}
        </form>
      </Tarjeta>
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
  useTituloPagina('Mi perfil')
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
      <div className="space-y-3" role="status" aria-live="polite">
        <Skeleton className="h-7 w-40" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, indice) => (
            <Skeleton key={indice} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (error && !perfil) {
    return (
      <div className="grid gap-4">
        <h2 className="text-xl font-bold text-texto">Mi perfil</h2>
        <ErrorAlerta mensaje={error} />
        <Boton tipo="button" className="w-full sm:w-auto" onClick={() => setIntentoCarga((actual) => actual + 1)}>
          Volver a intentar
        </Boton>
      </div>
    )
  }

  return (
    <>
      {error && <ErrorAlerta mensaje={error} className="mb-6" />}
      <FormularioPerfil
        perfil={perfil}
        onGuardar={guardarPerfil}
        guardando={guardando}
        mensajeExito={mensajeExito}
      />
    </>
  )
}

export default PerfilUsuario