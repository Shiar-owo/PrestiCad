import { describe, expect, it } from 'vitest'

import {
  TAMANO_MAXIMO_SOLICITUD_BYTES,
  calcularTamanoArchivos,
  validarTamanoSolicitud,
} from './tamanoSolicitud'

describe('tamanoSolicitud', () => {
  it('suma solo los archivos del formulario', () => {
    const formulario = new FormData()
    formulario.append('nombre', 'préstamo')
    formulario.append('documento', new File(['%PDF-'], 'dni.pdf', { type: 'application/pdf' }))
    formulario.append('foto', new File(['imagen'], 'foto.jpg', { type: 'image/jpeg' }))

    expect(calcularTamanoArchivos(formulario)).toBe(5 + 6)
  })

  it('acepta una solicitud cuyo total no supera el límite', () => {
    const formulario = new FormData()
    formulario.append('archivo', new File([new Uint8Array(1024)], 'archivo.pdf'))

    expect(validarTamanoSolicitud(formulario)).toBe('')
  })

  it('rechaza una solicitud cuyo total supera el límite', () => {
    const formulario = new FormData()
    formulario.append(
      'archivo',
      new File([new Uint8Array(TAMANO_MAXIMO_SOLICITUD_BYTES + 1)], 'archivo.pdf'),
    )

    expect(validarTamanoSolicitud(formulario)).toBe(
      'El total de archivos no debe superar 4 MB. Reduce el tamaño o la cantidad de archivos.',
    )
  })
})
