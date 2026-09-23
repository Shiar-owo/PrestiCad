export function validarNombre(nombre) {
  if (!nombre.trim()) {
    return 'El nombre es obligatorio.'
  }

  return ''
}

export function validarTelefono(telefono) {
  if (telefono.trim() && !/^[\d+\s-]+$/.test(telefono.trim())) {
    return 'El teléfono solo puede contener dígitos.'
  }

  return ''
}
