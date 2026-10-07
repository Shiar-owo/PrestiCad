import { useEffect, useState } from 'react'

const CLAVE_LOCAL = 'presticad-tema'

function preferenciaUsada() {
  if (typeof window === 'undefined') {
    return 'claro'
  }
  const guardada = window.localStorage.getItem(CLAVE_LOCAL)
  if (guardada === 'claro' || guardada === 'oscuro') {
    return guardada
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro'
}

function useTema() {
  const [tema, setTema] = useState(preferenciaUsada)

  useEffect(() => {
    const esOscuro = tema === 'oscuro'
    document.documentElement.classList.toggle('dark', esOscuro)
    window.localStorage.setItem(CLAVE_LOCAL, tema)

    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) {
      meta.setAttribute('content', esOscuro ? '#0b1f33' : '#ffffff')
    }
  }, [tema])

  function alternarTema() {
    setTema((actual) => (actual === 'oscuro' ? 'claro' : 'oscuro'))
  }

  return { tema, alternarTema }
}

export default useTema