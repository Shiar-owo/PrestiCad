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
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(opciones.headers || {}),
      },
      ...opciones,
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

export const api = {
  get: (ruta) => peticion(ruta),
  post: (ruta, datos) =>
    peticion(ruta, { method: 'POST', body: JSON.stringify(datos) }),
}