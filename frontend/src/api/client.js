const API_URL = '/api'

async function peticion(ruta, opciones = {}) {
  const respuesta = await fetch(`${API_URL}${ruta}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(opciones.headers || {}),
    },
    ...opciones,
  })

  if (!respuesta.ok) {
    throw new Error('La petición falló')
  }

  return respuesta.json()
}

export const api = {
  get: (ruta) => peticion(ruta),
  post: (ruta, datos) =>
    peticion(ruta, { method: 'POST', body: JSON.stringify(datos) }),
}