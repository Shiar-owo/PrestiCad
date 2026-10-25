import { ESTADOS_CHECKLIST_DEVOLUCION } from './constantes/devolucion'
import { validarFoto } from './validacionesPrestamo'

const ESTADOS_CON_DANO = ['dano_parcial', 'dano_total']

export function serializarChecklistDevolucion(filas) {
  return filas.map((fila) => ({
    elemento: String(fila.elemento ?? '').trim(),
    estado: fila.estado,
    observacion: String(fila.observacion ?? '').trim(),
  }))
}

export function obtenerElementosSinFotoDevolucion(checklist) {
  if (!Array.isArray(checklist)) return []
  return checklist
    .map((fila, indice) => ({
      indice,
      elemento: String(fila?.elemento ?? '').trim() || `Elemento ${indice + 1}`,
    }))
    .filter(({ indice }) => (
      ESTADOS_CON_DANO.includes(checklist[indice]?.estado)
      && !checklist[indice]?.foto
    ))
}

export function construirFormularioDevolucion(filas) {
  const formulario = new FormData()
  formulario.append('checklist', JSON.stringify(serializarChecklistDevolucion(filas)))
  filas.forEach((fila, indice) => {
    if (fila.foto) formulario.append(`foto_checklist_${indice}`, fila.foto)
  })
  return formulario
}

export function validarChecklistDevolucion(checklist) {
  const errores = {}

  if (!Array.isArray(checklist) || checklist.length === 0) {
    errores.checklist = 'Registra al menos un elemento del material.'
    return errores
  }
  const erroresFilas = {}
  checklist.forEach((item, indice) => {
    const erroresFila = {}
    if (!String(item.elemento ?? '').trim()) {
      erroresFila.elemento = 'El elemento del checklist inicial no tiene descripción.'
    }
    if (!ESTADOS_CHECKLIST_DEVOLUCION.includes(item.estado)) {
      erroresFila.estado = 'Selecciona el estado de devolución.'
    }
    if (ESTADOS_CON_DANO.includes(item.estado)) {
      if (!String(item.observacion ?? '').trim()) {
        erroresFila.observacion = 'Describe la observación porque el elemento reporta daño.'
      }
      if (!item.foto) {
        erroresFila.foto = 'Adjunta una foto porque el elemento reporta daño.'
      }
    }
    if (item.foto) {
      const errorFoto = validarFoto(item.foto)
      if (errorFoto) erroresFila.foto = errorFoto
    }
    if (Object.keys(erroresFila).length > 0) erroresFilas[indice] = erroresFila
  })
  if (Object.keys(erroresFilas).length > 0) {
    errores.filas = erroresFilas
  }

  return errores
}

export function armarChecklistDevolucion(checklistInicial) {
  const filas = Array.isArray(checklistInicial) ? checklistInicial : []

  return filas.map((item) => ({
    elemento: String(item?.elemento ?? '').trim(),
    observacionInicial: String(item?.observacion ?? ''),
    fotoInicialUrl: String(item?.foto_url ?? ''),
    estado: 'sin_cambios',
    observacion: '',
    foto: null,
    fotoPrevia: '',
  }))
}
