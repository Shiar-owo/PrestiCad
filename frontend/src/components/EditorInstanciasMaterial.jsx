import { useEffect, useRef, useState } from 'react'

import { api, ErrorApi } from '../api/client'
import { validarFoto } from '../validaciones'
import Boton from './ui/Boton'
import Campo from './ui/Campo'
import ErrorAlerta from './ui/ErrorAlerta'
import Tarjeta from './ui/Tarjeta'

const CAMPOS_MASIVOS = [
  { campo: 'color', etiqueta: 'Color' },
  { campo: 'ubicacion', etiqueta: 'Estante o ubicación' },
  { campo: 'observaciones', etiqueta: 'Observaciones' },
]

const OPCIONES_ESTADO_MANUAL = [
  { valor: 'disponible', etiqueta: 'Disponible' },
  { valor: 'en_mantenimiento', etiqueta: 'En mantenimiento' },
]

const ETIQUETAS_ESTADO_BLOQUEADO = {
  prestado: 'Prestado',
  reservado: 'Reservado',
}

function crearDatosInstancia(instancia) {
  return {
    codigo_ejemplar: instancia?.codigo_ejemplar || '',
    numero_serie: instancia?.numero_serie || '',
    estado: instancia?.estado || 'disponible',
    condicion_fisica: instancia?.condicion_fisica || '',
    color: instancia?.color || '',
    ubicacion: instancia?.ubicacion || '',
    observaciones: instancia?.observaciones || '',
  }
}

function crearMensajeError(error) {
  if (error instanceof ErrorApi && error.datos) {
    return Object.values(error.datos).flat().join(' ')
  }
  return 'No se pudo guardar el cambio. Inténtalo de nuevo.'
}

function EditorInstanciasMaterial({ material, alcance, onCambiarAlcance, onGuardado, onCancelar }) {
  const instancias = material.instancias || []
  const [instanciaId, setInstanciaId] = useState(instancias[0]?.id || '')
  const instancia = instancias.find((fila) => fila.id === instanciaId)
  const [datos, setDatos] = useState(() => crearDatosInstancia(instancia))
  const [foto, setFoto] = useState(null)
  const [vistaPrevia, setVistaPrevia] = useState('')
  const [quitarFoto, setQuitarFoto] = useState(false)
  const [valoresMasivos, setValoresMasivos] = useState({
    color: '',
    ubicacion: '',
    observaciones: '',
  })
  const [camposMasivos, setCamposMasivos] = useState({})
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const enviandoRef = useRef(false)
  const urlPreviaRef = useRef('')

  useEffect(() => {
    setDatos(crearDatosInstancia(instancia))
    setFoto(null)
    setVistaPrevia('')
    setQuitarFoto(false)
    setError('')
    if (urlPreviaRef.current) {
      URL.revokeObjectURL(urlPreviaRef.current)
      urlPreviaRef.current = ''
    }
  }, [instancia?.id])

  useEffect(() => () => {
    if (urlPreviaRef.current) URL.revokeObjectURL(urlPreviaRef.current)
  }, [])

  function manejarFoto(evento) {
    const archivo = evento.target.files?.[0] || null
    if (urlPreviaRef.current) URL.revokeObjectURL(urlPreviaRef.current)
    urlPreviaRef.current = archivo ? URL.createObjectURL(archivo) : ''
    setFoto(archivo)
    setVistaPrevia(urlPreviaRef.current)
    setQuitarFoto(false)
    setError(validarFoto(archivo) || '')
  }

  function quitarFotoActual() {
    if (urlPreviaRef.current) URL.revokeObjectURL(urlPreviaRef.current)
    urlPreviaRef.current = ''
    setFoto(null)
    setVistaPrevia('')
    setQuitarFoto(true)
  }

  async function guardarInstancia(evento) {
    evento.preventDefault()
    if (enviandoRef.current || !instancia) return

    const errorFoto = validarFoto(foto)
    if (errorFoto) {
      setError(errorFoto)
      return
    }

    enviandoRef.current = true
    setEnviando(true)
    setError('')
    try {
      const campos = { ...datos }
      if (['prestado', 'reservado'].includes(instancia.estado)) {
        delete campos.estado
      }
      if (foto) {
        const formulario = new FormData()
        Object.entries(campos).forEach(([campo, valor]) => formulario.append(campo, valor))
        formulario.append('foto', foto)
        await api.patch(`/instancias/${instancia.id}/`, formulario)
      } else {
        if (quitarFoto) campos.foto = null
        await api.patch(`/instancias/${instancia.id}/`, campos)
      }
      onGuardado()
    } catch (errorApi) {
      setError(crearMensajeError(errorApi))
    } finally {
      enviandoRef.current = false
      setEnviando(false)
    }
  }

  async function aplicarATodas(evento) {
    evento.preventDefault()
    if (enviandoRef.current) return

    const campos = Object.fromEntries(
      CAMPOS_MASIVOS
        .filter(({ campo }) => camposMasivos[campo])
        .map(({ campo }) => [campo, valoresMasivos[campo]]),
    )
    if (!Object.keys(campos).length) {
      setError('Marca al menos un campo que quieras aplicar a todos los ejemplares.')
      return
    }

    enviandoRef.current = true
    setEnviando(true)
    setError('')
    try {
      const resultados = await Promise.allSettled(
        instancias.map((fila) => api.patch(`/instancias/${fila.id}/`, campos)),
      )
      const fallidos = resultados.filter((resultado) => resultado.status === 'rejected').length
      if (fallidos) {
        setError(`No se pudieron actualizar ${fallidos} de ${instancias.length} ejemplares. Revisa la ficha y vuelve a intentarlo.`)
        return
      }
      onGuardado()
    } catch (errorApi) {
      setError(crearMensajeError(errorApi))
    } finally {
      enviandoRef.current = false
      setEnviando(false)
    }
  }

  const esMasivo = alcance === 'todas'
  const estadoBloqueado = ['prestado', 'reservado'].includes(instancia?.estado)
  const opcionesEstadoInstancia = estadoBloqueado
    ? [
      {
        valor: instancia.estado,
        etiqueta: instancia.estado_display || ETIQUETAS_ESTADO_BLOQUEADO[instancia.estado] || instancia.estado,
      },
    ]
    : OPCIONES_ESTADO_MANUAL

  return (
    <section>
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-texto">
            {esMasivo ? 'Editar todas las instancias' : `Editar ejemplar: ${material.nombre}`}
          </h3>
          <p className="mt-1 text-sm text-texto-suave">
            {esMasivo
              ? 'Marca los campos que se aplicarán a todos. Los demás datos individuales se conservarán.'
              : 'Selecciona el ejemplar y modifica solo sus datos individuales.'}
          </p>
          {!esMasivo && (
            <p className="mt-1 text-xs text-texto-suave">
              <span className="text-error" aria-hidden="true">*</span> Campos obligatorios.
            </p>
          )}
        </div>
        <Boton tipo="button" variante="fantasma" onClick={onCambiarAlcance}>
          Cambiar alcance
        </Boton>
      </header>

      {error && <ErrorAlerta mensaje={error} className="mb-4" />}

      <Tarjeta className="p-6">
        {!instancias.length ? (
          <div className="grid gap-4">
            <p className="text-sm text-texto-suave">Este material no tiene ejemplares registrados.</p>
            <Boton tipo="button" variante="secundario" onClick={onCancelar}>Cancelar</Boton>
          </div>
        ) : esMasivo ? (
          <form onSubmit={aplicarATodas} className="grid gap-4">
            {CAMPOS_MASIVOS.map(({ campo, etiqueta }) => (
              <div key={campo} className="grid gap-2 rounded-lg border border-borde p-3 sm:grid-cols-[1fr_2fr] sm:items-center">
                <label className="flex items-center gap-2 text-sm font-semibold text-texto">
                  <input
                    type="checkbox"
                    checked={Boolean(camposMasivos[campo])}
                    onChange={(evento) => setCamposMasivos((actuales) => ({
                      ...actuales,
                      [campo]: evento.target.checked,
                    }))}
                    className="size-4 rounded border-borde accent-marca-600"
                  />
                  Aplicar {etiqueta.toLowerCase()}
                </label>
                <Campo
                  etiqueta={`${etiqueta} (opcional)`}
                  tipo={campo === 'observaciones' ? 'area' : 'text'}
                  valor={valoresMasivos[campo]}
                  deshabilitado={!camposMasivos[campo]}
                  onCambio={(evento) => setValoresMasivos((actuales) => ({ ...actuales, [campo]: evento.target.value }))}
                  maxLength={campo === 'ubicacion' ? 100 : campo === 'color' ? 30 : undefined}
                />
              </div>
            ))}
            <div className="flex flex-wrap gap-3">
              <Boton tipo="submit" cargando={enviando} deshabilitado={enviando}>
                Aplicar a {instancias.length} ejemplares
              </Boton>
              <Boton tipo="button" variante="secundario" onClick={onCancelar} deshabilitado={enviando}>
                Cancelar
              </Boton>
            </div>
          </form>
        ) : (
          <form onSubmit={guardarInstancia} className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-semibold text-texto sm:col-span-2">
              Ejemplar
              <select
                value={instanciaId}
                onChange={(evento) => setInstanciaId(evento.target.value)}
                className="rounded-lg border border-borde bg-white px-3 py-2 text-sm font-normal dark:bg-superficie"
              >
                {instancias.map((fila) => (
                  <option key={fila.id} value={fila.id}>{fila.codigo_ejemplar} — {fila.numero_serie || 'Sin número de serie'} — {fila.estado_display || fila.estado}</option>
                ))}
              </select>
            </label>
            <Campo
              etiqueta="Código de Ejemplar"
              valor={datos.codigo_ejemplar}
              maxLength={50}
              requerido
              onCambio={(evento) => setDatos((actuales) => ({ ...actuales, codigo_ejemplar: evento.target.value }))}
            />
            <Campo
              etiqueta="Estado"
              opciones={opcionesEstadoInstancia}
              valor={datos.estado}
              deshabilitado={estadoBloqueado}
              requerido={!estadoBloqueado}
              ayuda={
                estadoBloqueado
                  ? 'No se puede modificar manualmente un ejemplar Prestado o Reservado; debe seguir su procedimiento correspondiente para volver a Disponible.'
                  : ''
              }
              onCambio={(evento) => setDatos((actuales) => ({ ...actuales, estado: evento.target.value }))}
            />
            <Campo
              etiqueta="Número de serie (opcional)"
              valor={datos.numero_serie}
              maxLength={80}
              onCambio={(evento) => setDatos((actuales) => ({ ...actuales, numero_serie: evento.target.value }))}
            />
            <Campo
              etiqueta="Condición física (opcional)"
              valor={datos.condicion_fisica}
              maxLength={100}
              onCambio={(evento) => setDatos((actuales) => ({ ...actuales, condicion_fisica: evento.target.value }))}
            />
            <Campo
              etiqueta="Color del ejemplar (opcional)"
              valor={datos.color}
              maxLength={30}
              onCambio={(evento) => setDatos((actuales) => ({ ...actuales, color: evento.target.value }))}
            />
            <Campo
              etiqueta="Estante o ubicación (opcional)"
              valor={datos.ubicacion}
              maxLength={100}
              onCambio={(evento) => setDatos((actuales) => ({ ...actuales, ubicacion: evento.target.value }))}
            />
            <Campo
              etiqueta="Observaciones (opcional)"
              tipo="area"
              valor={datos.observaciones}
              className="sm:col-span-2"
              onCambio={(evento) => setDatos((actuales) => ({ ...actuales, observaciones: evento.target.value }))}
            />
            <div className="grid gap-2 sm:col-span-2">
              <span className="text-sm font-semibold text-texto">Foto de este ejemplar (opcional)</span>
              {error && <p className="text-xs text-error">{error}</p>}
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={manejarFoto} className="block w-full text-sm text-texto file:mr-3 file:rounded-lg file:border-0 file:bg-superficie-alta file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-texto" />
              {(vistaPrevia || (!quitarFoto && instancia?.foto)) && (
                <img className="h-32 w-32 rounded-lg border border-borde object-cover" src={vistaPrevia || instancia.foto} alt={`Foto de ${instancia?.codigo_ejemplar}`} />
              )}
              {!quitarFoto && instancia?.foto && !foto && (
                <Boton tipo="button" variante="fantasma" tamanio="pequeno" onClick={quitarFotoActual}>
                  Quitar foto actual
                </Boton>
              )}
            </div>
            <div className="flex flex-wrap gap-3 sm:col-span-2">
              <Boton tipo="submit" cargando={enviando} deshabilitado={enviando}>Guardar ejemplar</Boton>
              <Boton tipo="button" variante="secundario" onClick={onCancelar} deshabilitado={enviando}>Cancelar</Boton>
            </div>
          </form>
        )}
      </Tarjeta>
    </section>
  )
}

export default EditorInstanciasMaterial
