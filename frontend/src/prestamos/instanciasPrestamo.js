export function obtenerInstanciaSeleccionada(instancias, instanciaId) {
  if (
    !Array.isArray(instancias)
    || instanciaId === ''
    || instanciaId === null
    || instanciaId === undefined
  ) {
    return null
  }

  return instancias.find((instancia) => String(instancia.id) === String(instanciaId)) || null
}

export function crearOpcionesInstancia(instancias, cargando = false) {
  return [
    {
      valor: '',
      etiqueta: cargando ? 'Cargando instancias…' : 'Selecciona una instancia',
    },
    ...instancias.map((instancia) => {
      const detalles = [
        instancia.numero_serie && `Serie: ${instancia.numero_serie}`,
        instancia.condicion_fisica && `Condición física: ${instancia.condicion_fisica}`,
      ].filter(Boolean)

      return {
        valor: String(instancia.id),
        etiqueta: [instancia.codigo_ejemplar, ...detalles].join(' · '),
      }
    }),
  ]
}
