import { useEffect, useState } from 'react'

import { api, ErrorApi } from '../api/client'
import {
  validarCodigoInventario,
  validarFoto,
  validarNombre,
  validarPuntosReputacion,
  validarStock,
} from '../validaciones'
import Campo from './ui/Campo'
import Boton from './ui/Boton'
import Tarjeta from './ui/Tarjeta'
import ErrorAlerta from './ui/ErrorAlerta'

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

function EncabezadoSeccion({ children }) {
  return (
    <h4 className="mt-2 border-b border-borde pb-2 text-sm font-bold uppercase tracking-wide text-texto-suave">
      {children}
    </h4>
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
            {esEdicion && (
              <Campo
                etiqueta="Estado"
                opciones={OPCIONES_ESTADO}
                valor={datos.estado}
                onCambio={(evento) => actualizar('estado', evento.target.value)}
                error={errores.estado}
              />
            )}
            <Campo
              etiqueta="Stock (unidades)"
              tipo="number"
              min="1"
              step="1"
              valor={datos.stock}
              onCambio={(evento) => actualizar('stock', evento.target.value)}
              error={errores.stock}
            />
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
            <Campo
              etiqueta="Número de serie"
              valor={datos.numero_serie}
              onCambio={(evento) => actualizar('numero_serie', evento.target.value)}
              maxLength={60}
            />
            <Campo
              etiqueta="Color"
              valor={datos.color}
              onCambio={(evento) => actualizar('color', evento.target.value)}
              maxLength={30}
            />
            <Campo
              etiqueta="Estado físico"
              valor={datos.estado_fisico}
              onCambio={(evento) => actualizar('estado_fisico', evento.target.value)}
              maxLength={120}
            />
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
            {vistaPrevia ? (
              <img
                className="mt-2 h-32 w-32 rounded-lg border border-borde object-cover"
                src={vistaPrevia}
                alt="Vista previa de la foto"
              />
            ) : (
              <span className="mt-2 flex h-32 w-32 items-center justify-center rounded-lg border border-dashed border-borde text-xs text-texto-suave">
                Sin foto
              </span>
            )}
          </div>

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