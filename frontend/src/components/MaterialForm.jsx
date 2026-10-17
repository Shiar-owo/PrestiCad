import { useEffect, useRef, useState } from 'react'

import { api, ErrorApi } from '../api/client'
import {
  validarCodigoInventario,
  validarFoto,
  validarNombre,
  validarPuntosReputacion,
} from '../validaciones'
import { OPCIONES_ESTADO, OPCIONES_TIER, OPCIONES_TIPO } from '../constantes/catalogo'
import {
  construirCuerpoRegistroMaterial,
  crearEjemplares,
  mapearErroresPorFila,
  redimensionarEjemplares,
  validarCodigosDuplicados,
  validarFotosEjemplares,
} from '../inventario/registroMaterial'
import Campo from './ui/Campo'
import Boton from './ui/Boton'
import Tarjeta from './ui/Tarjeta'
import ErrorAlerta from './ui/ErrorAlerta'
import EditorInstanciasMaterial from './EditorInstanciasMaterial'

// Parámetros de reputación en puntos: si se blanks, el backend aplica los
// valores por defecto configurados (HU04 criterio 3).
const CAMPOS_PUNTOS = [
  { campo: 'bonificacion_tiempo', etiqueta: 'Bonificación por tiempo' },
  { campo: 'deduccion_tardanza', etiqueta: 'Deducción por tardanza' },
  { campo: 'deduccion_dano_parcial', etiqueta: 'Deducción por daño parcial' },
  { campo: 'deduccion_dano_total', etiqueta: 'Deducción por daño total' },
]

const DATOS_INICIALES = {
  nombre: '',
  descripcion: '',
  codigo_inventario: '',
  tipo: 'equipo',
  stock: 1,
  modo: 'unico',
  es_alto_valor: false,
  marca: '',
  modelo: '',
  numero_serie: '',
  color: '',
  estado_fisico: '',
  ubicacion: '',
  foto: null,
  vistaPreviaFoto: '',
  tier_minimo_requerido: '',
  bonificacion_tiempo: '',
  deduccion_tardanza: '',
  deduccion_dano_parcial: '',
  deduccion_dano_total: '',
  costo_reparacion: '',
  costo_reposicion: '',
  estado: 'disponible',
}

function crearDatosIniciales(material) {
  return {
    ...DATOS_INICIALES,
    ...Object.fromEntries(
      Object.entries(DATOS_INICIALES).map(([campo, inicial]) => [campo, material?.[campo] ?? inicial]),
    ),
    modo: 'unico',
    foto: null,
    vistaPreviaFoto: material?.foto || '',
  }
}

function validar(datos) {
  const errores = {}

  const errorNombre = validarNombre(datos.nombre)
  if (errorNombre) {
    errores.nombre = errorNombre
  }

  const errorCodigo = validarCodigoInventario(datos.codigo_inventario)
  if (errorCodigo) {
    errores.codigo_inventario = errorCodigo
  }

  for (const { campo } of CAMPOS_PUNTOS) {
    const error = validarPuntosReputacion(datos[campo])
    if (error) {
      errores[campo] = error
    }
  }

  for (const campo of ['costo_reparacion', 'costo_reposicion']) {
    if (datos[campo] !== '' && !Number.isFinite(Number(datos[campo]))) {
      errores[campo] = 'Ingresa un monto o déjalo vacío.'
    }
  }

  const errorFoto = validarFoto(datos.foto)
  if (errorFoto) {
    errores.foto = errorFoto
  }

  return errores
}

function EncabezadoSeccion({ children }) {
  return (
    <h4 className="mt-2 border-b border-borde pb-2 text-sm font-bold uppercase tracking-wide text-texto-suave">
      {children}
    </h4>
  )
}

function MaterialForm({ material, onGuardado, onCancelar }) {
  const esEdicion = Boolean(material)
  const [alcanceEdicion, setAlcanceEdicion] = useState(null)
  const contadorIds = useRef(0)
  const urlsTemporales = useRef(new Set())
  const enviandoRef = useRef(false)
  const [datos, setDatos] = useState(() => crearDatosIniciales(material))
  const [ejemplares, setEjemplares] = useState(() =>
    material ? [] : crearEjemplares(1, () => `ejemplar-${++contadorIds.current}`),
  )
  const [errores, setErrores] = useState({})
  const [erroresFilas, setErroresFilas] = useState({})
  const [enviando, setEnviando] = useState(false)
  const [mensajeExito, setMensajeExito] = useState('')

  useEffect(() => () => {
    urlsTemporales.current.forEach((url) => URL.revokeObjectURL(url))
    urlsTemporales.current.clear()
  }, [])

  function crearVistaPrevia(archivo) {
    const url = URL.createObjectURL(archivo)
    urlsTemporales.current.add(url)
    return url
  }

  function liberarVistaPrevia(url) {
    if (url && urlsTemporales.current.has(url)) {
      URL.revokeObjectURL(url)
      urlsTemporales.current.delete(url)
    }
  }

  function liberarVistasDeFilas(filas) {
    filas.forEach((fila) => liberarVistaPrevia(fila.vistaPrevia))
  }

  function redimensionarFilas(cantidad) {
    const siguiente = redimensionarEjemplares(
      ejemplares,
      cantidad,
      () => `ejemplar-${++contadorIds.current}`,
    )
    const idsConservados = new Set(siguiente.map((fila) => fila.id))
    liberarVistasDeFilas(ejemplares.filter((fila) => !idsConservados.has(fila.id)))
    setEjemplares(siguiente)
    setErroresFilas({})
  }

  function cambiarModo(modo) {
    const cantidad = modo === 'unico' ? 1 : Math.max(ejemplares.length, 2)
    redimensionarFilas(cantidad)
    actualizar('modo', modo)
  }

  function actualizar(campo, valor) {
    setDatos((previos) => ({ ...previos, [campo]: valor }))
  }

  function actualizarFila(indice, campo, valor) {
    setEjemplares(ejemplares.map((fila, posicion) =>
      posicion === indice ? { ...fila, [campo]: valor } : fila,
    ))
  }

  function manejarArchivoFoto(evento) {
    const archivo = evento.target.files?.[0] || null
    liberarVistaPrevia(datos.vistaPreviaFoto)
    actualizar('foto', archivo)
    actualizar('vistaPreviaFoto', archivo ? crearVistaPrevia(archivo) : material?.foto || '')
    setErrores((previos) => ({ ...previos, foto: validarFoto(archivo) }))
  }

  function manejarFotoEjemplar(indice, evento) {
    const archivo = evento.target.files?.[0] || null
    const fila = ejemplares[indice]
    liberarVistaPrevia(fila?.vistaPrevia)
    const vistaPrevia = archivo ? crearVistaPrevia(archivo) : ''
    setEjemplares(ejemplares.map((actual, posicion) =>
      posicion === indice ? { ...actual, foto: archivo, vistaPrevia } : actual,
    ))
    setErroresFilas((previos) => {
      const siguientes = { ...previos }
      const error = validarFoto(archivo)
      if (error) siguientes[indice] = { ...siguientes[indice], foto: error }
      else if (siguientes[indice]) {
        const { foto, ...resto } = siguientes[indice]
        if (Object.keys(resto).length) siguientes[indice] = resto
        else delete siguientes[indice]
      }
      return siguientes
    })
  }

  // Los parámetros en blanco no se envían: el backend los resuelve con los
  // valores por defecto configurados. Los costos vacíos se envían como null
  // para limpiarlos en la edición.
  function construirCampos() {
    const cuerpo = {
      nombre: datos.nombre.trim(),
      descripcion: datos.descripcion.trim(),
      codigo_inventario: datos.codigo_inventario.trim(),
      tipo: datos.tipo,
      es_alto_valor: datos.es_alto_valor,
      marca: datos.marca.trim(),
      modelo: datos.modelo.trim(),
      color: datos.color.trim(),
      costo_reparacion: datos.costo_reparacion === '' ? null : Number(datos.costo_reparacion),
      costo_reposicion: datos.costo_reposicion === '' ? null : Number(datos.costo_reposicion),
    }

    if (!esEdicion) {
      cuerpo.stock = Number(datos.stock)
      cuerpo.numero_serie = datos.numero_serie.trim()
      cuerpo.estado_fisico = datos.estado_fisico.trim()
    }

    if (datos.tier_minimo_requerido) {
      cuerpo.tier_minimo_requerido = datos.tier_minimo_requerido
    }

    for (const { campo } of CAMPOS_PUNTOS) {
      if (datos[campo] !== '') {
        cuerpo[campo] = Number(datos[campo])
      }
    }

    if (esEdicion) {
      cuerpo.estado = datos.estado
    }

    return cuerpo
  }

  // Sin foto nueva se manda el objeto de siempre (JSON). Con foto, todo tiene
  // que viajar en el mismo multipart, así que se arma un FormData.
  function construirCuerpo() {
    const campos = construirCampos()

    if (!datos.foto) {
      return campos
    }

    const formulario = new FormData()
    for (const [campo, valor] of Object.entries(campos)) {
      // Un `null` appendeado se convierte en la cadena "null" y el backend lo
      // rechaza. La cadena vacía sí la DRF la traduce a null en los campos
      // que admiten nulo, que es justo lo que limpia los costos.
      formulario.append(campo, valor === null ? '' : valor)
    }
    formulario.append('foto', datos.foto)

    return formulario
  }

  function mostrarErroresDelBackend(datosError) {
    const erroresApi = {}
    const erroresDeFila = mapearErroresPorFila(datosError)
    for (const campo of Object.keys(datosError)) {
      if (campo === 'detail' || campo === 'indice') {
        if (campo === 'indice') continue
        erroresApi.formulario = String(datosError[campo])
        continue
      }
      if (campo === 'instancias') {
        erroresApi.formulario = Array.isArray(datosError[campo])
          ? datosError[campo][0]
          : String(datosError[campo])
        continue
      }
      erroresApi[campo] = Array.isArray(datosError[campo])
        ? datosError[campo][0]
        : String(datosError[campo])
    }
    setErrores(erroresApi)
    setErroresFilas(erroresDeFila)
  }

  async function manejarEnvio(evento) {
    evento.preventDefault()
    if (enviandoRef.current) return

    const erroresFormulario = validar(datos)
    setErrores(erroresFormulario)
    let erroresDeFila = {}
    if (!esEdicion && datos.modo !== 'unico') {
      if (ejemplares.length < 2 || ejemplares.length > 50) {
        erroresFormulario.stock = 'Registra entre 2 y 50 ejemplares.'
      }
      const erroresCodigo = datos.modo === 'detalle' ? validarCodigosDuplicados(ejemplares) : []
      if (datos.modo === 'detalle') {
        ejemplares.forEach((fila, indice) => {
          if (!fila.codigo_ejemplar.trim()) {
            erroresDeFila[indice] = {
              ...(erroresDeFila[indice] || {}),
              codigo_ejemplar: 'El código del ejemplar es obligatorio.',
            }
          }
        })
      }
      erroresCodigo.forEach(({ indice, mensaje }) => {
        erroresDeFila[indice] = { ...(erroresDeFila[indice] || {}), codigo_ejemplar: mensaje }
      })
      validarFotosEjemplares(ejemplares).forEach(({ indice, mensaje }) => {
        erroresDeFila[indice] = { ...(erroresDeFila[indice] || {}), foto: mensaje }
      })
    }
    setErroresFilas(erroresDeFila)
    if (Object.keys(erroresFormulario).length > 0 || Object.keys(erroresDeFila).length > 0) {
      return
    }

    enviandoRef.current = true
    setEnviando(true)
    setMensajeExito('')
    try {
      const cuerpo = esEdicion
        ? construirCuerpo()
        : construirCuerpoRegistroMaterial({
          modo: datos.modo,
          datos: { ...construirCampos(), foto: datos.foto, ubicacion: datos.ubicacion },
          ejemplares,
        })
      if (esEdicion) {
        await api.put(`/materiales/${material.id}/`, cuerpo)
      } else {
        await api.post('/materiales/', cuerpo)
      }

      setMensajeExito(
        esEdicion ? 'Material actualizado correctamente.' : 'Material registrado correctamente.',
      )
      setErrores({})
      setErroresFilas({})
      if (!esEdicion) {
        liberarVistaPrevia(datos.vistaPreviaFoto)
        liberarVistasDeFilas(ejemplares)
        setDatos(crearDatosIniciales(null))
        setEjemplares(crearEjemplares(1, () => `ejemplar-${++contadorIds.current}`))
      }
      if (onGuardado) {
        onGuardado()
      }
    } catch (error) {
      if (error instanceof ErrorApi && error.datos) {
        mostrarErroresDelBackend(error.datos)
      } else {
        setErrores({
          formulario: 'No se pudo conectar con el servidor. Inténtalo de nuevo.',
        })
      }
    } finally {
      enviandoRef.current = false
      setEnviando(false)
    }
  }

  if (esEdicion && alcanceEdicion && alcanceEdicion !== 'general') {
    return (
      <EditorInstanciasMaterial
        material={material}
        alcance={alcanceEdicion}
        onCambiarAlcance={() => setAlcanceEdicion(null)}
        onGuardado={onGuardado}
        onCancelar={onCancelar}
      />
    )
  }

  if (esEdicion && !alcanceEdicion) {
    const cantidad = material.instancias?.length || material.stock
    return (
      <section>
        <header className="mb-5">
          <h3 className="text-lg font-bold text-texto">Editar material: {material.nombre}</h3>
          <p className="mt-1 text-sm text-texto-suave">Elige qué información quieres modificar. El material tiene {cantidad} ejemplar{cantidad === 1 ? '' : 'es'}.</p>
        </header>
        <Tarjeta className="grid gap-3 p-6 sm:grid-cols-3">
          <Boton tipo="button" variante="secundario" onClick={() => setAlcanceEdicion('general')}>
            Datos generales
          </Boton>
          <Boton tipo="button" variante="secundario" onClick={() => setAlcanceEdicion('instancia')}>
            Elegir un ejemplar
          </Boton>
          <Boton tipo="button" variante="secundario" onClick={() => setAlcanceEdicion('todas')}>
            Aplicar campos a todos
          </Boton>
          <Boton tipo="button" variante="fantasma" className="sm:col-span-3" onClick={onCancelar}>
            Cancelar
          </Boton>
        </Tarjeta>
      </section>
    )
  }

  return (
    <section>
      <header className="mb-5">
        <h3 className="text-lg font-bold text-texto">
          {esEdicion ? `Editar material: ${material.nombre}` : 'Registrar material'}
        </h3>
      </header>

      {mensajeExito && (
        <p className="mb-4 text-sm font-semibold text-marca-700 dark:text-marca-300" role="status">
          {mensajeExito}
        </p>
      )}

      <Tarjeta className="p-6">
        <form onSubmit={manejarEnvio} noValidate className="grid gap-4">
          {errores.formulario && <ErrorAlerta mensaje={errores.formulario} />}

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              etiqueta="Nombre"
              valor={datos.nombre}
              onCambio={(evento) => actualizar('nombre', evento.target.value)}
              error={errores.nombre}
              maxLength={150}
            />
            <Campo
              etiqueta="Código de inventario"
              valor={datos.codigo_inventario}
              onCambio={(evento) => actualizar('codigo_inventario', evento.target.value)}
              error={errores.codigo_inventario}
              maxLength={30}
            />
            <Campo
              etiqueta="Descripción"
              tipo="area"
              valor={datos.descripcion}
              onCambio={(evento) => actualizar('descripcion', evento.target.value)}
              rows={2}
              className="sm:col-span-2"
            />
            <Campo
              etiqueta="Tipo"
              opciones={OPCIONES_TIPO}
              valor={datos.tipo}
              onCambio={(evento) => actualizar('tipo', evento.target.value)}
            />
            {!esEdicion && (
              <Campo
                etiqueta="Modo de registro"
                opciones={[
                  { valor: 'unico', etiqueta: 'Único' },
                  { valor: 'lote', etiqueta: 'Lote idéntico' },
                  { valor: 'detalle', etiqueta: 'Por detalle' },
                ]}
                valor={datos.modo}
                onCambio={(evento) => cambiarModo(evento.target.value)}
              />
            )}
            {esEdicion && (
              <Campo
                etiqueta="Estado"
                opciones={OPCIONES_ESTADO}
                valor={datos.estado}
                onCambio={(evento) => actualizar('estado', evento.target.value)}
                error={errores.estado}
              />
            )}
            {!esEdicion && datos.modo !== 'unico' && (
              <Campo
                etiqueta="Cantidad de ejemplares"
                tipo="number"
                min="2"
                max="50"
                step="1"
                valor={ejemplares.length}
                onCambio={(evento) => {
                  const cantidad = Number(evento.target.value)
                  if (Number.isInteger(cantidad) && cantidad >= 2 && cantidad <= 50) {
                    redimensionarFilas(cantidad)
                  }
                }}
                error={errores.stock}
              />
            )}
          </div>

          <label className="flex items-center gap-2 text-sm font-semibold text-texto">
            <input
              type="checkbox"
              checked={datos.es_alto_valor}
              onChange={(evento) => actualizar('es_alto_valor', evento.target.checked)}
              className="size-4 rounded border-borde accent-marca-600"
            />
            ¿Es de alto valor?
          </label>

          <EncabezadoSeccion>Ficha técnica</EncabezadoSeccion>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              etiqueta="Marca"
              valor={datos.marca}
              onCambio={(evento) => actualizar('marca', evento.target.value)}
              maxLength={60}
            />
            <Campo
              etiqueta="Modelo"
              valor={datos.modelo}
              onCambio={(evento) => actualizar('modelo', evento.target.value)}
              maxLength={60}
            />
            {(!esEdicion && datos.modo === 'unico') && (
              <Campo
                etiqueta="Número de serie"
                valor={datos.numero_serie}
                onCambio={(evento) => actualizar('numero_serie', evento.target.value)}
                maxLength={50}
              />
            )}
            <Campo
              etiqueta={!esEdicion && datos.modo === 'unico'
                ? 'Color del ejemplar'
                : !esEdicion
                  ? 'Color general (predeterminado)'
                  : 'Color del material'}
              valor={datos.color}
              onCambio={(evento) => actualizar('color', evento.target.value)}
              maxLength={30}
            />
            {(!esEdicion && ['unico', 'lote'].includes(datos.modo)) && (
              <Campo
                etiqueta="Estado físico"
                valor={datos.estado_fisico}
                onCambio={(evento) => actualizar('estado_fisico', evento.target.value)}
                maxLength={50}
              />
            )}
            {!esEdicion && ['unico', 'lote'].includes(datos.modo) && (
              <Campo
                etiqueta={datos.modo === 'lote' ? 'Estante por defecto' : 'Estante'}
                valor={datos.ubicacion}
                onCambio={(evento) => actualizar('ubicacion', evento.target.value)}
                maxLength={100}
              />
            )}
          </div>

          <div className="grid gap-1">
            <span className="text-sm font-semibold text-texto">Foto del material</span>
            {errores.foto ? (
              <p className="text-xs text-error">{errores.foto}</p>
            ) : (
              <p className="text-xs text-texto-suave">JPG, PNG o WEBP, hasta 5 MB. Opcional.</p>
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-invalid={Boolean(errores.foto)}
              onChange={manejarArchivoFoto}
              className="block w-full text-sm text-texto file:mr-3 file:rounded-lg file:border-0 file:bg-superficie-alta file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-texto hover:file:bg-acento-50"
            />
            {datos.vistaPreviaFoto ? (
              <img
                className="mt-2 h-32 w-32 rounded-lg border border-borde object-cover"
                src={datos.vistaPreviaFoto}
                alt="Vista previa de la foto"
              />
            ) : (
              <span className="mt-2 flex h-32 w-32 items-center justify-center rounded-lg border border-dashed border-borde text-xs text-texto-suave">
                Sin foto
              </span>
            )}
          </div>

          {!esEdicion && datos.modo !== 'unico' && (
            <>
              <EncabezadoSeccion>
                {datos.modo === 'lote' ? 'Datos de cada ejemplar' : 'Detalle de los ejemplares'}
              </EncabezadoSeccion>
              <div className="grid gap-4">
                {ejemplares.map((fila, indice) => (
                  <Tarjeta key={fila.id} className="grid gap-4 border border-borde p-4">
                    <h5 className="text-sm font-bold text-texto">Ejemplar {indice + 1}</h5>
                    {erroresFilas[indice] && (
                      <ErrorAlerta
                        mensaje={Object.values(erroresFilas[indice]).join(' ')}
                      />
                    )}
                    <div className="grid gap-4 sm:grid-cols-2">
                      {datos.modo === 'detalle' && (
                        <Campo
                          etiqueta="Código de ejemplar"
                          valor={fila.codigo_ejemplar}
                          placeholder={`${datos.codigo_inventario.trim() || 'CODIGO'}-${String(indice + 1).padStart(2, '0')}`}
                          onCambio={(evento) => actualizarFila(indice, 'codigo_ejemplar', evento.target.value)}
                          error={erroresFilas[indice]?.codigo_ejemplar}
                          maxLength={50}
                          requerido
                        />
                      )}
                      <Campo
                        etiqueta="Número de serie"
                        valor={fila.numero_serie}
                        onCambio={(evento) => actualizarFila(indice, 'numero_serie', evento.target.value)}
                        maxLength={80}
                      />
                      <Campo
                        etiqueta="Color del ejemplar (opcional)"
                        valor={fila.color}
                        onCambio={(evento) => actualizarFila(indice, 'color', evento.target.value)}
                        maxLength={30}
                      />
                      {datos.modo === 'detalle' && (
                        <Campo
                          etiqueta="Estado físico"
                          valor={fila.estado_fisico}
                          onCambio={(evento) => actualizarFila(indice, 'estado_fisico', evento.target.value)}
                          maxLength={100}
                        />
                      )}
                      <Campo
                        etiqueta={datos.modo === 'lote' ? 'Estante (opcional)' : 'Estante'}
                        valor={fila.ubicacion}
                        onCambio={(evento) => actualizarFila(indice, 'ubicacion', evento.target.value)}
                        maxLength={100}
                      />
                      <Campo
                        etiqueta={datos.modo === 'detalle' ? 'Descripción individual' : 'Observaciones'}
                        tipo="area"
                        valor={fila.observaciones}
                        onCambio={(evento) => actualizarFila(indice, 'observaciones', evento.target.value)}
                        rows={2}
                      />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-sm font-semibold text-texto" htmlFor={`foto-ejemplar-${fila.id}`}>
                        Foto del ejemplar (opcional)
                      </label>
                      <input
                        id={`foto-ejemplar-${fila.id}`}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        aria-invalid={Boolean(erroresFilas[indice]?.foto)}
                        onChange={(evento) => manejarFotoEjemplar(indice, evento)}
                        className="block w-full text-sm text-texto file:mr-3 file:rounded-lg file:border-0 file:bg-superficie-alta file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-texto hover:file:bg-acento-50"
                      />
                      {erroresFilas[indice]?.foto && (
                        <p className="text-xs text-error">{erroresFilas[indice].foto}</p>
                      )}
                      {fila.vistaPrevia && (
                        <img
                          className="h-24 w-24 rounded-lg border border-borde object-cover"
                          src={fila.vistaPrevia}
                          alt={`Vista previa del ejemplar ${indice + 1}`}
                        />
                      )}
                    </div>
                  </Tarjeta>
                ))}
              </div>
            </>
          )}

          <EncabezadoSeccion>Parámetros de reputación</EncabezadoSeccion>

          <p className="text-xs text-texto-suave">
            Los parámetros en blanco usan los valores por defecto del sistema. Los puntos
            van de 0 a 500.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              etiqueta="Tier mínimo requerido"
              opciones={[
                { valor: '', etiqueta: 'Sin especificar' },
                ...OPCIONES_TIER,
              ]}
              valor={datos.tier_minimo_requerido}
              onCambio={(evento) => actualizar('tier_minimo_requerido', evento.target.value)}
            />
            {CAMPOS_PUNTOS.map(({ campo, etiqueta }) => (
              <Campo
                key={campo}
                etiqueta={etiqueta}
                tipo="number"
                min="0"
                max="500"
                step="1"
                valor={datos[campo]}
                onCambio={(evento) => actualizar(campo, evento.target.value)}
                error={errores[campo]}
              />
            ))}
            <Campo
              etiqueta="Costo de reparación (opcional)"
              tipo="number"
              min="0"
              step="0.01"
              valor={datos.costo_reparacion}
              onCambio={(evento) => actualizar('costo_reparacion', evento.target.value)}
              error={errores.costo_reparacion}
            />
            <Campo
              etiqueta="Costo de reposición (opcional)"
              tipo="number"
              min="0"
              step="0.01"
              valor={datos.costo_reposicion}
              onCambio={(evento) => actualizar('costo_reposicion', evento.target.value)}
              error={errores.costo_reposicion}
            />
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            <Boton tipo="submit" cargando={enviando}>
              {esEdicion ? 'Guardar cambios' : 'Registrar material'}
            </Boton>
            {onCancelar && (
              <Boton variante="secundario" tipo="button" deshabilitado={enviando} onClick={onCancelar}>
                Cancelar
              </Boton>
            )}
          </div>
        </form>
      </Tarjeta>
    </section>
  )
}

export default MaterialForm
