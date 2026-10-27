import React from 'react'
import Boton from './ui/Boton'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { tieneError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { tieneError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error no controlado capturado por ErrorBoundary:', error, errorInfo)
  }

  render() {
    if (this.state.tieneError) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
          <div className="max-w-md rounded-2xl border border-borde bg-superficie p-8 shadow-sm">
            <h2 className="text-xl font-bold text-texto">Algo salió mal</h2>
            <p className="mt-2 text-sm text-texto-suave">
              Ocurrió un error inesperado al procesar la vista. Puedes intentar recargar la página o volver al catálogo.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Boton
                variante="primario"
                onClick={() => window.location.reload()}
              >
                Recargar página
              </Boton>
              <Boton
                variante="secundario"
                onClick={() => {
                  this.setState({ tieneError: false, error: null })
                  window.location.href = '/catalogo'
                }}
              >
                Ir al catálogo
              </Boton>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
