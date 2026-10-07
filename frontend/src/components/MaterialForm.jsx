import { useEffect, useState } from 'react'

import { api, ErrorApi } from '../api/client'
import {
  validarCodigoInventario,
  validarFoto,
  validarNombre,
  validarPuntosReputacion,
  validarStock,
} from '../validaciones'

// Debe reflejar las mismas taxonomías que
// backend/apps/inventario/constants.py
const OPCIONES_TIPO = [
  { valor: 'equipo', etiqueta: 'Equipo' },
  { valor: 'libro', etiqueta: 'Libro' },
  { valor: 'objeto', etiqueta: 'Objeto' },
]

const OPCIONES_ESTADO = [
  { valor: 'disponible', etiqueta: 'Disponible' },
  { valor: 'en_mantenimiento', etiqueta: 'En Mantenimiento' },
  { valor: 'reservado', etiqueta: 'Reservado' },
  { valor: 'prestado', etiqueta: 'Prestado' },
]

// Debe reflejar apps/usuarios/constants.py (TIERS)
const OPCIONES_TIER = [
  { valor: 'estandar', etiqueta: 'Estándar' },
  { valor: 'avanzado', etiqueta: 'Avanzado' },
  { valor: 'restringido', etiqueta: 'Restringido' },
]

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
  es_alto_valor: false,
  marca: '',
  modelo: '',
  numero_serie: '',
  color: '',
  estado_fisico: '',
  // `foto` no vive aquí: es un archivo, no un valor de texto. Se maneja aparte
  // con `archivoFoto` (lo nuevo que elige el gestor) y `vistaPrevia` (la
  // imagen que se muestra, que al editar es la que ya tenía guardada).
  tier_minimo_requerido: '',
  bonificacion_tiempo: '',
  deduccion_tardanza: '',
  deduccion_dano_parcial: '',
  deduccion_dano_total: '',
  costo_reparacion: '',
  costo_reposicion: '',
  estado: 'disponible',
}

function validar(datos, esEdicion, archivoFoto) {
  const errores = {}

  const errorNombre = validarNombre(datos.nombre)
  if (errorNombre) {
    errores.nombre = errorNombre
  }

  const errorCodigo = validarCodigoInventario(datos.codigo_inventario)
  if (errorCodigo) {
    errores.codigo_inventario = errorCodigo
  }

  const errorStock = validarStock(datos.stock)
  if (errorStock) {
    errores.stock = errorStock
  } else if (datos.stock === '' && esEdicion) {
    errores.stock = 'El stock no puede quedar vacío.'
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

  const errorFoto = validarFoto(archivoFoto)
  if (errorFoto) {
    errores.foto = errorFoto
  }

  return errores
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

function MaterialForm({ material, onGuardado, onCancelar }) {
  const esEdicion = Boolean(material)
  const [datos, setDatos] = useState(DATOS_INICIALES)
  const [archivoFoto, setArchivoFoto] = useState(null)
  const [vistaPrevia, setVistaPrevia] = useState('')
  const [errores, setErrores] = useState({})
  const [enviando, setEnviando] = useState(false)
  const [mensajeExito, setMensajeExito] = useState('')

  useEffect(() => {
    if (!material) {
      setDatos(DATOS_INICIALES)
    } else {
      setDatos({
        ...DATOS_INICIALES,
        ...Object.fromEntries(
          Object.keys(DATOS_INICIALES).map((campo) => [
            campo,
            material[campo] ?? (campo === 'stock' ? 1 : ''),
          ]),
        ),
      })
    }
    setArchivoFoto(null)
    setVistaPrevia(material?.foto || '')
    setErrores({})
    setMensajeExito('')
  }, [material])

  // El cleanup corre con la URL anterior a la que `vistaPrevia` va a tomar, y
  // también al desmontar. Solo se liberan las URLs temporales creadas con
  // `createObjectURL`; las ya guardadas las administra el backend.
  useEffect(
    () => () => {
      if (vistaPrevia.startsWith('blob:')) {
        URL.revokeObjectURL(vistaPrevia)
      }
    },
    [vistaPrevia],
  )

  function actualizar(campo, valor) {
    setDatos((previos) => ({ ...previos, [campo]: valor }))
  }

  function manejarArchivoFoto(evento) {
    const archivo = evento.target.files?.[0] || null
    setArchivoFoto(archivo)
    // Sin archivo nuevo se vuelve a la foto guardada: al editar, quitar la
    // selección no debe dejar la vista previa en blanco.
    setVistaPrevia(archivo ? URL.createObjectURL(archivo) : material?.foto || '')
    setErrores((previos) => ({ ...previos, foto: validarFoto(archivo) }))
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
      stock: Number(datos.stock),
      es_alto_valor: datos.es_alto_valor,
      marca: datos.marca.trim(),
      modelo: datos.modelo.trim(),
      numero_serie: datos.numero_serie.trim(),
      color: datos.color.trim(),
      estado_fisico: datos.estado_fisico.trim(),
      costo_reparacion: datos.costo_reparacion === '' ? null : Number(datos.costo_reparacion),
      costo_reposicion: datos.costo_reposicion === '' ? null : Number(datos.costo_reposicion),
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

    if (!archivoFoto) {
      return campos
    }

    const formulario = new FormData()
    for (const [campo, valor] of Object.entries(campos)) {
      // Un `null` appendeado se convierte en la cadena "null" y el backend lo
      // rechaza. La cadena vacía sí la DRF la traduce a null en los campos
      // que admiten nulo, que es justo lo que limpia los costos.
      formulario.append(campo, valor === null ? '' : valor)
    }
    formulario.append('foto', archivoFoto)

    return formulario
  }

  function mostrarErroresDelBackend(datosError) {
    const erroresApi = {}
    for (const campo of Object.keys(datosError)) {
      if (campo === 'detail') {
        erroresApi.formulario = String(datosError[campo])
        continue
      }
      erroresApi[campo] = Array.isArray(datosError[campo])
        ? datosError[campo][0]
        : String(datosError[campo])
    }
    setErrores(erroresApi)
  }

  async function manejarEnvio(evento) {
    evento.preventDefault()

    const erroresFormulario = validar(datos, esEdicion, archivoFoto)
    setErrores(erroresFormulario)
    if (Object.keys(erroresFormulario).length > 0) {
      return
    }

    setEnviando(true)
    setMensajeExito('')
    try {
      const cuerpo = construirCuerpo()
      if (esEdicion) {
        await api.put(`/materiales/${material.id}/`, cuerpo)
      } else {
        await api.post('/materiales/', cuerpo)
      }

      setMensajeExito(
        esEdicion ? 'Material actualizado correctamente.' : 'Material registrado correctamente.',
      )
      setErrores({})
      setArchivoFoto(null)
      setVistaPrevia(material?.foto || '')
      if (!esEdicion) {
        setDatos(DATOS_INICIALES)
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
      setEnviando(false)
    }
  }

  return (
    <section className="material-form">
      <h3>{esEdicion ? `Editar material: ${material.nombre}` : 'Registrar material'}</h3>

      <form onSubmit={manejarEnvio} noValidate>
        {mensajeExito && <p className="exito">{mensajeExito}</p>}
        {errores.formulario && <p className="error">{errores.formulario}</p>}

        <Campo etiqueta="Nombre" error={errores.nombre}>
          <input
            type="text"
            maxLength={150}
            value={datos.nombre}
            aria-invalid={Boolean(errores.nombre)}
            onChange={(e) => actualizar('nombre', e.target.value)}
          />
        </Campo>

        <Campo etiqueta="Código de inventario" error={errores.codigo_inventario}>
          <input
            type="text"
            maxLength={30}
            value={datos.codigo_inventario}
            aria-invalid={Boolean(errores.codigo_inventario)}
            onChange={(e) => actualizar('codigo_inventario', e.target.value)}
          />
        </Campo>

        <Campo etiqueta="Descripción">
          <textarea
            rows={2}
            value={datos.descripcion}
            onChange={(e) => actualizar('descripcion', e.target.value)}
          />
        </Campo>

        <Campo etiqueta="Tipo">
          <select value={datos.tipo} onChange={(e) => actualizar('tipo', e.target.value)}>
            {OPCIONES_TIPO.map((opcion) => (
              <option key={opcion.valor} value={opcion.valor}>
                {opcion.etiqueta}
              </option>
            ))}
          </select>
        </Campo>

        {esEdicion && (
          <Campo etiqueta="Estado" error={errores.estado}>
            <select
              value={datos.estado}
              onChange={(e) => actualizar('estado', e.target.value)}
            >
              {OPCIONES_ESTADO.map((opcion) => (
                <option key={opcion.valor} value={opcion.valor}>
                  {opcion.etiqueta}
                </option>
              ))}
            </select>
          </Campo>
        )}

        <Campo etiqueta="Stock (unidades)" error={errores.stock}>
          <input
            type="number"
            min="1"
            step="1"
            value={datos.stock}
            aria-invalid={Boolean(errores.stock)}
            onChange={(e) => actualizar('stock', e.target.value)}
          />
        </Campo>

        <label>
          <span>¿Es de alto valor?</span>
          <input
            type="checkbox"
            checked={datos.es_alto_valor}
            onChange={(e) => actualizar('es_alto_valor', e.target.checked)}
          />
        </label>

        <h4>Ficha técnica</h4>

        <Campo etiqueta="Marca">
          <input
            type="text"
            maxLength={60}
            value={datos.marca}
            onChange={(e) => actualizar('marca', e.target.value)}
          />
        </Campo>

        <Campo etiqueta="Modelo">
          <input
            type="text"
            maxLength={60}
            value={datos.modelo}
            onChange={(e) => actualizar('modelo', e.target.value)}
          />
        </Campo>

        <Campo etiqueta="Número de serie">
          <input
            type="text"
            maxLength={60}
            value={datos.numero_serie}
            onChange={(e) => actualizar('numero_serie', e.target.value)}
          />
        </Campo>

        <Campo etiqueta="Color">
          <input
            type="text"
            maxLength={30}
            value={datos.color}
            onChange={(e) => actualizar('color', e.target.value)}
          />
        </Campo>

        <Campo etiqueta="Estado físico">
          <input
            type="text"
            maxLength={120}
            value={datos.estado_fisico}
            onChange={(e) => actualizar('estado_fisico', e.target.value)}
          />
        </Campo>

        <Campo etiqueta="Foto del material" error={errores.foto}>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-invalid={Boolean(errores.foto)}
            onChange={manejarArchivoFoto}
          />
          <span className="material-form__ayuda">
            JPG, PNG o WEBP, hasta 5 MB. Opcional.
          </span>
          {vistaPrevia ? (
            <img className="material-form__previa" src={vistaPrevia} alt="Vista previa de la foto" />
          ) : (
            <span className="material-form__previa material-form__previa--vacia">
              Sin foto
            </span>
          )}
        </Campo>

        <h4>Parámetros de reputación</h4>
        <p>
          Los parámetros en blanco usan los valores por defecto del sistema. Los puntos
          van de 0 a 500.
        </p>

        <Campo etiqueta="Tier mínimo requerido">
          <select
            value={datos.tier_minimo_requerido}
            onChange={(e) => actualizar('tier_minimo_requerido', e.target.value)}
          >
            <option value="">Sin especificar</option>
            {OPCIONES_TIER.map((opcion) => (
              <option key={opcion.valor} value={opcion.valor}>
                {opcion.etiqueta}
              </option>
            ))}
          </select>
        </Campo>

        {CAMPOS_PUNTOS.map(({ campo, etiqueta }) => (
          <Campo key={campo} etiqueta={etiqueta} error={errores[campo]}>
            <input
              type="number"
              min="0"
              max="500"
              step="1"
              value={datos[campo]}
              aria-invalid={Boolean(errores[campo])}
              onChange={(e) => actualizar(campo, e.target.value)}
            />
          </Campo>
        ))}

        <Campo etiqueta="Costo de reparación (opcional)" error={errores.costo_reparacion}>
          <input
            type="number"
            min="0"
            step="0.01"
            value={datos.costo_reparacion}
            aria-invalid={Boolean(errores.costo_reparacion)}
            onChange={(e) => actualizar('costo_reparacion', e.target.value)}
          />
        </Campo>

        <Campo etiqueta="Costo de reposición (opcional)" error={errores.costo_reposicion}>
          <input
            type="number"
            min="0"
            step="0.01"
            value={datos.costo_reposicion}
            aria-invalid={Boolean(errores.costo_reposicion)}
            onChange={(e) => actualizar('costo_reposicion', e.target.value)}
          />
        </Campo>

        <div className="material-form__acciones">
          <button type="submit" disabled={enviando}>
            {enviando
              ? 'Guardando…'
              : esEdicion
                ? 'Guardar cambios'
                : 'Registrar material'}
          </button>

          {onCancelar && (
            <button
              type="button"
              className="boton-secundario"
              onClick={onCancelar}
              disabled={enviando}
            >
              Cancelar
            </button>
          )}
        </div>
      </form>
    </section>
  )
}

export default MaterialForm
