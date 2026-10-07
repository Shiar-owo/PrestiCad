const API_URL = '/api'

export class ErrorApi extends Error {
  constructor(status, datos) {
    super(`La petición falló (estado: ${status || 'sin conexión'})`)
    this.name = 'ErrorApi'
    this.status = status
    this.datos = datos
  }
}

function esFormulario(datos) {
  return typeof FormData !== 'undefined' && datos instanceof FormData
}

function construirBody(datos) {
  return esFormulario(datos) ? datos : JSON.stringify(datos)
}

function obtenerTokenCSRF() {
  if (typeof document === 'undefined') return null
  const cookie = document.cookie.split('; ').find((item) => item.startsWith('csrftoken='))
  return cookie ? decodeURIComponent(cookie.slice('csrftoken='.length)) : null
}

async function peticion(ruta, opciones = {}) {
  const { headers = {}, ...resto } = opciones
  const metodo = (resto.method || 'GET').toUpperCase()
  const tokenCSRF = obtenerTokenCSRF()
  const cabeceras = {
    ...(esFormulario(resto.body) ? {} : { 'Content-Type': 'application/json' }),
    ...headers,
    ...(!['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(metodo) && tokenCSRF
      ? { 'X-CSRFToken': tokenCSRF }
      : {}),
  }

  let respuesta
  try {
    respuesta = await fetch(`${API_URL}${ruta}`, {
      ...resto,
      credentials: 'include',
      headers: cabeceras,
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
  post: (ruta, datos, opciones = {}) => peticion(ruta, {
    ...opciones,
    method: 'POST',
    body: construirBody(datos),
  }),
  put: (ruta, datos, opciones = {}) => peticion(ruta, {
    ...opciones,
    method: 'PUT',
    body: construirBody(datos),
  }),
  patch: (ruta, datos, opciones = {}) => peticion(ruta, {
    ...opciones,
    method: 'PATCH',
    body: construirBody(datos),
  }),
}
