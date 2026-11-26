import { useContext, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  Building,
  Camera,
  CheckCircle2,
  Eye,
  GraduationCap,
  IdCard,
  Info,
  Mail,
  Phone,
  Plus,
  Shield,
  Trash2,
  User,
  X,
} from 'lucide-react'

import { api, ErrorApi } from '../api/client'
import SesionContext from '../contextos/SesionContext'
import { validarEmailSecundario, validarTelefono } from '../validaciones'
import useTituloPagina from '../hooks/useTituloPagina'
import Campo from '../components/ui/Campo'
import CampoTelefono from '../components/ui/CampoTelefono'
import Boton from '../components/ui/Boton'
import Tarjeta from '../components/ui/Tarjeta'
import Skeleton from '../components/ui/Skeleton'
import ErrorAlerta from '../components/ui/ErrorAlerta'
import TarjetaReputacion from '../components/ui/TarjetaReputacion'
import { ETIQUETAS_ROL } from '../constantes/roles'
import ExitoModal from '../components/ui/ExitoModal'

const ETIQUETAS_TIPO = {
  alumno: 'Alumno',
  docente: 'Docente',
  administrativo: 'Administrativo',
}

function FilaDatoInstitucional({ icono: Icono, etiqueta, valor, badge }) {
  return (
    <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:py-3.5 border-b border-borde/50 last:border-b-0">
      <div className="flex items-center gap-2.5 text-sm font-medium text-texto-suave">
        {Icono && <Icono aria-hidden="true" className="size-4 shrink-0 text-texto-suave" />}
        <span>{etiqueta}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-texto break-words">{valor || 'No registrado'}</span>
        {badge && (
          <span className="inline-flex rounded-full bg-acento-100 px-2 py-0.5 text-[11px] font-bold text-acento-800 dark:bg-acento-500/20 dark:text-acento-300">
            {badge}
          </span>
        )}
      </div>
    </div>
  )
}

function FormularioPerfil({ perfil, onGuardar, onGuardarFoto, onEliminarFoto, guardando = false }) {
  // Teléfonos (hasta 3 en total)
  const [telefonoPrincipal, setTelefonoPrincipal] = useState(perfil.telefono || '')
  const [telefonoSecundario, setTelefonoSecundario] = useState(perfil.telefono_secundario || '')
  const [telefonoTerciario, setTelefonoTerciario] = useState(perfil.telefono_terciario || '')
  
  // Visibilidad de teléfonos opcionales
  const [mostrarSecundario, setMostrarSecundario] = useState(Boolean(perfil.telefono_secundario))
  const [mostrarTerciario, setMostrarTerciario] = useState(Boolean(perfil.telefono_terciario))

  // Correo de recuperación (solo 1 adicional)
  const [emailSecundario, setEmailSecundario] = useState(perfil.email_secundario || '')

  // Foto de perfil
  const [previewFoto, setPreviewFoto] = useState(perfil.foto_perfil || null)
  const [fotoPendiente, setFotoPendiente] = useState(null)
  const [guardandoFoto, setGuardandoFoto] = useState(false)
  const [errorFoto, setErrorFoto] = useState('')
  const [modalFotoAbierto, setModalFotoAbierto] = useState(false)
  const [menuFotoAbierto, setMenuFotoAbierto] = useState(false)
  const inputFotoRef = useRef(null)
  const menuFotoRef = useRef(null)

  // Doble verificación al eliminar o vaciar datos opcionales de contacto
  const [modalEliminacionAbierto, setModalEliminacionAbierto] = useState(false)
  const [camposAEliminar, setCamposAEliminar] = useState([])
  const [datosContactoPendientes, setDatosContactoPendientes] = useState(null)

  const [errores, setErrores] = useState({})
  const [notificacion, setNotificacion] = useState(null)
  const timerNotifRef = useRef(null)

  function mostrarNotificacion(tipo, texto, duracion = 3000) {
    if (timerNotifRef.current) clearTimeout(timerNotifRef.current)
    setNotificacion({ tipo, texto })
    timerNotifRef.current = setTimeout(() => {
      setNotificacion(null)
    }, duracion)
  }

  useEffect(() => {
    function manejarClickFueraMenu(evento) {
      if (menuFotoRef.current && !menuFotoRef.current.contains(evento.target)) {
        setMenuFotoAbierto(false)
      }
    }

    function manejarTecla(evento) {
      if (evento.key === 'Escape') {
        setMenuFotoAbierto(false)
        setModalFotoAbierto(false)
        setModalEliminacionAbierto(false)
      }
    }

    document.addEventListener('mousedown', manejarClickFueraMenu)
    document.addEventListener('keydown', manejarTecla)

    return () => {
      document.removeEventListener('mousedown', manejarClickFueraMenu)
      document.removeEventListener('keydown', manejarTecla)
      if (timerNotifRef.current) clearTimeout(timerNotifRef.current)
    }
  }, [])

  useEffect(() => {
    setTelefonoPrincipal(perfil.telefono || '')
    setTelefonoSecundario(perfil.telefono_secundario || '')
    setTelefonoTerciario(perfil.telefono_terciario || '')
    setMostrarSecundario(Boolean(perfil.telefono_secundario))
    setMostrarTerciario(Boolean(perfil.telefono_terciario))
    setEmailSecundario(perfil.email_secundario || '')
    setPreviewFoto(perfil.foto_perfil || null)
    setFotoPendiente(null)
    setErrores({})
    setErrorFoto('')
  }, [perfil])

  function manejarSeleccionFoto(evento) {
    const archivo = evento.target.files?.[0]
    if (!archivo) return

    // Validar tipo y peso
    const formatosValidos = ['image/jpeg', 'image/png', 'image/webp']
    if (!formatosValidos.includes(archivo.type)) {
      setErrorFoto('La foto debe ser formato JPG, PNG o WEBP.')
      return
    }

    if (archivo.size > 4 * 1024 * 1024) {
      setErrorFoto('La foto no debe superar 4 MB.')
      return
    }

    setErrorFoto('')
    const urlPreview = URL.createObjectURL(archivo)
    setFotoPendiente({
      archivo,
      preview: urlPreview,
      nombre: archivo.name,
      peso: (archivo.size / (1024 * 1024)).toFixed(2),
    })
    evento.target.value = ''
  }

  function cancelarFotoPendiente() {
    if (fotoPendiente?.preview) {
      URL.revokeObjectURL(fotoPendiente.preview)
    }
    setFotoPendiente(null)
    setErrorFoto('')
  }

  async function confirmarGuardadoFoto() {
    if (!fotoPendiente?.archivo || !onGuardarFoto) return
    setGuardandoFoto(true)
    setErrorFoto('')
    try {
      const formData = new FormData()
      formData.append('foto_perfil', fotoPendiente.archivo)
      await onGuardarFoto(formData)
      if (fotoPendiente?.preview) {
        URL.revokeObjectURL(fotoPendiente.preview)
      }
      setFotoPendiente(null)
    } catch (err) {
      setErrorFoto(mensajeErrorApi(err, 'No se pudo guardar la foto de perfil.'))
    } finally {
      setGuardandoFoto(false)
    }
  }

  async function manejarEliminarFoto() {
    if (!onEliminarFoto || guardandoFoto) return
    setMenuFotoAbierto(false)
    setModalFotoAbierto(false)
    setGuardandoFoto(true)
    setErrorFoto('')
    try {
      await onEliminarFoto()
    } catch (err) {
      setErrorFoto(mensajeErrorApi(err, 'No se pudo eliminar la foto de perfil.'))
    } finally {
      setGuardandoFoto(false)
    }
  }

  function eliminarTelefonoSecundario() {
    setTelefonoSecundario('')
    setMostrarSecundario(false)
  }

  function eliminarTelefonoTerciario() {
    setTelefonoTerciario('')
    setMostrarTerciario(false)
  }

  function agregarSiguienteTelefono() {
    if (!mostrarSecundario) {
      setMostrarSecundario(true)
    } else if (!mostrarTerciario) {
      setMostrarTerciario(true)
    }
  }

  const cantidadTelefonosVisibles = 1 + (mostrarSecundario ? 1 : 0) + (mostrarTerciario ? 1 : 0)

  function manejarEnvio(evento) {
    evento.preventDefault()

    const erroresFormulario = {}

    // Validar teléfono principal (obligatorio)
    const errTelPrincipal = validarTelefono(telefonoPrincipal, { obligatorio: true })
    if (errTelPrincipal) erroresFormulario.telefono = errTelPrincipal

    // Validar teléfonos adicionales si están visibles
    if (mostrarSecundario && telefonoSecundario.trim()) {
      const errSec = validarTelefono(telefonoSecundario, { obligatorio: false })
      if (errSec) erroresFormulario.telefono_secundario = errSec
    }

    if (mostrarTerciario && telefonoTerciario.trim()) {
      const errTer = validarTelefono(telefonoTerciario, { obligatorio: false })
      if (errTer) erroresFormulario.telefono_terciario = errTer
    }

    // Validar que no se repitan los teléfonos
    const tels = [
      telefonoPrincipal.trim(),
      mostrarSecundario ? telefonoSecundario.trim() : '',
      mostrarTerciario ? telefonoTerciario.trim() : '',
    ].filter(Boolean)

    if (new Set(tels).size !== tels.length) {
      erroresFormulario.telefono = 'No puedes registrar números de celular repetidos.'
    }

    // Validar correo secundario (opcional, pero si existe debe ser válido y distinto al principal)
    const errEmailSec = validarEmailSecundario(emailSecundario, perfil.email)
    if (errEmailSec) erroresFormulario.email_secundario = errEmailSec

    setErrores(erroresFormulario)
    if (Object.keys(erroresFormulario).length > 0 || !onGuardar) return

    // Verificar si existen cambios reales frente a los datos actuales de contacto
    const tel1Limpio = telefonoPrincipal.trim()
    const tel2Limpio = mostrarSecundario ? telefonoSecundario.trim() : ''
    const tel3Limpio = mostrarTerciario ? telefonoTerciario.trim() : ''
    const emailSecLimpio = emailSecundario.trim()

    const sonDatosDiferentes =
      tel1Limpio !== (perfil.telefono || '').trim() ||
      tel2Limpio !== (perfil.telefono_secundario || '').trim() ||
      tel3Limpio !== (perfil.telefono_terciario || '').trim() ||
      emailSecLimpio !== (perfil.email_secundario || '').trim()

    if (!sonDatosDiferentes) {
      mostrarNotificacion('info', 'No realizaste cambios en tu información de contacto.')
      return
    }

    const datosContacto = {
      telefono: tel1Limpio,
      telefono_secundario: tel2Limpio,
      telefono_terciario: tel3Limpio,
      email_secundario: emailSecLimpio,
    }

    // Doble verificación: comprobar si se está dejando en blanco o quitando un dato opcional previo
    const camposBorrados = []
    if (Boolean(perfil.email_secundario?.trim()) && !emailSecLimpio) {
      camposBorrados.push({
        id: 'email_secundario',
        etiqueta: 'Correo de recuperación',
        valorAnterior: perfil.email_secundario.trim(),
      })
    }
    if (Boolean(perfil.telefono_secundario?.trim()) && !tel2Limpio) {
      camposBorrados.push({
        id: 'telefono_secundario',
        etiqueta: 'Celular alternativo',
        valorAnterior: perfil.telefono_secundario.trim(),
      })
    }
    if (Boolean(perfil.telefono_terciario?.trim()) && !tel3Limpio) {
      camposBorrados.push({
        id: 'telefono_terciario',
        etiqueta: 'Celular de respaldo',
        valorAnterior: perfil.telefono_terciario.trim(),
      })
    }

    if (camposBorrados.length > 0) {
      setCamposAEliminar(camposBorrados)
      setDatosContactoPendientes(datosContacto)
      setModalEliminacionAbierto(true)
      return
    }

    onGuardar(datosContacto)
  }

  function confirmarEliminacionYGuardar() {
    if (!datosContactoPendientes || !onGuardar) return
    const datosParaEnviar = datosContactoPendientes
    setModalEliminacionAbierto(false)
    setCamposAEliminar([])
    setDatosContactoPendientes(null)
    onGuardar(datosParaEnviar)
  }

  function cancelarEliminacion() {
    setModalEliminacionAbierto(false)
    setCamposAEliminar([])
    setDatosContactoPendientes(null)
  }

  const iniciales =
    `${perfil.nombre ? perfil.nombre[0] : ''}${perfil.apellido ? perfil.apellido[0] : ''}`.toUpperCase()

  return (
    <div className="space-y-8">
      {/* Encabezado Principal del Perfil */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between border-b border-borde pb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          {/* Avatar circular amplio con nitidez nativa, filtro hover y menú interactivo */}
          <div className="relative shrink-0" ref={menuFotoRef}>
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={menuFotoAbierto}
              onClick={() => setMenuFotoAbierto((actual) => !actual)}
              title="Haz clic para ver opciones de foto"
              aria-label="Opciones de foto de perfil"
              className="group relative block size-48 sm:size-56 rounded-full overflow-hidden ring-2 ring-marca-500/40 hover:ring-marca-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento-600 transition-all shadow-md hover:shadow-lg"
            >
              {previewFoto ? (
                <img
                  src={previewFoto}
                  alt={`Foto de perfil de ${perfil.nombre}`}
                  className="size-full rounded-full object-cover"
                />
              ) : (
                <div className="flex size-full items-center justify-center rounded-full bg-marca-600 text-5xl sm:text-6xl font-black text-white">
                  {iniciales}
                </div>
              )}

              {/* Filtro de desenfoque y overlay al poner el mouse encima */}
              <span className="absolute inset-0 rounded-full flex items-center justify-center bg-black/40 backdrop-blur-xs opacity-0 transition-opacity group-hover:opacity-100 text-white">
                <Eye className="size-10" />
              </span>
            </button>

            {/* Botón flotante indicador de cámara */}
            <button
              type="button"
              onClick={() => setMenuFotoAbierto((actual) => !actual)}
              aria-label="Cambiar foto de perfil"
              title="Cambiar foto de perfil"
              className="absolute bottom-1.5 right-1.5 flex size-10 sm:size-11 items-center justify-center rounded-full bg-superficie border border-borde text-texto shadow-md hover:bg-superficie-alta transition-colors focus-visible:outline-2 focus-visible:outline-acento-600"
            >
              <Camera className="size-5 text-texto-suave" />
            </button>

            {/* Menú de opciones al hacer clic sobre la imagen */}
            {menuFotoAbierto && (
              <div
                role="menu"
                aria-label="Opciones de foto de perfil"
                className="absolute top-full left-0 mt-2 w-52 rounded-xl border border-borde bg-superficie p-1.5 shadow-xl z-30 animate-in fade-in zoom-in-95 duration-150"
              >
                {previewFoto ? (
                  <>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuFotoAbierto(false)
                        setModalFotoAbierto(true)
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-texto hover:bg-superficie-alta transition-colors text-left"
                    >
                      <Eye className="size-4 text-acento-600 dark:text-acento-400 shrink-0" />
                      <span>Ver foto</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuFotoAbierto(false)
                        inputFotoRef.current?.click()
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-texto hover:bg-superficie-alta transition-colors text-left"
                    >
                      <Camera className="size-4 text-marca-600 dark:text-marca-400 shrink-0" />
                      <span>Cambiar foto</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      disabled={guardandoFoto}
                      onClick={manejarEliminarFoto}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors text-left"
                    >
                      <Trash2 className="size-4 shrink-0" />
                      <span>Eliminar foto</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuFotoAbierto(false)
                      inputFotoRef.current?.click()
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-texto hover:bg-superficie-alta transition-colors text-left"
                  >
                    <Camera className="size-4 text-marca-600 dark:text-marca-400 shrink-0" />
                    <span>Subir foto de perfil</span>
                  </button>
                )}
              </div>
            )}

            <input
              ref={inputFotoRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={manejarSeleccionFoto}
            />
          </div>

          <div>
            <h1 className="text-2xl font-black text-texto sm:text-3xl">
              {perfil.nombre} {perfil.apellido}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-md bg-marca-100 px-2.5 py-0.5 text-xs font-bold text-marca-800 dark:bg-marca-500/15 dark:text-marca-300">
                {ETIQUETAS_TIPO[perfil.tipo] || perfil.tipo}
              </span>
              <span className="inline-flex items-center rounded-md bg-acento-100 px-2.5 py-0.5 text-xs font-bold text-acento-800 dark:bg-acento-500/20 dark:text-acento-300">
                Rol: {ETIQUETAS_ROL[perfil.rol] || perfil.rol || 'Prestatario'}
              </span>
            </div>

            {errorFoto && <p className="mt-1 text-xs font-semibold text-red-600 dark:text-red-400">{errorFoto}</p>}
          </div>
        </div>
      </div>

      {/* Modal de confirmación para guardar nueva foto de perfil inmediatamente */}
      {fotoPendiente && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirmar nueva foto de perfil"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md animate-in fade-in"
        >
          <div
            className="relative max-w-sm w-full rounded-2xl bg-superficie p-5 shadow-2xl border border-borde flex flex-col items-center gap-4 animate-in zoom-in-95 duration-150"
          >
            <div className="flex w-full items-center justify-between border-b border-borde/60 pb-2">
              <h3 className="text-sm font-bold text-texto">
                Nueva foto de perfil
              </h3>
              <button
                type="button"
                onClick={cancelarFotoPendiente}
                disabled={guardandoFoto}
                aria-label="Cancelar"
                className="rounded-lg p-1 text-texto-suave hover:bg-superficie-alta hover:text-texto transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="flex flex-col items-center gap-2 py-2">
              <div className="size-44 sm:size-48 rounded-full overflow-hidden border-2 border-marca-500/40 shadow-md">
                <img
                  src={fotoPendiente.preview}
                  alt="Vista previa de nueva foto"
                  className="size-full object-cover [backface-visibility:hidden] [transform:translateZ(0)]"
                />
              </div>
              <p className="text-xs text-texto-suave text-center">
                {fotoPendiente.nombre} ({fotoPendiente.peso} MB)
              </p>
            </div>

            {errorFoto && (
              <p className="text-xs font-semibold text-red-600 dark:text-red-400 text-center">
                {errorFoto}
              </p>
            )}

            <div className="flex w-full gap-2 pt-2 border-t border-borde/50">
              <Boton
                tipo="button"
                variante="secundario"
                onClick={cancelarFotoPendiente}
                disabled={guardandoFoto}
                className="flex-1"
              >
                Cancelar
              </Boton>
              <Boton
                tipo="button"
                onClick={confirmarGuardadoFoto}
                cargando={guardandoFoto}
                className="flex-1"
              >
                Guardar foto
              </Boton>
            </div>
          </div>
        </div>
      )}

      {/* Modal / Lightbox para ver la foto de perfil en tamaño completo */}
      {modalFotoAbierto && previewFoto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Foto de perfil de ${perfil.nombre}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in"
          onClick={() => setModalFotoAbierto(false)}
        >
          <div
            className="relative max-w-3xl w-full rounded-2xl bg-superficie p-4 sm:p-5 shadow-2xl border border-borde flex flex-col items-center gap-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex w-full items-center justify-between border-b border-borde/60 pb-3">
              <h3 className="text-base font-bold text-texto">
                Foto de perfil — {perfil.nombre} {perfil.apellido}
              </h3>
              <button
                type="button"
                onClick={() => setModalFotoAbierto(false)}
                aria-label="Cerrar visor de foto"
                className="rounded-lg p-1.5 text-texto-suave hover:bg-superficie-alta hover:text-texto transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="flex items-center justify-center max-h-[75vh] w-full overflow-auto rounded-xl bg-superficie-alta/30 p-2 sm:p-4">
              <img
                src={previewFoto}
                alt={`Foto de perfil de ${perfil.nombre}`}
                className="max-h-[70vh] max-w-full w-auto h-auto rounded-lg shadow-md"
              />
            </div>
            <div className="flex w-full justify-between items-center pt-2 border-t border-borde/50">
              <button
                type="button"
                onClick={() => {
                  setModalFotoAbierto(false)
                  inputFotoRef.current?.click()
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-borde bg-superficie px-3 py-1.5 text-xs font-semibold text-texto hover:bg-superficie-alta transition-colors"
              >
                <Camera className="size-4" />
                Cambiar por otra foto
              </button>
              <button
                type="button"
                onClick={() => setModalFotoAbierto(false)}
                className="rounded-lg bg-marca-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-marca-700 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de doble verificación para eliminación de datos opcionales */}
      {modalEliminacionAbierto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-modal-eliminacion"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs animate-in fade-in"
          onClick={cancelarEliminacion}
        >
          <div
            className="relative max-w-md w-full rounded-2xl bg-superficie p-5 sm:p-6 shadow-2xl border border-borde flex flex-col gap-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3.5">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400">
                <AlertTriangle className="size-5" />
              </div>
              <div className="flex-1">
                <h3 id="titulo-modal-eliminacion" className="text-base font-bold text-texto">
                  Confirmar eliminación de información
                </h3>
                <p className="mt-1 text-xs text-texto-suave">
                  Has dejado en blanco o quitado datos de contacto opcionales que tenías registrados. Si guardas estos cambios, se eliminarán de tu cuenta:
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-red-200/60 bg-red-50/50 p-3 dark:border-red-900/40 dark:bg-red-950/20">
              <ul className="space-y-2 text-xs">
                {camposAEliminar.map((item) => (
                  <li key={item.id} className="flex flex-col gap-0.5">
                    <span className="font-semibold text-texto">{item.etiqueta}:</span>
                    <span className="text-red-700 dark:text-red-300 font-mono break-all line-through">
                      {item.valorAnterior}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-xs text-texto-suave">
              ¿Deseas confirmar la eliminación de estos datos y guardar tu perfil?
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-borde/50">
              <Boton
                tipo="button"
                variante="secundario"
                tamanio="pequeno"
                onClick={cancelarEliminacion}
              >
                Cancelar
              </Boton>
              <Boton
                tipo="button"
                variante="peligro"
                tamanio="pequeno"
                cargando={guardando}
                deshabilitado={guardando}
                onClick={confirmarEliminacionYGuardar}
              >
                Sí, eliminar y guardar
              </Boton>
            </div>
          </div>
        </div>
      )}

      {!['gestor', 'administrador'].includes(perfil.rol) && (
        <section aria-labelledby="titulo-reputacion">
          <h2 id="titulo-reputacion" className="sr-only">Nivel de Reputación</h2>
          <TarjetaReputacion
            tier={perfil.reputacion_tier}
            puntaje={perfil.reputacion_puntaje}
            puntosGanadosSemana={perfil.reputacion_puntos_ganados_semana}
            topeSemanal={perfil.reputacion_tope_semanal}
          />
        </section>
      )}

      {!['gestor', 'administrador'].includes(perfil.rol) && (
        <section aria-labelledby="titulo-prestamos-activos">
          <h2 id="titulo-prestamos-activos" className="sr-only">Préstamos activos</h2>
          <Tarjeta className="p-4">
            <div className="flex items-center gap-2 border-b border-borde/60 pb-3 mb-3">
              <Info className="size-5 text-marca-600 dark:text-marca-400" aria-hidden="true" />
              <h3 className="text-base font-bold text-texto">Préstamos activos</h3>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between rounded-lg border border-borde bg-superficie px-4 py-3">
                <span className="text-sm font-medium text-texto-suave">Préstamos en curso</span>
                <span className="text-sm font-bold text-texto">
                  {perfil.prestamos_activos ?? 0}
                  {typeof perfil.maximo_prestamos_activos === 'number' && perfil.maximo_prestamos_activos > 0
                    ? ` / ${perfil.maximo_prestamos_activos}`
                    : ''}
                </span>
              </div>
              {perfil.tiene_prestamos_vencidos && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-600/40 dark:bg-amber-900/20"
                >
                  <AlertTriangle
                    className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
                    aria-hidden="true"
                  />
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                    Tienes préstamos vencidos. Por favor, devuelve los materiales pendientes para
                    restablecer tu acceso al sistema de préstamos.
                  </p>
                </div>
              )}
            </div>
          </Tarjeta>
        </section>
      )}

      {/* Las dos secciones principales organizadas limpiamente */}
      <div className="grid gap-8 lg:grid-cols-2">
        {/* SECCIÓN 1: Información Institucional y Académica (Solo Lectura) */}
        <section aria-labelledby="seccion-institucional" className="flex flex-col">
          <Tarjeta className="flex-1 p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-borde/60 pb-3 mb-2">
                <div className="flex items-center gap-2">
                  <Shield className="size-5 text-marca-600 dark:text-marca-400" />
                  <h2 id="seccion-institucional" className="text-lg font-bold text-texto">
                    Información Institucional y de Contacto
                  </h2>
                </div>
              </div>

              <div className="divide-y divide-borde/40">
                <FilaDatoInstitucional
                  icono={User}
                  etiqueta="Nombre completo"
                  valor={`${perfil.nombre} ${perfil.apellido}`}
                />
                <FilaDatoInstitucional
                  icono={IdCard}
                  etiqueta="Documento de Identidad (DNI)"
                  valor={perfil.dni}
                />
                <FilaDatoInstitucional
                  icono={GraduationCap}
                  etiqueta="Tipo de usuario"
                  valor={ETIQUETAS_TIPO[perfil.tipo] || perfil.tipo}
                />
                <FilaDatoInstitucional
                  icono={Building}
                  etiqueta="Facultad"
                  valor={perfil.facultad || 'No especificada'}
                />
                <FilaDatoInstitucional
                  icono={Building}
                  etiqueta="Carrera / Departamento"
                  valor={perfil.departamento_carrera || 'No especificado'}
                />
                <FilaDatoInstitucional
                  icono={Mail}
                  etiqueta="Correo institucional"
                  valor={perfil.email}
                />
                {Boolean(perfil.email_secundario?.trim()) && (
                  <FilaDatoInstitucional
                    icono={Mail}
                    etiqueta="Correo de recuperación"
                    valor={perfil.email_secundario}
                  />
                )}
                <FilaDatoInstitucional
                  icono={Phone}
                  etiqueta="Celular principal"
                  valor={perfil.telefono || 'Sin celular registrado'}
                />
                {Boolean(perfil.telefono_secundario?.trim()) && (
                  <FilaDatoInstitucional
                    icono={Phone}
                    etiqueta="Celular alternativo"
                    valor={perfil.telefono_secundario}
                  />
                )}
                {Boolean(perfil.telefono_terciario?.trim()) && (
                  <FilaDatoInstitucional
                    icono={Phone}
                    etiqueta="Celular de respaldo"
                    valor={perfil.telefono_terciario}
                  />
                )}
              </div>
            </div>

            <div className="mt-5 rounded-lg bg-superficie-alta/70 p-3 text-xs text-texto-suave flex items-start gap-2">
              <Info className="size-4 shrink-0 text-texto-suave mt-0.5" />
              <span>
                Los datos de identidad y pertenencia académica registrados al crear tu cuenta son verificados por la institución y permanecen protegidos. Si requieres rectificar tu nombre, DNI, facultad o carrera, solicita la actualización con la administración de almacén.
              </span>
            </div>
          </Tarjeta>
        </section>

        {/* SECCIÓN 2: Datos de Contacto y Personalización (Modificable) */}
        <section aria-labelledby="seccion-contacto">
          <Tarjeta className="p-6">
            <form onSubmit={manejarEnvio} noValidate className="space-y-6">
              <div className="flex items-center justify-between border-b border-borde/60 pb-3">
                <div className="flex items-center gap-2">
                  <Phone className="size-5 text-acento-600 dark:text-acento-400" />
                  <h2 id="seccion-contacto" className="text-lg font-bold text-texto">
                    Datos de Contacto y Personalización
                  </h2>
                </div>
                {notificacion && (
                  <p
                    className={`flex items-center gap-1.5 text-xs font-bold transition-all ${
                      notificacion.tipo === 'exito'
                        ? 'text-marca-700 dark:text-marca-300'
                        : 'text-acento-700 dark:text-acento-300'
                    }`}
                    role="status"
                  >
                    {notificacion.tipo === 'exito' ? (
                      <CheckCircle2 className="size-4 shrink-0 text-marca-600 dark:text-marca-400" />
                    ) : (
                      <Info className="size-4 shrink-0 text-acento-600 dark:text-acento-400" />
                    )}
                    {notificacion.texto}
                  </p>
                )}
              </div>

              {/* Gestión de Teléfonos / Celulares (Máx 3) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-texto">
                    Números de celular ({cantidadTelefonosVisibles}/3)
                  </label>
                  {cantidadTelefonosVisibles < 3 && (
                    <button
                      type="button"
                      onClick={agregarSiguienteTelefono}
                      className="inline-flex items-center gap-1 text-xs font-bold text-acento-600 hover:text-acento-700 dark:text-acento-400 focus-visible:outline-2 focus-visible:outline-acento-600"
                    >
                      <Plus className="size-3.5" />
                      {!mostrarSecundario ? 'Agregar celular alternativo' : 'Agregar celular de respaldo'}
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  <CampoTelefono
                    etiqueta="Celular principal"
                    valor={telefonoPrincipal}
                    onCambio={(evento) => setTelefonoPrincipal(evento.target.value)}
                    error={errores.telefono}
                    requerido
                  />

                  {mostrarSecundario && (
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <CampoTelefono
                          etiqueta="Celular alternativo (opcional)"
                          valor={telefonoSecundario}
                          onCambio={(evento) => setTelefonoSecundario(evento.target.value)}
                          error={errores.telefono_secundario}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={eliminarTelefonoSecundario}
                        title="Quitar celular alternativo"
                        className="mb-1 p-2.5 text-texto-suave hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-superficie-alta transition-colors"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  )}

                  {mostrarTerciario && (
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <CampoTelefono
                          etiqueta="Celular de respaldo (opcional)"
                          valor={telefonoTerciario}
                          onCambio={(evento) => setTelefonoTerciario(evento.target.value)}
                          error={errores.telefono_terciario}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={eliminarTelefonoTerciario}
                        title="Quitar celular de respaldo"
                        className="mb-1 p-2.5 text-texto-suave hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-superficie-alta transition-colors"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Correo de Recuperación (Solo 1 adicional) */}
              <div className="space-y-2 border-t border-borde/40 pt-4">
                <Campo
                  etiqueta="Correo de recuperación (opcional)"
                  tipo="email"
                  valor={emailSecundario}
                  onCambio={(evento) => setEmailSecundario(evento.target.value)}
                  error={errores.email_secundario}
                  placeholder="ejemplo.recuperacion@correo.com"
                  ayuda="Correo adicional para notificaciones y recuperación de tu cuenta."
                />
              </div>

              <div className="pt-2">
                <Boton
                  tipo="submit"
                  cargando={guardando}
                  className="w-full sm:w-auto"
                >
                  Guardar cambios
                </Boton>
              </div>
            </form>
          </Tarjeta>
        </section>
      </div>
    </div>
  )
}

function mensajeErrorApi(error, mensajePredeterminado) {
  if (!(error instanceof ErrorApi)) return mensajePredeterminado
  if (error.status === 401) return 'Tu sesión venció. Inicia sesión nuevamente.'

  const datos = error.datos
  if (datos?.detail) return datos.detail

  if (datos && typeof datos === 'object') {
    const primerError = Object.values(datos).flat()[0]
    if (typeof primerError === 'string') return primerError
  }

  if (error.status === 403) {
    return 'No se pudo validar la solicitud. Recarga el perfil e inténtalo otra vez.'
  }

  return mensajePredeterminado
}

function PerfilUsuario({ onPerfilActualizado }) {
  useTituloPagina('Mi perfil')
  const { usuario } = useContext(SesionContext) || {}
  const [perfil, setPerfil] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [mensajeExito, setMensajeExito] = useState('')
  const [intentoCarga, setIntentoCarga] = useState(0)
  useEffect(() => {
    let activo = true
    setCargando(true)
    setError('')

    api.get('/usuarios/perfil/')
      .then((datos) => {
        if (activo) {
          setPerfil(datos)
          onPerfilActualizado?.(datos)
        }
      })
      .catch((fallo) => {
        if (activo) setError(mensajeErrorApi(fallo, 'No se pudo cargar tu perfil.'))
      })
      .finally(() => {
        if (activo) setCargando(false)
      })

    return () => {
      activo = false
    }
  }, [intentoCarga])

  async function guardarPerfil(datos) {
    setGuardando(true)
    setError('')
    setMensajeExito('')

    try {
      const perfilActualizado = await api.put('/usuarios/perfil/', datos)
      setPerfil(perfilActualizado)
      onPerfilActualizado?.(perfilActualizado)
      setMensajeExito('Los cambios se guardaron correctamente.')
    } catch (fallo) {
      setError(mensajeErrorApi(fallo, 'No se pudieron guardar los cambios.'))
    } finally {
      setGuardando(false)
    }
  }

  async function guardarFotoPerfil(formData) {
    try {
      const perfilActualizado = await api.put('/usuarios/perfil/', formData)
      setPerfil(perfilActualizado)
      onPerfilActualizado?.(perfilActualizado)
      setMensajeExito('Foto de perfil actualizada correctamente.')
    } catch (fallo) {
      setError(mensajeErrorApi(fallo, 'No se pudo guardar la foto de perfil.'))
      throw fallo
    }
  }

  async function eliminarFotoPerfil() {
    try {
      const perfilActualizado = await api.put('/usuarios/perfil/', { eliminar_foto_perfil: true })
      setPerfil(perfilActualizado)
      onPerfilActualizado?.(perfilActualizado)
      setMensajeExito('Foto de perfil eliminada correctamente.')
    } catch (fallo) {
      setError(mensajeErrorApi(fallo, 'No se pudo eliminar la foto de perfil.'))
      throw fallo
    }
  }

  if (cargando) {
    return (
      <div className="space-y-6" role="status" aria-live="polite">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <div className="grid gap-8 lg:grid-cols-2">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (error && !perfil) {
    return (
      <div className="grid gap-4 max-w-lg">
        <h1 className="text-2xl font-bold text-texto">Mi perfil</h1>
        <ErrorAlerta mensaje={error} />
        <Boton tipo="button" className="w-full sm:w-auto" onClick={() => setIntentoCarga((actual) => actual + 1)}>
          Volver a intentar
        </Boton>
      </div>
    )
  }

  return (
    <>
      <ExitoModal mensaje={mensajeExito} onCerrar={() => setMensajeExito('')} />
      {error && <ErrorAlerta mensaje={error} className="mb-6" />}
      <FormularioPerfil
        perfil={{ ...perfil, rol: perfil.rol || usuario?.rol }}
        onGuardar={guardarPerfil}
        onGuardarFoto={guardarFotoPerfil}
        onEliminarFoto={eliminarFotoPerfil}
        guardando={guardando}
      />
    </>
  )
}

export default PerfilUsuario
