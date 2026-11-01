import { useEffect, useState } from 'react'

import { api } from '../api/client'
import useTituloPagina from '../hooks/useTituloPagina'
import {
  ETIQUETAS_ESTADO,
  ETIQUETAS_TIER,
  ETIQUETAS_TIPO,
} from '../constantes/catalogo'
import MaterialForm from '../components/MaterialForm'
import FichaTecnicaModal from '../components/FichaTecnicaModal'
import ConfirmacionDobleEliminacion from '../components/ConfirmacionDobleEliminacion'
import Boton from '../components/ui/Boton'
import Tarjeta from '../components/ui/Tarjeta'
import Skeleton from '../components/ui/Skeleton'
import ErrorAlerta from '../components/ui/ErrorAlerta'
import EstadoVacio from '../components/ui/EstadoVacio'
import { obtenerCodigoInstancia } from '../inventario/eliminacionMaterial'

const ETIQUETAS_MODO_REGISTRO = {
  unico: 'Único',
  lote: 'Lote idéntico',
  detalle: 'Por detalle',
}

function DatoResumen({ etiqueta, valor }) {
  let valorVisible = valor
  if (typeof valor === 'boolean') valorVisible = valor ? 'Sí' : 'No'
  else if (valor === null || valor === undefined || valor === '') valorVisible = '—'

  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-texto-suave">{etiqueta}</dt>
      <dd className="mt-1 break-words text-sm text-texto">{valorVisible}</dd>
    </div>
  )
}

function Materiales() {
  useTituloPagina('Inventario')
  const [materiales, setMateriales] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [materialEnEdicion, setMaterialEnEdicion] = useState(null)
  const [resumenRegistro, setResumenRegistro] = useState(null)
  const [materialFicha, setMaterialFicha] = useState(null)
  const [registroAEliminar, setRegistroAEliminar] = useState(null)

  useEffect(() => {
    cargarMateriales()
  }, [])

  async function cargarMateriales() {
    setCargando(true)
    setError('')
    try {
      const datos = await api.get('/materiales/')
      setMateriales(Array.isArray(datos) ? datos : [])
    } catch {
      setError('No se pudo cargar la lista de materiales.')
    } finally {
      setCargando(false)
    }
  }

  function abrirFormularioAlta() {
    setMaterialEnEdicion(null)
    setResumenRegistro(null)
    setMostrarFormulario(true)
  }

  function abrirFormularioEdicion(material) {
    setMaterialEnEdicion(material)
    setResumenRegistro(null)
    setMostrarFormulario(true)
  }

  function cerrarFormulario() {
    setMostrarFormulario(false)
    setMaterialEnEdicion(null)
  }

  async function manejarGuardado(resultadoRegistro) {
    setResumenRegistro(resultadoRegistro || null)
    setMostrarFormulario(false)
    setMaterialEnEdicion(null)
    await cargarMateriales()
  }

  async function actualizarFichaTrasAgregarInstancias() {
    try {
      const materialActualizado = await api.get(`/materiales/${materialFicha.id}/`)
      setMaterialFicha(materialActualizado)
    } catch {
      setError('Los ejemplares se agregaron, pero no se pudo actualizar la ficha.')
    }
    await cargarMateriales()
  }

  async function confirmarEliminacion() {
    if (registroAEliminar.tipo === 'material') {
      await api.delete(`/materiales/${registroAEliminar.material.id}/`)
    } else {
      await api.delete(`/instancias/${registroAEliminar.instancia.id}/`)
    }
    setRegistroAEliminar(null)
    setMaterialFicha(null)
    await cargarMateriales()
  }

  const codigoInstanciaAEliminar = registroAEliminar?.tipo === 'instancia'
    ? obtenerCodigoInstancia(registroAEliminar.instancia)
    : ''
  const materialRegistrado = resumenRegistro?.material
  const instanciasRegistradas = Array.isArray(materialRegistrado?.instancias)
    ? materialRegistrado.instancias
    : []

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

      {!mostrarFormulario && resumenRegistro && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="resumen-registro-material-titulo"
            className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-borde bg-white p-6 shadow-xl dark:bg-superficie"
          >
            <header className="border-b border-borde pb-4">
              <h3 id="resumen-registro-material-titulo" className="text-lg font-bold text-marca-700 dark:text-marca-300">
                Material registrado correctamente
              </h3>
              <p className="mt-2 text-sm text-texto">
                <strong>{materialRegistrado.nombre}</strong> · Código de Material:{' '}
                <code className="font-mono">{materialRegistrado.codigo_material || materialRegistrado.codigo_inventario}</code>
              </p>
            </header>

            <dl className="mt-4 grid gap-3 rounded-lg border border-borde bg-superficie-alta p-4 sm:grid-cols-2 lg:grid-cols-4">
              <DatoResumen
                etiqueta="Tipo"
                valor={ETIQUETAS_TIPO[materialRegistrado.tipo] || materialRegistrado.tipo}
              />
              <DatoResumen
                etiqueta="Estado"
                valor={ETIQUETAS_ESTADO[materialRegistrado.estado] || materialRegistrado.estado}
              />
              <DatoResumen
                etiqueta="Modo de registro"
                valor={ETIQUETAS_MODO_REGISTRO[resumenRegistro.modo] || resumenRegistro.modo}
              />
              <DatoResumen etiqueta="Total de instancias" valor={instanciasRegistradas.length} />
              <DatoResumen etiqueta="Marca" valor={materialRegistrado.marca} />
              <DatoResumen etiqueta="Modelo" valor={materialRegistrado.modelo} />
              <DatoResumen etiqueta="Color" valor={materialRegistrado.color} />
              <DatoResumen etiqueta="Alto valor" valor={materialRegistrado.es_alto_valor} />
            </dl>

            {materialRegistrado.descripcion && (
              <p className="mt-3 text-sm text-texto">
                <strong>Descripción:</strong> {materialRegistrado.descripcion}
              </p>
            )}

            <section className="mt-5">
              <h4 className="border-b border-borde pb-2 text-sm font-bold text-texto">
                Detalle de instancias
              </h4>
              <div className="mt-3 overflow-x-auto rounded-lg border border-borde">
                <table className="min-w-full divide-y divide-borde text-left text-xs">
                  <thead className="bg-superficie-alta uppercase tracking-wide text-texto-suave">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Código de Ejemplar</th>
                      <th className="px-3 py-2 font-semibold">N.º de serie</th>
                      <th className="px-3 py-2 font-semibold">Estado</th>
                      <th className="px-3 py-2 font-semibold">Condición física</th>
                      <th className="px-3 py-2 font-semibold">Color</th>
                      <th className="px-3 py-2 font-semibold">Ubicación</th>
                      <th className="px-3 py-2 font-semibold">Observaciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-borde">
                    {instanciasRegistradas.length > 0 ? instanciasRegistradas.map((instancia) => (
                      <tr key={instancia.id || instancia.codigo_ejemplar} className="align-top text-texto">
                        <td className="whitespace-nowrap px-3 py-2 font-mono font-semibold">
                          {instancia.codigo_ejemplar || '—'}
                        </td>
                        <td className="px-3 py-2">{instancia.numero_serie || '—'}</td>
                        <td className="px-3 py-2">{instancia.estado_display || instancia.estado || '—'}</td>
                        <td className="px-3 py-2">{instancia.condicion_fisica || '—'}</td>
                        <td className="px-3 py-2">
                          {(['unico', 'lote'].includes(resumenRegistro.modo)
                            ? materialRegistrado.color
                            : instancia.color) || '—'}
                        </td>
                        <td className="px-3 py-2">{instancia.ubicacion || '—'}</td>
                        <td className="px-3 py-2">{instancia.observaciones || '—'}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={7} className="px-3 py-4 text-center text-texto-suave">
                          No hay instancias para mostrar.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <footer className="mt-5 flex justify-end">
              <Boton tipo="button" onClick={() => setResumenRegistro(null)}>
                Cerrar
              </Boton>
            </footer>
          </section>
        </div>
      )}

      {mostrarFormulario && (
        <MaterialForm
          key={materialEnEdicion?.id || 'nuevo'}
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
                  <th className="px-4 py-3 font-semibold">Código de Material</th>
                  <th className="px-4 py-3 font-semibold">Nombre</th>
                  <th className="px-4 py-3 font-semibold">Foto</th>
                  <th className="px-4 py-3 font-semibold">Tipo</th>
                  <th className="px-4 py-3 font-semibold">Stock</th>
                  <th className="px-4 py-3 font-semibold">Disponibles</th>
                  <th className="px-4 py-3 font-semibold">Tier mínimo</th>
                  <th className="px-4 py-3 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {materiales.map((material) => (
                  <tr key={material.id} className="text-texto">
                    <td className="px-4 py-3 font-mono text-xs">{material.codigo_material || material.codigo_inventario}</td>
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
                      <div className="flex items-center gap-2">
                        <Boton
                          variante="fantasma"
                          tamanio="pequeno"
                          tipo="button"
                          onClick={() => setMaterialFicha(material)}
                        >
                          Ficha
                        </Boton>
                        <Boton
                          variante="secundario"
                          tamanio="pequeno"
                          tipo="button"
                          onClick={() => abrirFormularioEdicion(material)}
                        >
                          Editar
                        </Boton>
                        <Boton
                          variante="peligro"
                          tamanio="pequeno"
                          tipo="button"
                          onClick={() => setRegistroAEliminar({ tipo: 'material', material })}
                        >
                          Eliminar
                        </Boton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Tarjeta>
      )}

      {materialFicha && (
        <FichaTecnicaModal
          material={materialFicha}
          onCerrar={() => setMaterialFicha(null)}
          onEliminarInstancia={(instancia) => setRegistroAEliminar({
            tipo: 'instancia',
            material: materialFicha,
            instancia,
          })}
          onAgregarInstancias={actualizarFichaTrasAgregarInstancias}
        />
      )}

      {registroAEliminar && (
        <ConfirmacionDobleEliminacion
          titulo={registroAEliminar.tipo === 'material'
            ? `Eliminar material ${registroAEliminar.material.nombre}`
            : `Eliminar ejemplar ${codigoInstanciaAEliminar}`}
          descripcion={registroAEliminar.tipo === 'material'
            ? `Se eliminarán el material ${registroAEliminar.material.codigo_material || registroAEliminar.material.codigo_inventario}, sus ${registroAEliminar.material.instancias?.length || registroAEliminar.material.stock} ejemplares y sus fotos.`
            : `Se eliminará el ejemplar ${codigoInstanciaAEliminar} del material ${registroAEliminar.material.nombre}.`}
          codigoConfirmacion={registroAEliminar.tipo === 'material'
            ? registroAEliminar.material.codigo_material || registroAEliminar.material.codigo_inventario
            : codigoInstanciaAEliminar}
          onConfirmar={confirmarEliminacion}
          onCancelar={() => setRegistroAEliminar(null)}
        />
      )}
    </section>
  )
}

export default Materiales
