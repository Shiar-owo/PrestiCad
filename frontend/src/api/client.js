const API_URL = '/api'

export class ErrorApi extends Error {
  constructor(status, datos) {
    super(`La petición falló (estado: ${status || 'sin conexión'})`)
    this.name = 'ErrorApi'
    this.status = status
    this.datos = datos
  }
}

function obtenerTokenCsrf() {
  const cookie = document.cookie
    .split('; ')
    .find((parte) => parte.startsWith('csrftoken='))
  return cookie ? decodeURIComponent(cookie.slice('csrftoken='.length)) : ''
}

async function peticion(ruta, opciones = {}) {
  let respuesta
  const metodo = (opciones.method || 'GET').toUpperCase()
  const encabezados = {
    'Content-Type': 'application/json',
    ...(opciones.headers || {}),
  }
  if (!['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(metodo)) {
    const tokenCsrf = obtenerTokenCsrf()
    if (tokenCsrf) encabezados['X-CSRFToken'] = tokenCsrf
  }

  try {
    respuesta = await fetch(`${API_URL}${ruta}`, {
      ...opciones,
      credentials: 'same-origin',
      headers: encabezados,
    })
  } catch {
    throw new ErrorApi(0, null)
  }

  let datos = null
  try {
    datos = await respuesta.json()
  } catch {
    datos = null
  }

  if (!respuesta.ok) throw new ErrorApi(respuesta.status, datos)
  return datos
}

export const api = {
  get: (ruta) => peticion(ruta),
  post: (ruta, datos, opciones = {}) =>
    peticion(ruta, { ...opciones, method: 'POST', body: JSON.stringify(datos) }),
  put: (ruta, datos, opciones = {}) =>
    peticion(ruta, { ...opciones, method: 'PUT', body: JSON.stringify(datos) }),
}
