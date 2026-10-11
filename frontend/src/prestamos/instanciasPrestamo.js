export function crearOpcionesInstancia(instancias, cargando = false) {
  return [
    {
      valor: '',
      etiqueta: cargando ? 'Cargando instancias…' : 'Selecciona una instancia',
    },
    ...instancias.map((instancia) => {
      const detalles = [
        instancia.numero_serie && `Serie: ${instancia.numero_serie}`,
        instancia.estado_fisico && `Estado físico: ${instancia.estado_fisico}`,
      ].filter(Boolean)

      return {
        valor: String(instancia.id),
        etiqueta: [instancia.codigo_ejemplar, ...detalles].join(' · '),
      }
    }),
  ]
}
