import { useEffect, useState } from 'react'

import { api, ErrorApi } from '../api/client'
import MaterialForm from '../components/MaterialForm'
import Boton from '../components/ui/Boton'
import Tarjeta from '../components/ui/Tarjeta'
import Skeleton from '../components/ui/Skeleton'
import ErrorAlerta from '../components/ui/ErrorAlerta'
import EstadoVacio from '../components/ui/EstadoVacio'

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
    <section>
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-texto">Inventario de materiales</h2>
          <p className="mt-1 text-sm text-texto-suave">
            Alta, edición y cambio de estado de los materiales del catálogo.
          </p>
        </div>
        {!mostrarFormulario && (
          <Boton tipo="button" onClick={abrirFormularioAlta}>
            Registrar material
          </Boton>
        )}
      </header>

      {error && <ErrorAlerta mensaje={error} className="mb-4" />}

      {mostrarFormulario && (
        <MaterialForm
          material={materialEnEdicion}
          onGuardado={manejarGuardado}
          onCancelar={cerrarFormulario}
        />
      )}

      {!mostrarFormulario && cargando && (
        <div className="space-y-3" role="status" aria-live="polite">
          {Array.from({ length: 5 }).map((_, indice) => (
            <Skeleton key={indice} className="h-12 rounded-lg" />
          ))}
        </div>
      )}

      {!cargando && !mostrarFormulario && materiales.length === 0 && (
        <EstadoVacio titulo="Aún no hay materiales registrados" mensaje="Registra el primer material del inventario." />
      )}

      {!cargando && !mostrarFormulario && materiales.length > 0 && (
        <Tarjeta className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-borde text-left text-xs uppercase tracking-wide text-texto-suave">
                  <th className="px-4 py-3 font-semibold">Código</th>
                  <th className="px-4 py-3 font-semibold">Nombre</th>
                  <th className="px-4 py-3 font-semibold">Foto</th>
                  <th className="px-4 py-3 font-semibold">Tipo</th>
                  <th className="px-4 py-3 font-semibold">Stock</th>
                  <th className="px-4 py-3 font-semibold">Disponibles</th>
                  <th className="px-4 py-3 font-semibold">Tier mínimo</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {materiales.map((material) => (
                  <tr key={material.id} className="text-texto">
                    <td className="px-4 py-3 font-mono text-xs">{material.codigo_inventario}</td>
                    <td className="px-4 py-3 font-semibold">{material.nombre}</td>
                    <td className="px-4 py-3">
                      {material.foto ? (
                        <img
                          className="flex size-10 items-center justify-center overflow-hidden rounded-lg border border-borde object-cover"
                          src={material.foto}
                          alt={`Foto de ${material.nombre}`}
                          width="40"
                          height="40"
                          loading="lazy"
                        />
                      ) : (
                        <span
                          className="flex size-10 items-center justify-center rounded-lg border border-borde bg-superficie-alta text-sm text-texto-suave"
                          role="img"
                          aria-label={`${material.nombre} no tiene foto`}
                        >
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">{ETIQUETAS_TIPO[material.tipo] || material.tipo}</td>
                    <td className="px-4 py-3">{material.stock}</td>
                    <td className="px-4 py-3">{material.unidades_disponibles}</td>
                    <td className="px-4 py-3">
                      {ETIQUETAS_TIER[material.tier_minimo_requerido] || material.tier_minimo_requerido}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={material.estado}
                        disabled={cambiandoEstado === material.id}
                        onChange={(e) => cambiarEstado(material, e.target.value)}
                        className="rounded-lg border border-borde bg-white px-2 py-1.5 text-sm text-texto dark:bg-superficie"
                      >
                        {OPCIONES_ESTADO.map((opcion) => (
                          <option
                            key={opcion.valor}
                            value={opcion.valor}
                            className="bg-white text-texto dark:bg-superficie"
                          >
                            {opcion.etiqueta}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <Boton
                        variante="secundario"
                        tamanio="pequeno"
                        tipo="button"
                        onClick={() => abrirFormularioEdicion(material)}
                      >
                        Editar
                      </Boton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Tarjeta>
      )}
    </section>
  )
}

export default Materiales