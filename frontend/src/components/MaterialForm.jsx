import { useEffect, useRef, useState } from 'react'

import { api, ErrorApi } from '../api/client'
import {
  validarCodigoMaterial,
  validarFoto,
  validarNombre,
  validarPuntosReputacion,
} from '../validaciones'
import { ETIQUETAS_ESTADO, OPCIONES_TIER, OPCIONES_TIPO } from '../constantes/catalogo'
import {
  MAXIMO_EJEMPLARES_REGISTRO,
  codigoEjemplarPorDefecto,
  construirCuerpoRegistroMaterial,
  crearEjemplares,
  ejemplosCodigosEjemplares,
  mapearErroresPorFila,
  redimensionarEjemplares,
  validarCodigosDuplicados,
  validarFotosEjemplares,
} from '../inventario/registroMaterial'
import Campo from './ui/Campo'
import Boton from './ui/Boton'
import Tarjeta from './ui/Tarjeta'
import ErrorAlerta from './ui/ErrorAlerta'
import AgregarEjemplaresMaterial from './AgregarEjemplaresMaterial'
import EditorInstanciasMaterial from './EditorInstanciasMaterial'

// Parámetros de reputación en puntos: si se blanks, el backend aplica los
// valores por defecto configurados (HU04 criterio 3).
const CAMPOS_PUNTOS = [
  { campo: 'bonificacion_tiempo', etiqueta: 'Bonificación por tiempo' },
  { campo: 'deduccion_tardanza', etiqueta: 'Deducción por tardanza' },
  { campo: 'deduccion_dano_parcial', etiqueta: 'Deducción por daño parcial' },
  { campo: 'deduccion_dano_total', etiqueta: 'Deducción por daño total' },
]

const DEFAULTS_REPUTACION_POR_TIER = {
  avanzado: {
    bonificacion_tiempo: '10',
    deduccion_tardanza: '5',
    deduccion_dano_parcial: '20',
    deduccion_dano_total: '40',
  },
  estandar: {
    bonificacion_tiempo: '5',
    deduccion_tardanza: '10',
    deduccion_dano_parcial: '30',
    deduccion_dano_total: '60',
  },
  restringido: {
    bonificacion_tiempo: '0',
    deduccion_tardanza: '15',
    deduccion_dano_parcial: '40',
    deduccion_dano_total: '80',
  },
}

const OPCIONES_ESTADO_INICIAL_EJEMPLAR = [
  { valor: 'disponible', etiqueta: 'Disponible' },
  { valor: 'en_mantenimiento', etiqueta: 'En mantenimiento' },
]

const ETIQUETAS_CAMPOS_ERROR = {
  nombre: 'Nombre',
  codigo_material: 'Código de Material',
  codigo_ejemplar: 'Código de Ejemplar',
  tipo: 'Tipo',
  stock: 'Cantidad de ejemplares',
  estado: 'Estado',
  estado_inicial_ejemplares: 'Estado',
  foto: 'Foto',
  formulario: 'Registro',
}

function convertirErroresALista(error) {
  if (Array.isArray(error)) return error.flatMap(convertirErroresALista)
  if (error && typeof error === 'object') {
    return Object.values(error).flatMap(convertirErroresALista)
  }
  return [String(error)]
}

const DATOS_INICIALES = {
  nombre: '',
  descripcion: '',
  codigo_material: '',
  tipo: 'equipo',
  stock: 1,
  modo: 'unico',
  es_alto_valor: false,
  precio: '',
  marca: '',
  modelo: '',
  numero_serie: '',
  color: '',
  ubicacion: '',
  observaciones: '',
  foto: null,
  vistaPreviaFoto: '',
  tier_minimo_requerido: 'estandar',
  bonificacion_tiempo: '5',
  deduccion_tardanza: '10',
  deduccion_dano_parcial: '30',
  deduccion_dano_total: '60',
  estado_inicial_ejemplares: 'disponible',
  costo_reparacion: '',
  costo_reposicion: '',
  estado: 'disponible',
}

export function obtenerInstanciasElegiblesEstadoGeneral(material) {
  if (!Array.isArray(material?.instancias)) return []
  return material.instancias.filter((inst) => ['disponible', 'en_mantenimiento'].includes(inst.estado))
}

export function puedeCambiarEstadoGeneral(material) {
  return obtenerInstanciasElegiblesEstadoGeneral(material).length > 0
}

export function obtenerEstadoGeneralInicial(material) {
  if (!material) return 'disponible'
  const instancias = Array.isArray(material.instancias) ? material.instancias : []
  const estadosElegibles = new Set(
    instancias
      .filter((inst) => ['disponible', 'en_mantenimiento'].includes(inst.estado))
      .map((inst) => inst.estado),
  )
  if (estadosElegibles.size > 1) {
    return ''
  }
  if (estadosElegibles.size === 0) {
    return material.estado || 'disponible'
  }
  if (estadosElegibles.has('en_mantenimiento') || material.estado === 'en_mantenimiento') {
    return 'en_mantenimiento'
  }
  return 'disponible'
}

function crearDatosIniciales(material) {
  return {
    ...DATOS_INICIALES,
    ...Object.fromEntries(
      Object.entries(DATOS_INICIALES).map(([campo, inicial]) => [campo, material?.[campo] ?? inicial]),
    ),
    estado: obtenerEstadoGeneralInicial(material),
    modo: 'unico',
    foto: null,
    vistaPreviaFoto: material?.foto || '',
  }
}

function validar(datos) {
  const errores = {}

  if (datos.precio === '' || datos.precio === null || datos.precio === undefined) {
    errores.precio = 'El precio es obligatorio.'
  } else if (!Number.isFinite(Number(datos.precio))) {
    errores.precio = 'Ingresa un precio válido.'
  } else if (Number(datos.precio) < 0) {
    errores.precio = 'El precio no puede ser negativo.'
  }

  const errorNombre = validarNombre(datos.nombre)
  if (errorNombre) {
    errores.nombre = errorNombre
  }

  const errorCodigo = validarCodigoMaterial(datos.codigo_material)
  if (errorCodigo) {
    errores.codigo_material = errorCodigo
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
  const instanciasMaterial = Array.isArray(material?.instancias) ? material.instancias : []
  const instanciasBloqueadas = instanciasMaterial.filter((inst) =>
    ['prestado', 'reservado'].includes(inst.estado),
  )
  const instanciasModificables = obtenerInstanciasElegiblesEstadoGeneral(material)
  const estadoGeneralBloqueado = esEdicion && !puedeCambiarEstadoGeneral(material)
  const [alcanceEdicion, setAlcanceEdicion] = useState(null)
  const contadorIds = useRef(0)
  const urlsTemporales = useRef(new Set())
  const enviandoRef = useRef(false)
  const [datos, setDatos] = useState(() => crearDatosIniciales(material))
  const [reposicionVinculadaAlPrecio, setReposicionVinculadaAlPrecio] = useState(() =>
    !material || material.costo_reposicion == null || Number(material.costo_reposicion) === Number(material.precio),
  )
  const [ejemplares, setEjemplares] = useState(() =>
    material ? [] : crearEjemplares(1, () => `ejemplar-${++contadorIds.current}`),
  )
  const [cantidadEjemplares, setCantidadEjemplares] = useState('1')
  const [errores, setErrores] = useState({})
  const [erroresFilas, setErroresFilas] = useState({})
  const [enviando, setEnviando] = useState(false)
  const [mensajeExito, setMensajeExito] = useState('')
  const [mostrarErroresEmergente, setMostrarErroresEmergente] = useState(false)
  const [estadoGeneralModificado, setEstadoGeneralModificado] = useState(false)
  const [estadoPendienteConfirmacion, setEstadoPendienteConfirmacion] = useState(null)

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

  function redimensionarFilas(cantidad, modo = datos.modo) {
    const filasRedimensionadas = redimensionarEjemplares(
      ejemplares,
      cantidad,
      () => `ejemplar-${++contadorIds.current}`,
    )
    const siguiente = modo === 'detalle'
      ? filasRedimensionadas.map((fila, indice) => ({
        ...fila,
        codigo_ejemplar: fila.codigo_ejemplar || codigoEjemplarPorDefecto(datos.codigo_material, indice),
        color: fila.color || datos.color,
      }))
      : filasRedimensionadas
    const idsConservados = new Set(siguiente.map((fila) => fila.id))
    liberarVistasDeFilas(ejemplares.filter((fila) => !idsConservados.has(fila.id)))
    setEjemplares(siguiente)
    setErroresFilas({})
    return siguiente
  }

  function cambiarModo(modo) {
    const cantidad = modo === 'unico' ? 1 : Math.max(ejemplares.length, 2)
    redimensionarFilas(cantidad, modo)
    setCantidadEjemplares(String(cantidad))
    setErrores((previos) => ({ ...previos, stock: '' }))
    actualizar('modo', modo)
  }

  function cambiarCantidadEjemplares(valor) {
    setCantidadEjemplares(valor)
    const cantidad = Number(valor)
    const cantidadValida = valor !== ''
      && Number.isInteger(cantidad)
      && cantidad >= 2
      && cantidad <= MAXIMO_EJEMPLARES_REGISTRO

    setErrores((previos) => ({
      ...previos,
      stock: cantidadValida
        ? ''
        : `Ingresa un número entero entre 2 y ${MAXIMO_EJEMPLARES_REGISTRO}.`,
    }))

    if (cantidadValida) redimensionarFilas(cantidad)
  }

  function actualizar(campo, valor) {
    if (campo === 'precio') {
      setDatos((previos) => ({
        ...previos,
        precio: valor,
        ...(reposicionVinculadaAlPrecio ? { costo_reposicion: valor } : {}),
      }))
      return
    }
    if (campo === 'costo_reposicion') {
      setReposicionVinculadaAlPrecio(false)
    }
    if (campo === 'tier_minimo_requerido' && DEFAULTS_REPUTACION_POR_TIER[valor]) {
      setDatos((previos) => ({
        ...previos,
        tier_minimo_requerido: valor,
        ...DEFAULTS_REPUTACION_POR_TIER[valor],
      }))
      return
    }
    if (!esEdicion && datos.modo === 'detalle' && campo === 'estado') {
      setEjemplares(ejemplares.map((fila) => ({ ...fila, estado: valor })))
    }
    if (!esEdicion && datos.modo === 'detalle' && ['codigo_material', 'color'].includes(campo)) {
      setEjemplares(ejemplares.map((fila, indice) => {
        if (campo === 'codigo_material') {
          const codigoAnterior = codigoEjemplarPorDefecto(datos.codigo_material, indice)
          if (!fila.codigo_ejemplar || fila.codigo_ejemplar === codigoAnterior) {
            return { ...fila, codigo_ejemplar: codigoEjemplarPorDefecto(valor, indice) }
          }
        }
        if (campo === 'color' && (!fila.color || fila.color === datos.color)) {
          return { ...fila, color: valor }
        }
        return fila
      }))
    }
    setDatos((previos) => ({ ...previos, [campo]: valor }))
  }

  function actualizarFila(indice, campo, valor) {
    if (!esEdicion && datos.modo === 'detalle' && campo === 'estado') {
      const filasActualizadas = ejemplares.map((fila, posicion) =>
        posicion === indice ? { ...fila, estado: valor } : fila,
      )
      setEjemplares(filasActualizadas)
      if (filasActualizadas.length > 0) {
        const todasDisponibles = filasActualizadas.every((fila) => fila.estado === 'disponible')
        const todasEnMantenimiento = filasActualizadas.every((fila) => fila.estado === 'en_mantenimiento')
        if (todasDisponibles || todasEnMantenimiento) {
          setDatos((previos) => ({
            ...previos,
            estado: todasEnMantenimiento ? 'en_mantenimiento' : 'disponible',
          }))
        }
      }
      return
    }
    const filasActualizadas = ejemplares.map((fila, posicion) =>
      posicion === indice ? { ...fila, [campo]: valor } : fila,
    )
    setEjemplares(filasActualizadas)
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
      codigo_material: datos.codigo_material.trim(),
      tipo: datos.tipo,
      es_alto_valor: datos.es_alto_valor,
      precio: datos.precio === '' ? '' : Number(datos.precio),
      marca: datos.marca.trim(),
      modelo: datos.modelo.trim(),
      color: datos.color.trim(),
      costo_reparacion: datos.costo_reparacion === '' ? null : Number(datos.costo_reparacion),
      costo_reposicion: datos.costo_reposicion === '' ? null : Number(datos.costo_reposicion),
    }

    if (!esEdicion) {
      cuerpo.stock = Number(datos.stock)
      cuerpo.numero_serie = datos.numero_serie.trim()
      cuerpo.estado_inicial_ejemplares = datos.estado_inicial_ejemplares
      if (datos.modo === 'detalle') {
        cuerpo.estado = datos.estado
      }
    }

    if (datos.tier_minimo_requerido) {
      cuerpo.tier_minimo_requerido = datos.tier_minimo_requerido
    }

    for (const { campo } of CAMPOS_PUNTOS) {
      if (datos[campo] !== '') {
        cuerpo[campo] = Number(datos[campo])
      }
    }

    if (
      esEdicion &&
      !estadoGeneralBloqueado &&
      estadoGeneralModificado &&
      ['disponible', 'en_mantenimiento'].includes(datos.estado)
    ) {
      cuerpo.estado = datos.estado
    }

    return cuerpo
  }

  function solicitarCambioEstadoGeneral(nuevoEstado) {
    if (estadoGeneralBloqueado) return
    if (!['disponible', 'en_mantenimiento'].includes(nuevoEstado)) return
    setEstadoPendienteConfirmacion(nuevoEstado)
  }

  function confirmarCambioEstadoGeneral() {
    if (!estadoPendienteConfirmacion) return
    actualizar('estado', estadoPendienteConfirmacion)
    setEstadoGeneralModificado(true)
    setEstadoPendienteConfirmacion(null)
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
        erroresApi.formulario = convertirErroresALista(datosError[campo]).join(' | ')
        continue
      }
      if (campo === 'instancias') {
        erroresApi.formulario = convertirErroresALista(datosError[campo]).join(' | ')
        continue
      }
      erroresApi[campo] = convertirErroresALista(datosError[campo]).join(' | ')
    }
    setErrores(erroresApi)
    setErroresFilas(erroresDeFila)
    setMostrarErroresEmergente(true)
  }

  async function manejarEnvio(evento) {
    evento.preventDefault()
    if (enviandoRef.current) return

    const erroresFormulario = validar(datos)
    let erroresDeFila = {}
    if (!esEdicion && datos.modo !== 'unico') {
      const cantidad = Number(cantidadEjemplares)
      if (cantidadEjemplares === ''
        || !Number.isInteger(cantidad)
        || cantidad < 2
        || cantidad > MAXIMO_EJEMPLARES_REGISTRO
        || cantidad !== ejemplares.length) {
        erroresFormulario.stock = `Ingresa un número entero entre 2 y ${MAXIMO_EJEMPLARES_REGISTRO}.`
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
    setErrores(erroresFormulario)
    setErroresFilas(erroresDeFila)
    if (Object.keys(erroresFormulario).length > 0 || Object.keys(erroresDeFila).length > 0) {
      setMostrarErroresEmergente(true)
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
          datos: {
            ...construirCampos(),
            foto: datos.foto,
            ubicacion: datos.ubicacion,
            observaciones: datos.observaciones,
          },
          ejemplares,
        })
      let resultadoRegistro = null
      if (esEdicion) {
        await api.put(`/materiales/${material.id}/`, cuerpo)
      } else {
        resultadoRegistro = await api.post('/materiales/', cuerpo)
      }

      setMensajeExito(
        esEdicion ? 'Material actualizado correctamente.' : 'Material registrado correctamente.',
      )
      setErrores({})
      setErroresFilas({})
      setMostrarErroresEmergente(false)
      if (!esEdicion) {
        liberarVistaPrevia(datos.vistaPreviaFoto)
        liberarVistasDeFilas(ejemplares)
        setDatos(crearDatosIniciales(null))
        setReposicionVinculadaAlPrecio(true)
        setEjemplares(crearEjemplares(1, () => `ejemplar-${++contadorIds.current}`))
      }
      if (onGuardado) {
        onGuardado(resultadoRegistro ? { material: resultadoRegistro, modo: datos.modo } : null)
      }
    } catch (error) {
      if (error instanceof ErrorApi && error.datos) {
        mostrarErroresDelBackend(error.datos)
      } else {
        setErrores({
          formulario: 'No se pudo conectar con el servidor. Inténtalo de nuevo.',
        })
        setMostrarErroresEmergente(true)
      }
    } finally {
      enviandoRef.current = false
      setEnviando(false)
    }
  }

  const mensajesErroresEmergente = [
    ...Object.entries(errores).flatMap(([campo, mensaje]) =>
      String(mensaje).split(' | ').filter(Boolean).map((detalle) => ({
        campo: ETIQUETAS_CAMPOS_ERROR[campo] || campo.replaceAll('_', ' '),
        detalle,
      })),
    ),
    ...Object.entries(erroresFilas).flatMap(([indice, erroresFila]) =>
      Object.entries(erroresFila).flatMap(([campo, mensaje]) =>
        String(mensaje).split(' | ').filter(Boolean).map((detalle) => ({
          campo: `Ejemplar ${Number(indice) + 1} · ${ETIQUETAS_CAMPOS_ERROR[campo] || campo.replaceAll('_', ' ')}`,
          detalle,
        })),
      ),
    ),
  ]

  if (esEdicion && alcanceEdicion === 'agregar') {
    return (
      <section>
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-texto">
              Añadir nueva existencia: {material.nombre}
            </h3>
            <p className="mt-1 text-sm text-texto-suave">
              Registra nuevos ejemplares físicos para este material del catálogo.
            </p>
          </div>
          <Boton tipo="button" variante="fantasma" onClick={() => setAlcanceEdicion(null)}>
            Cambiar alcance
          </Boton>
        </header>
        <AgregarEjemplaresMaterial
          material={material}
          onGuardado={onGuardado}
          onCancelar={() => setAlcanceEdicion(null)}
        />
      </section>
    )
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
        <Tarjeta className="grid gap-3 p-6 sm:grid-cols-2">
          <Boton tipo="button" variante="secundario" onClick={() => setAlcanceEdicion('general')}>
            Datos generales
          </Boton>
          <Boton tipo="button" variante="secundario" onClick={() => setAlcanceEdicion('instancia')}>
            Elegir un ejemplar
          </Boton>
          <Boton tipo="button" variante="secundario" onClick={() => setAlcanceEdicion('todas')}>
            Aplicar campos a todos
          </Boton>
          <Boton tipo="button" variante="secundario" onClick={() => setAlcanceEdicion('agregar')}>
            Añadir nueva existencia
          </Boton>
          <Boton tipo="button" variante="fantasma" className="sm:col-span-2" onClick={onCancelar}>
            Cancelar
          </Boton>
        </Tarjeta>
      </section>
    )
  }

  const opcionesEstadoGeneral = estadoGeneralBloqueado
    ? [{ valor: datos.estado, etiqueta: ETIQUETAS_ESTADO[datos.estado] || datos.estado }]
    : datos.estado === ''
      ? [
        { valor: '', etiqueta: 'Mixto (disponibles y en mantenimiento)' },
        ...OPCIONES_ESTADO_INICIAL_EJEMPLAR,
      ]
      : OPCIONES_ESTADO_INICIAL_EJEMPLAR
  const ejemplosCodigoLote = ejemplosCodigosEjemplares(
    datos.codigo_material,
    cantidadEjemplares,
  )

  return (
    <section>
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-texto">
            {esEdicion ? `Editar material: ${material.nombre}` : 'Registrar material'}
          </h3>
          <p className="mt-1 text-xs text-texto-suave">
            <span className="text-error" aria-hidden="true">*</span> Campos obligatorios.
          </p>
        </div>
        {esEdicion && (
          <Boton tipo="button" variante="fantasma" onClick={() => setAlcanceEdicion(null)}>
            Cambiar alcance
          </Boton>
        )}
      </header>

      {mensajeExito && (
        <p className="mb-4 text-sm font-semibold text-marca-700 dark:text-marca-300" role="status">
          {mensajeExito}
        </p>
      )}

      {estadoPendienteConfirmacion && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onMouseDown={(evento) => {
            if (evento.target === evento.currentTarget) setEstadoPendienteConfirmacion(null)
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirmar-estado-general-titulo"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-borde bg-white p-6 shadow-xl dark:bg-superficie"
          >
            <h3 id="confirmar-estado-general-titulo" className="text-lg font-bold text-texto">
              Confirmar cambio de estado general
            </h3>
            <p className="mt-2 text-sm text-texto">
              ¿De verdad quieres cambiar el estado general de <strong>{material.nombre}</strong> a{' '}
              <strong>
                {estadoPendienteConfirmacion === 'en_mantenimiento' ? 'En mantenimiento' : 'Disponible'}
              </strong>
              ?
            </p>
            <p className="mt-2 text-sm text-texto-suave">
              {instanciasModificables.length > 0
                ? `Este cambio se aplicará al guardar a ${instanciasModificables.length} ejemplar${instanciasModificables.length === 1 ? '' : 'es'} que actualmente está${instanciasModificables.length === 1 ? '' : 'n'} en estado Disponible o En mantenimiento.`
                : 'Actualmente no hay ejemplares en estado Disponible o En mantenimiento que puedan ser modificados manualmente.'}
            </p>

            {instanciasBloqueadas.length > 0 && (
              <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
                <p className="font-bold">
                  Atención: {instanciasBloqueadas.length} ejemplar{instanciasBloqueadas.length === 1 ? '' : 'es'} en estado Prestado o Reservado no será{instanciasBloqueadas.length === 1 ? '' : 'n'} modificado{instanciasBloqueadas.length === 1 ? '' : 's'}
                </p>
                <p className="mt-1">
                  Por regla de negocio, las instancias en estado <strong>Prestado</strong> o{' '}
                  <strong>Reservado</strong> deben seguir su procedimiento correspondiente (registro de
                  devolución o gestión de reserva) para volver a estar en <strong>Disponible</strong>.
                </p>
                <ul className="mt-2 list-disc space-y-0.5 pl-4 font-mono">
                  {instanciasBloqueadas.map((inst) => (
                    <li key={inst.id}>
                      {inst.codigo_ejemplar} ({inst.estado_display || (inst.estado === 'prestado' ? 'Prestado' : 'Reservado')})
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Boton
                tipo="button"
                variante="secundario"
                onClick={() => setEstadoPendienteConfirmacion(null)}
              >
                Cancelar
              </Boton>
              <Boton tipo="button" onClick={confirmarCambioEstadoGeneral}>
                Sí, cambiar estado
              </Boton>
            </div>
          </section>
        </div>
      )}

      {mostrarErroresEmergente && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onMouseDown={(evento) => {
            if (evento.target === evento.currentTarget) setMostrarErroresEmergente(false)
          }}
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="errores-registro-material-titulo"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-borde bg-white p-6 shadow-xl dark:bg-superficie"
          >
            <h3 id="errores-registro-material-titulo" className="text-lg font-bold text-error">
              No se pudo {esEdicion ? 'guardar los cambios' : 'registrar el material'}
            </h3>
            <p className="mt-1 text-sm text-texto-suave">Corrige estos problemas e inténtalo de nuevo:</p>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-texto">
              {mensajesErroresEmergente.map(({ campo, detalle }, indice) => (
                <li key={`${campo}-${indice}`}>
                  {campo !== 'Registro' && <strong>{campo}: </strong>}
                  {detalle}
                </li>
              ))}
            </ul>
            <div className="mt-6 flex justify-end">
              <Boton tipo="button" onClick={() => setMostrarErroresEmergente(false)}>
                Entendido
              </Boton>
            </div>
          </section>
        </div>
      )}

      <Tarjeta className="p-6">
        <form onSubmit={manejarEnvio} noValidate className="grid gap-4">
          {errores.formulario && <ErrorAlerta mensaje={errores.formulario} />}

          <div className="grid items-start gap-4 sm:grid-cols-2">
            <Campo
              etiqueta="Nombre"
              valor={datos.nombre}
              onCambio={(evento) => actualizar('nombre', evento.target.value)}
              error={errores.nombre}
              maxLength={150}
              requerido
            />
            <Campo
              etiqueta="Código de Material"
              valor={datos.codigo_material}
              onCambio={(evento) => actualizar('codigo_material', evento.target.value)}
              error={errores.codigo_material}
              maxLength={30}
              requerido
            />
            {!esEdicion && datos.modo === 'unico' && (
              <Campo
                etiqueta="Código de Ejemplar"
                valor={datos.codigo_material.trim()
                  ? codigoEjemplarPorDefecto(datos.codigo_material, 0)
                  : ''}
                ayuda="Se genera automáticamente para la única unidad registrada."
                readOnly
              />
            )}
            <Campo
              etiqueta="Descripción (opcional)"
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
              requerido
            />
            {!esEdicion && (
              <Campo
                etiqueta="Modo de registro (opcional)"
                opciones={[
                  { valor: 'unico', etiqueta: 'Único' },
                  { valor: 'lote', etiqueta: 'Lote idéntico' },
                  { valor: 'detalle', etiqueta: 'Por detalle' },
                ]}
                valor={datos.modo}
                onCambio={(evento) => cambiarModo(evento.target.value)}
              />
            )}
            {(esEdicion || (!esEdicion && datos.modo === 'detalle')) && (
              <Campo
                etiqueta="Estado"
                opciones={opcionesEstadoGeneral}
                valor={datos.estado}
                deshabilitado={estadoGeneralBloqueado}
                onCambio={(evento) => esEdicion
                  ? solicitarCambioEstadoGeneral(evento.target.value)
                  : actualizar('estado', evento.target.value)}
                error={errores.estado}
                ayuda={esEdicion
                  ? estadoGeneralBloqueado
                    ? `No se puede cambiar el estado general: no hay ejemplares Disponibles o En mantenimiento. El estado actual es ${ETIQUETAS_ESTADO[datos.estado] || datos.estado}.`
                    : estadoGeneralModificado
                    ? `Cambio confirmado: al guardar, los ejemplares elegibles pasarán a "${datos.estado === 'en_mantenimiento' ? 'En mantenimiento' : 'Disponible'}".`
                    : 'Cambiar el estado general afectará solo a los ejemplares Disponibles o En mantenimiento; los Prestados o Reservados conservarán su estado.'
                  : datos.estado === 'en_mantenimiento'
                    ? 'Todas las instancias están En mantenimiento y sus estados no se pueden modificar.'
                    : 'Todas las instancias inician Disponibles; puedes poner algunas En mantenimiento. Si todas quedan así, el material también cambiará a En mantenimiento.'}
                requerido={!esEdicion}
              />
            )}
            {!esEdicion && datos.modo !== 'unico' && (
              <Campo
                etiqueta="Cantidad de ejemplares"
                tipo="number"
                min="2"
                max={MAXIMO_EJEMPLARES_REGISTRO}
                step="1"
                valor={cantidadEjemplares}
                ayuda={`Rango permitido: 2–${MAXIMO_EJEMPLARES_REGISTRO} ejemplares.`}
                onCambio={(evento) => cambiarCantidadEjemplares(evento.target.value)}
                error={errores.stock}
                requerido
              />
            )}
            {!esEdicion && datos.modo === 'lote' && (
              <p className="sm:col-span-2 text-sm text-texto-suave" role="status" aria-live="polite">
                Los códigos de ejemplar se completan automáticamente a partir del Código de Material.
                {ejemplosCodigoLote && (
                  <> Ejemplo: <code className="font-mono text-texto">{ejemplosCodigoLote.primero}</code> (primero) y <code className="font-mono text-texto">{ejemplosCodigoLote.ultimo}</code> (último).</>
                )}
              </p>
            )}
            {!esEdicion && ['unico', 'lote'].includes(datos.modo) && (
              <Campo
                etiqueta="Estado"
                opciones={OPCIONES_ESTADO_INICIAL_EJEMPLAR}
                valor={datos.estado_inicial_ejemplares}
                onCambio={(evento) => actualizar('estado_inicial_ejemplares', evento.target.value)}
                requerido
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
            ¿Es de alto valor? (opcional)
          </label>

          <Campo
            etiqueta="Precio"
            tipo="number"
            min="0"
            step="0.01"
            valor={datos.precio}
            onCambio={(evento) => actualizar('precio', evento.target.value)}
            error={errores.precio}
            requerido
          />

          <EncabezadoSeccion>Ficha técnica</EncabezadoSeccion>
          {!esEdicion && datos.modo === 'lote' && (
            <p role="status" className="-mt-3 mb-4 text-sm text-texto-suave">
              <span aria-hidden="true" className="mr-1 font-bold text-amber-600 dark:text-amber-400">*</span>
              Al crear el lote no se asignan números de serie. Después, edita cada ejemplar para añadir el suyo.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              etiqueta="Marca (opcional)"
              valor={datos.marca}
              onCambio={(evento) => actualizar('marca', evento.target.value)}
              maxLength={60}
            />
            <Campo
              etiqueta="Modelo (opcional)"
              valor={datos.modelo}
              onCambio={(evento) => actualizar('modelo', evento.target.value)}
              maxLength={60}
            />
            {(!esEdicion && datos.modo === 'unico') && (
              <Campo
                etiqueta="Número de serie (opcional)"
                valor={datos.numero_serie}
                onCambio={(evento) => actualizar('numero_serie', evento.target.value)}
                maxLength={50}
              />
            )}
            <Campo
              etiqueta={!esEdicion && datos.modo === 'unico'
                ? 'Color del ejemplar (opcional)'
                : !esEdicion
                  ? datos.modo === 'lote'
                    ? 'Color de los ejemplares (opcional)'
                    : 'Color predeterminado de ejemplares (opcional)'
                  : 'Color del material (opcional)'}
              valor={datos.color}
              onCambio={(evento) => actualizar('color', evento.target.value)}
              maxLength={30}
            />
            {!esEdicion && ['unico', 'lote'].includes(datos.modo) && (
              <Campo
                etiqueta={datos.modo === 'lote' ? 'Estante por defecto (opcional)' : 'Estante (opcional)'}
                valor={datos.ubicacion}
                onCambio={(evento) => actualizar('ubicacion', evento.target.value)}
                maxLength={100}
              />
            )}
            {!esEdicion && datos.modo === 'lote' && (
              <Campo
                etiqueta="Observaciones de los ejemplares (opcional)"
                tipo="area"
                valor={datos.observaciones}
                onCambio={(evento) => actualizar('observaciones', evento.target.value)}
                rows={2}
              />
            )}
            {!esEdicion && datos.modo === 'unico' && (
              <Campo
                etiqueta="Observaciones del ejemplar (opcional)"
                tipo="area"
                valor={datos.observaciones}
                onCambio={(evento) => actualizar('observaciones', evento.target.value)}
                rows={2}
              />
            )}
          </div>

          <div className="grid gap-1">
            <span className="text-sm font-semibold text-texto">
              Foto del material (opcional)
            </span>
            {errores.foto ? (
              <p className="text-xs text-error">{errores.foto}</p>
            ) : (
              <p className="text-xs text-texto-suave">
                JPG, PNG o WEBP, hasta 4 MB.
              </p>
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

          {!esEdicion && datos.modo === 'detalle' && (
            <>
              <EncabezadoSeccion>Detalle de los ejemplares</EncabezadoSeccion>
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
                          etiqueta="Código de Ejemplar"
                          valor={fila.codigo_ejemplar}
                          placeholder={`${datos.codigo_material.trim() || 'CODIGO'}-${String(indice + 1).padStart(2, '0')}`}
                          onCambio={(evento) => actualizarFila(indice, 'codigo_ejemplar', evento.target.value)}
                          error={erroresFilas[indice]?.codigo_ejemplar}
                          maxLength={50}
                          requerido
                        />
                      )}
                      <Campo
                        etiqueta="Número de serie (opcional)"
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
                      <Campo
                        etiqueta="Estado del ejemplar"
                        opciones={OPCIONES_ESTADO_INICIAL_EJEMPLAR}
                        valor={fila.estado}
                        deshabilitado={datos.estado === 'en_mantenimiento'}
                        onCambio={(evento) => actualizarFila(indice, 'estado', evento.target.value)}
                        requerido
                      />
                      <Campo
                        etiqueta="Estante (opcional)"
                        valor={fila.ubicacion}
                        onCambio={(evento) => actualizarFila(indice, 'ubicacion', evento.target.value)}
                        maxLength={100}
                      />
                      <Campo
                        etiqueta={datos.modo === 'detalle' ? 'Descripción individual (opcional)' : 'Observaciones (opcional)'}
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
              etiqueta={esEdicion ? 'Tier mínimo requerido (opcional)' : 'Tier mínimo (opcional)'}
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
                etiqueta={`${etiqueta} (opcional)`}
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
              ayuda="Por defecto, se completa con el Precio. Puedes cambiarlo manualmente."
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
