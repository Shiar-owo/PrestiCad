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

// --- Inventario (HU04) ---

export function validarCodigoInventario(codigo) {
  if (!codigo.trim()) {
    return 'El código de inventario es obligatorio.'
  }

  if (codigo.trim().length > 30) {
    return 'El código admite máximo 30 caracteres.'
  }

  return ''
}

export function validarStock(stock) {
  const valor = Number(stock)

  if (stock === '' || stock === null || stock === undefined) {
    return ''
  }

  if (!Number.isInteger(valor)) {
    return 'El stock debe ser un número entero.'
  }

  if (valor < 1) {
    return 'El stock debe ser al menos 1 unidad.'
  }

  return ''
}

export function validarPuntosReputacion(valor) {
  if (valor === '' || valor === null || valor === undefined) {
    return ''
  }

  const numero = Number(valor)

  if (!Number.isInteger(numero)) {
    return 'Ingresa un número entero.'
  }

  if (numero < 0 || numero > 500) {
    return 'Ingresa un valor entre 0 y 500 puntos.'
  }

  return ''
}

// Debe reflejar backend/apps/inventario/validators.py, incluidos los mensajes:
// el backend los manda en el 400 y el frontend los muestra tal cual.
export const TAMANIO_MAXIMO_FOTO = 5 * 1024 * 1024

export const FORMATOS_FOTO = ['image/jpeg', 'image/png', 'image/webp']

export function validarFoto(archivo) {
  if (!archivo) {
    return ''
  }

  if (archivo.size > TAMANIO_MAXIMO_FOTO) {
    return 'La foto no debe pesar más de 5 MB.'
  }

  if (!FORMATOS_FOTO.includes(archivo.type)) {
    return 'La foto debe estar en formato JPG, PNG o WEBP.'
  }

  return ''
}
