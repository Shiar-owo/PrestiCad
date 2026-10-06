import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api, ErrorApi } from './client'

// El cliente habla siempre con rutas relativas: el dev server de Vite hace de
// proxy hacia el backend. Solo importa cómo arma la petición.
function responderCon(cuerpo, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => cuerpo,
  }
}

function ultimaPeticion() {
  return globalThis.fetch.mock.calls.at(-1)
}

function cuerpoDeLaPeticion() {
  return ultimaPeticion()[1].body
}

function cabecerasDeLaPeticion() {
  return ultimaPeticion()[1].headers
}

describe('api', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn(async () => responderCon({}))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('objetos planos', () => {
    it('los serializa a JSON', async () => {
      await api.post('/auth/login/', { email: 'a@b.com', password: 'secreta' })

      expect(cuerpoDeLaPeticion()).toBe('{"email":"a@b.com","password":"secreta"}')
    })

    // Regresión: se pasó el objeto crudo a `fetch` y llegó al backend como
    // "[object Object]", que la DRF rechazaba con "JSON parse error".
    it('nunca deja un objeto plano como body', async () => {
      await api.post('/auth/login/', { email: 'a@b.com' })

      expect(typeof cuerpoDeLaPeticion()).toBe('string')
    })

    it('serializa igual en put y en patch', async () => {
      await api.put('/usuarios/7/', { rol: 'gestor' })
      expect(cuerpoDeLaPeticion()).toBe('{"rol":"gestor"}')

      await api.patch('/materiales/3/', { estado: 'disponible' })
      expect(cuerpoDeLaPeticion()).toBe('{"estado":"disponible"}')
    })

    it('mantiene Content-Type: application/json', async () => {
      await api.post('/auth/login/', { email: 'a@b.com' })

      expect(cabecerasDeLaPeticion()).toEqual({ 'Content-Type': 'application/json' })
    })

    it('deja las cabeceras que le pasan por opciones', async () => {
      await api.post('/algo/', { a: 1 }, { headers: { 'X-Algo': '1' } })

      expect(cabecerasDeLaPeticion()).toEqual({
        'Content-Type': 'application/json',
        'X-Algo': '1',
      })
    })

    it('envía las cookies de sesión', async () => {
      await api.post('/auth/login/', { email: 'a@b.com' })

      expect(ultimaPeticion()[1].credentials).toBe('include')
    })
  })

  describe('FormData', () => {
    it('lo pasa crudo, sin convertirlo a texto', async () => {
      const formulario = new FormData()
      formulario.append('nombre', 'Cálculo integral')

      await api.post('/materiales/', formulario)

      expect(cuerpoDeLaPeticion()).toBe(formulario)
    })

    // Si se fijara a mano, el `boundary` del multipart no viajaría y Django no
    // lograría parsear la subida.
    it('omite Content-Type para que el navegador ponga el boundary', async () => {
      const formulario = new FormData()
      formulario.append('foto', new Blob(['x'], { type: 'image/png' }), 'foto.png')

      await api.post('/materiales/', formulario)

      expect(cabecerasDeLaPeticion()).not.toHaveProperty('Content-Type')
    })

    it('sigue funcionando en put', async () => {
      const formulario = new FormData()
      formulario.append('foto', new Blob(['x'], { type: 'image/png' }), 'foto.png')

      await api.put('/materiales/3/', formulario)

      expect(cuerpoDeLaPeticion()).toBe(formulario)
      expect(cabecerasDeLaPeticion()).not.toHaveProperty('Content-Type')
    })
  })

  describe('respuestas', () => {
    it('devuelve el cuerpo parseado', async () => {
      globalThis.fetch = vi.fn(async () =>
        responderCon({ mensaje: 'ok', usuario: { id: 1 } }),
      )

      await expect(api.get('/materiales/')).resolves.toEqual({
        mensaje: 'ok',
        usuario: { id: 1 },
      })
    })

    it('lanza ErrorApi con el estado y el cuerpo en un error', async () => {
      globalThis.fetch = vi.fn(async () =>
        responderCon({ detail: 'Inicia sesión para gestionar el inventario.' }, { ok: false, status: 403 }),
      )

      await expect(api.post('/materiales/', { a: 1 })).rejects.toThrowError(ErrorApi)
      await expect(api.post('/materiales/', { a: 1 })).rejects.toMatchObject({
        status: 403,
        datos: { detail: 'Inicia sesión para gestionar el inventario.' },
      })
    })

    it('lanza ErrorApi sin datos si la respuesta no es JSON', async () => {
      globalThis.fetch = vi.fn(async () => ({
        ok: false,
        status: 500,
        json: async () => {
          throw new SyntaxError('Unexpected token <')
        },
      }))

      await expect(api.get('/materiales/')).rejects.toMatchObject({ status: 500, datos: null })
    })

    it('lanza ErrorApi con estado 0 cuando no hay red', async () => {
      globalThis.fetch = vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      })

      await expect(api.get('/materiales/')).rejects.toMatchObject({ status: 0, datos: null })
    })
  })

  describe('peticiones sin cuerpo', () => {
    // El logout se llama sin datos: el body tiene que quedar en undefined y no
    // en la cadena "undefined".
    it('no manda body si no se pasa nada', async () => {
      await api.post('/auth/logout/')

      expect(cuerpoDeLaPeticion()).toBeUndefined()
    })
  })

  // La vista de perfil (HU16) es el único endpoint con `csrf_protect`, así que
  // el `put` tiene que mandar el token. En entorno de pruebas no hay `document`
  // y `obtenerTokenCSRF` devuelve null, con lo cual esa rama nunca se probaba.
  describe('token CSRF en el put', () => {
    function conCookieCsrf(valor) {
      globalThis.document = { cookie: `sessionid=abc; csrftoken=${valor}` }
    }

    afterEach(() => {
      delete globalThis.document
    })

    it('manda el token que encuentra en la cookie', async () => {
      conCookieCsrf('token123')

      await api.put('/usuarios/perfil/', { nombre: 'Ana' })

      expect(cabecerasDeLaPeticion()).toMatchObject({ 'X-CSRFToken': 'token123' })
    })

    it('con FormData manda el token y sigue sin poner Content-Type', async () => {
      conCookieCsrf('token123')

      const formulario = new FormData()
      formulario.append('foto', new Blob(['x'], { type: 'image/png' }), 'foto.png')

      await api.put('/materiales/3/', formulario)

      expect(cabecerasDeLaPeticion()).toEqual({ 'X-CSRFToken': 'token123' })
      expect(cuerpoDeLaPeticion()).toBe(formulario)
    })

    it('no manda el header si no hay cookie csrftoken', async () => {
      globalThis.document = { cookie: 'sessionid=abc' }

      await api.put('/usuarios/perfil/', { nombre: 'Ana' })

      expect(cabecerasDeLaPeticion()).not.toHaveProperty('X-CSRFToken')
      expect(cabecerasDeLaPeticion()).toEqual({ 'Content-Type': 'application/json' })
    })
  })

  describe('búsqueda de materiales', () => {
    it('construye la petición GET al endpoint con los filtros en query params', async () => {
      await api.get('/materiales/buscar/?q=laptop&categoria=equipo&estado=disponible')

      expect(ultimaPeticion()[0]).toBe('/api/materiales/buscar/?q=laptop&categoria=equipo&estado=disponible')
      expect(ultimaPeticion()[1].credentials).toBe('include')
    })
  })
})

