import { ESTADOS_CHECKLIST_DEVOLUCION } from './constantes/devolucion'

export function validarChecklistDevolucion(checklist) {
  const errores = {}

  if (!Array.isArray(checklist) || checklist.length === 0) {
    errores.checklist = 'Registra al menos un elemento del material.'
    return errores
  }
  if (checklist.some((item) => !String(item.elemento ?? '').trim())) {
    errores.checklist = 'Describe cada elemento inspeccionado.'
    return errores
  }
  if (checklist.some((item) => !ESTADOS_CHECKLIST_DEVOLUCION.includes(item.estado))) {
    errores.checklist = 'Selecciona el estado de devolución de cada elemento.'
  }

  return errores
}

export function armarChecklistDevolucion(checklistInicial) {
  const filas = Array.isArray(checklistInicial) ? checklistInicial : []

  return filas.map((item) => ({
    elemento: String(item?.elemento ?? '').trim(),
    condicion: String(item?.condicion ?? ''),
    estado: 'sin_cambios',
    observacion: '',
  }))
}
