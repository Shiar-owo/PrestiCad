import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { CalendarDays, FileText, History, Pencil, Search, Trash2 } from 'lucide-react'

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
import CalendarioDisponibilidad from '../components/reservas/CalendarioDisponibilidad'
import ExitoModal from '../components/ui/ExitoModal'
import Boton from '../components/ui/Boton'
import Tarjeta from '../components/ui/Tarjeta'
import Skeleton from '../components/ui/Skeleton'
import ErrorAlerta from '../components/ui/ErrorAlerta'
import EstadoVacio from '../components/ui/EstadoVacio'
import ControlesPaginacion from '../components/ui/ControlesPaginacion'
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
  const navigate = useNavigate()
  const [materiales, setMateriales] = useState([])
  const [totalMateriales, setTotalMateriales] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [materialEnEdicion, setMaterialEnEdicion] = useState(null)
  const [resumenRegistro, setResumenRegistro] = useState(null)
  const [materialFicha, setMaterialFicha] = useState(null)
  const [materialCalendario, setMaterialCalendario] = useState(null)
  const [registroAEliminar, setRegistroAEliminar] = useState(null)
  const [mensajePopupExito, setMensajePopupExito] = useState('')
  const [busquedaNombre, setBusquedaNombre] = useState('')
  const solicitudRef = useRef(0)

  useEffect(() => {
    const temporizador = setTimeout(() => cargarMateriales(pagina, busquedaNombre), busquedaNombre ? 300 : 0)
    return () => clearTimeout(temporizador)
  }, [pagina, busquedaNombre])

  async function cargarMateriales(paginaSolicitada = pagina, q = busquedaNombre) {
    const idSolicitud = ++solicitudRef.current
    setCargando(true)
    setError('')
    try {
      const params = new URLSearchParams({ page: String(paginaSolicitada), page_size: '25' })
      if (q.trim()) params.set('q', q.trim())
      const datos = await api.get(`/materiales/gestion/?${params}`)
      if (idSolicitud !== solicitudRef.current) return
      setMateriales(Array.isArray(datos.results) ? datos.results : [])
      setTotalMateriales(Number(datos.count) || 0)
    } catch {
      if (idSolicitud !== solicitudRef.current) return
      setError('No se pudo cargar la lista de materiales.')
    } finally {
      if (idSolicitud === solicitudRef.current) setCargando(false)
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
    if (!resultadoRegistro) setMensajePopupExito('Los cambios del material se guardaron correctamente.')
    setMostrarFormulario(false)
    setMaterialEnEdicion(null)
    if (pagina !== 1) {
      setPagina(1)
    } else {
      await cargarMateriales(1, busquedaNombre)
    }
  }

  async function actualizarFichaTrasAgregarInstancias() {
    try {
      const materialActualizado = await api.get(`/materiales/${materialFicha.id}/`)
      setMaterialFicha(materialActualizado)
      setMensajePopupExito('Los ejemplares se actualizaron correctamente.')
    } catch {
      setError('Los ejemplares se agregaron, pero no se pudo actualizar la ficha.')
    }
    await cargarMateriales()
  }

  async function confirmarEliminacion() {
    const nombreEliminado = registroAEliminar.tipo === 'material'
      ? registroAEliminar.material.nombre
      : obtenerCodigoInstancia(registroAEliminar.instancia)
    if (registroAEliminar.tipo === 'material') {
      await api.delete(`/materiales/${registroAEliminar.material.id}/`)
    } else {
      await api.delete(`/instancias/${registroAEliminar.instancia.id}/`)
    }
    setRegistroAEliminar(null)
    setMaterialFicha(null)
    setMensajePopupExito(`${registroAEliminar.tipo === 'material' ? 'Material' : 'Ejemplar'} ${nombreEliminado} eliminado correctamente.`)
    await cargarMateriales()
  }

  const codigoInstanciaAEliminar = registroAEliminar?.tipo === 'instancia'
    ? obtenerCodigoInstancia(registroAEliminar.instancia)
    : ''
  const materialRegistrado = resumenRegistro?.material
  const instanciasRegistradas = Array.isArray(materialRegistrado?.instancias)
    ? materialRegistrado.instancias
    : []
  const materialesFiltrados = materiales

  return (
    <section>
      <ExitoModal
        titulo="Acción completada"
        mensaje={mensajePopupExito}
        onCerrar={() => setMensajePopupExito('')}
      />
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
              <DatoResumen etiqueta="Total de ejemplares" valor={instanciasRegistradas.length} />
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
                Detalle de ejemplares
              </h4>
              <div className="mt-3 overflow-x-auto rounded-lg border border-borde">
                <table className="min-w-full divide-y divide-borde text-left text-xs">
                  <thead className="bg-superficie-alta uppercase tracking-wide text-texto-suave">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Código de Ejemplar</th>
                      <th className="px-3 py-2 font-semibold">N.º de serie</th>
                      <th className="px-3 py-2 font-semibold">Estado</th>
                      <th className="px-3 py-2 font-semibold">Observaciones</th>
                      <th className="px-3 py-2 font-semibold">Color</th>
                      <th className="px-3 py-2 font-semibold">Ubicación</th>
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
                        <td className="px-3 py-2">{instancia.observaciones || '—'}</td>
                        <td className="px-3 py-2">
                          {(['unico', 'lote'].includes(resumenRegistro.modo)
                            ? materialRegistrado.color
                            : instancia.color) || '—'}
                        </td>
                        <td className="px-3 py-2">{instancia.ubicacion || '—'}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={7} className="px-3 py-4 text-center text-texto-suave">
                          No hay ejemplares para mostrar.
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

      {!mostrarFormulario && (
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <label htmlFor="buscar-material-inventario" className="sr-only">
            Buscar material por nombre
          </label>
          <div className="relative w-full sm:max-w-sm">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-texto-suave" />
            <input
              id="buscar-material-inventario"
              type="search"
              value={busquedaNombre}
              onChange={(evento) => { setBusquedaNombre(evento.target.value); setPagina(1) }}
              placeholder="Buscar material por nombre…"
              className="w-full rounded-lg border border-borde bg-superficie py-2 pl-9 pr-3 text-sm text-texto placeholder:text-texto-suave focus-visible:outline-2 focus-visible:outline-acento-600"
            />
          </div>
          <p className="text-xs text-texto-suave" aria-live="polite">{totalMateriales} materiales</p>
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

      {!cargando && !mostrarFormulario && totalMateriales === 0 && !busquedaNombre && (
        <EstadoVacio titulo="Aún no hay materiales registrados" mensaje="Registra el primer material del inventario." />
      )}

      {!cargando && !mostrarFormulario && totalMateriales === 0 && busquedaNombre && (
        <EstadoVacio titulo="No se encontraron materiales" mensaje="Prueba con otro nombre. La búsqueda ignora mayúsculas y tildes." />
      )}

      {!cargando && !mostrarFormulario && materialesFiltrados.length > 0 && (
        <Tarjeta className="overflow-hidden border-borde shadow-sm">
          <div
            className="overflow-x-auto"
            role="region"
            aria-label="Tabla de inventario de materiales"
            tabIndex={0}
          >
            <table className="min-w-[980px] w-full text-sm">
              <thead>
                <tr className="border-b border-borde bg-superficie-alta/70 text-left text-xs uppercase tracking-wide text-texto-suave">
                  <th scope="col" className="whitespace-nowrap px-4 py-3.5 font-bold">Código de Material</th>
                  <th scope="col" className="px-4 py-3.5 font-bold">Nombre</th>
                  <th scope="col" className="px-4 py-3.5 font-bold">Foto</th>
                  <th scope="col" className="px-4 py-3.5 font-bold">Tipo</th>
                  <th scope="col" className="px-4 py-3.5 text-center font-bold">Stock</th>
                  <th scope="col" className="px-4 py-3.5 font-bold">Disponibles</th>
                  <th scope="col" className="px-4 py-3.5 font-bold">Tier mínimo</th>
                  <th scope="col" className="px-4 py-3.5 font-bold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {materialesFiltrados.map((material) => (
                  <tr key={material.id} className="text-texto transition-colors hover:bg-superficie-alta/40">
                    <td className="whitespace-nowrap px-4 py-3.5">
                      <code className="rounded-md bg-superficie-alta px-2 py-1 font-mono text-xs font-semibold text-texto">
                        {material.codigo_material || material.codigo_inventario}
                      </code>
                    </td>
                    <td className="max-w-64 px-4 py-3.5 font-semibold leading-snug">{material.nombre}</td>
                    <td className="px-4 py-3.5">
                      {material.foto ? (
                        <img
                          className="size-11 rounded-lg border border-borde object-cover shadow-xs"
                          src={material.foto}
                          alt={`Foto de ${material.nombre}`}
                          width="44"
                          height="44"
                          loading="lazy"
                        />
                      ) : (
                        <span
                          className="flex size-11 items-center justify-center rounded-lg border border-borde bg-superficie-alta text-sm text-texto-suave"
                          role="img"
                          aria-label={`${material.nombre} no tiene foto`}
                        >
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex rounded-full bg-acento-100 px-2.5 py-1 text-xs font-semibold text-acento-800 dark:bg-acento-500/15 dark:text-acento-300">
                        {ETIQUETAS_TIPO[material.tipo] || material.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className="inline-flex min-w-10 justify-center rounded-lg bg-superficie-alta px-2.5 py-1.5 font-bold tabular-nums text-texto">
                        {material.stock}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${Number(material.unidades_disponibles) > 0
                        ? 'bg-marca-100 text-marca-800 dark:bg-marca-500/15 dark:text-marca-300'
                        : 'bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-300'
                      }`}>
                        <span aria-hidden="true" className={`size-1.5 rounded-full ${Number(material.unidades_disponibles) > 0 ? 'bg-marca-600 dark:bg-marca-400' : 'bg-amber-600 dark:bg-amber-400'}`} />
                        {material.unidades_disponibles}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex rounded-full border border-borde px-2.5 py-1 text-xs font-medium text-texto-suave">
                        {ETIQUETAS_TIER[material.tier_minimo_requerido] || material.tier_minimo_requerido}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex min-w-[300px] flex-wrap items-center gap-1.5 rounded-xl border border-borde bg-superficie-alta/50 p-1.5">
                        <Boton
                          variante="accion"
                          tamanio="pequeno"
                          tipo="button"
                          icono={CalendarDays}
                          onClick={() => setMaterialCalendario(material)}
                        >
                          Calendario
                        </Boton>
                        <Boton
                          variante="accion"
                          tamanio="pequeno"
                          tipo="button"
                          icono={History}
                          onClick={() => navigate(`/panel/inventario/${material.id}/historial`)}
                        >
                          Historial
                        </Boton>
                        <Boton
                          variante="accion"
                          tamanio="pequeno"
                          tipo="button"
                          icono={FileText}
                          onClick={() => setMaterialFicha(material)}
                        >
                          Ficha
                        </Boton>
                        <Boton
                          variante="primario"
                          tamanio="pequeno"
                          tipo="button"
                          icono={Pencil}
                          onClick={() => abrirFormularioEdicion(material)}
                        >
                          Editar
                        </Boton>
                        <Boton
                          variante="peligro"
                          tamanio="pequeno"
                          tipo="button"
                          icono={Trash2}
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

      {!cargando && !mostrarFormulario && <ControlesPaginacion pagina={pagina} total={totalMateriales} onCambiar={setPagina} cargando={cargando} />}

      {materialCalendario && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onMouseDown={(evento) => {
            if (evento.target === evento.currentTarget) setMaterialCalendario(null)
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="calendario-material-titulo"
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-borde bg-white p-6 shadow-2xl dark:bg-superficie"
          >
            <header className="mb-4 flex items-start justify-between gap-4 border-b border-borde pb-3">
              <div>
                <h3 id="calendario-material-titulo" className="text-lg font-bold text-texto">
                  Calendario de reservas futuras
                </h3>
                <p className="mt-0.5 text-sm text-texto-suave">
                  <strong className="text-texto">{materialCalendario.nombre}</strong> · Código:{' '}
                  <code className="font-mono">{materialCalendario.codigo_material || materialCalendario.codigo_inventario}</code>
                </p>
              </div>
              <Boton
                variante="secundario"
                tamanio="pequeno"
                tipo="button"
                onClick={() => setMaterialCalendario(null)}
              >
                Cerrar
              </Boton>
            </header>

            <CalendarioDisponibilidad
              materialId={materialCalendario.id}
              soloLectura
              mostrarResumenReservas
            />
          </section>
        </div>
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
