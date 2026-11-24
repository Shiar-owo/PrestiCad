import { useEffect } from 'react'

function useTituloPagina(titulo) {
  useEffect(() => {
    document.title = titulo ? `PrestiCad · ${titulo}` : 'PrestiCad'
  }, [titulo])
}

export default useTituloPagina