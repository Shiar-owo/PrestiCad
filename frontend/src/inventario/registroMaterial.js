import { validarFoto } from '../validaciones'

export const MAXIMO_EJEMPLARES_REGISTRO = 50

export function codigoEjemplarPorDefecto(codigoInventario, indice) {
  const base = String(codigoInventario || '').trim().toUpperCase() || 'CODIGO'
  return `${base}-${String(indice + 1).padStart(2, '0')}`
}

export function crearEjemplar(idLocal) {
  return {
    id: idLocal,
    codigo_ejemplar: '',
    numero_serie: '',
    color: '',
    estado: 'disponible',
    foto: null,
    vistaPrevia: '',
    estado_fisico: 'Operativo',
    ubicacion: '',
    observaciones: '',
  }
}

export function crearEjemplares(cantidad, generarId) {
  const total = Math.max(0, Math.min(Number(cantidad) || 0, MAXIMO_EJEMPLARES_REGISTRO))
  return Array.from({ length: total }, () => crearEjemplar(generarId()))
}

export function redimensionarEjemplares(ejemplares, cantidad, generarId) {
  const existentes = Array.isArray(ejemplares) ? ejemplares : []
  const total = Math.max(0, Math.min(Number(cantidad) || 0, MAXIMO_EJEMPLARES_REGISTRO))
  if (total <= existentes.length) return existentes.slice(0, total)
  return [
    ...existentes,
    ...crearEjemplares(total - existentes.length, generarId),
  ]
}

export function validarCodigosDuplicados(ejemplares) {
  const indicesPorCodigo = new Map()
  const errores = []
  ejemplares.forEach((ejemplar, indice) => {
    const codigo = String(ejemplar.codigo_ejemplar || '').trim().toLocaleLowerCase()
    if (!codigo) return
    if (indicesPorCodigo.has(codigo)) {
      errores.push({
        indice,
        mensaje: `El código del ejemplar está repetido (fila ${indicesPorCodigo.get(codigo) + 1}).`,
      })
    } else {
      indicesPorCodigo.set(codigo, indice)
    }
  })
  return errores
}

export function validarFotosEjemplares(ejemplares) {
  return ejemplares.flatMap((ejemplar, indice) => {
    const mensaje = validarFoto(ejemplar.foto)
    return mensaje ? [{ indice, campo: 'foto', mensaje }] : []
  })
}

function camposDeEjemplar(ejemplar, modo, datos, indice) {
  if (modo === 'lote') {
    return {
      estado: datos.estado_inicial_ejemplares || 'disponible',
      numero_serie: ejemplar.numero_serie || datos.numero_serie || '',
      color: ejemplar.color || datos.color || '',
      observaciones: ejemplar.observaciones || datos.observaciones || '',
      ubicacion: ejemplar.ubicacion || datos.ubicacion || '',
    }
  }

  const campos = {
    estado: ejemplar.estado || 'disponible',
    numero_serie: ejemplar.numero_serie || '',
    color: ejemplar.color || '',
    observaciones: ejemplar.observaciones || '',
    ubicacion: ejemplar.ubicacion || '',
  }
  if (modo === 'detalle') {
    campos.codigo_ejemplar = (ejemplar.codigo_ejemplar || codigoEjemplarPorDefecto(datos.codigo_inventario, indice)).trim()
    campos.estado_fisico = ejemplar.estado_fisico || 'Operativo'
  }
  return campos
}

export function construirCuerpoRegistroMaterial({ modo, datos, ejemplares = [] }) {
  const filas = modo === 'unico' ? ejemplares.slice(0, 1) : ejemplares
  const compartidos = { ...datos }
  delete compartidos.modo
  delete compartidos.stock

  if (modo !== 'unico') {
    delete compartidos.numero_serie
    if (modo === 'detalle') delete compartidos.estado_fisico
  }
  delete compartidos.observaciones

  const cuerpo = {
    ...compartidos,
    modo,
    stock: modo === 'unico' ? 1 : filas.length,
  }

  if (modo === 'unico') {
    const fila = filas[0] || {}
    cuerpo.numero_serie = datos.numero_serie || ''
    cuerpo.estado_fisico = datos.estado_fisico || fila.estado_fisico || 'Operativo'
    cuerpo.ubicacion = datos.ubicacion || fila.ubicacion || ''
    cuerpo.estado_inicial_ejemplares = fila.estado || datos.estado_inicial_ejemplares || 'disponible'
    return construirCuerpoConFotos(cuerpo, [], datos.foto)
  }

  cuerpo.instancias = filas.map((fila, indice) => camposDeEjemplar(fila, modo, datos, indice))
  return construirCuerpoConFotos(
    cuerpo,
    filas.map((fila) => fila.foto),
    datos.foto,
  )
}

function construirCuerpoConFotos(cuerpo, fotosFilas, fotoPortada) {
  const hayFotos = Boolean(fotoPortada) || fotosFilas.some(Boolean)
  if (!hayFotos) return cuerpo

  const formulario = new FormData()
  Object.entries(cuerpo).forEach(([campo, valor]) => {
    if (campo === 'instancias') formulario.append(campo, JSON.stringify(valor))
    else if (valor !== undefined && valor !== null) formulario.append(campo, String(valor))
  })
  if (fotoPortada) formulario.append('foto', fotoPortada)
  fotosFilas.forEach((foto, indice) => {
    if (foto) formulario.append(`instancia_foto_${indice}`, foto)
  })
  return formulario
}

export function mapearErroresPorFila(error) {
  const respuesta = error?.response?.data || error?.data || error || {}
  const indice = Number(respuesta.indice)
  if (!Number.isInteger(indice) || indice < 0) return {}
  const campo = Object.keys(respuesta).find((clave) => !['indice', 'detail'].includes(clave)) || 'general'
  const valor = respuesta[campo]
  const mensaje = Array.isArray(valor) ? valor[0] : typeof valor === 'string' ? valor : ''
  return mensaje ? { [indice]: { campo, mensaje } } : {}
}
