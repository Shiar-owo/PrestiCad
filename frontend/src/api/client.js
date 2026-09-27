const API_URL = '/api'

export class ErrorApi extends Error {
  constructor(status, datos) {
    super(`La petición falló (estado: ${status || 'sin conexión'})`)
    this.name = 'ErrorApi'
    this.status = status
    this.datos = datos
  }
}

async function peticion(ruta, opciones = {}) {
  let respuesta
  try {
    respuesta = await fetch(`${API_URL}${ruta}`, {
      ...opciones,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(opciones.headers || {}),
      },
    })
  } catch {
    // Error de red (servidor no disponible, CORS, etc.)
    throw new ErrorApi(0, null)
  }

  let datos = null
  try {
    datos = await respuesta.json()
  } catch {
    datos = null
  }

  if (!respuesta.ok) {
    throw new ErrorApi(respuesta.status, datos)
  }

  return datos
}

function obtenerTokenCSRF() {
  if (typeof document === 'undefined') return null

  const cookie = document.cookie
    .split('; ')
    .find((item) => item.startsWith('csrftoken='))

  return cookie ? decodeURIComponent(cookie.slice('csrftoken='.length)) : null
}

export const api = {
  get: (ruta) => peticion(ruta),
  post: (ruta, datos, opciones = {}) =>
    peticion(ruta, { ...opciones, method: 'POST', body: JSON.stringify(datos) }),
  put: (ruta, datos, opciones = {}) => {
    const tokenCSRF = obtenerTokenCSRF()
    return peticion(ruta, {
      ...opciones,
      headers: {
        ...(opciones.headers || {}),
        ...(tokenCSRF ? { 'X-CSRFToken': tokenCSRF } : {}),
      },
      method: 'PUT',
      body: JSON.stringify(datos),
    })
  },
  patch: (ruta, datos, opciones = {}) =>
    peticion(ruta, { ...opciones, method: 'PATCH', body: JSON.stringify(datos) }),
}
