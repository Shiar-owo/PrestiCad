import { validarFoto } from '../validaciones'
import { MAXIMO_EJEMPLARES_REGISTRO } from './registroMaterial'

function codigoNormalizado(valor) {
  return String(valor || '').trim().toLocaleLowerCase()
}

function obtenerSufijo(codigo, base) {
  const prefijo = String(base || '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const coincidencia = String(codigo || '').match(new RegExp(`^${prefijo}-(\\d+)$`, 'i'))
  return coincidencia ? Number(coincidencia[1]) : 0
}

function crearFila(id, codigo) {
  return {
    id,
    codigo_ejemplar: codigo,
    numero_serie: '',
    color: '',
    foto: null,
    vistaPrevia: '',
    estado: 'disponible',
    estado_fisico: 'Operativo',
    ubicacion: '',
    observaciones: '',
  }
}

export function redimensionarFilasAlta(ejemplares, cantidad, material, generarId) {
  const existentes = Array.isArray(ejemplares) ? ejemplares : []
  const total = Math.max(1, Math.min(Number(cantidad) || 1, MAXIMO_EJEMPLARES_REGISTRO))
  if (total <= existentes.length) return existentes.slice(0, total)

  const base = material?.codigo_inventario || 'MAT'
  const codigos = [
    ...(material?.instancias || []).map((fila) => fila.codigo_ejemplar),
    ...existentes.map((fila) => fila.codigo_ejemplar),
  ]
  let siguiente = Math.max(
    Number(material?.stock) || 0,
    material?.instancias?.length || 0,
    ...codigos.map((codigo) => obtenerSufijo(codigo, base)),
  ) + 1
  const nuevas = []
  while (existentes.length + nuevas.length < total) {
    const codigo = `${base}-${String(siguiente).padStart(2, '0')}`
    siguiente += 1
    if (codigos.some((existente) => codigoNormalizado(existente) === codigoNormalizado(codigo))) continue
    nuevas.push(crearFila(generarId(), codigo))
    codigos.push(codigo)
  }
  return [...existentes, ...nuevas]
}

export function validarFilasAlta(ejemplares, material) {
  const codigosExistentes = new Set(
    (material?.instancias || []).map((fila) => codigoNormalizado(fila.codigo_ejemplar)),
  )
  const codigosNuevos = new Map()
  const errores = []

  ejemplares.forEach((fila, indice) => {
    const codigo = codigoNormalizado(fila.codigo_ejemplar)
    if (!codigo) {
      errores.push({ indice, campo: 'codigo_ejemplar', mensaje: 'El código del ejemplar es obligatorio.' })
    } else if (codigosExistentes.has(codigo)) {
      errores.push({ indice, campo: 'codigo_ejemplar', mensaje: 'El código ya pertenece a un ejemplar de este material.' })
    } else if (codigosNuevos.has(codigo)) {
      errores.push({ indice, campo: 'codigo_ejemplar', mensaje: `El código está repetido (fila ${codigosNuevos.get(codigo) + 1}).` })
    } else {
      codigosNuevos.set(codigo, indice)
    }

    const errorFoto = validarFoto(fila.foto)
    if (errorFoto) errores.push({ indice, campo: 'foto', mensaje: errorFoto })
  })

  return errores
}

export function construirCuerpoAltaInstancias(ejemplares) {
  const instancias = ejemplares.map((fila) => ({
    codigo_ejemplar: fila.codigo_ejemplar.trim(),
    numero_serie: fila.numero_serie || '',
    color: fila.color || '',
    estado: fila.estado || 'disponible',
    estado_fisico: fila.estado_fisico || 'Operativo',
    ubicacion: fila.ubicacion || '',
    observaciones: fila.observaciones || '',
  }))
  if (!ejemplares.some((fila) => fila.foto)) return { instancias }

  const formulario = new FormData()
  formulario.append('instancias', JSON.stringify(instancias))
  ejemplares.forEach((fila, indice) => {
    if (fila.foto) formulario.append(`instancia_foto_${indice}`, fila.foto)
  })
  return formulario
}

export function mapearErroresAltaInstancias(error) {
  const respuesta = error?.datos || error?.response?.data || error || {}
  const errores = {}
  const indice = Number(respuesta.indice)
  if (Number.isInteger(indice) && indice >= 0) {
    errores[indice] = {
      [respuesta.campo || 'general']: respuesta.mensaje || 'Revisa los datos de este ejemplar.',
    }
    return errores
  }

  if (Array.isArray(respuesta.instancias)) {
    respuesta.instancias.forEach((fila, indiceFila) => {
      if (!fila || typeof fila !== 'object' || Array.isArray(fila)) return
      Object.entries(fila).forEach(([campo, mensajes]) => {
        const mensaje = Array.isArray(mensajes) ? mensajes[0] : mensajes
        if (mensaje) errores[indiceFila] = { ...errores[indiceFila], [campo]: String(mensaje) }
      })
    })
  }
  return errores
}
