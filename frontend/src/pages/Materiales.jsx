import { useEffect, useState } from 'react'

import { api, ErrorApi } from '../api/client'
import MaterialForm from '../components/MaterialForm'

// Debe reflejar backend/apps/inventario/constants.py
const ETIQUETAS_TIPO = {
  equipo: 'Equipo',
  libro: 'Libro',
  objeto: 'Objeto',
}

const ETIQUETAS_ESTADO = {
  disponible: 'Disponible',
  en_mantenimiento: 'En Mantenimiento',
  reservado: 'Reservado',
  prestado: 'Prestado',
}

// Debe reflejar apps/usuarios/constants.py (TIERS)
const ETIQUETAS_TIER = {
  avanzado: 'Avanzado',
  estandar: 'Estándar',
  restringido: 'Restringido',
}

const OPCIONES_ESTADO = Object.keys(ETIQUETAS_ESTADO).map((valor) => ({
  valor,
  etiqueta: ETIQUETAS_ESTADO[valor],
}))

function Materiales() {
  const [materiales, setMateriales] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [materialEnEdicion, setMaterialEnEdicion] = useState(null)
  const [cambiandoEstado, setCambiandoEstado] = useState(null)

  useEffect(() => {
    cargarMateriales()
  }, [])

  async function cargarMateriales() {
    setCargando(true)
    setError('')
    try {
      const datos = await api.get('/materiales/')
      setMateriales(datos)
    } catch {
      setError('No se pudo cargar la lista de materiales.')
    } finally {
      setCargando(false)
    }
  }

  function abrirFormularioAlta() {
    setMaterialEnEdicion(null)
    setMostrarFormulario(true)
  }

  function abrirFormularioEdicion(material) {
    setMaterialEnEdicion(material)
    setMostrarFormulario(true)
  }

  function cerrarFormulario() {
    setMostrarFormulario(false)
    setMaterialEnEdicion(null)
  }

  async function manejarGuardado() {
    setMostrarFormulario(false)
    setMaterialEnEdicion(null)
    await cargarMateriales()
  }

  // El cambio de estado viaja como un PATCH con un solo campo (HU04 criterio 8).
  // La actualización es optimista: si el backend la rechaza, se revierte.
  async function cambiarEstado(material, nuevoEstado) {
    if (nuevoEstado === material.estado) {
      return
    }

    setError('')
    setMateriales((actuales) =>
      actuales.map((m) => (m.id === material.id ? { ...m, estado: nuevoEstado } : m)),
    )
    setCambiandoEstado(material.id)

    try {
      await api.patch(`/materiales/${material.id}/`, { estado: nuevoEstado })
    } catch (errorApi) {
      setMateriales((actuales) =>
        actuales.map((m) => (m.id === material.id ? { ...m, estado: material.estado } : m)),
      )
      if (errorApi instanceof ErrorApi && errorApi.status === 403) {
        setError('No tienes permiso para cambiar el estado de los materiales.')
      } else {
        setError('No se pudo cambiar el estado del material.')
      }
    } finally {
      setCambiandoEstado(null)
    }
  }

  return (
    <section className="materiales">
      <div className="materiales__cabecera">
        <h3>Inventario de materiales</h3>
        {!mostrarFormulario && (
          <button type="button" onClick={abrirFormularioAlta}>
            Registrar material
          </button>
        )}
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      {cargando && <p>Cargando materiales...</p>}

      {mostrarFormulario && (
        <MaterialForm
          material={materialEnEdicion}
          onGuardado={manejarGuardado}
          onCancelar={cerrarFormulario}
        />
      )}

      {!cargando && !mostrarFormulario && materiales.length === 0 && (
        <p>Todavía no hay materiales registrados.</p>
      )}

      {!cargando && materiales.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Nombre</th>
              <th>Tipo</th>
              <th>Stock</th>
              <th>Unidades disponibles</th>
              <th>Tier mínimo</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {materiales.map((material) => (
              <tr key={material.id}>
                <td>{material.codigo_inventario}</td>
                <td>{material.nombre}</td>
                <td>{ETIQUETAS_TIPO[material.tipo] || material.tipo}</td>
                <td>{material.stock}</td>
                <td>{material.unidades_disponibles}</td>
                <td>
                  {ETIQUETAS_TIER[material.tier_minimo_requerido] ||
                    material.tier_minimo_requerido}
                </td>
                <td>
                  <select
                    value={material.estado}
                    disabled={cambiandoEstado === material.id}
                    onChange={(e) => cambiarEstado(material, e.target.value)}
                  >
                    {OPCIONES_ESTADO.map((opcion) => (
                      <option key={opcion.valor} value={opcion.valor}>
                        {opcion.etiqueta}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <button
                    type="button"
                    className="boton-secundario"
                    onClick={() => abrirFormularioEdicion(material)}
                  >
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

export default Materiales
