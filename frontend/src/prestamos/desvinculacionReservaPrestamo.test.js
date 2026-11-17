import { describe, expect, it } from 'vitest'
import { construirSolicitudPrestamo } from './solicitudPrestamo'

/**
 * Función auxiliar para evaluar la lógica de detección de campos opcionales eliminados
 * (vaciados manualmente o quitados) que requieren doble verificación en PerfilUsuario.
 */
export function detectarCamposContactoAEliminar(perfilOriginal, datosNuevos) {
  const camposBorrados = []

  const emailSecLimpio = (datosNuevos.email_secundario || '').trim()
  const tel2Limpio = (datosNuevos.telefono_secundario || '').trim()
  const tel3Limpio = (datosNuevos.telefono_terciario || '').trim()

  if (Boolean(perfilOriginal.email_secundario?.trim()) && !emailSecLimpio) {
    camposBorrados.push({
      id: 'email_secundario',
      etiqueta: 'Correo de recuperación',
      valorAnterior: perfilOriginal.email_secundario.trim(),
    })
  }
  if (Boolean(perfilOriginal.telefono_secundario?.trim()) && !tel2Limpio) {
    camposBorrados.push({
      id: 'telefono_secundario',
      etiqueta: 'Celular alternativo',
      valorAnterior: perfilOriginal.telefono_secundario.trim(),
    })
  }
  if (Boolean(perfilOriginal.telefono_terciario?.trim()) && !tel3Limpio) {
    camposBorrados.push({
      id: 'telefono_terciario',
      etiqueta: 'Celular de respaldo',
      valorAnterior: perfilOriginal.telefono_terciario.trim(),
    })
  }

  return camposBorrados
}

describe('Construcción de solicitud de préstamo y desacoplamiento de reservas', () => {
  const materialPrueba = {
    id: 10,
    nombre: 'Osciloscopio Digital',
    codigo_material: 'MAT-OSC-01',
    precio_estimado: 500,
  }

  it('no incluye reserva_id en la solicitud si se realiza un préstamo independiente sin reserva', () => {
    const solicitud = construirSolicitudPrestamo({
      dni: '12345678',
      material: materialPrueba,
      instanciaId: '25',
      reservaId: '',
      minutos: 120,
      checklist: [{ elemento: 'Sondas', observacion: 'Completas', foto: null }],
    })

    expect(solicitud.get('reserva_id')).toBeNull()
    expect(solicitud.get('dni_prestatario')).toBe('12345678')
    expect(solicitud.get('material_id')).toBe('10')
    expect(solicitud.get('instancia_id')).toBe('25')
  })

  it('incluye reserva_id en la solicitud cuando el gestor convierte formalmente una reserva', () => {
    const solicitud = construirSolicitudPrestamo({
      dni: '12345678',
      material: materialPrueba,
      instanciaId: '25',
      reservaId: '99',
      minutos: 180,
      checklist: [{ elemento: 'Pantalla', observacion: 'Sin rayones', foto: null }],
    })

    expect(solicitud.get('reserva_id')).toBe('99')
  })
})

describe('Doble verificación en eliminación de datos opcionales de contacto (PerfilUsuario)', () => {
  it('detecta eliminación cuando un correo de recuperación existente se deja en blanco', () => {
    const perfilOriginal = {
      email_secundario: 'recupera@dominio.com',
      telefono_secundario: '987654321',
      telefono_terciario: '',
    }
    const datosNuevos = {
      email_secundario: '',
      telefono_secundario: '987654321',
      telefono_terciario: '',
    }

    const borrados = detectarCamposContactoAEliminar(perfilOriginal, datosNuevos)
    expect(borrados).toHaveLength(1)
    expect(borrados[0].id).toBe('email_secundario')
    expect(borrados[0].valorAnterior).toBe('recupera@dominio.com')
  })

  it('detecta eliminación cuando un celular alternativo o de respaldo se vacía', () => {
    const perfilOriginal = {
      email_secundario: '',
      telefono_secundario: '987654321',
      telefono_terciario: '912345678',
    }
    const datosNuevos = {
      email_secundario: '',
      telefono_secundario: ' ',
      telefono_terciario: '',
    }

    const borrados = detectarCamposContactoAEliminar(perfilOriginal, datosNuevos)
    expect(borrados).toHaveLength(2)
    expect(borrados.map((b) => b.id)).toEqual(['telefono_secundario', 'telefono_terciario'])
  })

  it('no activa eliminación si el campo estaba vacío desde antes o si se actualiza con un nuevo valor', () => {
    const perfilOriginal = {
      email_secundario: '',
      telefono_secundario: '',
      telefono_terciario: '',
    }
    const datosNuevos = {
      email_secundario: 'nuevo@correo.com',
      telefono_secundario: '',
      telefono_terciario: '',
    }

    const borrados = detectarCamposContactoAEliminar(perfilOriginal, datosNuevos)
    expect(borrados).toHaveLength(0)
  })

  it('no activa eliminación si se modifica un correo existente por otro correo', () => {
    const perfilOriginal = {
      email_secundario: 'anterior@correo.com',
      telefono_secundario: '987654321',
    }
    const datosNuevos = {
      email_secundario: 'nuevo@correo.com',
      telefono_secundario: '911223344',
    }

    const borrados = detectarCamposContactoAEliminar(perfilOriginal, datosNuevos)
    expect(borrados).toHaveLength(0)
  })
})
