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
  const { headers, ...resto } = opciones

  // Con FormData no se fija `Content-Type`: el navegador tiene que añadirlo con
  // el `boundary` del multipart. Si se manda `application/json` a mano, Django
  // no logra a parsear la petición.
  const cabeceras = {
    ...(resto.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(headers || {}),
  }

  let respuesta
  try {
    respuesta = await fetch(`${API_URL}${ruta}`, {
      credentials: 'include',
      headers: cabeceras,
      ...resto,
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
  post: (ruta, datos, opciones = {}) =>
    peticion(ruta, { ...opciones, method: 'POST', body: datos }),
  put: (ruta, datos, opciones = {}) => peticion(ruta, { ...opciones, method: 'PUT', body: datos }),
  patch: (ruta, datos, opciones = {}) =>
    peticion(ruta, { ...opciones, method: 'PATCH', body: datos }),
}
