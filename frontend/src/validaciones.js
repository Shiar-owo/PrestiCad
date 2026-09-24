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

export function validarEmail(email) {
  if (!email.trim()) {
    return 'El email es obligatorio.'
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return 'Ingresa un correo electrónico válido.'
  }

  return ''
}

export function validarPassword(password) {
  if (!password) {
    return 'La contraseña es obligatoria.'
  }

  if (password.length < 8) {
    return 'La contraseña debe tener al menos 8 caracteres.'
  }

  return ''
}

