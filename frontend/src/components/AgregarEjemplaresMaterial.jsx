import { useEffect, useRef, useState } from 'react'

import { api, ErrorApi } from '../api/client'
import {
  construirCuerpoAltaInstancias,
  mapearErroresAltaInstancias,
  redimensionarFilasAlta,
  validarFilasAlta,
} from '../inventario/agregarEjemplares'
import Boton from './ui/Boton'
import Campo from './ui/Campo'
import ErrorAlerta from './ui/ErrorAlerta'
import Tarjeta from './ui/Tarjeta'

const OPCIONES_ESTADO_INICIAL_EJEMPLAR = [
  { valor: 'disponible', etiqueta: 'Disponible' },
  { valor: 'en_mantenimiento', etiqueta: 'En mantenimiento' },
]

function obtenerMensajeError(error) {
  if (!(error instanceof ErrorApi) || !error.datos) {
    return 'No se pudieron agregar los ejemplares. Inténtalo de nuevo.'
  }
  const respuesta = error.datos
  if (Array.isArray(respuesta.instancias) && typeof respuesta.instancias[0] === 'string') {
    return respuesta.instancias[0]
  }
  const mensajes = Object.entries(respuesta)
    .filter(([campo]) => !['indice', 'campo', 'mensaje', 'instancias'].includes(campo))
    .flatMap(([, valor]) => Array.isArray(valor) ? valor : [valor])
    .filter((valor) => typeof valor === 'string')
  return mensajes.join(' ') || 'Revisa los datos de los ejemplares.'
}

function AgregarEjemplaresMaterial({ material, onGuardado, onCancelar }) {
  const contadorIds = useRef(0)
  const urlsPrevia = useRef(new Set())
  const enviandoRef = useRef(false)
  const [cantidad, setCantidad] = useState(1)
  const [ejemplares, setEjemplares] = useState(() =>
    redimensionarFilasAlta([], 1, material, () => `alta-${++contadorIds.current}`),
  )
  const [erroresFilas, setErroresFilas] = useState({})
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => () => {
    urlsPrevia.current.forEach((url) => URL.revokeObjectURL(url))
    urlsPrevia.current.clear()
  }, [])

  function liberarVistaPrevia(url) {
    if (!url) return
    URL.revokeObjectURL(url)
    urlsPrevia.current.delete(url)
  }

  function cambiarCantidad(evento) {
    const valor = Number(evento.target.value)
    if (!Number.isInteger(valor) || valor < 1) return
    const siguientes = redimensionarFilasAlta(
      ejemplares,
      valor,
      material,
      () => `alta-${++contadorIds.current}`,
    )
    const idsConservados = new Set(siguientes.map((fila) => fila.id))
    ejemplares
      .filter((fila) => !idsConservados.has(fila.id))
      .forEach((fila) => liberarVistaPrevia(fila.vistaPrevia))
    setEjemplares(siguientes)
    setCantidad(siguientes.length)
    setErroresFilas({})
    setError('')
  }

  function actualizarFila(indice, campo, valor) {
    setEjemplares((actuales) => actuales.map((fila, posicion) =>
      posicion === indice ? { ...fila, [campo]: valor } : fila,
    ))
    setErroresFilas((actuales) => {
      if (!actuales[indice]?.[campo]) return actuales
      const errorFila = { ...actuales[indice] }
      delete errorFila[campo]
      const siguientes = { ...actuales }
      if (Object.keys(errorFila).length) siguientes[indice] = errorFila
      else delete siguientes[indice]
      return siguientes
    })
  }

  function manejarFoto(indice, evento) {
    const archivo = evento.target.files?.[0] || null
    const fila = ejemplares[indice]
    liberarVistaPrevia(fila?.vistaPrevia)
    const vistaPrevia = archivo ? URL.createObjectURL(archivo) : ''
    if (vistaPrevia) urlsPrevia.current.add(vistaPrevia)
    actualizarFila(indice, 'foto', archivo)
    actualizarFila(indice, 'vistaPrevia', vistaPrevia)
  }

  async function enviar(evento) {
    evento.preventDefault()
    if (enviandoRef.current) return

    const errores = validarFilasAlta(ejemplares, material)
    const porFila = {}
    errores.forEach(({ indice, campo, mensaje }) => {
      porFila[indice] = { ...porFila[indice], [campo]: mensaje }
    })
    setErroresFilas(porFila)
    setError('')
    if (errores.length) return

    enviandoRef.current = true
    setEnviando(true)
    try {
      await api.post(
        `/materiales/${material.id}/instancias/`,
        construirCuerpoAltaInstancias(ejemplares),
      )
      await onGuardado()
    } catch (errorApi) {
      const erroresApi = mapearErroresAltaInstancias(errorApi)
      setErroresFilas(erroresApi)
      setError(Object.keys(erroresApi).length ? '' : obtenerMensajeError(errorApi))
    } finally {
      enviandoRef.current = false
      setEnviando(false)
    }
  }

  return (
    <Tarjeta className="mt-4 border border-acento-200 p-4 dark:border-acento-800">
      <form onSubmit={enviar} noValidate className="grid gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h5 className="font-semibold text-texto">Agregar ejemplares</h5>
            <p className="mt-1 text-xs text-texto-suave">
              Puedes agregar de uno a 50. Cada código debe ser único.{' '}
              <span className="text-error" aria-hidden="true">*</span> Campos obligatorios.
            </p>
          </div>
          <Campo
            etiqueta="Cantidad"
            tipo="number"
            valor={cantidad}
            onCambio={cambiarCantidad}
            min={1}
            max={50}
            step={1}
            requerido
            className="w-28"
          />
        </div>

        {error && <ErrorAlerta mensaje={error} />}

        <div className="grid gap-3">
          {ejemplares.map((fila, indice) => (
            <div key={fila.id} className="grid gap-3 rounded-lg border border-borde bg-superficie p-4">
              <h6 className="text-sm font-semibold text-texto">Ejemplar {indice + 1}</h6>
              {erroresFilas[indice] && (
                <ErrorAlerta mensaje={Object.values(erroresFilas[indice]).join(' ')} />
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo
                  etiqueta="Código de ejemplar"
                  valor={fila.codigo_ejemplar}
                  onCambio={(evento) => actualizarFila(indice, 'codigo_ejemplar', evento.target.value)}
                  maxLength={50}
                  requerido
                />
                <Campo
                  etiqueta="Estado inicial del ejemplar"
                  opciones={OPCIONES_ESTADO_INICIAL_EJEMPLAR}
                  valor={fila.estado || 'disponible'}
                  onCambio={(evento) => actualizarFila(indice, 'estado', evento.target.value)}
                  requerido
                />
                <Campo
                  etiqueta="Número de serie"
                  valor={fila.numero_serie}
                  onCambio={(evento) => actualizarFila(indice, 'numero_serie', evento.target.value)}
                  maxLength={80}
                />
                <Campo
                  etiqueta="Color del ejemplar"
                  valor={fila.color}
                  onCambio={(evento) => actualizarFila(indice, 'color', evento.target.value)}
                  maxLength={30}
                />
                <Campo
                  etiqueta="Estado físico (descripción)"
                  valor={fila.estado_fisico}
                  onCambio={(evento) => actualizarFila(indice, 'estado_fisico', evento.target.value)}
                  maxLength={100}
                />
                <Campo
                  etiqueta="Estante o ubicación"
                  valor={fila.ubicacion}
                  onCambio={(evento) => actualizarFila(indice, 'ubicacion', evento.target.value)}
                  maxLength={100}
                />
                <Campo
                  etiqueta="Observaciones"
                  tipo="area"
                  valor={fila.observaciones}
                  onCambio={(evento) => actualizarFila(indice, 'observaciones', evento.target.value)}
                  rows={2}
                  className="sm:col-span-2"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-semibold text-texto" htmlFor={`alta-foto-${fila.id}`}>
                  Foto del ejemplar (opcional)
                </label>
                {erroresFilas[indice]?.foto && (
                  <p className="text-xs text-error">{erroresFilas[indice].foto}</p>
                )}
                <input
                  id={`alta-foto-${fila.id}`}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  aria-invalid={Boolean(erroresFilas[indice]?.foto)}
                  onChange={(evento) => manejarFoto(indice, evento)}
                  className="block w-full text-sm text-texto file:mr-3 file:rounded-lg file:border-0 file:bg-superficie-alta file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-texto"
                />
                {fila.vistaPrevia && (
                  <img
                    className="size-20 rounded-lg border border-borde object-cover"
                    src={fila.vistaPrevia}
                    alt={`Vista previa del ejemplar ${indice + 1}`}
                  />
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Boton tipo="button" variante="secundario" onClick={onCancelar} deshabilitado={enviando}>
            Cancelar
          </Boton>
          <Boton tipo="submit" cargando={enviando} deshabilitado={enviando}>
            Agregar {ejemplares.length === 1 ? 'ejemplar' : `${ejemplares.length} ejemplares`}
          </Boton>
        </div>
      </form>
    </Tarjeta>
  )
}

export default AgregarEjemplaresMaterial
