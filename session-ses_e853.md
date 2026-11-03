# Cambio de almacenamiento de PDFs e imágenes (fork #1)

**Session ID:** ses_e85312258ffeYzVyCneegXKgS6
**Created:** 10/26/2026, 7:42:19 PM
**Updated:** 11/2/2026, 8:52:34 PM

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 3.9s)

_Thinking:_

Need continue frontend.

**Tool: bash**

**Input:**
```json
{
  "command": "sed -n '220,620p' frontend/src/pages/RegistrarPrestamo.jsx",
  "workdir": "/home/shiarowo/PERSONAL/Presticad"
}
```

**Output:**
```
        ? {
            instanciaId: '',
            documentoIdentidad: null,
            compromisoResponsabilidad: null,
          }
        : {}),
    }))
    setErrores((actual) => ({
      ...actual,
      [camposError[campo] || campo]: undefined,
      ...(campo === 'materialId'
        ? {
            instancia_id: undefined,
            documento_identidad: undefined,
            compromiso_responsabilidad: undefined,
          }
        : {}),
    }))
    if (campo === 'materialId') {
      setInstancias([])
      setCargandoInstancias(Boolean(valor))
      setErrorInstancias('')
    }
    setError('')
    setPrestamoCreado(null)
  }

  function cambiarDuracion(duracion) {
    const cambio = evaluarCambioDuracion(
      duracion,
      formulario.dias,
      formulario.unidadTiempo,
      materialSeleccionado,
    )
    if (cambio.error) {
      setErrores((actual) => ({ ...actual, dias: cambio.error }))
      return
    }
    actualizar('dias', cambio.valor)
  }

  function cambiarUnidadTiempo(nuevaUnidad) {
    setFormulario((actual) => ({ ...actual, unidadTiempo: nuevaUnidad }))
    setErrores((actual) => ({ ...actual, dias: undefined }))
  }

  function actualizarChecklist(indice, campo, valor) {
    setFormulario((actual) => ({
      ...actual,
      checklist: actual.checklist.map((item, posicion) => (
        posicion === indice ? { ...item, [campo]: valor } : item
      )),
    }))
    setErrores((actual) => ({ ...actual, checklist: undefined }))
  }

  function cambiarFotoChecklist(indice, archivo) {
    const filaActual = formulario.checklist[indice]
    if (filaActual?.fotoPrevia) {
      URL.revokeObjectURL(filaActual.fotoPrevia)
      urlsTemporales.current.delete(filaActual.fotoPrevia)
    }
    const fotoPrevia = archivo ? URL.createObjectURL(archivo) : ''
    if (fotoPrevia) urlsTemporales.current.add(fotoPrevia)
    if (referenciasFotos.current[indice]) referenciasFotos.current[indice].value = ''
    setFormulario((actual) => ({
      ...actual,
      checklist: actual.checklist.map((item, posicion) => (
        posicion === indice ? { ...item, foto: archivo, fotoPrevia } : item
      )),
    }))
    setErrores((actual) => ({
      ...actual,
      fotosChecklist: { ...actual.fotosChecklist, [indice]: undefined },
    }))
  }

  function enfocarPrimerError() {
    window.requestAnimationFrame(() => {
      const control = referenciaFormulario.current?.querySelector('[aria-invalid="true"]')
      if (!control) return
      control.scrollIntoView({ behavior: 'smooth', block: 'center' })
      control.focus({ preventScroll: true })
    })
  }

  function cerrarAdvertenciaFotos() {
    setElementosSinFoto(null)
    enfocarPrimerError()
  }

  function agregarElementoChecklist() {
    setFormulario((actual) => ({
      ...actual,
      checklist: [...actual.checklist, { elemento: '', observacion: '', foto: null, fotoPrevia: '' }],
    }))
  }

  function quitarElementoChecklist(indice) {
    const fila = formulario.checklist[indice]
    if (fila?.fotoPrevia) {
      URL.revokeObjectURL(fila.fotoPrevia)
      urlsTemporales.current.delete(fila.fotoPrevia)
    }
    setFormulario((actual) => ({
      ...actual,
      checklist: actual.checklist.filter((_, posicion) => posicion !== indice),
    }))
    setErrores((actual) => ({ ...actual, checklist: undefined }))
  }

  async function registrar(evento) {
    evento.preventDefault()
    if (bloqueadoPorElegibilidad) return
    const datosValidacion = {
      dni: formulario.dni,
      material: materialSeleccionado,
      instanciaId: formulario.instanciaId,
      duracionValor: formulario.dias,
      duracionUnidad: formulario.unidadTiempo,
      checklist: formulario.checklist,
      documentoIdentidad: formulario.documentoIdentidad,
      compromisoResponsabilidad: formulario.compromisoResponsabilidad,
    }
    const validacion = validarFormularioPrestamo(datosValidacion)
    setErrores(validacion)
    setError('')
    setPrestamoCreado(null)
    const fotosFaltantes = obtenerElementosSinFoto(formulario.checklist)
    setElementosSinFoto(fotosFaltantes.length > 0 ? fotosFaltantes : null)
    if (Object.keys(validacion).length > 0) {
      if (fotosFaltantes.length === 0) enfocarPrimerError()
      return
    }

    setGuardando(true)
    try {
      const minutosPrestamo = convertirTiempoAMinutos(formulario.dias, formulario.unidadTiempo)
      const solicitud = construirSolicitudPrestamo({
        dni: formulario.dni,
        material: materialSeleccionado,
        instanciaId: formulario.instanciaId,
        minutos: minutosPrestamo,
        checklist: formulario.checklist,
        documentoIdentidad: formulario.documentoIdentidad,
        compromisoResponsabilidad: formulario.compromisoResponsabilidad,
      })
      const errorTamano = validarTamanoSolicitud(solicitud)
      if (errorTamano) {
        setError(errorTamano)
        return
      }
      const respuesta = await api.post('/prestamos/', solicitud)
      setPrestamoCreado(respuesta)
      formulario.checklist.forEach((item) => {
        if (item.fotoPrevia) {
          URL.revokeObjectURL(item.fotoPrevia)
          urlsTemporales.current.delete(item.fotoPrevia)
        }
      })
      setFormulario(FORMULARIO_INICIAL)
      await cargarMateriales()
    } catch (errorApi) {
      const erroresApi = errorApi instanceof ErrorApi ? errorApi.datos : null
      const camposApi = {
        dni_prestatario: 'dni',
        instancia_id: 'instancia_id',
        tiempo_prestamo_minutos: 'dias',
        tiempo_prestamo_dias: 'dias',
        documento_identidad: 'documento_identidad',
        compromiso_responsabilidad: 'compromiso_responsabilidad',
      }
      const erroresDeCampo = Object.fromEntries(
        Object.entries(camposApi)
          .filter(([campo]) => erroresApi?.[campo])
          .map(([campo, destino]) => [
            destino,
            Array.isArray(erroresApi[campo]) ? erroresApi[campo][0] : String(erroresApi[campo]),
          ]),
      )
      const erroresFotosApi = mapearErroresFotoChecklist(erroresApi?.fotos_checklist)
      if (Object.keys(erroresDeCampo).length > 0 || Object.keys(erroresFotosApi).length > 0) {
        setErrores((actual) => ({
          ...actual,
          ...erroresDeCampo,
          fotosChecklist: { ...actual.fotosChecklist, ...erroresFotosApi },
        }))
        setError('')
        enfocarPrimerError()
      } else {
        setError(mensajeApi(errorApi))
      }
    } finally {
      setGuardando(false)
    }
  }

  return (
    <section aria-labelledby="titulo-registro-prestamo">
      <header className="mb-5">
        <h2 id="titulo-registro-prestamo" className="text-xl font-bold text-texto">
          Registrar entrega de préstamo
        </h2>
        <p className="mt-1 text-sm text-texto-suave">
          Confirma la identidad y elegibilidad del prestatario antes de entregar el material.
        </p>
      </header>

      {error && <ErrorAlerta mensaje={error} className="mb-4" />}

      {prestamoCreado && (
        <div
          className="mb-4 rounded-xl border border-marca-200 bg-marca-50 p-4 text-sm text-marca-800 dark:border-marca-700/60 dark:bg-marca-500/15 dark:text-marca-300"
          role="status"
        >
          <p className="font-semibold">
            Préstamo registrado como activo para {prestamoCreado.usuario_nombre}.
          </p>
          <p className="mt-1">
            Fecha límite de devolución:{' '}
            <strong>{fechaLegible(prestamoCreado.fecha_limite)}</strong>
          </p>
        </div>
      )}

      {cargando && (
        <div className="space-y-3" role="status" aria-live="polite">
          <p className="text-sm text-texto-suave">Cargando materiales disponibles…</p>
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      )}

      {!cargando && materiales.length === 0 && (
        <EstadoVacio
          titulo="No hay unidades disponibles"
          mensaje="No hay materiales disponibles para prestar en este momento."
        />
      )}

      {!cargando && materiales.length > 0 && (
        <Tarjeta className="p-6">
          <form ref={referenciaFormulario} onSubmit={registrar} noValidate className="grid gap-5">
            <SelectorPrestatario
              etiqueta="DNI del prestatario"
              valor={formulario.dni}
              onCambio={(valor) => actualizar('dni', valor)}
              error={errores.dni}
              ayuda="Al completar o seleccionar el DNI se consultará la reputación del prestatario."
              requerido
            />
            <Campo
              etiqueta="Material disponible"
              opciones={OPCIONES_MATERIAL(materiales)}
              valor={formulario.materialId}
              onCambio={(evento) => actualizar('materialId', evento.target.value)}
              error={errores.material}
              requerido
            />
            {consultandoPerfil && (
              <p className="text-sm text-texto-suave" role="status">Consultando perfil y reputación…</p>
            )}
            {errorPerfil && <ErrorAlerta mensaje={errorPerfil} />}
            {perfilVerificadoActual && (
              <div
                className={`rounded-xl border p-4 text-sm ${
                  perfilHabilitado && (!materialSeleccionado || tierCumple)
                    ? 'border-marca-200 bg-marca-50 text-marca-800 dark:border-marca-700/60 dark:bg-marca-500/15 dark:text-marca-300'
                    : 'border-red-300 bg-red-50 text-red-800 dark:border-red-700/60 dark:bg-red-500/10 dark:text-red-300'
                }`}
                role="status"
                aria-live="polite"
              >
                <p className="font-semibold">{perfilVerificadoActual.nombre} {perfilVerificadoActual.apellido}</p>
                <p>
                  Reputación: {perfilVerificadoActual.reputacion_puntaje} puntos · Tier{' '}
                  {ETIQUETA_TIER[perfilVerificadoActual.reputacion_tier] || perfilVerificadoActual.reputacion_tier}
                </p>
                {!perfilHabilitado && <p className="mt-1 font-semibold">El usuario no está habilitado para recibir préstamos.</p>}
                {materialSeleccionado && (
                  <p className="mt-1">
                    Tier requerido: {ETIQUETA_TIER[materialSeleccionado.tier_minimo_requerido] || materialSeleccionado.tier_minimo_requerido}.
                    {' '}{!tierCumple && <strong>No cumple el requisito; el registro está bloqueado.</strong>}
                    {tierCumple && perfilHabilitado && <strong> Cumple el requisito.</strong>}
                  </p>
                )}
              </div>
            )}
            <Campo
              etiqueta="Instancia disponible"
              opciones={crearOpcionesInstancia(instancias, cargandoInstancias)}
              valor={formulario.instanciaId}
              onCambio={(evento) => actualizar('instanciaId', evento.target.value)}
              error={errores.instancia_id}
              ayuda={!materialSeleccionado
                ? 'Selecciona primero el material.'
                : cargandoInstancias
                  ? 'Consultando sus instancias disponibles.'
                  : errorInstancias
                    ? 'No se pudo consultar el inventario de instancias.'
                    : instancias.length > 0
                      ? 'El código identifica el ejemplar físico que se entregará.'
                      : 'No hay instancias disponibles para este material.'}
              deshabilitado={!materialSeleccionado || cargandoInstancias || instancias.length === 0}
              requerido
            />
            {instanciaSeleccionada && (
              <section
                className="grid gap-4 rounded-xl border border-acento-300 bg-acento-50/50 p-4 dark:border-acento-700/60 dark:bg-acento-500/10 sm:grid-cols-[minmax(9rem,12rem)_1fr]"
                aria-labelledby="titulo-ficha-instancia-prestamo"
              >
                <div className="flex min-h-36 items-center justify-center overflow-hidden rounded-lg border border-borde bg-superficie">
                  {instanciaSeleccionada.foto ? (
                    <img
                      src={instanciaSeleccionada.foto}
                      alt={`Foto del ejemplar ${instanciaSeleccionada.codigo_ejemplar}`}
                      className="h-full max-h-48 w-full object-contain p-2"
                    />
                  ) : (
                    <p className="p-4 text-center text-sm text-texto-suave">
                      Este ejemplar no tiene fotografía individual.
                    </p>
                  )}
                </div>
                <div>
                  <h3 id="titulo-ficha-instancia-prestamo" className="font-bold text-texto">
                    Ficha del ejemplar seleccionado
                  </h3>
                  <p className="mt-1 text-sm text-texto-suave">
                    {materialSeleccionado?.nombre || 'Material'} · Código de Material:{' '}
                    {materialSeleccionado?.codigo_material || materialSeleccionado?.codigo_inventario || 'No registrado'}
                  </p>
                  <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="font-semibold text-texto">Código de Ejemplar</dt>
                      <dd className="break-words text-texto-suave">{instanciaSeleccionada.codigo_ejemplar}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-texto">Estado</dt>
                      <dd className="text-texto-suave">
                        {instanciaSeleccionada.estado_display || instanciaSeleccionada.estado || 'No registrado'}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-texto">Número de serie</dt>
                      <dd className="break-words text-texto-suave">
                        {instanciaSeleccionada.numero_serie || 'No registrado'}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-texto">Color</dt>
                      <dd className="text-texto-suave">{instanciaSeleccionada.color || 'No registrado'}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-texto">Observaciones del ejemplar</dt>
                      <dd className="text-texto-suave">{instanciaSeleccionada.observaciones || 'No registrado'}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-texto">Ubicación</dt>
                      <dd className="text-texto-suave">{instanciaSeleccionada.ubicacion || 'No registrada'}</dd>
                    </div>
                  </dl>
                </div>
              </section>
            )}
            {errorInstancias && <ErrorAlerta mensaje={errorInstancias} />}
            {materialSeleccionado && !cargandoInstancias && !errorInstancias && instancias.length === 0 && (
              <EstadoVacio
                titulo="Sin instancias disponibles"
                mensaje="Este material no tiene ejemplares disponibles para prestar."
              />
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo
                etiqueta="Duración del préstamo"
                tipo="number"
                min="1"
                step="1"
                valor={formulario.dias}
                onCambio={(evento) => cambiarDuracion(evento.target.value)}
                error={errores.dias}
                ayuda={ayudaRangoDuracion(materialSeleccionado)}
                requerido
              />
              <Campo
                etiqueta="Unidad de tiempo"
                opciones={UNIDADES_TIEMPO_PRESTAMO}
                valor={formulario.unidadTiempo}
                onCambio={(evento) => cambiarUnidadTiempo(evento.target.value)}
              />
            </div>
            {fechaLimiteEstimada && (
              <p className="text-sm text-texto-suave">
                Fecha límite estimada:{' '}
                <strong className="text-texto">{fechaLegible(fechaLimiteEstimada)}</strong>
                <small className="block">La fecha confirmada por el servidor aparecerá al registrar.</small>
              </p>
            )}

            <fieldset className="grid gap-4 rounded-xl border border-borde p-4">
              <legend className="px-2 text-sm font-bold text-texto">Checklist del estado inicial</legend>

```

**Tool: bash**

**Input:**
```json
{
  "command": "sed -n '1,130p' backend/apps/prestamos/views.py && sed -n '1,80p' backend/apps/prestamos/urls.py && sed -n '220,330p' backend/apps/prestamos/views.py",
  "workdir": "/home/shiarowo/PERSONAL/Presticad"
}
```

**Output:**
```
from mimetypes import guess_type

from django.http import FileResponse, HttpResponseRedirect
from rest_framework import status
from rest_framework.generics import GenericAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.prestamos.constants import ESTADOS_PRESTAMO
from apps.prestamos.consultar_serializers import (
    PrestamoDevolucionDetalleSerializer,
    PrestamoHistorialDetalleSerializer,
    PrestamoConsultaSerializer,
    PrestamoHistorialSerializer,
    SugerenciaPrestatarioSerializer,
)
from apps.prestamos.models import Devolucion
from apps.prestamos.permissions import (
    EsGestorDeAlmacen,
    EsGestorAdministradorOPrestatarioPropio,
    EsGestorOAdministrador,
    EsPrestatarioAutenticado,
)
from apps.prestamos.serializers import (
    ActualizarDocumentoGarantiaSerializer,
    BusquedaPrestatarioSerializer,
    ConsultaReportesSerializer,
    DevolucionIngresoSerializer,
    DevolucionResultadoSerializer,
    FiltroHistorialPrestamosSerializer,
    PrestamoRegistroSerializer,
    RegistrarPrestamoSerializer,
    ReporteDevolucionSerializer,
    url_reporte_publica,
)
from apps.prestamos.services import (
    PrestamoError,
    actualizar_documento_garantia,
    buscar_prestatarios_por_dni,
    consultar_detalle_historial_prestamo,
    consultar_historial_prestamos,
    consultar_prestamo_para_devolucion,
    consultar_prestamos_usuario,
    consultar_reportes_devolucion,
    estimar_devolucion,
    obtener_documento_garantia,
    obtener_foto_checklist,
    registrar_devolucion,
    registrar_prestamo,
)


class RegistrarPrestamoView(APIView):
    """Registra la entrega de un material: POST /api/prestamos/."""

    permission_classes = [EsGestorDeAlmacen]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        serializer = RegistrarPrestamoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            prestamo = registrar_prestamo(
                **serializer.validated_data,
                registrado_por=request.usuario_autenticado,
            )
        except PrestamoError as error:
            return Response(
                {error.campo: [error.mensaje]},
                status=error.status_code,
            )

        return Response(
            PrestamoRegistroSerializer(prestamo).data,
            status=status.HTTP_201_CREATED,
        )


class BuscarPrestatariosView(APIView):
    """Sugiere prestatarios activos por DNI para entrega e historial."""

    permission_classes = [EsGestorOAdministrador]

    def get(self, request):
        prefijo = request.query_params.get("dni", "").strip()
        if not prefijo:
            return Response([])

        serializer = BusquedaPrestatarioSerializer(data={"dni": prefijo})
        serializer.is_valid(raise_exception=True)
        prestatarios = buscar_prestatarios_por_dni(serializer.validated_data["dni"])
        return Response(SugerenciaPrestatarioSerializer(prestatarios, many=True).data)


class MisPrestamosView(APIView):
    """Devuelve exclusivamente los préstamos del prestatario en sesión."""

    permission_classes = [EsPrestatarioAutenticado]

    def get(self, request):
        prestamos = consultar_prestamos_usuario(request.usuario_autenticado.id)
        return Response(PrestamoConsultaSerializer(prestamos, many=True).data)


class HistorialPrestamosPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 100


class HistorialPrestamosView(GenericAPIView):
    """Consulta paginada del historial global para administrador y gestor."""

    permission_classes = [EsGestorOAdministrador]
    serializer_class = PrestamoHistorialSerializer
    pagination_class = HistorialPrestamosPagination

    def get(self, request):
        dni = request.query_params.get("dni", "").strip()
        if dni:
            filtro = FiltroHistorialPrestamosSerializer(data={"dni": dni})
            filtro.is_valid(raise_exception=True)
            dni = filtro.validated_data["dni"]
        else:
            dni = None

        estado = request.query_params.get("estado")
from django.urls import path

from apps.prestamos.views import (
    DetalleHistorialPrestamoView,
    DetallePrestamoParaDevolucionView,
    BuscarPrestatariosView,
    DescargarDocumentoGarantiaView,
    DescargarFotoChecklistView,
    EstimarDevolucionView,
    HistorialPrestamosView,
    ListarReportesDevolucionView,
    MisPrestamosView,
    RegistrarDevolucionView,
    RegistrarPrestamoView,
    ReporteDevolucionView,
)

urlpatterns = [
    path("prestamos/", RegistrarPrestamoView.as_view(), name="registrar-prestamo"),
    path(
        "prestamos/prestatarios/",
        BuscarPrestatariosView.as_view(),
        name="buscar-prestatarios-prestamo",
    ),
    path("prestamos/historial/", HistorialPrestamosView.as_view(), name="historial-prestamos"),
    path(
        "prestamos/<int:prestamo_id>/historial/",
        DetalleHistorialPrestamoView.as_view(),
        name="detalle-historial-prestamo",
    ),
    path("prestamos/mis-prestamos/", MisPrestamosView.as_view(), name="mis-prestamos"),
    path(
        "prestamos/devoluciones/reportes/",
        ListarReportesDevolucionView.as_view(),
        name="reportes-devolucion",
    ),
    path(
        "prestamos/devoluciones/<int:devolucion_id>/reporte/",
        ReporteDevolucionView.as_view(),
        name="reporte-devolucion",
    ),
    path(
        "prestamos/<int:prestamo_id>/garantia/<str:tipo>/",
        DescargarDocumentoGarantiaView.as_view(),
        name="descargar-documento-garantia",
    ),
    path(
        "prestamos/<int:prestamo_id>/checklist/<str:fase>/<int:indice>/foto/",
        DescargarFotoChecklistView.as_view(),
        name="foto-checklist",
    ),
    path(
        "prestamos/<int:prestamo_id>/devolucion/estimar/",
        EstimarDevolucionView.as_view(),
        name="estimar-devolucion",
    ),
    path(
        "prestamos/<int:prestamo_id>/devolucion/",
        RegistrarDevolucionView.as_view(),
        name="registrar-devolucion",
    ),
    path(
        "prestamos/<int:prestamo_id>/",
        DetallePrestamoParaDevolucionView.as_view(),
        name="detalle-prestamo-devolucion",
    ),
]
            imagen, nombre = obtener_foto_checklist(prestamo_id, fase, indice)
        except PrestamoError as error:
            return _respuesta_error(error)

        # En producción (Cloudinary) imagen.url es una URL absoluta; redirigir.
        # En desarrollo (FileSystemStorage privado) url() lanza ValueError: abrir
        # el archivo directamente y servirlo mediante FileResponse.
        try:
            url = imagen.url
        except ValueError:
            url = None

        if url and url.startswith(("http://", "https://")):
            return HttpResponseRedirect(url)

        content_type = guess_type(nombre)[0] or "application/octet-stream"
        try:
            archivo = imagen.open("rb")
        except (FileNotFoundError, OSError):
            return Response(
                {"detail": "La foto del checklist no existe."},
                status=404,
            )
        respuesta = FileResponse(archivo, content_type=content_type)
        respuesta["Content-Disposition"] = f'inline; filename="{nombre}"'
        return respuesta


class DetalleHistorialPrestamoView(APIView):
    """Devuelve ficha técnica, ejemplar y checklist de una entrega histórica."""

    permission_classes = [EsGestorAdministradorOPrestatarioPropio]

    def get(self, request, prestamo_id):
        try:
            prestamo = consultar_detalle_historial_prestamo(prestamo_id)
        except PrestamoError as error:
            return _respuesta_error(error)
        return Response(PrestamoHistorialDetalleSerializer(prestamo).data)


def _respuesta_resultado(resultado, prestamo_id, devolucion=None, http_status=200):
    datos = {
        **resultado,
        "prestamo_id": prestamo_id,
    }
    if devolucion is not None:
        datos["devolucion_id"] = devolucion.id
        datos["reporte_url"] = url_reporte_publica(devolucion)
    return Response(
        DevolucionResultadoSerializer(datos).data,
        status=http_status,
    )


class DetallePrestamoParaDevolucionView(APIView):
    """GET /api/prestamos/{id}/ — datos para el formulario de devolución (HU11)."""

    permission_classes = [EsGestorDeAlmacen]

    def get(self, request, prestamo_id):
        try:
            prestamo = consultar_prestamo_para_devolucion(prestamo_id)
        except PrestamoError as error:
            return _respuesta_error(error)
        return Response(PrestamoDevolucionDetalleSerializer(prestamo).data)


class EstimarDevolucionView(APIView):
    """POST /api/prestamos/{id}/devolucion/estimar/ — resumen sin persistir (HU11)."""

    permission_classes = [EsGestorDeAlmacen]

    def post(self, request, prestamo_id):
        serializer = DevolucionIngresoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            resultado = estimar_devolucion(
                prestamo_id=prestamo_id,
                checklist_devolucion=serializer.validated_data["checklist"],
            )
        except PrestamoError as error:
            return _respuesta_error(error)

        return _respuesta_resultado(resultado, prestamo_id)


class RegistrarDevolucionView(APIView):
    """POST /api/prestamos/{id}/devolucion/ — registra y calcula sanciones (HU11)."""

    permission_classes = [EsGestorDeAlmacen]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request, prestamo_id):
        serializer = DevolucionIngresoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            devolucion = registrar_devolucion(
                prestamo_id=prestamo_id,
                checklist_devolucion=serializer.validated_data["checklist"],
                fotos_checklist=serializer.validated_data.get("fotos_checklist", []),
                realizado_por=request.usuario_autenticado,
            )
        except PrestamoError as error:
            return _respuesta_error(error)

        return _respuesta_resultado(
            devolucion.resultado,
            prestamo_id,

```

**Tool: bash**

**Input:**
```json
{
  "command": "grep -n 'def crear_usuario\\|def crear_material\\|def registrar_prestamo\\|class .*Prestamo.*Test\\|class .*Devolucion' backend/apps/prestamos/tests.py | head -80 && grep -n 'restringido\\|tier' backend/apps/prestamos/tests.py | head -60",
  "workdir": "/home/shiarowo/PERSONAL/Presticad"
}
```

**Output:**
```
81:def registrar_prestamo(**datos):
285:def crear_usuario(email, dni, rol="prestatario", **cambios):
302:def crear_material(**cambios):
320:class ModuloPrestamosTestCase(SimpleTestCase):
328:class RegistrarPrestamoServiceTestCase(TestCase):
672:class RegistrarPrestamoConcurrenciaTestCase(TransactionTestCase):
718:class ConsultarPrestamosServiceTestCase(TestCase):
772:class HistorialPrestamosServiceTestCase(TestCase):
833:class MisPrestamosAPITestCase(APITestCase):
924:class HistorialPrestamosAPITestCase(APITestCase):
1234:class RegistrarPrestamoAPITestCase(APITestCase):
1831:class DevolucionBaseTestCase(TestCase):
1885:class EstimarDevolucionServiceTestCase(DevolucionBaseTestCase):
1949:class RegistrarDevolucionServiceTestCase(DevolucionBaseTestCase):
2307:class ReporteDevolucionTestCase(DevolucionBaseTestCase):
2386:class DevolucionAPITestCase(DevolucionBaseTestCase):
2666:class ReportesDevolucionAPITestCase(DevolucionBaseTestCase):
310:    if "tiempo_maximo_prestamo" not in cambios and "tier_minimo_requerido" not in cambios:
396:            tier_minimo_requerido="avanzado",
404:            reputacion_tier="avanzado",
560:    def test_rechaza_tier_insuficiente_sin_cambiar_inventario(self):
563:            tier_minimo_requerido="avanzado",
1877:    def _marcar_prestatario(self, puntaje, tier):
1879:        self.prestatario.reputacion_tier = tier
1881:            update_fields=["reputacion_puntaje", "reputacion_tier", "updated_at"],
2195:        self._marcar_prestatario(-480, "restringido")
2214:    def test_recalcula_el_tier_al_atravesar_un_rango(self):
2226:        self.assertEqual(devolucion.resultado["tier_antes"], "avanzado")
2227:        self.assertEqual(devolucion.resultado["tier_despues"], "estandar")
2229:        self.assertEqual(self.prestatario.reputacion_tier, "estandar")

```

**Tool: bash**

**Input:**
```json
{
  "command": "cat frontend/src/prestamos/solicitudPrestamo.js && sed -n '1,260p' frontend/src/validacionesPrestamo.js",
  "workdir": "/home/shiarowo/PERSONAL/Presticad"
}
```

**Output:**
```
import { esMaterialAltoValor } from '../constantes/catalogo'

export function construirSolicitudPrestamo({
  dni,
  material,
  instanciaId,
  minutos,
  dias,
  checklist,
  fotosChecklist = checklist.map((item) => item.foto),
  documentoIdentidad,
  compromisoResponsabilidad,
}) {
  const solicitud = new FormData()
  solicitud.append('dni_prestatario', dni.trim())
  solicitud.append('material_id', material.id)
  solicitud.append('instancia_id', instanciaId)
  if (minutos !== undefined && minutos !== null && minutos !== '') {
    solicitud.append('tiempo_prestamo_minutos', String(Number(minutos)))
  } else {
    solicitud.append('tiempo_prestamo_dias', String(Number(dias)))
  }
  solicitud.append('checklist_inicial', JSON.stringify(checklist.map((item) => ({
    elemento: item.elemento.trim(),
    observacion: item.observacion.trim(),
  }))))
  fotosChecklist.forEach((foto, indice) => {
    if (foto) solicitud.append(`foto_checklist_${indice}`, foto)
  })

  const materialAltoValor = esMaterialAltoValor(material)
  if (materialAltoValor && documentoIdentidad) {
    solicitud.append('documento_identidad', documentoIdentidad)
  }
  if (materialAltoValor && compromisoResponsabilidad) {
    solicitud.append('compromiso_responsabilidad', compromisoResponsabilidad)
  }

  return solicitud
}
import {
  TAMANO_MAXIMO_GARANTIA_BYTES,
  TAMANO_MAXIMO_GARANTIA_MB,
} from './constantes/garantia'
import {
  DURACION_MAXIMA_PRESTAMO_MINUTOS,
  DURACION_MINIMA_PRESTAMO_MINUTOS,
  EXTENSIONES_FOTO_CHECKLIST,
  TAMANO_MAXIMO_FOTO_CHECKLIST_MB,
  TAMANO_MAXIMO_FOTO_CHECKLIST_BYTES,
  TIEMPO_MAXIMO_DEFAULT_POR_TIER,
  TIPOS_FOTO_CHECKLIST,
  convertirTiempoAMinutos,
  formatearDuracionMinutos,
} from './constantes/checklistPrestamo'
import { esMaterialAltoValor } from './constantes/catalogo'

export function obtenerMinutosMaximosMaterial(material) {
  if (material?.tiempo_maximo_prestamo) {
    return Number(material.tiempo_maximo_prestamo)
  }
  if (material?.tier_minimo_requerido) {
    const porTier =
      TIEMPO_MAXIMO_DEFAULT_POR_TIER[material.tier_minimo_requerido] ||
      TIEMPO_MAXIMO_DEFAULT_POR_TIER.estandar
    return porTier.minutos
  }
  return DURACION_MAXIMA_PRESTAMO_MINUTOS
}

export function mensajeRangoDuracion(material = null) {
  const maximoMinutos = obtenerMinutosMaximosMaterial(material)
  return `La duración debe ser de al menos ${DURACION_MINIMA_PRESTAMO_MINUTOS} minutos y máximo ${formatearDuracionMinutos(maximoMinutos)}.`
}

export function ayudaRangoDuracion(material = null) {
  const maximoMinutos = obtenerMinutosMaximosMaterial(material)
  return `Mínimo ${DURACION_MINIMA_PRESTAMO_MINUTOS} minutos · Máximo para este material: ${formatearDuracionMinutos(maximoMinutos)} · Incluye 30 min de tiempo de gracia en la devolución.`
}

export function validarFormularioPrestamo({
  dni,
  material,
  instanciaId,
  duracionValor,
  duracionUnidad,
  dias,
  checklist,
  documentoIdentidad,
  compromisoResponsabilidad,
}) {
  const errores = {}
  const erroresFotos = {}
  const dniLimpio = String(dni ?? '').trim()
  const valorTiempo = duracionValor !== undefined ? duracionValor : dias
  const unidadTiempo = duracionUnidad || (duracionValor !== undefined ? 'horas' : 'dias')
  const cantidad = Number(valorTiempo)
  const minutos = convertirTiempoAMinutos(valorTiempo, unidadTiempo)
  const maximoMinutos = obtenerMinutosMaximosMaterial(material)

  if (!/^\d{8}$/.test(dniLimpio)) {
    errores.dni = 'El DNI debe tener exactamente 8 dígitos.'
  }
  if (!material) {
    errores.material = 'Selecciona un material disponible.'
  }
  if (!instanciaId) {
    errores.instancia_id = 'Selecciona una instancia disponible.'
  }
  if (
    valorTiempo === ''
    || valorTiempo === null
    || valorTiempo === undefined
    || !Number.isInteger(cantidad)
    || cantidad <= 0
    || !Number.isInteger(minutos)
  ) {
    errores.dias = mensajeRangoDuracion(material)
  } else if (minutos < DURACION_MINIMA_PRESTAMO_MINUTOS) {
    errores.dias = `El tiempo mínimo de préstamo es de ${DURACION_MINIMA_PRESTAMO_MINUTOS} minutos.`
  } else if (minutos > maximoMinutos) {
    errores.dias = `El tiempo solicitado supera el máximo permitido para este material (${formatearDuracionMinutos(maximoMinutos)}).`
  }
  if (!Array.isArray(checklist) || checklist.length === 0) {
    errores.checklist = 'Registra al menos un elemento del material.'
  } else {
    if (checklist.some((item) => !String(item.elemento ?? '').trim())) {
      errores.checklist = 'Completa el elemento en cada fila del checklist.'
    }
    checklist.forEach((item, indice) => {
      const errorFoto = validarFoto(item.foto)
      if (errorFoto) erroresFotos[indice] = errorFoto || 'Adjunta una foto para este elemento.'
    })
    if (Object.keys(erroresFotos).length > 0) errores.fotosChecklist = erroresFotos
  }
  if (esMaterialAltoValor(material)) {
    const errorDocumentoIdentidad = validarArchivoGarantia(
      documentoIdentidad,
      'Adjunta el documento de identidad en PDF.',
    )
    const errorCompromiso = validarArchivoGarantia(
      compromisoResponsabilidad,
      'Adjunta el compromiso de responsabilidad en PDF.',
    )
    if (errorDocumentoIdentidad) errores.documento_identidad = errorDocumentoIdentidad
    if (errorCompromiso) errores.compromiso_responsabilidad = errorCompromiso
  }

  return errores
}

export function validarFoto(archivo) {
  if (!archivo) return 'Adjunta una foto para este elemento.'
  const nombre = String(archivo.name || '').toLowerCase()
  const extensionValida = EXTENSIONES_FOTO_CHECKLIST.some((extension) => nombre.endsWith(extension))
  if (!extensionValida) return 'La foto debe tener extensión JPG, PNG o WEBP.'
  if (!TIPOS_FOTO_CHECKLIST.includes(archivo.type)) {
    return 'La foto debe ser de tipo JPG, PNG o WEBP.'
  }
  if (archivo.size > TAMANO_MAXIMO_FOTO_CHECKLIST_BYTES) {
    return `La foto no debe superar ${TAMANO_MAXIMO_FOTO_CHECKLIST_MB} MB.`
  }
  return ''
}

export function evaluarCambioDuracion(duracion, duracionAnterior, unidad = 'horas', material = null) {
  if (duracion === '') return { valor: '', error: '' }
  const cantidad = Number(duracion)
  const minutos = convertirTiempoAMinutos(duracion, unidad)
  const maximoMinutos = obtenerMinutosMaximosMaterial(material)
  if (!Number.isFinite(cantidad) || !Number.isInteger(cantidad) || cantidad <= 0) {
    return {
      valor: String(duracionAnterior),
      error: mensajeRangoDuracion(material),
    }
  }
  if (minutos < DURACION_MINIMA_PRESTAMO_MINUTOS) {
    return {
      valor: String(duracionAnterior),
      error: `El tiempo mínimo de préstamo es de ${DURACION_MINIMA_PRESTAMO_MINUTOS} minutos.`,
    }
  }
  if (minutos > maximoMinutos) {
    return {
      valor: String(duracionAnterior),
      error: `El tiempo solicitado supera el máximo permitido para este material (${formatearDuracionMinutos(maximoMinutos)}).`,
    }
  }
  return { valor: duracion, error: '' }
}

export function obtenerElementosSinFoto(checklist) {
  if (!Array.isArray(checklist)) return []
  return checklist
    .map((item, indice) => ({ indice, elemento: String(item?.elemento ?? '').trim() || `Elemento ${indice + 1}` }))
    .filter(({ indice }) => !checklist[indice]?.foto)
}

export function mapearErroresFotoChecklist(erroresBackend) {
  if (!erroresBackend || typeof erroresBackend !== 'object' || Array.isArray(erroresBackend)) return {}
  return Object.fromEntries(
    Object.entries(erroresBackend).map(([indice, mensajes]) => [
      indice,
      Array.isArray(mensajes) ? mensajes.join(' ') : String(mensajes),
    ]),
  )
}

function validarArchivoGarantia(archivo, mensajeRequerido) {
  if (!archivo) return mensajeRequerido
  if (!String(archivo.name || '').toLowerCase().endsWith('.pdf')) {
    return 'El archivo debe tener extensión .pdf.'
  }
  if (archivo.type !== 'application/pdf') {
    return 'El archivo debe ser de tipo PDF (application/pdf).'
  }
  if (archivo.size > TAMANO_MAXIMO_GARANTIA_BYTES) {
    return `El archivo no debe superar ${TAMANO_MAXIMO_GARANTIA_MB} MB.`
  }
  return ''
}

export function calcularFechaLimiteEstimada(duracionValor, unidad = 'horas', material = null) {
  const cantidad = Number(duracionValor)
  const minutos = convertirTiempoAMinutos(duracionValor, unidad)
  const maximoMinutos = obtenerMinutosMaximosMaterial(material)
  if (
    duracionValor === ''
    || !Number.isInteger(cantidad)
    || cantidad <= 0
    || !Number.isInteger(minutos)
    || minutos < DURACION_MINIMA_PRESTAMO_MINUTOS
    || minutos > maximoMinutos
  ) return null
  return new Date(Date.now() + minutos * 60 * 1000)
}

```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 2.2s)

_Thinking:_

Need more frontend rest, especially documents/gating.

**Tool: bash**

**Input:**
```json
{
  "command": "sed -n '620,980p' frontend/src/pages/RegistrarPrestamo.jsx",
  "workdir": "/home/shiarowo/PERSONAL/Presticad"
}
```

**Output:**
```
              <legend className="px-2 text-sm font-bold text-texto">Checklist del estado inicial</legend>
              <p className="text-xs text-texto-suave">
                Cada elemento debe tener una foto JPG, PNG o WEBP. Tamaño máximo: {TAMANO_MAXIMO_FOTO_CHECKLIST_MB} MB.
              </p>
              {formulario.checklist.map((item, indice) => (
                <div key={`checklist-${indice}`} className="relative grid gap-4 rounded-lg border border-borde p-4 sm:grid-cols-2">
                  <Campo
                    etiqueta="Elemento"
                    valor={item.elemento}
                    onCambio={(evento) => actualizarChecklist(indice, 'elemento', evento.target.value)}
                    aria-invalid={Boolean(errores.checklist && !item.elemento.trim())}
                    maxLength={100}
                    requerido
                  />
                  <Campo
                    etiqueta="Observación del checklist (opcional)"
                    valor={item.observacion}
                    onCambio={(evento) => actualizarChecklist(indice, 'observacion', evento.target.value)}
                    maxLength={500}
                  />
                  <div className="grid gap-2 sm:col-span-2">
                    <label className="text-sm font-semibold text-texto" htmlFor={`foto-checklist-${indice}`}>
                      Foto del elemento <span aria-hidden="true" className="text-error">*</span>
                    </label>
                    <input
                      ref={(elemento) => { referenciasFotos.current[indice] = elemento }}
                      id={`foto-checklist-${indice}`}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                      aria-invalid={Boolean(errores.fotosChecklist?.[indice])}
                      aria-describedby={errores.fotosChecklist?.[indice]
                        ? `foto-checklist-${indice}-ayuda foto-checklist-${indice}-error`
                        : `foto-checklist-${indice}-ayuda`}
                      className="block w-full text-sm text-texto file:mr-3 file:rounded-lg file:border-0 file:bg-superficie-alta file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-texto"
                      onChange={(evento) => cambiarFotoChecklist(indice, evento.target.files?.[0] || null)}
                    />
                    <p id={`foto-checklist-${indice}-ayuda`} className="text-xs text-texto-suave">
                      Formatos permitidos: JPG, PNG y WEBP.
                    </p>
                    {errores.fotosChecklist?.[indice] && (
                      <p id={`foto-checklist-${indice}-error`} className="text-xs text-error" role="alert">
                        {errores.fotosChecklist[indice]}
                      </p>
                    )}
                    {item.fotoPrevia && (
                      <div className="flex flex-wrap items-start gap-3">
                        <img
                          src={item.fotoPrevia}
                          alt={`Vista previa de ${item.elemento || `elemento ${indice + 1}`}`}
                          className="h-28 w-28 rounded-lg border border-borde bg-superficie object-contain p-1"
                        />
                        <Boton
                          variante="secundario"
                          tamanio="pequeno"
                          tipo="button"
                          onClick={() => cambiarFotoChecklist(indice, null)}
                        >
                          Quitar foto
                        </Boton>
                      </div>
                    )}
                  </div>
                  {formulario.checklist.length > 1 && (
                    <Boton
                      variante="secundario"
                      tamanio="pequeno"
                      tipo="button"
                      className="sm:absolute sm:right-3 sm:top-3"
                      onClick={() => quitarElementoChecklist(indice)}
                    >
                      Quitar elemento
                    </Boton>
                  )}
                </div>
              ))}
              {errores.checklist && <ErrorAlerta mensaje={errores.checklist} />}
              <Boton variante="secundario" tipo="button" onClick={agregarElementoChecklist}>
                Agregar elemento
              </Boton>
            </fieldset>

            {esMaterialAltoValor(materialSeleccionado) && (
              <fieldset
                key={formulario.materialId}
                className="grid gap-3 rounded-xl border border-acento-300 bg-acento-50/50 p-4 dark:border-acento-700/60 dark:bg-acento-500/10"
              >
                <legend className="px-2 text-sm font-bold text-acento-800 dark:text-acento-300">
                  Garantía obligatoria para material de alto valor
                </legend>
                <p className="text-xs text-texto-suave">
                  Adjunta ambos documentos en PDF. Se almacenarán de forma privada y solo gestión
                  autorizada podrá descargarlos. Tamaño máximo: {TAMANO_MAXIMO_GARANTIA_MB} MB.
                </p>
                <SubidaDocumentoPDF
                  etiqueta="Documento de identidad (PDF)"
                  archivo={formulario.documentoIdentidad}
                  onCambio={(archivo) => actualizar('documentoIdentidad', archivo)}
                  error={errores.documento_identidad}
                  ayuda={`Solo se acepta application/pdf, hasta ${TAMANO_MAXIMO_GARANTIA_MB} MB.`}
                />
                <SubidaDocumentoPDF
                  etiqueta="Carta de responsabilidad (PDF)"
                  archivo={formulario.compromisoResponsabilidad}
                  onCambio={(archivo) => actualizar('compromisoResponsabilidad', archivo)}
                  error={errores.compromiso_responsabilidad}
                  ayuda={`Solo se acepta application/pdf, hasta ${TAMANO_MAXIMO_GARANTIA_MB} MB.`}
                />
              </fieldset>
            )}

            <div className="flex flex-wrap gap-2">
              <Boton
                tipo="submit"
                cargando={guardando}
                deshabilitado={bloqueadoPorElegibilidad || Boolean(
                  esMaterialAltoValor(materialSeleccionado)
                  && (!formulario.documentoIdentidad || !formulario.compromisoResponsabilidad)
                )}
              >
                Confirmar entrega
              </Boton>
              <Boton
                variante="secundario"
                tipo="button"
                deshabilitado={guardando}
                onClick={cargarMateriales}
              >
                Actualizar disponibilidad
              </Boton>
            </div>
          </form>
        </Tarjeta>
      )}
      {elementosSinFoto && (
        <AdvertenciaModal
          titulo="Faltan fotos del checklist"
          descripcion="Adjunta una foto para cada uno de estos elementos antes de continuar:"
          mensajes={elementosSinFoto.map(({ elemento }) => elemento)}
          onCerrar={cerrarAdvertenciaFotos}
        />
      )}
    </section>
  )
}

export default RegistrarPrestamo

```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 6.6s)

_Thinking:_

Need implement branch1. Need maybe choose simpler UI: Add checkbox/toggle "Préstamo excepcional" visible only when user restricted and material tier higher. It switches API to /prestamos/excepcion/. Add banner and force guarantee docs. Need validation allow documents for exception. Modify validaciones function signature `esExcepcion=false` and `requiereGarantia = esMaterialAltoValor(material) || esExcepcion`. Also request builder takes `esExcepcion` and appends docs if required. Could create separate `construirSolicitudPrestamoExcepcional`? Simpler add optional `esExcepcion` param, docs condition `materialAltoValor || esExcepcion`. Then `api.post(esExcepcion ? '/prestamos/excepcion/' : '/prestamos/')`. Need deter regular users? UI shows checkbox only if perfil is restricted AND material tier not accessible. Backend enforces anyway. Need perhaps auto-set? If user selects material inaccessible, existing UI blocks. We should show an "Excepción" option to unblock. Need derive `puedeSolicitarExcepcion = perfilVerificadoActual?.rol === 'prestatario' && perfilVerificadoActual?.estado === 'activo' && perfilVerificadoActual.reputacion_tier === 'restringido' && materialSeleccionado && !tierCumple`. Then `bloqueadoPorElegibilidad` excludes if esExcepcion and may. Form state add `esExcepcion: false`. When material changes reset false. When checkbox toggled true, docs required. We can update validation. Need if toggling off and material not accessible block.

Potential issue admin/gestor user searching restricted profile; okay.

Need display requires docs even if not high value. Use `requiereGarantia = esMaterialAltoValor(materialSeleccionado) || formulario.esExcepcion`.

Need modify `actualizar` mapping for esExcepcion maybe no field. When material change reset `esExcepcion: false` in form. Current update for material resets instancia/docs. Extend.

Need update card message: if may exception, show button/toggle. Better actual checkbox with label "Registrar como préstamo excepcional" and explanation. Could use native checkbox. Existing code no checkbox UI? Use simple label. Need only show when `puedeSolicitarExcepcion`. Add helper info.

Need badge: `estadoPrestamo.js` presentar state with optional `esExcepcion`? Currently `presentarEstadoPrestamo(estado)` returns `{texto, clase}`. Need add optional param `esExcepcion=false`: if active text `Activo - Excepción`, class maybe `prestamo-estado--excepcion`? User plan said badge. But components use `BadgeEstado` not `presentarEstadoPrestamo`? Search.

**Tool: bash**

**Input:**
```json
{
  "command": "grep -RIn 'presentarEstadoPrestamo\\|obtenerEstadoVisible' frontend/src --exclude='*.test.js' && cat frontend/src/prestamos/estadoPrestamo.js && sed -n '1,260p' frontend/src/components/prestamos/ListaPrestamos.jsx",
  "workdir": "/home/shiarowo/PERSONAL/Presticad"
}
```

**Output:**
```
frontend/src/prestamos/estadoPrestamo.js:13:export function obtenerEstadoVisible(prestamo, ahora = new Date()) {
frontend/src/prestamos/estadoPrestamo.js:22:export function presentarEstadoPrestamo(estado) {
frontend/src/prestamos/estadoPrestamo.js:33:      estado_visible: obtenerEstadoVisible(prestamo, ahora),
frontend/src/prestamos/filtroPrestamos.js:1:import { obtenerEstadoVisible } from './estadoPrestamo'
frontend/src/prestamos/filtroPrestamos.js:7:    const estadoVisible = prestamo.estado_visible ?? obtenerEstadoVisible(prestamo, ahora)
const PRESENTACION_ESTADOS = {
  activo: { texto: 'Activo', clase: 'prestamo-estado--activo' },
  reservado: { texto: 'Reservado', clase: 'prestamo-estado--reservado' },
  vencido: { texto: 'Vencido', clase: 'prestamo-estado--vencido' },
  devuelto: { texto: 'Devuelto', clase: 'prestamo-estado--devuelto' },
}

function fechaComoNumero(fecha) {
  const valor = new Date(fecha).getTime()
  return Number.isNaN(valor) ? null : valor
}

export function obtenerEstadoVisible(prestamo, ahora = new Date()) {
  if (prestamo.estado !== 'activo') return prestamo.estado

  const fechaLimite = fechaComoNumero(prestamo.fecha_limite)
  if (fechaLimite === null || fechaLimite >= ahora.getTime()) return prestamo.estado

  return 'vencido'
}

export function presentarEstadoPrestamo(estado) {
  return PRESENTACION_ESTADOS[estado] || {
    texto: 'Estado desconocido',
    clase: 'prestamo-estado--desconocido',
  }
}

export function ordenarPrestamos(prestamos, ahora = new Date()) {
  return prestamos
    .map((prestamo) => ({
      ...prestamo,
      estado_visible: obtenerEstadoVisible(prestamo, ahora),
    }))
    .sort((a, b) => {
      const aVencido = a.estado_visible === 'vencido'
      const bVencido = b.estado_visible === 'vencido'
      if (aVencido !== bVencido) return aVencido ? -1 : 1

      if (aVencido) {
        const fechaLimiteA = fechaComoNumero(a.fecha_limite) ?? Number.POSITIVE_INFINITY
        const fechaLimiteB = fechaComoNumero(b.fecha_limite) ?? Number.POSITIVE_INFINITY
        if (fechaLimiteA !== fechaLimiteB) return fechaLimiteA - fechaLimiteB
      } else {
        const fechaEntregaA = fechaComoNumero(a.fecha_entrega) ?? 0
        const fechaEntregaB = fechaComoNumero(b.fecha_entrega) ?? 0
        if (fechaEntregaA !== fechaEntregaB) return fechaEntregaB - fechaEntregaA
      }

      return Number(b.id) - Number(a.id)
    })
}
import { useState } from 'react'

import { ordenarPrestamos } from '../../prestamos/estadoPrestamo'
import { filtrarPrestamos } from '../../prestamos/filtroPrestamos'
import BadgeEstado from '../ui/BadgeEstado'
import EstadoVacio from '../ui/EstadoVacio'
import DetallePrestamo from './DetallePrestamo'
import FiltroPrestamos from './FiltroPrestamos'

export default function ListaPrestamos({ prestamos, onSeleccionar }) {
  const [filtro, setFiltro] = useState('todos')
  const [seleccionado, setSeleccionado] = useState(null)
  const ordenados = ordenarPrestamos(prestamos)
  const visibles = filtrarPrestamos(ordenados, filtro)

  if (seleccionado) {
    return (
      <DetallePrestamo
        onVolver={() => setSeleccionado(null)}
        prestamo={seleccionado}
      />
    )
  }

  return (
    <section aria-label="Mis préstamos">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h3 className="text-lg font-bold text-texto">Mis préstamos</h3>
        <FiltroPrestamos estado={filtro} onCambiar={setFiltro} />
      </div>

      {visibles.length === 0 ? (
        <div className="mt-4">
          <EstadoVacio
            titulo={ordenados.length === 0 ? 'Aún no tienes préstamos' : 'Sin préstamos con este estado'}
            mensaje={
              ordenados.length === 0
                ? 'Tus préstamos aparecerán aquí cuando el gestor registre una entrega.'
                : 'Prueba con otro filtro de estado.'
            }
          />
        </div>
      ) : (
        <ul className="mt-4 grid gap-3">
          {visibles.map((prestamo) => (
            <li key={prestamo.id}>
              <button
                type="button"
                className="w-full rounded-xl border border-borde bg-white p-4 text-left transition-colors hover:border-acento-400 hover:bg-superficie-alta dark:bg-superficie"
                onClick={() => {
                  setSeleccionado(prestamo)
                  onSeleccionar?.(prestamo)
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-texto">{prestamo.material_nombre}</span>
                  <BadgeEstado estado={prestamo.estado_visible} />
                </div>
                <p className="mt-1 text-sm text-texto-suave">
                  Código de Material: {prestamo.material_codigo}
                  {prestamo.codigo_ejemplar && <> · Código de Ejemplar: {prestamo.codigo_ejemplar}</>}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

```

**Tool: bash**

**Input:**
```json
{
  "command": "sed -n '1,280p' frontend/src/components/prestamos/DetallePrestamo.jsx",
  "workdir": "/home/shiarowo/PERSONAL/Presticad"
}
```

**Output:**
```
import { useEffect, useState } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, RotateCcw, Trash2, Upload } from 'lucide-react'

import { api, ErrorApi } from '../../api/client'
import { ETIQUETAS_ESTADO, esMaterialAltoValor } from '../../constantes/catalogo'
import { formatearDuracionMinutos } from '../../constantes/checklistPrestamo'
import BadgeEstado from '../ui/BadgeEstado'
import Boton from '../ui/Boton'
import ErrorAlerta from '../ui/ErrorAlerta'
import Skeleton from '../ui/Skeleton'
import Tarjeta from '../ui/Tarjeta'

function mostrarFecha(fecha) {
  const valor = new Date(fecha)
  if (Number.isNaN(valor.getTime())) return fecha

  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(valor)
}

function CampoDetalle({ etiqueta, children }) {
  return (
    <div className="rounded-xl border border-borde bg-superficie p-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-texto-suave">
        {etiqueta}
      </dt>
      <dd className="mt-1 break-words text-sm font-medium text-texto">{children}</dd>
    </div>
  )
}

const DOCUMENTOS_GARANTIA = [
  {
    tipo: 'documento-identidad',
    campo: 'documento_identidad_disponible',
    etiqueta: 'Documento de identidad',
    nombreArchivo: 'documento_identidad',
  },
  {
    tipo: 'compromiso',
    campo: 'compromiso_responsabilidad_disponible',
    etiqueta: 'Compromiso de responsabilidad',
    nombreArchivo: 'compromiso_responsabilidad',
  },
]

function mensajeError(error, accion) {
  if (error instanceof ErrorApi && error.datos) {
    if (typeof error.datos.detail === 'string') return error.datos.detail
    const mensaje = Object.values(error.datos).flat()[0]
    if (mensaje) return String(mensaje)
  }
  return `No se pudo ${accion} el documento. Intenta nuevamente.`
}

export default function DetallePrestamo({
  prestamo,
  onVolver,
  etiquetaVolver = 'Volver a mis préstamos',
  onDevolucion = null,
  puedeEditarGarantia = false,
  onAnterior = null,
  onSiguiente = null,
  hayAnterior = false,
  haySiguiente = false,
}) {
  const [detalle, setDetalle] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [intento, setIntento] = useState(0)
  const [archivos, setArchivos] = useState({})
  const [accion, setAccion] = useState('')
  const [error, setError] = useState('')
  const [errorArchivos, setErrorArchivos] = useState({})

  useEffect(() => {
    let activa = true
    setCargando(true)
    setDetalle(null)
    setError('')
    setArchivos({})
    setErrorArchivos({})

    api.get(`/prestamos/${prestamo.id}/historial/`)
      .then((datos) => {
        if (activa) setDetalle(datos)
      })
      .catch(() => {
        if (activa) setError('No se pudo cargar el detalle completo del préstamo.')
      })
      .finally(() => {
        if (activa) setCargando(false)
      })

    return () => {
      activa = false
    }
  }, [prestamo.id, intento])

  async function gestionarDocumento(documento, eliminar = false) {
    const archivo = archivos[documento.nombreArchivo]
    if (!eliminar && !archivo) {
      setErrorArchivos((actual) => ({
        ...actual,
        [documento.nombreArchivo]: 'Selecciona un archivo PDF para reemplazar el documento.',
      }))
      return
    }
    if (eliminar && !window.confirm(
      `¿Eliminar ${documento.etiqueta.toLowerCase()}? Debe quedar al menos un PDF de garantía.`,
    )) return

    setAccion(documento.tipo)
    setError('')
    setErrorArchivos((actual) => ({ ...actual, [documento.nombreArchivo]: '' }))
    try {
      const formulario = new FormData()
      if (eliminar) formulario.append('eliminar', 'true')
      else formulario.append('archivo', archivo)
      await api.patch(`/prestamos/${prestamo.id}/garantia/${documento.tipo}/`, formulario)
      setArchivos((actual) => ({ ...actual, [documento.nombreArchivo]: null }))
      setIntento((actual) => actual + 1)
    } catch (errorApi) {
      setErrorArchivos((actual) => ({
        ...actual,
        [documento.nombreArchivo]: mensajeError(errorApi, eliminar ? 'eliminar' : 'reemplazar'),
      }))
    } finally {
      setAccion('')
    }
  }

  const estado = detalle?.estado ?? prestamo.estado_visible ?? prestamo.estado
  const material = detalle?.material
  const instancia = detalle?.instancia
  const documentos = detalle?.documentos_garantia
  const totalDocumentos = DOCUMENTOS_GARANTIA.filter((documento) => (
    documentos?.[documento.campo]
  )).length

  return (
    <Tarjeta className="p-6" aria-labelledby="prestamo-detalle-titulo">
      <Boton
        variante="fantasma"
        tamanio="pequeno"
        tipo="button"
        icono={ArrowLeft}
        onClick={onVolver}
      >
        {etiquetaVolver}
      </Boton>
      {(onAnterior || onSiguiente) && (
        <nav className="mt-3 flex flex-wrap gap-2" aria-label="Navegar entre préstamos">
          <Boton
            variante="secundario"
            tamanio="pequeno"
            tipo="button"
            icono={ChevronLeft}
            deshabilitado={!hayAnterior}
            onClick={onAnterior}
          >
            Préstamo anterior
          </Boton>
          <Boton
            variante="secundario"
            tamanio="pequeno"
            tipo="button"
            icono={ChevronRight}
            deshabilitado={!haySiguiente}
            onClick={onSiguiente}
          >
            Préstamo siguiente
          </Boton>
        </nav>
      )}
      <h3 id="prestamo-detalle-titulo" className="mt-4 text-lg font-bold text-texto">
        Detalle del préstamo
      </h3>

      {cargando && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2" role="status" aria-live="polite">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
          <p className="text-sm text-texto-suave">Cargando ficha e historial del ejemplar…</p>
        </div>
      )}
      {error && (
        <div className="mt-4 grid gap-3">
          <ErrorAlerta mensaje={error} />
          <Boton
            variante="secundario"
            tipo="button"
            className="w-fit"
            onClick={() => setIntento((actual) => actual + 1)}
          >
            Reintentar
          </Boton>
        </div>
      )}

      {!cargando && detalle && (
        <>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {detalle.prestatario_nombre && (
              <CampoDetalle etiqueta="Prestatario">
                {detalle.prestatario_nombre} · DNI {detalle.prestatario_dni}
              </CampoDetalle>
            )}
            <CampoDetalle etiqueta="Fecha de entrega">{mostrarFecha(detalle.fecha_entrega)}</CampoDetalle>
            <CampoDetalle etiqueta="Fecha límite">{mostrarFecha(detalle.fecha_limite)}</CampoDetalle>
            <CampoDetalle etiqueta="Duración">
              {detalle.tiempo_prestamo_minutos
                ? formatearDuracionMinutos(detalle.tiempo_prestamo_minutos)
                : `${detalle.tiempo_prestamo_dias} días`}
            </CampoDetalle>
            <CampoDetalle etiqueta="Estado"><BadgeEstado estado={estado} /></CampoDetalle>
          </dl>

          <section className="mt-6 rounded-xl border border-borde p-4" aria-labelledby="titulo-ficha-prestamo">
            <h4 id="titulo-ficha-prestamo" className="font-bold text-texto">Ficha del material</h4>
            {material?.foto && (
              <img
                src={material.foto}
                alt={`Foto de ${material.nombre}`}
                className="mt-3 h-44 w-44 rounded-lg border border-borde object-cover"
              />
            )}
            <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <CampoDetalle etiqueta="Material">{material?.nombre || prestamo.material_nombre}</CampoDetalle>
              <CampoDetalle etiqueta="Código de Material">
                {material?.codigo_material || material?.codigo_inventario || prestamo.material_codigo}
              </CampoDetalle>
              <CampoDetalle etiqueta="Descripción">{material?.descripcion || 'Sin descripción'}</CampoDetalle>
              <CampoDetalle etiqueta="Tipo">{material?.tipo || 'No especificado'}</CampoDetalle>
              <CampoDetalle etiqueta="Marca y modelo">
                {[material?.marca, material?.modelo].filter(Boolean).join(' · ') || 'No especificados'}
              </CampoDetalle>
              <CampoDetalle etiqueta="Número de serie general">
                {material?.numero_serie || 'No registrado'}
              </CampoDetalle>
              <CampoDetalle etiqueta="Color general">{material?.color || 'No registrado'}</CampoDetalle>
              <CampoDetalle etiqueta="Estado">
                {ETIQUETAS_ESTADO[material?.estado] || material?.estado || 'No registrado'}
              </CampoDetalle>
              <CampoDetalle etiqueta="Alto valor">
                {esMaterialAltoValor(material) ? 'Sí' : 'No'}
              </CampoDetalle>
              <CampoDetalle etiqueta="Tier mínimo">{material?.tier_minimo_requerido}</CampoDetalle>
              {material?.tiempo_maximo_prestamo && (
                <CampoDetalle etiqueta="Tiempo máximo del material">
                  {formatearDuracionMinutos(material.tiempo_maximo_prestamo)}
                </CampoDetalle>
              )}
              <CampoDetalle etiqueta="Bonificación por entrega a tiempo">
                {material?.bonificacion_tiempo} puntos
              </CampoDetalle>
              <CampoDetalle etiqueta="Deducción por tardanza">
                {material?.deduccion_tardanza} puntos por día
              </CampoDetalle>
              <CampoDetalle etiqueta="Deducción por daño parcial">
                {material?.deduccion_dano_parcial} puntos
              </CampoDetalle>
              <CampoDetalle etiqueta="Deducción por daño total">
                {material?.deduccion_dano_total} puntos
              </CampoDetalle>
              <CampoDetalle etiqueta="Costos de reparación y reposición">
                {material?.costo_reparacion ?? 'No definido'} / {material?.costo_reposicion ?? 'No definido'}
              </CampoDetalle>
            </dl>
          </section>

          <section className="mt-6 rounded-xl border border-borde p-4" aria-labelledby="titulo-instancia-prestamo">
            <h4 id="titulo-instancia-prestamo" className="font-bold text-texto">
              Ejemplar entregado
            </h4>
            {instancia ? (
              <>
                {instancia.foto && (
                  <img

```

**Tool: bash**

**Input:**
```json
{
  "command": "sed -n '280,360p' backend/apps/prestamos/tests.py && sed -n '328,470p' backend/apps/prestamos/tests.py && sed -n '1234,1400p' backend/apps/prestamos/tests.py",
  "workdir": "/home/shiarowo/PERSONAL/Presticad"
}
```

**Output:**
```

        self.assertFalse(serializer.is_valid())
        self.assertIn("condicion", str(serializer.errors))


def crear_usuario(email, dni, rol="prestatario", **cambios):
    usuario = registrar_usuario(
        nombre="Ana",
        apellido="Torres",
        email=email,
        dni=dni,
        tipo="docente",
        facultad="Ingeniería",
        password="ClaveSegura123",
    )
    usuario.rol = Rol.objects.get(nombre=rol)
    for campo, valor in cambios.items():
        setattr(usuario, campo, valor)
    usuario.save()
    return usuario


def crear_material(**cambios):
    estado = cambios.pop("estado", None)
    datos = {
        "nombre": "Proyector",
        "codigo_material": "EQ-001",
        "tipo": "equipo",
        "stock": 1,
    }
    if "tiempo_maximo_prestamo" not in cambios and "tier_minimo_requerido" not in cambios:
        datos["tiempo_maximo_prestamo"] = 4320
    datos.update(cambios)
    material = registrar_material(**datos)
    if estado:
        material.estado = estado
        material.save(update_fields=["estado", "updated_at"])
    return material


class ModuloPrestamosTestCase(SimpleTestCase):
    def test_urls_del_modulo_estan_montadas(self):
        from config.urls import urlpatterns

        rutas = {str(ruta.pattern) for ruta in urlpatterns}
        self.assertIn("api/", rutas)


class RegistrarPrestamoServiceTestCase(TestCase):
    def setUp(self):
        self.gestor = crear_usuario("gestor@unsa.edu.pe", "10000001", rol="gestor")
        self.prestatario = crear_usuario("ana@unsa.edu.pe", "10000002")
        self.material = crear_material()

    def _registrar(self, **cambios):
        datos = {
            "dni_prestatario": self.prestatario.dni,
            "material_id": self.material.id,
            "tiempo_prestamo_dias": 3,
            "checklist_inicial": CHECKLIST,
            "registrado_por": self.gestor,
        }
        datos.update(cambios)
        return registrar_prestamo(**datos)

    def test_garantia_tiene_estado_pendiente_y_se_asocia_al_prestamo(self):
        prestamo = self._registrar()

        garantia = Garantia.objects.create(prestamo=prestamo)

        self.assertEqual(garantia.tipo, "documento_y_compromiso")
        self.assertEqual(garantia.estado, "pendiente")
        self.assertIsNone(garantia.fecha_registro)
        self.assertEqual(prestamo.garantia, garantia)

    def test_registra_prestamo_activo_con_fecha_limite_y_checklist(self):
        antes = timezone.now()

        prestamo = self._registrar()

        self.assertEqual(prestamo.estado, "activo")
class RegistrarPrestamoServiceTestCase(TestCase):
    def setUp(self):
        self.gestor = crear_usuario("gestor@unsa.edu.pe", "10000001", rol="gestor")
        self.prestatario = crear_usuario("ana@unsa.edu.pe", "10000002")
        self.material = crear_material()

    def _registrar(self, **cambios):
        datos = {
            "dni_prestatario": self.prestatario.dni,
            "material_id": self.material.id,
            "tiempo_prestamo_dias": 3,
            "checklist_inicial": CHECKLIST,
            "registrado_por": self.gestor,
        }
        datos.update(cambios)
        return registrar_prestamo(**datos)

    def test_garantia_tiene_estado_pendiente_y_se_asocia_al_prestamo(self):
        prestamo = self._registrar()

        garantia = Garantia.objects.create(prestamo=prestamo)

        self.assertEqual(garantia.tipo, "documento_y_compromiso")
        self.assertEqual(garantia.estado, "pendiente")
        self.assertIsNone(garantia.fecha_registro)
        self.assertEqual(prestamo.garantia, garantia)

    def test_registra_prestamo_activo_con_fecha_limite_y_checklist(self):
        antes = timezone.now()

        prestamo = self._registrar()

        self.assertEqual(prestamo.estado, "activo")
        self.assertEqual(prestamo.usuario, self.prestatario)
        self.assertEqual(prestamo.registrado_por, self.gestor)
        self.assertEqual(prestamo.checklist_inicial, CHECKLIST)
        self.assertEqual(prestamo.fecha_limite - prestamo.fecha_entrega, timedelta(days=3))
        self.assertGreaterEqual(prestamo.fecha_entrega, antes)
        self.assertEqual(Material.objects.get(pk=self.material.pk).estado, "prestado")
        instancia = self.material.instancias.get()
        self.assertEqual(prestamo.instancia_id, instancia.id)
        self.assertEqual(instancia.estado, "prestado")

    def test_no_guarda_condicion_aunque_llegue_a_la_regla_interna(self):
        prestamo = self._registrar(
            checklist_inicial=[
                {"elemento": "Carcasa", "condicion": "Dato antiguo", "observacion": ""},
            ],
            fotos_checklist=[crear_foto_checklist()],
        )

        self.assertEqual(
            prestamo.checklist_inicial,
            [{"elemento": "Carcasa", "observacion": ""}],
        )

    def test_rechaza_duracion_superior_al_maximo_global(self):
        with self.assertRaises(PrestamoError) as contexto:
            self._registrar(tiempo_prestamo_dias=16)

        self.assertEqual(contexto.exception.campo, "tiempo_prestamo_dias")
        self.assertEqual(Prestamo.objects.count(), 0)

    def test_limita_duracion_minima_15_min_y_maxima_del_material(self):
        gafas_vr = crear_material(
            codigo_material="EQ-VR-01",
            nombre="Gafas VR",
            tipo="equipo",
            tier_minimo_requerido="avanzado",
            stock=2,
        )
        self.assertEqual(gafas_vr.tiempo_maximo_prestamo, 360)
        avanzado = crear_usuario(
            "avanzado@unsa.edu.pe",
            "10000011",
            reputacion_puntaje=300,
            reputacion_tier="avanzado",
        )

        with self.assertRaises(PrestamoError) as error_minimo:
            self._registrar(
                dni_prestatario=avanzado.dni,
                material_id=gafas_vr.id,
                tiempo_prestamo_minutos=14,
                tiempo_prestamo_dias=None,
            )
        self.assertEqual(error_minimo.exception.campo, "tiempo_prestamo_minutos")
        self.assertIn("15 minutos", error_minimo.exception.mensaje)

        prestamo_minimo = self._registrar(
            dni_prestatario=avanzado.dni,
            material_id=gafas_vr.id,
            tiempo_prestamo_minutos=15,
            tiempo_prestamo_dias=None,
        )
        self.assertEqual(prestamo_minimo.tiempo_prestamo_minutos, 15)
        self.assertEqual(
            prestamo_minimo.fecha_limite - prestamo_minimo.fecha_entrega,
            timedelta(minutes=15),
        )

        with self.assertRaises(PrestamoError) as error_maximo_vr:
            self._registrar(
                dni_prestatario=avanzado.dni,
                material_id=gafas_vr.id,
                tiempo_prestamo_minutos=361,
                tiempo_prestamo_dias=None,
            )
        self.assertEqual(error_maximo_vr.exception.campo, "tiempo_prestamo_minutos")
        self.assertIn("6 horas", error_maximo_vr.exception.mensaje)

        prestamo_vr_6h = self._registrar(
            dni_prestatario=avanzado.dni,
            material_id=gafas_vr.id,
            tiempo_prestamo_minutos=360,
            tiempo_prestamo_dias=None,
        )
        self.assertEqual(prestamo_vr_6h.tiempo_prestamo_minutos, 360)
        self.assertEqual(
            prestamo_vr_6h.fecha_limite - prestamo_vr_6h.fecha_entrega,
            timedelta(hours=6),
        )

    def test_rechaza_alta_sin_una_foto_por_elemento(self):
        with self.assertRaises(PrestamoError) as contexto:
            registrar_prestamo_real(
                dni_prestatario=self.prestatario.dni,
                material_id=self.material.id,
                tiempo_prestamo_dias=3,
                checklist_inicial=CHECKLIST,
                fotos_checklist=[crear_foto_checklist()],
                registrado_por=self.gestor,
            )

        self.assertEqual(contexto.exception.campo, "fotos_checklist")
        self.assertEqual(Prestamo.objects.count(), 0)

    def test_registra_la_instancia_especifica_solicitada(self):
        material = crear_material(codigo_material="EQ-ESPECIFICO", stock=2)
        instancias = list(material.instancias.order_by("codigo_ejemplar"))

        prestamo = self._registrar(
            material_id=material.id,
class RegistrarPrestamoAPITestCase(APITestCase):
    URL = "/api/prestamos/"

    def setUp(self):
        self.gestor = crear_usuario("gestor-api@unsa.edu.pe", "20000001", rol="gestor")
        self.prestatario = crear_usuario("prestatario-api@unsa.edu.pe", "20000002")
        self.material = crear_material(codigo_material="API-001")

    def _iniciar_sesion(self, usuario):
        sesion = self.client.session
        sesion[CLAVE_SESION_USUARIO_ID] = usuario.id
        sesion[CLAVE_SESION_ULTIMA_ACTIVIDAD] = timezone.now().isoformat()
        sesion.save()

    def _payload(self, **cambios):
        datos = {
            "dni_prestatario": self.prestatario.dni,
            "material_id": str(self.material.id),
            "tiempo_prestamo_dias": 3,
            "checklist_inicial": CHECKLIST,
        }
        datos.update(cambios)
        return datos

    def _payload_multipart(self, **cambios):
        datos = self._payload(**cambios)
        checklist = datos["checklist_inicial"]
        if isinstance(checklist, str):
            checklist = json.loads(checklist)
        datos["checklist_inicial"] = json.dumps(checklist)
        for indice in range(len(checklist)):
            datos[f"foto_checklist_{indice}"] = crear_foto_checklist()
        return datos

    def test_post_sin_sesion_responde_403(self):
        respuesta = self.client.post(self.URL, self._payload(), format="json")

        self.assertEqual(respuesta.status_code, 403)
        self.assertEqual(Prestamo.objects.count(), 0)

    def test_post_como_prestatario_responde_403(self):
        self._iniciar_sesion(self.prestatario)

        respuesta = self.client.post(self.URL, self._payload(), format="json")

        self.assertEqual(respuesta.status_code, 403)
        self.assertEqual(Prestamo.objects.count(), 0)

    def test_post_como_gestor_devuelve_201_y_datos_de_entrega(self):
        self._iniciar_sesion(self.gestor)
        instancia = self.material.instancias.get()

        with storage_garantias_temporal():
            respuesta = self.client.post(
                self.URL,
                self._payload_multipart(instancia_id=str(instancia.id)),
                format="multipart",
            )
            self.assertEqual(respuesta.status_code, 201, respuesta.content)
            datos = respuesta.json()
            self.assertEqual(datos["usuario_id"], self.prestatario.id)
            self.assertEqual(datos["usuario_nombre"], "Ana Torres")
            self.assertEqual(datos["estado"], "activo")
            self.assertEqual(datos["tiempo_prestamo_dias"], 3)
            self.assertEqual(datos["checklist_inicial"], CHECKLIST)
            self.assertEqual(datos["instancia_id"], str(instancia.id))
            self.assertEqual(datos["codigo_ejemplar"], instancia.codigo_ejemplar)
            self.assertFalse(datos["requiere_garantia"])
            self.assertEqual(Prestamo.objects.count(), 1)
            self.assertEqual(FotoChecklist.objects.filter(prestamo_id=datos["id"]).count(), 2)

            detalle = self.client.get(f"/api/prestamos/{datos['id']}/")
            self.assertEqual(detalle.status_code, 200, detalle.content)
            item = detalle.json()["checklist_inicial"][0]
            self.assertNotIn("condicion", item)
            self.assertTrue(item["foto_url"])
            foto = self.client.get(item["foto_url"])
            self.assertEqual(foto.status_code, 200)
            self.assertEqual(foto["Content-Type"], "image/png")

    def test_post_falla_si_falta_foto_de_un_elemento(self):
        self._iniciar_sesion(self.gestor)
        datos = self._payload_multipart()
        datos.pop("foto_checklist_1")

        respuesta = self.client.post(self.URL, datos, format="multipart")

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn("1", respuesta.json()["fotos_checklist"])
        self.assertEqual(Prestamo.objects.count(), 0)
        self.assertEqual(FotoChecklist.objects.count(), 0)

    def test_post_falla_si_foto_no_es_una_imagen_real(self):
        self._iniciar_sesion(self.gestor)
        datos = self._payload_multipart()
        datos["foto_checklist_1"] = SimpleUploadedFile(
            "foto.png",
            b"Esto no es una imagen",
            content_type="image/png",
        )

        respuesta = self.client.post(self.URL, datos, format="multipart")

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn("fotos_checklist", respuesta.json())
        self.assertEqual(Prestamo.objects.count(), 0)
        self.assertEqual(FotoChecklist.objects.count(), 0)

    def test_post_rechaza_duracion_menor_a_15_min_o_mayor_al_maximo_del_material(self):
        self._iniciar_sesion(self.gestor)

        menor_minimo = self.client.post(
            self.URL,
            self._payload_multipart(tiempo_prestamo_minutos=10),
            format="multipart",
        )
        self.assertEqual(menor_minimo.status_code, 400)
        self.assertIn("tiempo_prestamo_minutos", menor_minimo.json())

        fuera_material = self.client.post(
            self.URL,
            self._payload_multipart(tiempo_prestamo_minutos=5000),
            format="multipart",
        )
        self.assertEqual(fuera_material.status_code, 400)
        self.assertIn("tiempo_prestamo_minutos", fuera_material.json())
        self.assertIn("3 días", str(fuera_material.json()["tiempo_prestamo_minutos"]))
        self.assertEqual(Prestamo.objects.count(), 0)

    def test_post_multipart_registra_garantia_y_parsea_checklist_json(self):
        self._iniciar_sesion(self.gestor)
        material = crear_material(
            codigo_material="API-ALTO-VALOR",
            es_alto_valor=True,
        )
        instancia = material.instancias.get()
        datos = self._payload(
            material_id=str(material.id),
            instancia_id=str(instancia.id),
            checklist_inicial=CHECKLIST,
            documento_identidad=crear_pdf("dni-original.pdf"),
            compromiso_responsabilidad=crear_pdf("carta-original.pdf"),
        )
        datos["checklist_inicial"] = json.dumps(datos["checklist_inicial"])
        datos.update({
            f"foto_checklist_{indice}": crear_foto_checklist()
            for indice in range(len(CHECKLIST))
        })

        with storage_garantias_temporal():
            respuesta = self.client.post(self.URL, datos, format="multipart")

        self.assertEqual(respuesta.status_code, 201, respuesta.content)
        datos_respuesta = respuesta.json()
        self.assertEqual(datos_respuesta["checklist_inicial"], CHECKLIST)
        self.assertTrue(datos_respuesta["garantia_completa"])
        self.assertTrue(datos_respuesta["garantia_documento_identidad_cargado"])
        self.assertTrue(datos_respuesta["garantia_compromiso_responsabilidad_cargado"])
        self.assertNotIn("documento_identidad", datos_respuesta)
        self.assertEqual(Prestamo.objects.count(), 1)

    def test_post_sin_pdf_rechaza_material_de_alto_valor(self):
        self._iniciar_sesion(self.gestor)
        material = crear_material(
            codigo_material="API-ALTO-SIN-PDF",
            es_alto_valor=True,
        )

```

**Tool: bash**

**Input:**
```json
{
  "command": "sed -n '240,420p' backend/apps/prestamos/serializers.py && sed -n '240,380p' backend/apps/prestamos/consultar_serializers.py",
  "workdir": "/home/shiarowo/PERSONAL/Presticad"
}
```

**Output:**
```
    codigo_ejemplar = serializers.SerializerMethodField()
    requiere_garantia = serializers.BooleanField(read_only=True)
    garantia_completa = serializers.BooleanField(read_only=True)
    garantia_documento_identidad_cargado = serializers.SerializerMethodField()
    garantia_compromiso_responsabilidad_cargado = serializers.SerializerMethodField()

    class Meta:
        model = Prestamo
        fields = (
            "id",
            "usuario_id",
            "usuario_nombre",
            "material_id",
            "material_nombre",
            "material_codigo",
            "instancia_id",
            "codigo_ejemplar",
            "fecha_entrega",
            "fecha_limite",
            "tiempo_prestamo_minutos",
            "tiempo_prestamo_dias",
            "estado",
            "checklist_inicial",
            "requiere_garantia",
            "garantia_documento_identidad_cargado",
            "garantia_compromiso_responsabilidad_cargado",
            "garantia_completa",
        )

    def get_usuario_nombre(self, prestamo):
        return f"{prestamo.usuario.nombre} {prestamo.usuario.apellido}".strip()

    def get_codigo_ejemplar(self, prestamo):
        if prestamo.instancia_id is None:
            return None
        return prestamo.instancia.codigo_ejemplar

    def _obtener_garantia(self, prestamo):
        try:
            return prestamo.garantia
        except Garantia.DoesNotExist:
            return None

    def get_garantia_documento_identidad_cargado(self, prestamo):
        garantia = self._obtener_garantia(prestamo)
        return bool(garantia and garantia.documento_identidad)

    def get_garantia_compromiso_responsabilidad_cargado(self, prestamo):
        garantia = self._obtener_garantia(prestamo)
        return bool(garantia and garantia.compromiso_responsabilidad)


class ChecklistDevolucionItemSerializer(serializers.Serializer):
    """Estado devuelto de una fila del checklist inicial (RN09)."""

    elemento = serializers.CharField(max_length=100)
    estado = serializers.ChoiceField(choices=ESTADOS_CHECKLIST_DEVOLUCION)
    observacion = serializers.CharField(
        max_length=500,
        required=False,
        allow_blank=True,
        default="",
    )

    def to_internal_value(self, data):
        if isinstance(data, dict):
            campos_no_permitidos = set(data) - set(self.fields)
            if campos_no_permitidos:
                raise serializers.ValidationError({
                    campo: "Este campo no está permitido."
                    for campo in campos_no_permitidos
                })
        return super().to_internal_value(data)

    def validate_elemento(self, value):
        if not value.strip():
            raise serializers.ValidationError("Describe el elemento inspeccionado.")
        return value.strip()


class DevolucionIngresoSerializer(
    RechazarCamposNoPermitidosMixin,
    serializers.Serializer,
):
    """Entrada JSON de estimación y multipart de registro de devolución."""

    checklist = ChecklistDevolucionItemSerializer(many=True, allow_empty=False)
    fotos_checklist = serializers.ListField(
        child=serializers.ImageField(
            allow_null=True,
            validators=[validar_foto_checklist],
        ),
        required=False,
        write_only=True,
    )

    def to_internal_value(self, data):
        checklist = data.get("checklist") if hasattr(data, "get") else None
        if isinstance(checklist, str):
            try:
                checklist = json.loads(checklist)
            except (TypeError, ValueError) as error:
                raise serializers.ValidationError({
                    "checklist": "El checklist debe ser una lista JSON válida.",
                }) from error

        if isinstance(checklist, list):
            datos = {campo: data.get(campo) for campo in data.keys()}
            fotos = [
                datos.pop(f"foto_checklist_{indice}", None)
                for indice in range(len(checklist))
            ]
            datos["checklist"] = checklist
            datos["fotos_checklist"] = fotos
            data = datos

        return super().to_internal_value(data)

    def validate(self, attrs):
        datos_originales = self.initial_data
        checklist = attrs.get("checklist", [])
        campos_foto = {
            f"foto_checklist_{indice}"
            for indice in range(len(checklist))
        }
        if hasattr(datos_originales, "keys"):
            self.initial_data = {
                campo: datos_originales.get(campo)
                for campo in datos_originales.keys()
                if campo not in campos_foto
            }
        try:
            resultado = super().validate(attrs)
        finally:
            self.initial_data = datos_originales
        _validar_tamano_total_archivos(resultado.get("fotos_checklist", []))
        return resultado


def url_reporte_publica(devolucion):
    """URL abrible del PDF; patrón de `FotoMaterial` (MEDIA_URL_PUBLICA en dev)."""
    if not devolucion or not devolucion.reporte:
        return ""
    url = devolucion.reporte.url
    if url.startswith(("http://", "https://")):
        return url
    return f"{settings.MEDIA_URL_PUBLICA.rstrip('/')}/{url.lstrip('/')}"


class DevolucionResultadoSerializer(serializers.Serializer):
    """Resumen de sanciones que la API devuelve al estimar y al registrar."""

    prestamo_id = serializers.IntegerField()
    a_tiempo = serializers.BooleanField()
    en_tiempo_gracia = serializers.BooleanField(required=False, default=False)
    dias_tardanza = serializers.IntegerField()
    bonificacion = serializers.IntegerField()
    deduccion_tardanza = serializers.IntegerField()
    dano = serializers.ChoiceField(choices=ESTADOS_CHECKLIST_DEVOLUCION)
    hay_dano = serializers.BooleanField()
    deduccion_dano = serializers.IntegerField()
    cobro_economico = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        allow_null=True,
    )
    puntos_delta = serializers.IntegerField()
    reputacion_antes = serializers.IntegerField()
    tier_antes = serializers.CharField()
    reputacion_despues = serializers.IntegerField()
    tier_despues = serializers.CharField()
    devolucion_id = serializers.IntegerField(required=False)
    reporte_url = serializers.CharField(required=False)


class ConsultaReportesSerializer(
    RechazarCamposNoPermitidosMixin,
    serializers.Serializer,
):
    """Parámetros de filtro del listado de reportes de daños (RN10).

        allow_null=True,
    )
    costo_reposicion = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        source="material.costo_reposicion",
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = Prestamo
        fields = (
            "id",
            "material_id",
            "material_nombre",
            "material_codigo",
            "codigo_ejemplar",
            "fecha_entrega",
            "fecha_limite",
            "tiempo_prestamo_minutos",
            "tiempo_prestamo_dias",
            "estado",
            "prestatario_nombre",
            "prestatario_dni",
            "checklist_inicial",
            "bonificacion_tiempo",
            "deduccion_tardanza",
            "deduccion_dano_parcial",
            "deduccion_dano_total",
            "costo_reparacion",
            "costo_reposicion",
        )
        read_only_fields = fields

    def get_prestatario_nombre(self, obj):
        return f"{obj.usuario.nombre} {obj.usuario.apellido}".strip()

    def get_codigo_ejemplar(self, prestamo):
        return prestamo.instancia.codigo_ejemplar if prestamo.instancia_id else None

    def get_checklist_inicial(self, obj):
        return serializar_checklist_inicial(obj)

```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 2.7s)

_Thinking:_

Need note duplicate test class? cat showed duplicate? It printed same class twice maybe because sed ranges overlap? Range 328 start then 328 again due commands. Fine.

Need implement backend tests. Need inspect imports and helpers for PDF/foto.

**Tool: bash**

**Input:**
```json
{
  "command": "sed -n '1,120p' backend/apps/prestamos/tests.py && sed -n '470,620p' backend/apps/prestamos/tests.py && sed -n '1380,1540p' backend/apps/prestamos/tests.py",
  "workdir": "/home/shiarowo/PERSONAL/Presticad"
}
```

**Output:**
```
"""Pruebas de reglas y API para HU09 — registrar la entrega de un préstamo."""
import atexit
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
import json
import tempfile
import unittest
from datetime import timedelta
from io import BytesIO
from pathlib import Path
from threading import Barrier
from unittest.mock import patch
from uuid import uuid4

from django.core.exceptions import ValidationError
from django.core.files.storage import FileSystemStorage, storages
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import close_old_connections
from django.test import SimpleTestCase, TestCase, TransactionTestCase, override_settings
from django.utils import timezone
from PIL import Image
from rest_framework.test import APIClient, APITestCase

from apps.inventario.models import Material
from apps.inventario.serializers import MaterialSerializer
from apps.inventario.services import registrar_material
from apps.prestamos.models import (
    Devolucion,
    FotoChecklist,
    Garantia,
    Prestamo,
    ruta_documento_garantia,
)
from apps.prestamos import storage as almacenamiento_prestamos
from apps.prestamos.constants import TAMANO_MAXIMO_FOTO_CHECKLIST_BYTES
from apps.prestamos.serializers import RegistrarPrestamoSerializer
from apps.prestamos.validators import (
    validar_foto_checklist,
    validar_pdf_garantia,
)
from apps.prestamos.services import (
    PrestamoError,
    consultar_historial_prestamos,
    consultar_prestamos_usuario,
    estimar_devolucion,
    registrar_devolucion,
    registrar_prestamo as registrar_prestamo_real,
)
from apps.usuarios.models import Rol
from apps.usuarios.services import registrar_usuario, usuario_tiene_prestamos_activos
from apps.usuarios.sesiones import (
    CLAVE_SESION_ULTIMA_ACTIVIDAD,
    CLAVE_SESION_USUARIO_ID,
)


CHECKLIST = [
    {"elemento": "Carcasa", "observacion": ""},
    {"elemento": "Cable", "observacion": ""},
]
_DIRECTORIO_FOTOS_TEST = tempfile.TemporaryDirectory()
atexit.register(_DIRECTORIO_FOTOS_TEST.cleanup)
_ALMACENAMIENTO_FOTOS_TEST = FileSystemStorage(location=_DIRECTORIO_FOTOS_TEST.name)


def crear_foto_checklist(
    nombre="elemento.png",
    formato="PNG",
    tipo="image/png",
    color="white",
):
    contenido = BytesIO()
    Image.new("RGB", (2, 2), color).save(contenido, format=formato)
    return SimpleUploadedFile(
        nombre,
        contenido.getvalue(),
        content_type=tipo,
    )


def registrar_prestamo(**datos):
    """Añade imágenes válidas a las altas directas usadas por los tests."""
    datos.setdefault(
        "fotos_checklist",
        [crear_foto_checklist() for _ in datos.get("checklist_inicial", [])],
    )
    with patch.object(
        FotoChecklist._meta.get_field("imagen"),
        "storage",
        _ALMACENAMIENTO_FOTOS_TEST,
    ):
        return registrar_prestamo_real(**datos)


def crear_pdf(nombre):
    return SimpleUploadedFile(
        nombre,
        b"%PDF-1.7\ncontenido de prueba",
        content_type="application/pdf",
    )


class AlmacenamientoPresticadCloudinaryTestCase(SimpleTestCase):
    """El storage de producción separa PDFs raw de imágenes y conserva el prefijo."""

    @unittest.skipUnless(
        almacenamiento_prestamos.AlmacenamientoPresticadCloudinary is not None,
        "Cloudinary no está instalado en este entorno.",
    )
    def test_detecta_tipo_de_recurso_por_extension(self):
        storage = almacenamiento_prestamos.AlmacenamientoPresticadCloudinary()

        for nombre in ("reporte.pdf", "garantia.DOC", "archivo.docx", "nota.txt"):
            with self.subTest(nombre=nombre):
                self.assertEqual(storage._get_resource_type(nombre), "raw")

        for nombre in ("foto.jpg", "foto.jpeg", "foto.png", "foto.webp"):
            with self.subTest(nombre=nombre):
                self.assertEqual(storage._get_resource_type(nombre), "image")

            material_id=material.id,
            instancia_id=instancias[1].id,
        )

        self.assertEqual(prestamo.instancia_id, instancias[1].id)
        instancias[0].refresh_from_db()
        instancias[1].refresh_from_db()
        self.assertEqual(instancias[0].estado, "disponible")
        self.assertEqual(instancias[1].estado, "prestado")

    def test_rechaza_instancia_inexistente(self):
        with self.assertRaises(PrestamoError) as contexto:
            self._registrar(instancia_id=uuid4())

        self.assertEqual(contexto.exception.status_code, 404)
        self.assertEqual(contexto.exception.campo, "instancia_id")
        self.assertEqual(Prestamo.objects.count(), 0)

    def test_rechaza_instancia_de_otro_material(self):
        otro_material = crear_material(codigo_material="EQ-OTRO")

        with self.assertRaises(PrestamoError) as contexto:
            self._registrar(instancia_id=otro_material.instancias.get().id)

        self.assertEqual(contexto.exception.status_code, 400)
        self.assertEqual(contexto.exception.campo, "instancia_id")
        self.assertEqual(Prestamo.objects.count(), 0)

    def test_rechaza_instancia_no_disponible(self):
        instancia = self.material.instancias.get()
        instancia.estado = "prestado"
        instancia.save(update_fields=["estado"])

        with self.assertRaises(PrestamoError) as contexto:
            self._registrar(instancia_id=instancia.id)

        self.assertEqual(contexto.exception.status_code, 409)
        self.assertEqual(contexto.exception.campo, "instancia_id")
        self.assertEqual(Prestamo.objects.count(), 0)

    def test_rechaza_prestar_dos_veces_la_misma_instancia(self):
        instancia = self.material.instancias.get()
        self._registrar(instancia_id=instancia.id)
        otro_prestatario = crear_usuario("segundo-instancia@unsa.edu.pe", "10000005")

        with self.assertRaises(PrestamoError) as contexto:
            self._registrar(
                dni_prestatario=otro_prestatario.dni,
                instancia_id=instancia.id,
            )

        self.assertEqual(contexto.exception.status_code, 409)
        self.assertEqual(Prestamo.objects.count(), 1)

    def test_agota_y_restaura_disponibilidad_segun_stock_de_unidades(self):
        material = crear_material(
            nombre="Cables",
            codigo_material="OBJ-002",
            tipo="objeto",
            stock=2,
        )

        self._registrar(material_id=material.id)
        material.refresh_from_db()
        self.assertEqual(material.stock, 2)
        self.assertEqual(material.estado, "disponible")
        self.assertEqual(MaterialSerializer(material).data["unidades_disponibles"], 1)

        otro = crear_usuario("otro@unsa.edu.pe", "10000003")
        registrar_prestamo(
            dni_prestatario=otro.dni,
            material_id=material.id,
            tiempo_prestamo_dias=3,
            checklist_inicial=CHECKLIST,
            registrado_por=self.gestor,
        )
        material.refresh_from_db()
        self.assertEqual(material.estado, "prestado")
        self.assertEqual(MaterialSerializer(material).data["unidades_disponibles"], 0)

    def test_rechaza_sin_unidades_y_no_crea_prestamo(self):
        self._registrar()
        segundo = crear_usuario("segundo@unsa.edu.pe", "10000004")

        with self.assertRaises(PrestamoError) as contexto:
            self._registrar(dni_prestatario=segundo.dni)

        self.assertEqual(contexto.exception.status_code, 409)
        self.assertEqual(Prestamo.objects.count(), 1)

    def test_rechaza_tier_insuficiente_sin_cambiar_inventario(self):
        material = crear_material(
            codigo_material="EQ-002",
            tier_minimo_requerido="avanzado",
        )

        with self.assertRaises(PrestamoError) as contexto:
            self._registrar(material_id=material.id)

        self.assertIn("Tier", contexto.exception.mensaje)
        self.assertEqual(Prestamo.objects.count(), 0)
        material.refresh_from_db()
        self.assertEqual(material.estado, "disponible")

    def test_rechaza_usuario_suspendido(self):
        self.prestatario.estado = "suspendido"
        self.prestatario.save(update_fields=["estado"])

        with self.assertRaises(PrestamoError) as contexto:
            self._registrar()

        self.assertIn("habilitado", contexto.exception.mensaje)
        self.assertEqual(Prestamo.objects.count(), 0)

    def test_exige_ambos_pdf_para_material_de_alto_valor(self):
        material = crear_material(codigo_material="EQ-003", es_alto_valor=True)

        with self.assertRaises(PrestamoError) as contexto:
            self._registrar(material_id=material.id)
        self.assertEqual(contexto.exception.campo, "documento_identidad")
        self.assertEqual(Prestamo.objects.count(), 0)

        with self.assertRaises(PrestamoError) as contexto:
            self._registrar(
                material_id=material.id,
                documento_identidad=crear_pdf("dni-original.pdf"),
            )
        self.assertEqual(contexto.exception.campo, "compromiso_responsabilidad")
        self.assertEqual(Prestamo.objects.count(), 0)

        with storage_garantias_temporal():
            prestamo = self._registrar(
                material_id=material.id,
                documento_identidad=crear_pdf("dni-original.pdf"),
                compromiso_responsabilidad=crear_pdf("carta-original.pdf"),
            )
            garantia = prestamo.garantia

            self.assertEqual(garantia.estado, "registrada")
            self.assertIsNotNone(garantia.fecha_registro)
            self.assertTrue(prestamo.garantia_completa)
            self.assertNotIn("original", garantia.documento_identidad.name)
            self.assertNotIn("original", garantia.compromiso_responsabilidad.name)

    def test_rechaza_archivos_de_garantia_para_material_que_no_los_requiere(self):
        with self.assertRaises(PrestamoError) as contexto:
            self._registrar(documento_identidad=crear_pdf("dni.pdf"))

        self.assertEqual(contexto.exception.campo, "documento_identidad")
        self.assertEqual(Prestamo.objects.count(), 0)

            for indice in range(len(CHECKLIST))
        })

        with storage_garantias_temporal():
            respuesta = self.client.post(self.URL, datos, format="multipart")

        self.assertEqual(respuesta.status_code, 201, respuesta.content)
        datos_respuesta = respuesta.json()
        self.assertEqual(datos_respuesta["checklist_inicial"], CHECKLIST)
        self.assertTrue(datos_respuesta["garantia_completa"])
        self.assertTrue(datos_respuesta["garantia_documento_identidad_cargado"])
        self.assertTrue(datos_respuesta["garantia_compromiso_responsabilidad_cargado"])
        self.assertNotIn("documento_identidad", datos_respuesta)
        self.assertEqual(Prestamo.objects.count(), 1)

    def test_post_sin_pdf_rechaza_material_de_alto_valor(self):
        self._iniciar_sesion(self.gestor)
        material = crear_material(
            codigo_material="API-ALTO-SIN-PDF",
            es_alto_valor=True,
        )

        respuesta = self.client.post(
            self.URL,
            self._payload_multipart(material_id=str(material.id)),
            format="multipart",
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn("documento_identidad", respuesta.json())
        self.assertEqual(Prestamo.objects.count(), 0)

    def test_post_omite_instancia_y_guarda_la_seleccion_automatica(self):
        self._iniciar_sesion(self.gestor)

        with storage_garantias_temporal():
            respuesta = self.client.post(
                self.URL,
                self._payload_multipart(),
                format="multipart",
            )

        self.assertEqual(respuesta.status_code, 201, respuesta.content)
        instancia = self.material.instancias.get()
        self.assertEqual(respuesta.json()["instancia_id"], str(instancia.id))
        self.assertEqual(instancia.estado, "prestado")

    def test_listado_inventario_devuelve_unidades_libres_actualizadas(self):
        material = crear_material(
            nombre="Cables HDMI",
            codigo_material="API-002",
            tipo="objeto",
            stock=2,
        )
        registrar_prestamo(
            dni_prestatario=self.prestatario.dni,
            material_id=material.id,
            tiempo_prestamo_dias=3,
            checklist_inicial=CHECKLIST,
            registrado_por=self.gestor,
        )

        respuesta = self.client.get("/api/materiales/")

        self.assertEqual(respuesta.status_code, 200)
        cables = next(item for item in respuesta.json() if item["id"] == str(material.id))
        self.assertEqual(cables["stock"], 2)
        self.assertEqual(cables["unidades_disponibles"], 1)
        self.assertEqual(cables["estado"], "disponible")

    def test_post_como_administrador_responde_403(self):
        administrador = crear_usuario(
            "admin-api@unsa.edu.pe",
            "20000003",
            rol="administrador",
        )
        self._iniciar_sesion(administrador)

        respuesta = self.client.post(self.URL, self._payload(), format="json")

        self.assertEqual(respuesta.status_code, 403)

    def test_post_datos_invalidos_responde_400(self):
        self._iniciar_sesion(self.gestor)

        respuesta = self.client.post(
            self.URL,
            self._payload(tiempo_prestamo_dias=0, checklist_inicial=[]),
            format="json",
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn("tiempo_prestamo_dias", respuesta.json())
        self.assertIn("checklist_inicial", respuesta.json())
        self.assertEqual(Prestamo.objects.count(), 0)

    def test_post_rechaza_campos_no_autorizados(self):
        self._iniciar_sesion(self.gestor)

        respuesta = self.client.post(
            self.URL,
            self._payload_multipart(usuario_id=999, estado="devuelto"),
            format="multipart",
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn("usuario_id", respuesta.json())
        self.assertIn("estado", respuesta.json())
        self.assertEqual(Prestamo.objects.count(), 0)

    def test_post_rechaza_los_booleanos_obsoletos_de_garantia(self):
        self._iniciar_sesion(self.gestor)

        respuesta = self.client.post(
            self.URL,
            self._payload_multipart(garantia_documento_identidad_recibido=True),
            format="multipart",
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn("garantia_documento_identidad_recibido", respuesta.json())
        self.assertEqual(Prestamo.objects.count(), 0)

    def test_post_dni_inexistente_responde_404(self):
        self._iniciar_sesion(self.gestor)

        with storage_garantias_temporal():
            respuesta = self.client.post(
                self.URL,
                self._payload_multipart(dni_prestatario="29999999"),
                format="multipart",
            )

        self.assertEqual(respuesta.status_code, 404)
        self.assertEqual(Prestamo.objects.count(), 0)

    def test_post_requiere_token_csrf_con_sesion(self):
        gestor = self.gestor
        cliente = APIClient(enforce_csrf_checks=True)
        sesion = cliente.session
        sesion[CLAVE_SESION_USUARIO_ID] = gestor.id
        sesion[CLAVE_SESION_ULTIMA_ACTIVIDAD] = timezone.now().isoformat()
        sesion.save()

        respuesta = cliente.post(self.URL, self._payload(), format="json")

        self.assertEqual(respuesta.status_code, 403)
        self.assertEqual(Prestamo.objects.count(), 0)


class DescargarGarantiaAPITestCase(APITestCase):
    URL = "/api/prestamos/{prestamo_id}/garantia/{tipo}/"

    def setUp(self):
        self.gestor = crear_usuario("gestor-garantia@unsa.edu.pe", "20000301", rol="gestor")
        self.administrador = crear_usuario(
            "admin-garantia@unsa.edu.pe",
            "20000302",
            rol="administrador",
        )
        self.prestatario = crear_usuario("prestatario-garantia@unsa.edu.pe", "20000303")

```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 8.1s)

_Thinking:_

Need implement. Need maybe first backend then tests; then frontend. Need decide exact backend API route. Could have single `RegistrarPrestamoView` and URL direct `/prestamos/excepcion/` with subclass or same view flag. Add `RegistrarPrestamoExcepcionalView` with post calling `registrar_prestamo(..., es_excepcion=True)` ignoring validated `es_excepcion`. Better no serializer field? The serializer rejects unknown fields but direct endpoint doesn't need flag. `RegistrarPrestamoSerializer` doesn't have `es_excepcion`, and endpoint forces. The user plan says server forces and not trust client. So don't add serializer field. Add view.

Potential issue URL ordering: `prestamos/<int:prestamo_id>/` won't match "excepcion" because int. But place before dynamic? `prestamos/excepcion/` no int, fine.

Need maybe external "manager only" permission `EsGestorDeAlmacen`, same.

Need implement `_validar_elegibilidad(usuario, material, es_excepcion=False)`: if es_excepcion:
```
tiers_permitidos = TIERS_ACCESIBLES.get(usuario.reputacion_tier)
if usuario.reputacion_tier != "restringido" or tiers_permitidos is None or material.tier_minimo_requerido in tiers_permitidos:
    raise PrestamoError("es_excepcion", "El préstamo excepcional solo aplica a usuarios restringidos con material de Tier superior.")
return
```
Need if tier unknown? `tiers_permitidos=None`; restricted known likely. Condition should reject if not restricted. If restricted with material in accessible (restricted tier list maybe includes restringido) reject. Good.
Maybe use field `dni_prestatario` for error? The direct endpoint UI likely maps `dni_prestatario`. Better `"dni_prestatario"` so frontend maps to dni. But this is about exception; could use `"es_excepcion"` not mapped. We can map frontend. Test expects maybe `es_excepcion`. Plan not specify. Use "es_excepcion" semantically. Frontend can map. But direct API callers get clear. Use `es_excepcion`.
Also when regular loan user tier insufficient, message existing. Good.

`_validar_documentos_garantia(material, ..., es_excepcion=False)`: if not `requiere_garantia` and docs present message.Need messages. For exception require docs. Use "para préstamos excepcionales" maybe combine:
```
motivo = "préstamos excepcionales" if es_excepcion and not material.requiere_garantia() else "materiales de alto valor"
...
```
If both, "materiales de alto valor o préstamos excepcionales." Simpler `"es obligatorio para préstamos excepcionales y materiales de alto valor."` But existing tests check only field. Fine.
No docs accepted if no requirement and exception false. If exception true, docs accepted and required.

`Prestamo.requiere_garantia` uses `self.es_excepcion or self.material.requiere_garantia()`.
`garantia_completa` thus handles exception.

`registrar_prestamo`: add `es_excepcion=False` keyword. Validate flag must be bool? Internal service, direct view passes True. Could guard? Maybe if not bool raise. Not necessary. But we could ensure `bool`. Keep.

Set `es_excepcion=es_excepcion`.
Create guarantee if `requiere_garantia = material.requiere_garantia() or es_excepcion`; pass to validator. Good.

Double damage:
```
deduccion_dano_base = deduccion_dano
if prestamo.es_excepcion and deduccion_dano:
    deduccion_dano *= 2
```
Use integer. Add `deduccion_dano_base` to result? Existing UI maybe `DevolucionResultadoSerializer` ignores unknown? Serializer fields only; extra input keys in serializer are ignored? DRF Serializer `.data` only fields. No issue. Could add to serializer for display? Not required branch1 but useful. Plan maybe says result include. Let's inspect frontend devolucion to see displays. Search deduccion_dano.

**Tool: bash**

**Input:**
```json
{
  "command": "grep -RIn 'deduccion_dano' frontend/src backend/apps/prestamos --exclude='tests.py'",
  "workdir": "/home/shiarowo/PERSONAL/Presticad"
}
```

**Output:**
```
frontend/src/catalogo/fichaTecnica.js:69:    deduccionDanoParcial: material.deduccion_dano_parcial ?? 30,
frontend/src/catalogo/fichaTecnica.js:70:    deduccionDanoTotal: material.deduccion_dano_total ?? 60,
frontend/src/catalogo/fichaTecnica.test.js:44:      deduccion_dano_parcial: 40,
frontend/src/catalogo/fichaTecnica.test.js:45:      deduccion_dano_total: 100,
frontend/src/components/prestamos/DetallePrestamo.jsx:262:                {material?.deduccion_dano_parcial} puntos
frontend/src/components/prestamos/DetallePrestamo.jsx:265:                {material?.deduccion_dano_total} puntos
frontend/src/components/MaterialForm.jsx:47:  { campo: 'deduccion_dano_parcial', etiqueta: 'Deducción por daño parcial' },
frontend/src/components/MaterialForm.jsx:48:  { campo: 'deduccion_dano_total', etiqueta: 'Deducción por daño total' },
frontend/src/components/MaterialForm.jsx:55:    deduccion_dano_parcial: '20',
frontend/src/components/MaterialForm.jsx:56:    deduccion_dano_total: '40',
frontend/src/components/MaterialForm.jsx:61:    deduccion_dano_parcial: '30',
frontend/src/components/MaterialForm.jsx:62:    deduccion_dano_total: '60',
frontend/src/components/MaterialForm.jsx:67:    deduccion_dano_parcial: '40',
frontend/src/components/MaterialForm.jsx:68:    deduccion_dano_total: '80',
frontend/src/components/MaterialForm.jsx:120:  deduccion_dano_parcial: '30',
frontend/src/components/MaterialForm.jsx:121:  deduccion_dano_total: '60',
frontend/src/pages/DevolucionPrestamo.jsx:122:        {estimacion.hay_dano && estimacion.deduccion_dano > 0
frontend/src/pages/DevolucionPrestamo.jsx:123:          ? ` (−${estimacion.deduccion_dano} puntos)`
backend/apps/prestamos/consultar_serializers.py:138:            "deduccion_dano_parcial",
backend/apps/prestamos/consultar_serializers.py:139:            "deduccion_dano_total",
backend/apps/prestamos/consultar_serializers.py:227:    deduccion_dano_parcial = serializers.IntegerField(
backend/apps/prestamos/consultar_serializers.py:228:        source="material.deduccion_dano_parcial",
backend/apps/prestamos/consultar_serializers.py:231:    deduccion_dano_total = serializers.IntegerField(
backend/apps/prestamos/consultar_serializers.py:232:        source="material.deduccion_dano_total",
backend/apps/prestamos/consultar_serializers.py:268:            "deduccion_dano_parcial",
backend/apps/prestamos/consultar_serializers.py:269:            "deduccion_dano_total",
backend/apps/prestamos/serializers.py:400:    deduccion_dano = serializers.IntegerField()
backend/apps/prestamos/serializers.py:461:    deduccion_dano = serializers.IntegerField(
backend/apps/prestamos/serializers.py:462:        source="resultado.deduccion_dano",
backend/apps/prestamos/serializers.py:490:            "deduccion_dano",
backend/apps/prestamos/services.py:861:        deduccion_dano = material.deduccion_dano_total
backend/apps/prestamos/services.py:865:        deduccion_dano = material.deduccion_dano_parcial
backend/apps/prestamos/services.py:869:        deduccion_dano = 0
backend/apps/prestamos/services.py:872:    puntos_delta = bonificacion - deduccion_tardanza - deduccion_dano
backend/apps/prestamos/services.py:884:        "deduccion_dano": deduccion_dano,
backend/apps/prestamos/reportes.py:293:            f"-{resultado['deduccion_dano']} pts"
backend/apps/prestamos/reportes.py:294:            if resultado["deduccion_dano"]

```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 3.3s)

_Thinking:_

Could add `deduccion_dano_base` to result for clarity and serializer maybe not needed. Plan suggested "duplicar solo deducción por daño". Tests can assert. Maybe add base field to result and serializer? Existing `DevolucionResultadoSerializer` is explicit. If not exposed UI no concern. But user sees deducted 60 not explaining exception. Could include "deduccion_dano_base" and frontend show maybe. But branch1 scope? Could be nice. However adding field to serializer is backwards compatible. Need update `DevolucionResultadoSerializer` to include optional `deduccion_dano_base` maybe. Also `DevolucionReporteSerializer` maybe not. Let's inspect result serializers at 440+.

**Tool: bash**

**Input:**
```json
{
  "command": "sed -n '430,510p' backend/apps/prestamos/serializers.py && sed -n '100,145p' frontend/src/pages/DevolucionPrestamo.jsx && sed -n '280,300p' backend/apps/prestamos/reportes.py",
  "workdir": "/home/shiarowo/PERSONAL/Presticad"
}
```

**Output:**
```
    fecha_hasta = serializers.DateField(required=False)
    gestor_id = serializers.IntegerField(required=False, min_value=1)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        fecha_desde = attrs.get("fecha_desde")
        fecha_hasta = attrs.get("fecha_hasta")
        if fecha_desde and fecha_hasta and fecha_desde > fecha_hasta:
            raise serializers.ValidationError(
                {"fecha_desde": "La fecha inicial no puede ser posterior a la final."}
            )
        return attrs


class ReporteDevolucionSerializer(serializers.ModelSerializer):
    """Fila del listado de reportes de daños (consulta y descarga, RN10)."""

    devolucion_id = serializers.IntegerField(source="id", read_only=True)
    prestamo_id = serializers.IntegerField(source="prestamo.id", read_only=True)
    material_nombre = serializers.CharField(
        source="prestamo.material.nombre",
        read_only=True,
    )
    material_codigo = serializers.CharField(
        source="prestamo.material.codigo_material",
        read_only=True,
    )
    codigo_ejemplar = serializers.SerializerMethodField()
    prestatario_nombre = serializers.SerializerMethodField()
    gestor_nombre = serializers.SerializerMethodField()
    dano = serializers.CharField(source="resultado.dano", read_only=True)
    deduccion_dano = serializers.IntegerField(
        source="resultado.deduccion_dano",
        read_only=True,
    )
    cobro_economico = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        source="resultado.cobro_economico",
        allow_null=True,
        read_only=True,
    )
    puntos_delta = serializers.IntegerField(
        source="resultado.puntos_delta",
        read_only=True,
    )
    reporte_url = serializers.SerializerMethodField()

    class Meta:
        model = Devolucion
        fields = (
            "devolucion_id",
            "prestamo_id",
            "material_nombre",
            "material_codigo",
            "codigo_ejemplar",
            "prestatario_nombre",
            "gestor_nombre",
            "fecha_devolucion",
            "dano",
            "deduccion_dano",
            "cobro_economico",
            "puntos_delta",
            "reporte_url",
        )
        read_only_fields = fields

    def get_prestatario_nombre(self, devolucion):
        usuario = devolucion.prestamo.usuario
        return f"{usuario.nombre} {usuario.apellido}".strip()

    def get_codigo_ejemplar(self, devolucion):
        prestamo = devolucion.prestamo
        return prestamo.instancia.codigo_ejemplar if prestamo.instancia_id else None

    def get_gestor_nombre(self, devolucion):
        gestor = devolucion.realizado_por
        return f"{gestor.nombre} {gestor.apellido}".strip()

    def get_reporte_url(self, devolucion):
        return url_reporte_publica(devolucion)

  return (
    <div
      className="grid gap-3 rounded-xl border border-borde bg-superficie p-4 sm:grid-cols-2 lg:grid-cols-3"
      aria-live="polite"
    >
      <CampoResumen etiqueta="Entrega">
        {estimacion.a_tiempo
          ? 'A tiempo (sin tardanza)'
          : estimacion.en_tiempo_gracia || estimacion.dias_tardanza === 0
            ? 'En tiempo de gracia (30 min, sin sanción)'
            : `Tardía por ${estimacion.dias_tardanza} día(s)`}
      </CampoResumen>
      <CampoResumen etiqueta="Sanción por tiempo">
        {estimacion.a_tiempo
          ? `Bonificación +${estimacion.bonificacion} puntos`
          : estimacion.en_tiempo_gracia || estimacion.dias_tardanza === 0
            ? '0 puntos (tiempo de gracia de 30 min)'
            : `Deducción −${estimacion.deduccion_tardanza} puntos`}
      </CampoResumen>
      <CampoResumen etiqueta="Daño detectado">
        {ETIQUETAS_DANO[estimacion.dano]}
        {estimacion.hay_dano && estimacion.deduccion_dano > 0
          ? ` (−${estimacion.deduccion_dano} puntos)`
          : ''}
      </CampoResumen>
      <CampoResumen etiqueta="Cobro económico">
        {cobro ?? 'Sin cobro por daños'}
      </CampoResumen>
      <CampoResumen etiqueta="Puntos de reputación">
        <span className={tono === 'exito' ? 'text-acento-700' : 'text-error'}>
          {firmarPuntos(estimacion.puntos_delta)}
        </span>
      </CampoResumen>
      <CampoResumen etiqueta="Reputación resultante">
        {estimacion.reputacion_antes} ({etiquetaTier(estimacion.tier_antes)}) →{' '}
        {estimacion.reputacion_despues} ({etiquetaTier(estimacion.tier_despues)})
      </CampoResumen>
    </div>
  )
}

function DevolucionPrestamo() {
  useTituloPagina('Registrar devolución')
  const { prestamoId: parametroId } = useParams()
  const navigate = useNavigate()
            else "No aplica (entrega fuera de plazo)",
        ),
        (
            Paragraph(
                f"Deducción por tardanza · {resultado['dias_tardanza']} día(s)",
                estilos["celda_negrita"],
            ),
            f"-{resultado['deduccion_tardanza']} pts"
            if resultado["deduccion_tardanza"]
            else "No aplica",
        ),
        (
            Paragraph("Deducción por daño", estilos["celda_negrita"]),
            f"-{resultado['deduccion_dano']} pts"
            if resultado["deduccion_dano"]
            else "No aplica",
        ),
        (
            Paragraph("Impacto neto en reputación", estilos["celda_negrita"]),
            f"{resultado['puntos_delta']:+d} pts",
        ),

```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 4.0s)

_Thinking:_

Could leave UI showing total. Add base optional only maybe not necessary. Keep minimal.

Need also maybe `PrestamoDevolucionDetalleSerializer` include `es_excepcion` so devolution page can show? Plan says badge list/detail. Direct detail serializer `PrestamoHistorialDetalle` include. `PrestamoConsulta`, `PrestamoHistorial`, `PrestamoRegistro` include. Maybe `PrestamoDevolucionDetalle` include too. Good.

Need `RegistrarPrestamo` direct endpoint response includes `es_excepcion`. `PrestamoRegistro` fields.

Need tests:
- service direct exception restricted user with tier higher, docs required, creates guarantee, es_excepcion true, requires guarantee.
- rejects non-restricted, rejects accessible material.
- regular endpoint does not allow `es_excepcion` field (already mixin rejects unknown; not needed).
- API direct endpoint manager-only, forces flag, returns 201.
- devolution double damage only; perhaps one service test using direct prestamo created via `_registrar(es_excepcion=True...)`. Need inspect DevolucionBase setup for creating.

**Tool: bash**

**Input:**
```json
{
  "command": "sed -n '1831,1960p' backend/apps/prestamos/tests.py && sed -n '2128,2185p' backend/apps/prestamos/tests.py",
  "workdir": "/home/shiarowo/PERSONAL/Presticad"
}
```

**Output:**
```
class DevolucionBaseTestCase(TestCase):
    """Escenario compartido HU11: préstamo vigente con checklist de entrega."""

    def setUp(self):
        self.gestor = crear_usuario("gestor-dev@unsa.edu.pe", "10000021", rol="gestor")
        self.prestatario = crear_usuario("ana-dev@unsa.edu.pe", "10000022")
        self.material = crear_material(
            nombre="Proyector Dev",
            codigo_material="EQ-101",
            costo_reparacion="40.00",
            costo_reposicion="200.00",
        )
        self.prestamo = registrar_prestamo(
            dni_prestatario=self.prestatario.dni,
            material_id=self.material.id,
            tiempo_prestamo_dias=3,
            checklist_inicial=CHECKLIST,
            registrado_por=self.gestor,
        )
        self.checklist_ok = [
            {"elemento": "Carcasa", "estado": "sin_cambios", "observacion": ""},
            {"elemento": "Cable", "estado": "sin_cambios", "observacion": ""},
        ]

    def _devolver(self, fecha_devolucion=None, checklist=None, fotos_checklist=None):
        checklist = self.checklist_ok if checklist is None else checklist
        if fotos_checklist is None:
            fotos_checklist = [
                crear_foto_checklist()
                if item.get("estado") in ("dano_parcial", "dano_total")
                else None
                for item in checklist
            ]
        with patch.object(
            FotoChecklist._meta.get_field("imagen"),
            "storage",
            _ALMACENAMIENTO_FOTOS_TEST,
        ):
            return registrar_devolucion(
                prestamo_id=self.prestamo.id,
                checklist_devolucion=checklist,
                fotos_checklist=fotos_checklist,
                realizado_por=self.gestor,
                fecha_devolucion=fecha_devolucion,
            )

    def _marcar_prestatario(self, puntaje, tier):
        self.prestatario.reputacion_puntaje = puntaje
        self.prestatario.reputacion_tier = tier
        self.prestatario.save(
            update_fields=["reputacion_puntaje", "reputacion_tier", "updated_at"],
        )


class EstimarDevolucionServiceTestCase(DevolucionBaseTestCase):
    def test_estimar_devuelve_resultado_sin_persistir_nada(self):
        resultado = estimar_devolucion(
            prestamo_id=self.prestamo.id,
            checklist_devolucion=self.checklist_ok,
            fecha_devolucion=self.prestamo.fecha_limite,
        )

        self.assertTrue(resultado["a_tiempo"])
        self.assertEqual(resultado["bonificacion"], 15)
        self.assertEqual(resultado["dano"], "sin_cambios")
        self.assertEqual(resultado["puntos_delta"], 15)
        self.assertEqual(resultado["reputacion_despues"], 15)
        self.assertEqual(Devolucion.objects.count(), 0)
        self.prestamo.refresh_from_db()
        self.assertEqual(self.prestamo.estado, "activo")
        self.prestatario.refresh_from_db()
        self.assertEqual(self.prestatario.reputacion_puntaje, 0)

    def test_estimar_coincide_con_lo_que_luego_registra(self):
        checklist = [
            {"elemento": "Carcasa", "estado": "dano_parcial", "observacion": "Rasguño"},
            {"elemento": "Cable", "estado": "sin_cambios", "observacion": ""},
        ]
        estimado = estimar_devolucion(
            prestamo_id=self.prestamo.id,
            checklist_devolucion=checklist,
            fecha_devolucion=self.prestamo.fecha_limite,
        )

        devolucion = self._devolver(
            fecha_devolucion=self.prestamo.fecha_limite,
            checklist=checklist,
        )

        self.assertEqual(devolucion.resultado, estimado)

    def test_estimar_rechaza_checklist_invalido(self):
        with self.assertRaises(PrestamoError) as contexto:
            estimar_devolucion(prestamo_id=self.prestamo.id, checklist_devolucion=[])

        self.assertEqual(contexto.exception.status_code, 400)

    def test_estimar_rechaza_prestamo_inexistente(self):
        with self.assertRaises(PrestamoError) as contexto:
            estimar_devolucion(
                prestamo_id=99999,
                checklist_devolucion=self.checklist_ok,
            )

        self.assertEqual(contexto.exception.status_code, 404)

    def test_estimar_rechaza_prestamo_ya_devuelto(self):
        self._devolver()

        with self.assertRaises(PrestamoError) as contexto:
            estimar_devolucion(
                prestamo_id=self.prestamo.id,
                checklist_devolucion=self.checklist_ok,
            )

        self.assertEqual(contexto.exception.status_code, 409)


class RegistrarDevolucionServiceTestCase(DevolucionBaseTestCase):
    def test_dano_parcial_y_total_requieren_foto(self):
        for estado in ("dano_parcial", "dano_total"):
            with self.subTest(estado=estado):
                checklist = [
                    {"elemento": "Carcasa", "estado": estado, "observacion": "Daño visible"},
                    {"elemento": "Cable", "estado": "sin_cambios", "observacion": ""},
                ]

                with self.assertRaises(PrestamoError) as contexto:
                    self._devolver(checklist=checklist, fotos_checklist=[None, None])

        self.assertEqual(resultado["deduccion_tardanza"], 10)
        self.assertEqual(resultado["puntos_delta"], -10)

    def test_dano_parcial_guarda_el_contrato_actual_del_checklist(self):
        checklist = [
            {"elemento": "Carcasa", "estado": "dano_parcial", "observacion": "Rasguño"},
            {"elemento": "Cable", "estado": "sin_cambios", "observacion": ""},
        ]

        devolucion = self._devolver(
            fecha_devolucion=self.prestamo.fecha_limite,
            checklist=checklist,
        )

        resultado = devolucion.resultado
        self.assertEqual(resultado["dano"], "dano_parcial")
        self.assertEqual(resultado["deduccion_dano"], 30)
        self.assertEqual(resultado["cobro_economico"], "40.00")
        self.assertEqual(resultado["puntos_delta"], -15)
        self.assertEqual(
            set(devolucion.checklist_devolucion[0]),
            {"elemento", "estado", "observacion"},
        )

    def test_dano_total_aplica_deduccion_y_cobro_de_reposicion(self):
        checklist = [
            {"elemento": "Carcasa", "estado": "dano_total", "observacion": "Roto"},
            {"elemento": "Cable", "estado": "sin_cambios", "observacion": ""},
        ]

        devolucion = self._devolver(
            fecha_devolucion=self.prestamo.fecha_limite,
            checklist=checklist,
        )

        resultado = devolucion.resultado
        self.assertEqual(resultado["dano"], "dano_total")
        self.assertEqual(resultado["deduccion_dano"], 60)
        self.assertEqual(resultado["cobro_economico"], "200.00")
        self.assertEqual(resultado["puntos_delta"], -45)

    def test_cobro_nulo_cuando_el_material_no_tiene_costo_parametrizado(self):
        self.material.costo_reparacion = None
        self.material.costo_reposicion = None
        self.material.save(update_fields=["costo_reparacion", "costo_reposicion"])
        checklist = [
            {"elemento": "Carcasa", "estado": "dano_parcial", "observacion": "Leve"},
            {"elemento": "Cable", "estado": "sin_cambios", "observacion": ""},
        ]

        devolucion = self._devolver(fecha_devolucion=self.prestamo.fecha_limite, checklist=checklist)

        self.assertEqual(devolucion.resultado["dano"], "dano_parcial")
        self.assertIsNone(devolucion.resultado["cobro_economico"])

    def test_el_peor_dano_prevalece_entre_elementos(self):
        checklist = [
            {"elemento": "Carcasa", "estado": "dano_parcial", "observacion": "Rasguño"},

```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 4.1s)

_Thinking:_

Add test in DevolucionBase? Can modify prestamo.es_excepcion=True and save then devolver damage. Need guarantee not relevant. Example:
```
self.prestamo.es_excepcion=True; save
devolucion = self._devolver(... damage)
assert deduccion_dano=60, puntos_delta=-45? Material partial 30, double 60, no tardanza => -60. Wait existing partial test had -15? Why? Existing test `test_dano_parcial...` showed deduccion 30 and puntos -15. Huh bonificación? At fecha_limite a_tiempo True, bonificacion=15, so 15-30=-15. So double 60 => 15-60=-45. Good.
```
Maybe test total: 15-120=-105. Fine. Also assert `cobro_economico` remains 40.

Need migration. Add model field then `python manage.py makemigrations prestamos` maybe environment? Check README for commands / venv. Need inspect.

**Tool: bash**

**Input:**
```json
{
  "command": "ls -la backend && ls -la && find . -maxdepth 2 -type f \\( -name 'manage.py' -o -name 'pyproject.toml' -o -name 'requirements*.txt' -o -name 'package.json' \\) -print",
  "workdir": "/home/shiarowo/PERSONAL/Presticad"
}
```

**Output:**
```
total 52
drwxrwxr-x 7 shiarowo shiarowo 4096 Nov  2 17:43 .
drwxrwxr-x 6 shiarowo shiarowo 4096 Nov  2 16:11 ..
-rw-rw-r-- 1 shiarowo shiarowo   30 Sep 22 20:01 .dockerignore
-rw-rw-r-- 1 shiarowo shiarowo  602 Oct 27 16:08 .env.example
-rw-rw-r-- 1 shiarowo shiarowo  384 Oct 19 16:51 Dockerfile
-rw-rw-r-- 1 shiarowo shiarowo  632 Oct 27 16:08 Dockerfile.prod
drwxrwxr-x 2 shiarowo shiarowo 4096 Sep 22 19:14 __pycache__
drwxrwxr-x 7 shiarowo shiarowo 4096 Oct  7 07:07 apps
drwxrwxr-x 3 shiarowo shiarowo 4096 Oct  7 07:07 config
-rw-rw-r-- 1 shiarowo shiarowo  572 Sep 27 16:44 manage.py
drwxr-xr-x 5 root     root     4096 Nov  2 17:20 media
drwxr-xr-x 3 root     root     4096 Oct 27 10:25 privado
-rw-rw-r-- 1 shiarowo shiarowo  236 Nov  2 17:43 requirements.txt
total 48
drwxrwxr-x 6 shiarowo shiarowo 4096 Nov  2 16:11 .
drwxrwxr-x 8 shiarowo shiarowo 4096 Oct 25 20:38 ..
-rw-rw-r-- 1 shiarowo shiarowo  335 Sep 22 21:18 .env
-rw-rw-r-- 1 shiarowo shiarowo  745 Oct 27 16:08 .env.example
drwxrwxr-x 7 shiarowo shiarowo 4096 Nov  2 19:56 .git
-rw-rw-r-- 1 shiarowo shiarowo  310 Oct 19 16:51 .gitignore
-rw-rw-r-- 1 shiarowo shiarowo 7535 Nov  2 16:11 README.md
drwxrwxr-x 7 shiarowo shiarowo 4096 Nov  2 17:43 backend
-rw-rw-r-- 1 shiarowo shiarowo  926 Oct 27 16:08 docker-compose.yml
drwxrwxr-x 5 shiarowo shiarowo 4096 Nov  2 19:55 docs
drwxrwxr-x 7 shiarowo shiarowo 4096 Nov  2 17:43 frontend
./frontend/package.json
./backend/manage.py
./backend/requirements.txt

```

**Tool: bash**

**Input:**
```json
{
  "command": "grep -RIn 'makemigrations\\|pytest\\|manage.py test\\|npm test\\|npm run lint' README* backend/README* frontend/README* docs 2>/dev/null | head -80",
  "workdir": "/home/shiarowo/PERSONAL/Presticad"
}
```

**Output:**
```
README.md:114:docker compose exec backend python manage.py test
README.md:142:├── migrations/      # Migraciones (solo vía makemigrations/migrate)
docs/plan-reservas-excepciones.md:774:docker compose exec backend python manage.py makemigrations --check
docs/plan-reservas-excepciones.md:775:docker compose exec backend python manage.py test
docs/plan-reservas-excepciones.md:776:cd frontend && npm test && npm run build

```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 3.0s)

_Thinking:_

Need use docker? Check containers maybe. We'll code first. Use edit.

Need exact modifications. Let's update todo.

**Tool: todowrite**

**Input:**
```json
{
  "todos": [
    {
      "content": "Crear rama feature/prestamo-excepcional",
      "status": "completed",
      "priority": "high"
    },
    {
      "content": "Agregar Prestamo.es_excepcion y migración",
      "status": "in_progress",
      "priority": "high"
    },
    {
      "content": "Implementar servicios de excepción directa y doble daño",
      "status": "pending",
      "priority": "high"
    },
    {
      "content": "Agregar endpoint, serializers y frontend de excepción",
      "status": "pending",
      "priority": "high"
    },
    {
      "content": "Escribir y ejecutar pruebas backend/frontend",
      "status": "pending",
      "priority": "high"
    }
  ]
}
```

**Output:**
```
[
  {
    "content": "Crear rama feature/prestamo-excepcional",
    "status": "completed",
    "priority": "high"
  },
  {
    "content": "Agregar Prestamo.es_excepcion y migración",
    "status": "in_progress",
    "priority": "high"
  },
  {
    "content": "Implementar servicios de excepción directa y doble daño",
    "status": "pending",
    "priority": "high"
  },
  {
    "content": "Agregar endpoint, serializers y frontend de excepción",
    "status": "pending",
    "priority": "high"
  },
  {
    "content": "Escribir y ejecutar pruebas backend/frontend",
    "status": "pending",
    "priority": "high"
  }
]
```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 2.8s)

_Thinking:_

Implement model.

**Tool: edit**

**Input:**
```json
{
  "filePath": "/home/shiarowo/PERSONAL/Presticad/backend/apps/prestamos/models.py",
  "oldString": "    estado = models.CharField(\n        max_length=20,\n        choices=ESTADOS_PRESTAMO,\n        default=\"activo\",\n    )\n    checklist_inicial = models.JSONField(default=list)",
  "newString": "    estado = models.CharField(\n        max_length=20,\n        choices=ESTADOS_PRESTAMO,\n        default=\"activo\",\n    )\n    es_excepcion = models.BooleanField(\n        default=False,\n        help_text=\"Préstamo autorizado pese a que el Tier del usuario no permite el material.\",\n    )\n    checklist_inicial = models.JSONField(default=list)"
}
```

**Output:**
```
Edit applied successfully.
```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 2.9s)

**Tool: edit**

**Input:**
```json
{
  "filePath": "/home/shiarowo/PERSONAL/Presticad/backend/apps/prestamos/models.py",
  "oldString": "    @property\n    def requiere_garantia(self):\n        return self.material.requiere_garantia()",
  "newString": "    @property\n    def requiere_garantia(self):\n        return self.es_excepcion or self.material.requiere_garantia()"
}
```

**Output:**
```
Edit applied successfully.
```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 4.2s)

_Thinking:_

Now services edits. Need careful exact.

**Tool: edit**

**Input:**
```json
{
  "filePath": "/home/shiarowo/PERSONAL/Presticad/backend/apps/prestamos/services.py",
  "oldString": "def _validar_elegibilidad(usuario, material):\n    if usuario.rol.nombre != \"prestatario\":\n        raise PrestamoError(\n            \"dni_prestatario\",\n            \"El usuario indicado no tiene el rol de prestatario.\",\n        )\n    if usuario.estado != \"activo\":\n        raise PrestamoError(\n            \"dni_prestatario\",\n            \"El usuario no está habilitado para recibir préstamos.\",\n        )\n\n    tiers_permitidos = TIERS_ACCESIBLES.get(usuario.reputacion_tier)\n    if tiers_permitidos is None or material.tier_minimo_requerido not in tiers_permitidos:\n        raise PrestamoError(\n            \"dni_prestatario\",\n            \"El Tier de reputación del usuario no permite recibir este material.\",\n        )",
  "newString": "def _validar_elegibilidad(usuario, material, *, es_excepcion=False):\n    if usuario.rol.nombre != \"prestatario\":\n        raise PrestamoError(\n            \"dni_prestatario\",\n            \"El usuario indicado no tiene el rol de prestatario.\",\n        )\n    if usuario.estado != \"activo\":\n        raise PrestamoError(\n            \"dni_prestatario\",\n            \"El usuario no está habilitado para recibir préstamos.\",\n        )\n\n    tiers_permitidos = TIERS_ACCESIBLES.get(usuario.reputacion_tier)\n    if es_excepcion:\n        if (\n            usuario.reputacion_tier != \"restringido\"\n            or tiers_permitidos is None\n            or material.tier_minimo_requerido in tiers_permitidos\n        ):\n            raise PrestamoError(\n                \"es_excepcion\",\n                \"El préstamo excepcional solo aplica a usuarios Restringidos \"\n                \"con material de un Tier superior.\",\n            )\n        return\n\n    if tiers_permitidos is None or material.tier_minimo_requerido not in tiers_permitidos:\n        raise PrestamoError(\n            \"dni_prestatario\",\n            \"El Tier de reputación del usuario no permite recibir este material.\",\n        )"
}
```

**Output:**
```
Edit applied successfully.
```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 4.1s)

**Tool: edit**

**Input:**
```json
{
  "filePath": "/home/shiarowo/PERSONAL/Presticad/backend/apps/prestamos/services.py",
  "oldString": "def _validar_documentos_garantia(material, documento_identidad, compromiso_responsabilidad):\n    documentos = (\n        (\"documento_identidad\", documento_identidad, \"El documento de identidad en PDF\"),\n        (\n            \"compromiso_responsabilidad\",\n            compromiso_responsabilidad,\n            \"El compromiso de responsabilidad en PDF\",\n        ),\n    )\n    requiere_garantia = material.requiere_garantia()\n    if not requiere_garantia:\n        for campo, archivo, _ in documentos:\n            if archivo is not None:\n                raise PrestamoError(\n                    campo,\n                    \"Este material no requiere documentos de garantía.\",\n                )\n    if requiere_garantia:\n        for campo, archivo, descripcion in documentos:\n            if archivo is None:\n                raise PrestamoError(\n                    campo,\n                    f\"{descripcion} es obligatorio para materiales de alto valor.\",\n                )",
  "newString": "def _validar_documentos_garantia(\n    material,\n    documento_identidad,\n    compromiso_responsabilidad,\n    *,\n    es_excepcion=False,\n):\n    documentos = (\n        (\"documento_identidad\", documento_identidad, \"El documento de identidad en PDF\"),\n        (\n            \"compromiso_responsabilidad\",\n            compromiso_responsabilidad,\n            \"El compromiso de responsabilidad en PDF\",\n        ),\n    )\n    requiere_garantia = es_excepcion or material.requiere_garantia()\n    if not requiere_garantia:\n        for campo, archivo, _ in documentos:\n            if archivo is not None:\n                raise PrestamoError(\n                    campo,\n                    \"Este material no requiere documentos de garantía.\",\n                )\n    if requiere_garantia:\n        for campo, archivo, descripcion in documentos:\n            if archivo is None:\n                raise PrestamoError(\n                    campo,\n                    f\"{descripcion} es obligatorio para préstamos excepcionales \"\n                    \"y materiales de alto valor.\",\n                )"
}
```

**Output:**
```
Edit applied successfully.
```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 3.0s)

_Thinking:_

Now registrar_prestamo.

**Tool: edit**

**Input:**
```json
{
  "filePath": "/home/shiarowo/PERSONAL/Presticad/backend/apps/prestamos/services.py",
  "oldString": "    registrado_por,\n    documento_identidad=None,\n    compromiso_responsabilidad=None,\n    fecha_entrega=None,\n):\n    \"\"\"Registra la entrega con elegibilidad, garantía y control atómico de stock.\"\"\"",
  "newString": "    registrado_por,\n    documento_identidad=None,\n    compromiso_responsabilidad=None,\n    fecha_entrega=None,\n    es_excepcion=False,\n):\n    \"\"\"Registra la entrega con elegibilidad, garantía y control atómico de stock.\"\"\""
}
```

**Output:**
```
Edit applied successfully.
```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 3.0s)

**Tool: edit**

**Input:**
```json
{
  "filePath": "/home/shiarowo/PERSONAL/Presticad/backend/apps/prestamos/services.py",
  "oldString": "    _validar_elegibilidad(prestatario, material)\n    _validar_duracion_material(material, minutos_prestamo, campo_duracion)",
  "newString": "    _validar_elegibilidad(prestatario, material, es_excepcion=es_excepcion)\n    _validar_duracion_material(material, minutos_prestamo, campo_duracion)"
}
```

**Output:**
```
Edit applied successfully.
```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 2.8s)

**Tool: edit**

**Input:**
```json
{
  "filePath": "/home/shiarowo/PERSONAL/Presticad/backend/apps/prestamos/services.py",
  "oldString": "    requiere_garantia = material.requiere_garantia()\n    _validar_documentos_garantia(\n        material,\n        documento_identidad,\n        compromiso_responsabilidad,\n    )",
  "newString": "    requiere_garantia = es_excepcion or material.requiere_garantia()\n    _validar_documentos_garantia(\n        material,\n        documento_identidad,\n        compromiso_responsabilidad,\n        es_excepcion=es_excepcion,\n    )"
}
```

**Output:**
```
Edit applied successfully.
```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 2.9s)

**Tool: edit**

**Input:**
```json
{
  "filePath": "/home/shiarowo/PERSONAL/Presticad/backend/apps/prestamos/services.py",
  "oldString": "        tiempo_prestamo_dias=dias_prestamo,\n        estado=\"activo\",\n        checklist_inicial=checklist_inicial,\n        instancia_id=instancia_elegida[\"id\"],\n    )",
  "newString": "        tiempo_prestamo_dias=dias_prestamo,\n        estado=\"activo\",\n        es_excepcion=es_excepcion,\n        checklist_inicial=checklist_inicial,\n        instancia_id=instancia_elegida[\"id\"],\n    )"
}
```

**Output:**
```
Edit applied successfully.
```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 3.5s)

_Thinking:_

Double damage. Add base field maybe. Let's add `deduccion_dano_base` to result and serializer optional perhaps. But not necessary. Plan said double only damage. If only apply total and leave base, clear. Add field `deduccion_dano_base` for audit and include serializer. But tests current exact dict equality estimate vs register still okay if both include. External API adds. Could add. Might frontend ignore. Fine. Do.

**Tool: edit**

**Input:**
```json
{
  "filePath": "/home/shiarowo/PERSONAL/Presticad/backend/apps/prestamos/services.py",
  "oldString": "    else:\n        dano = \"sin_cambios\"\n        deduccion_dano = 0\n        cobro = None\n\n    puntos_delta = bonificacion - deduccion_tardanza - deduccion_dano",
  "newString": "    else:\n        dano = \"sin_cambios\"\n        deduccion_dano = 0\n        cobro = None\n\n    deduccion_dano_base = deduccion_dano\n    if prestamo.es_excepcion:\n        deduccion_dano *= 2\n\n    puntos_delta = bonificacion - deduccion_tardanza - deduccion_dano"
}
```

**Output:**
```
Edit applied successfully.
```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 3.0s)

**Tool: edit**

**Input:**
```json
{
  "filePath": "/home/shiarowo/PERSONAL/Presticad/backend/apps/prestamos/services.py",
  "oldString": "        \"dano\": dano,\n        \"hay_dano\": dano != \"sin_cambios\",\n        \"deduccion_dano\": deduccion_dano,\n        \"cobro_economico\": str(cobro) if cobro is not None else None,",
  "newString": "        \"dano\": dano,\n        \"hay_dano\": dano != \"sin_cambios\",\n        \"deduccion_dano_base\": deduccion_dano_base,\n        \"deduccion_dano\": deduccion_dano,\n        \"cobro_economico\": str(cobro) if cobro is not None else None,"
}
```

**Output:**
```
Edit applied successfully.
```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 2.7s)

_Thinking:_

Need serializers add es_excepcion and deduccion base. Do all.

**Tool: edit**

**Input:**
```json
{
  "filePath": "/home/shiarowo/PERSONAL/Presticad/backend/apps/prestamos/serializers.py",
  "oldString": "            \"tiempo_prestamo_dias\",\n            \"estado\",\n            \"checklist_inicial\",\n            \"requiere_garantia\",",
  "newString": "            \"tiempo_prestamo_dias\",\n            \"estado\",\n            \"es_excepcion\",\n            \"checklist_inicial\",\n            \"requiere_garantia\","
}
```

**Output:**
```
Edit applied successfully.
```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 2.8s)

**Tool: bash**

**Input:**
```json
{
  "command": "grep -n '\"tiempo_prestamo_dias\",' backend/apps/prestamos/serializers.py backend/apps/prestamos/consultar_serializers.py",
  "workdir": "/home/shiarowo/PERSONAL/Presticad"
}
```

**Output:**
```
backend/apps/prestamos/serializers.py:260:            "tiempo_prestamo_dias",
backend/apps/prestamos/consultar_serializers.py:71:            "tiempo_prestamo_dias",
backend/apps/prestamos/consultar_serializers.py:103:            "tiempo_prestamo_dias",
backend/apps/prestamos/consultar_serializers.py:190:            "tiempo_prestamo_dias",
backend/apps/prestamos/consultar_serializers.py:261:            "tiempo_prestamo_dias",

```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 3.3s)

_Thinking:_

Add es_excepcion to all consultar fieldsets. Use replace all? Exact pattern appears five with state. We can replace all occurrences of `"tiempo_prestamo_dias",\n            "estado",` with adding. Could `replaceAll`.

**Tool: edit**

**Input:**
```json
{
  "filePath": "/home/shiarowo/PERSONAL/Presticad/backend/apps/prestamos/consultar_serializers.py",
  "oldString": "            \"tiempo_prestamo_dias\",\n            \"estado\",",
  "newString": "            \"tiempo_prestamo_dias\",\n            \"estado\",\n            \"es_excepcion\",",
  "replaceAll": true
}
```

**Output:**
```
Edit applied successfully.
```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 3.1s)

_Thinking:_

Add deduccion base serializer.

**Tool: edit**

**Input:**
```json
{
  "filePath": "/home/shiarowo/PERSONAL/Presticad/backend/apps/prestamos/serializers.py",
  "oldString": "    dano = serializers.ChoiceField(choices=ESTADOS_CHECKLIST_DEVOLUCION)\n    hay_dano = serializers.BooleanField()\n    deduccion_dano = serializers.IntegerField()",
  "newString": "    dano = serializers.ChoiceField(choices=ESTADOS_CHECKLIST_DEVOLUCION)\n    hay_dano = serializers.BooleanField()\n    deduccion_dano_base = serializers.IntegerField(required=False)\n    deduccion_dano = serializers.IntegerField()"
}
```

**Output:**
```
Edit applied successfully.
```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 5.4s)

_Thinking:_

Need view and url. Add subclass or shared helper. Minimal subclass:
```
class RegistrarPrestamoExcepcionalView(APIView):
 permission...
 def post: same serializer, registrar_prestamo(**..., es_excepcion=True)
```
Could avoid duplicate by refactor `_registrar(request, es_excepcion)`. But simple duplication ~15 lines okay. Better refactor common function to avoid. Existing view simple. Add private function `_crear_prestamo(request, *, es_excepcion=False)` returning Response, then classes. But simplicity. Let's modify.

**Tool: edit**

**Input:**
```json
{
  "filePath": "/home/shiarowo/PERSONAL/Presticad/backend/apps/prestamos/views.py",
  "oldString": "class RegistrarPrestamoView(APIView):\n    \"\"\"Registra la entrega de un material: POST /api/prestamos/.\"\"\"\n\n    permission_classes = [EsGestorDeAlmacen]\n    parser_classes = [MultiPartParser, FormParser, JSONParser]\n\n    def post(self, request):\n        serializer = RegistrarPrestamoSerializer(data=request.data)\n        serializer.is_valid(raise_exception=True)\n\n        try:\n            prestamo = registrar_prestamo(\n                **serializer.validated_data,\n                registrado_por=request.usuario_autenticado,\n            )\n        except PrestamoError as error:\n            return Response(\n                {error.campo: [error.mensaje]},\n                status=error.status_code,\n            )\n\n        return Response(\n            PrestamoRegistroSerializer(prestamo).data,\n            status=status.HTTP_201_CREATED,\n        )",
  "newString": "def _registrar_prestamo(request, *, es_excepcion=False):\n    serializer = RegistrarPrestamoSerializer(data=request.data)\n    serializer.is_valid(raise_exception=True)\n\n    try:\n        prestamo = registrar_prestamo(\n            **serializer.validated_data,\n            registrado_por=request.usuario_autenticado,\n            es_excepcion=es_excepcion,\n        )\n    except PrestamoError as error:\n        return Response(\n            {error.campo: [error.mensaje]},\n            status=error.status_code,\n        )\n\n    return Response(\n        PrestamoRegistroSerializer(prestamo).data,\n        status=status.HTTP_201_CREATED,\n    )\n\n\nclass RegistrarPrestamoView(APIView):\n    \"\"\"Registra la entrega de un material: POST /api/prestamos/.\"\"\"\n\n    permission_classes = [EsGestorDeAlmacen]\n    parser_classes = [MultiPartParser, FormParser, JSONParser]\n\n    def post(self, request):\n        return _registrar_prestamo(request)\n\n\nclass RegistrarPrestamoExcepcionalView(APIView):\n    \"\"\"Registra una excepción académica directa: POST /api/prestamos/excepcion/.\"\"\"\n\n    permission_classes = [EsGestorDeAlmacen]\n    parser_classes = [MultiPartParser, FormParser, JSONParser]\n\n    def post(self, request):\n        return _registrar_prestamo(request, es_excepcion=True)"
}
```

**Output:**
```
Edit applied successfully.
```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 2.6s)

**Tool: edit**

**Input:**
```json
{
  "filePath": "/home/shiarowo/PERSONAL/Presticad/backend/apps/prestamos/urls.py",
  "oldString": "    RegistrarDevolucionView,\n    RegistrarPrestamoView,\n    ReporteDevolucionView,\n)",
  "newString": "    RegistrarDevolucionView,\n    RegistrarPrestamoExcepcionalView,\n    RegistrarPrestamoView,\n    ReporteDevolucionView,\n)"
}
```

**Output:**
```
Edit applied successfully.
```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 2.8s)

**Tool: edit**

**Input:**
```json
{
  "filePath": "/home/shiarowo/PERSONAL/Presticad/backend/apps/prestamos/urls.py",
  "oldString": "    path(\"prestamos/\", RegistrarPrestamoView.as_view(), name=\"registrar-prestamo\"),\n    path(",
  "newString": "    path(\"prestamos/\", RegistrarPrestamoView.as_view(), name=\"registrar-prestamo\"),\n    path(\n        \"prestamos/excepcion/\",\n        RegistrarPrestamoExcepcionalView.as_view(),\n        name=\"registrar-prestamo-excepcional\",\n    ),\n    path("
}
```

**Output:**
```
Edit applied successfully.
```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 2.6s)

_Thinking:_

Need migration. Could run makemigrations with environment. Check docker compose ps.

**Tool: bash**

**Input:**
```json
{
  "command": "docker compose ps --format json",
  "workdir": "/home/shiarowo/PERSONAL/Presticad",
  "timeout": 20000
}
```

**Output:**
```
{"Command":"\"sh -c 'python manag…\"","CreatedAt":"2026-11-02 17:18:11 -0500 -05","ExitCode":0,"Health":"","ID":"a8af8513f80f","Image":"presticad-backend","Labels":"com.docker.compose.config-hash=e69088c54cec75f770655e66cc5c5c2b35ff78b432f73b36c1dac1b2a5d3f5af,com.docker.compose.depends_on=db:service_healthy:false,com.docker.compose.image=sha256:944348cfde66aa2ac80d850548a607958356e63fb6e7631ae0dfded6f3bd8c73,com.docker.compose.project=presticad,com.docker.compose.project.config_files=/home/shiarowo/PERSONAL/Presticad/docker-compose.yml,com.docker.compose.project.working_dir=/home/shiarowo/PERSONAL/Presticad,com.docker.compose.service=backend,com.docker.compose.container-number=1,com.docker.compose.oneoff=False,com.docker.compose.version=2.40.3","LocalVolumes":"0","Mounts":"/home/shiarowo…","Name":"presticad-backend-1","Names":"presticad-backend-1","Networks":"presticad_default","Ports":"0.0.0.0:8000-\u003e8000/tcp, [::]:8000-\u003e8000/tcp","Project":"presticad","Publishers":[{"URL":"0.0.0.0","TargetPort":8000,"PublishedPort":8000,"Protocol":"tcp"},{"URL":"::","TargetPort":8000,"PublishedPort":8000,"Protocol":"tcp"}],"RunningFor":"3 hours ago","Service":"backend","Size":"0B","State":"running","Status":"Up 3 hours"}
{"Command":"\"docker-entrypoint.s…\"","CreatedAt":"2026-11-02 17:18:11 -0500 -05","ExitCode":0,"Health":"healthy","ID":"ec90e4153042","Image":"postgres:16","Labels":"com.docker.compose.version=2.40.3,com.docker.compose.config-hash=d9ad5a1b4e507e2e48474cafbd0940751f60d43fdc68334742d4f0eba3409eb2,com.docker.compose.container-number=1,com.docker.compose.depends_on=,com.docker.compose.image=sha256:a3b7f434b2dc57ce85a67e171163eb8ab1a1ebcb39d27484661f26b1dfbe30d6,com.docker.compose.project.config_files=/home/shiarowo/PERSONAL/Presticad/docker-compose.yml,com.docker.compose.service=db,com.docker.compose.oneoff=False,com.docker.compose.project=presticad,com.docker.compose.project.working_dir=/home/shiarowo/PERSONAL/Presticad","LocalVolumes":"1","Mounts":"presticad_pgda…","Name":"presticad-db-1","Names":"presticad-db-1","Networks":"presticad_default","Ports":"0.0.0.0:5432-\u003e5432/tcp, [::]:5432-\u003e5432/tcp","Project":"presticad","Publishers":[{"URL":"0.0.0.0","TargetPort":5432,"PublishedPort":5432,"Protocol":"tcp"},{"URL":"::","TargetPort":5432,"PublishedPort":5432,"Protocol":"tcp"}],"RunningFor":"3 hours ago","Service":"db","Size":"0B","State":"running","Status":"Up 3 hours (healthy)"}
{"Command":"\"docker-entrypoint.s…\"","CreatedAt":"2026-11-02 17:18:11 -0500 -05","ExitCode":0,"Health":"","ID":"43c623202f9d","Image":"presticad-frontend","Labels":"com.docker.compose.project.config_files=/home/shiarowo/PERSONAL/Presticad/docker-compose.yml,com.docker.compose.project.working_dir=/home/shiarowo/PERSONAL/Presticad,com.docker.compose.service=frontend,com.docker.compose.version=2.40.3,com.docker.compose.depends_on=backend:service_started:false,com.docker.compose.project=presticad,com.docker.compose.config-hash=593347aef718c7d355616e82492683cd3917d771450d8909911a9921d66298cc,com.docker.compose.container-number=1,com.docker.compose.image=sha256:87a767fd6676295a7327434fe7452df243c31b5aae15b17cf26617ff5f6c7170,com.docker.compose.oneoff=False","LocalVolumes":"1","Mounts":"/home/shiarowo…,1b8adce1b8b739…","Name":"presticad-frontend-1","Names":"presticad-frontend-1","Networks":"presticad_default","Ports":"0.0.0.0:5173-\u003e5173/tcp, [::]:5173-\u003e5173/tcp","Project":"presticad","Publishers":[{"URL":"0.0.0.0","TargetPort":5173,"PublishedPort":5173,"Protocol":"tcp"},{"URL":"::","TargetPort":5173,"PublishedPort":5173,"Protocol":"tcp"}],"RunningFor":"3 hours ago","Service":"frontend","Size":"0B","State":"running","Status":"Up 3 hours"}

```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 4.6s)

_Thinking:_

Run makemigrations.

**Tool: bash**

**Input:**
```json
{
  "command": "docker compose exec -T backend python manage.py makemigrations prestamos",
  "workdir": "/home/shiarowo/PERSONAL/Presticad",
  "timeout": 120000
}
```

**Output:**
```
Migrations for 'prestamos':
  apps/prestamos/migrations/0008_prestamo_es_excepcion.py
    + Add field es_excepcion to prestamo

```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 2.7s)

_Thinking:_

Need inspect generated.

**Tool: bash**

**Input:**
```json
{
  "command": "cat backend/apps/prestamos/migrations/0008_prestamo_es_excepcion.py",
  "workdir": "/home/shiarowo/PERSONAL/Presticad"
}
```

**Output:**
```
# Generated by Django 6.1.1 on 2026-11-03 00:59

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('prestamos', '0007_prestamo_tiempo_prestamo_minutos_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='prestamo',
            name='es_excepcion',
            field=models.BooleanField(default=False, help_text='Préstamo autorizado pese a que el Tier del usuario no permite el material.'),
        ),
    ]

```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 3.4s)

_Thinking:_

Need maybe line length style? Existing migrations generated. Fine.

Update todo.

**Tool: todowrite**

**Input:**
```json
{
  "todos": [
    {
      "content": "Crear rama feature/prestamo-excepcional",
      "status": "completed",
      "priority": "high"
    },
    {
      "content": "Agregar Prestamo.es_excepcion y migración",
      "status": "completed",
      "priority": "high"
    },
    {
      "content": "Implementar servicios de excepción directa y doble daño",
      "status": "in_progress",
      "priority": "high"
    },
    {
      "content": "Agregar endpoint, serializers y frontend de excepción",
      "status": "pending",
      "priority": "high"
    },
    {
      "content": "Escribir y ejecutar pruebas backend/frontend",
      "status": "pending",
      "priority": "high"
    }
  ]
}
```

**Output:**
```
[
  {
    "content": "Crear rama feature/prestamo-excepcional",
    "status": "completed",
    "priority": "high"
  },
  {
    "content": "Agregar Prestamo.es_excepcion y migración",
    "status": "completed",
    "priority": "high"
  },
  {
    "content": "Implementar servicios de excepción directa y doble daño",
    "status": "in_progress",
    "priority": "high"
  },
  {
    "content": "Agregar endpoint, serializers y frontend de excepción",
    "status": "pending",
    "priority": "high"
  },
  {
    "content": "Escribir y ejecutar pruebas backend/frontend",
    "status": "pending",
    "priority": "high"
  }
]
```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 8.4s)

_Thinking:_

Need check imports / syntax. Services edit. Could run tests soon after adding tests.

Need frontend modifications. First `estadoPrestamo` maybe not used by BadgeEstado. Could update BadgeEstado to accept `esExcepcion` and use text. Simpler in components use `BadgeEstado estado={...} texto={prestamo.es_excepcion && estado==='activo' ? 'Activo - Excepción' : ''}`. But `estado` could vencido with exception; plan badge only activo? "Badge visible: Activo - Excepción". If vencido, show Vencido maybe not exception. Could show "Vencido - Excepción"? Plan says active only. We'll use helper `textoEstadoPrestamo(prestamo, estadoVisible)` exported from estadoPrestamo to centralize and test. But simpler in components repeated. Need maybe detail. Let's create function `presentarEstadoPrestamo(prestamo, estadoVisible)`? Existing signature current state. Don't break tests. Add `textoEstadoPrestamo(prestamo, estado = prestamo.estado_visible ?? prestamo.estado)` returning `Activo - Excepción` if es_excepcion and estado activo. Use in ListaPrestamos, ListaHistorial, Detalle. Test. But user plan said badge. Fine.

Actually `presentarEstadoPrestamo` is unused; could extend optional second arg `esExcepcion=false`? Test existing expects one arg. Add optional param. But components use BadgeEstado. Use helper.

Modify `BadgeEstado`? No need if passed text.

Frontend Registrar:
- add esExcepcion to FORM
- In actualizar when material changes reset esExcepcion false.
- derive `puedeSolicitarExcepcion`: profile maybe restricted, active, role, material selected, !tierCumple. But currently `tierCumple` false for unknown. Good.
- `excepcionActiva = Boolean(formulario.esExcepcion && puedeSolicitarExcepcion)` maybe if profile changes.
- `bloqueadoPorElegibilidad` should use `... || (!tierCumple && !excepcionActiva)`. Currently boolean includes all. Define:
```
const bloqueadoPorElegibilidad = Boolean(materialSeleccionado && dni valid &&
 (verificacionPendiente || errorPerfil || !perfilVerificadoActual || !perfilHabilitado || (!tierCumple && !excepcionActiva)))
```Need if `esExcepcion` true but material accessible, backend rejects. UI only allows when !tierCumple, so fine.
- When toggle esExcepcion, maybe `setFormulario({ ... esExcepcion: checked})`, clear errors docs maybe.
- Use `requiereGarantia` derived from material high value or excepcionActiva.
- validation calls `esExcepcion: excepcionActiva`.
- `construirSolicitudPrestamo` add esExcepcion and docs.
- endpoint.
- Fields banner condition `puedeSolicitarExcepcion` show checkbox. If active, message notes guarantee mandatory/double damage.
- Show default blocked message currently "No cumple el requisito; el registro está bloqueado." Should modify if exception available: "No cumple... puedes registrar una excepción académica." But if checkbox active then "Excepción académica activa." We'll update.
- Guarantee field condition requires `requiereGarantia`.
- submit disabled docs if requiere.
- To map API `es_excepcion` to maybe set general error? Add to camposApi? Could map `es_excepcion` -> `esExcepcion`? `errores` doesn't render. Better no mapping; mensajeApi shows. Since direct endpoint call, if backend rejects invalid exception, error general. Fine.

Need validation `validarFormularioPrestamo` add `esExcepcion=false` parameter and use. Existing tests may call without. Good.

Request builder add `esExcepcion=false`, adds docs if high value or exception. Need call.

Potential issue `construirSolicitudPrestamo` tests expected no docs for non-high; default false. Fine.

Need update tests for frontend. Inspect current tests for solicitud/validaciones/Registrar maybe.

**Tool: bash**

**Input:**
```json
{
  "command": "find frontend/src -type f \\( -name '*.test.js' -o -name '*.test.jsx' \\) | sort | grep -E 'Prestamo|prestamo|validaciones'",
  "workdir": "/home/shiarowo/PERSONAL/Presticad"
}
```

**Output:**
```
frontend/src/prestamos/estadoPrestamo.test.js
frontend/src/prestamos/filtroPrestamos.test.js
frontend/src/prestamos/historialPrestamos.test.js
frontend/src/prestamos/instanciasPrestamo.test.js
frontend/src/prestamos/MisPrestamos.test.js
frontend/src/prestamos/navegacionPrestamos.test.js
frontend/src/prestamos/prestatarios.test.js
frontend/src/prestamos/reportesDevolucion.test.js
frontend/src/prestamos/solicitudPrestamo.test.js
frontend/src/prestamos/tamanoSolicitud.test.js
frontend/src/validacionesDevolucion.test.js
frontend/src/validacionesPrestamo.test.js
frontend/src/validacionesTelefono.test.js

```

**Tool: bash**

**Input:**
```json
{
  "command": "cat frontend/src/prestamos/solicitudPrestamo.test.js 2>/dev/null; grep -RIn 'validarFormularioPrestamo\\|construirSolicitudPrestamo' frontend/src --include='*.test.js' --include='*.test.jsx'",
  "workdir": "/home/shiarowo/PERSONAL/Presticad"
}
```

**Output:**
```
import { describe, expect, it } from 'vitest'

import { construirSolicitudPrestamo } from './solicitudPrestamo'

describe('construirSolicitudPrestamo', () => {
  it('construye multipart con instancia, fotos, checklist y ambos PDF', () => {
    const documentoIdentidad = new File(['%PDF-'], 'dni.pdf', { type: 'application/pdf' })
    const compromisoResponsabilidad = new File(['%PDF-'], 'compromiso.pdf', {
      type: 'application/pdf',
    })
    const foto = new File(['imagen'], 'pantalla.jpg', { type: 'image/jpeg' })
    const solicitud = construirSolicitudPrestamo({
      dni: ' 12345678 ',
      material: { id: 'material-1', es_alto_valor: true },
      instanciaId: 'instancia-1',
      dias: '5',
      checklist: [{ elemento: ' Equipo ', observacion: ' Revisado ', foto }],
      documentoIdentidad,
      compromisoResponsabilidad,
    })

    expect(solicitud).toBeInstanceOf(FormData)
    expect(solicitud.get('dni_prestatario')).toBe('12345678')
    expect(solicitud.get('material_id')).toBe('material-1')
    expect(solicitud.get('instancia_id')).toBe('instancia-1')
    expect(solicitud.get('tiempo_prestamo_dias')).toBe('5')
    expect(JSON.parse(solicitud.get('checklist_inicial'))).toEqual([
      { elemento: 'Equipo', observacion: 'Revisado' },
    ])
    expect(solicitud.get('foto_checklist_0')).toBe(foto)
    expect(solicitud.get('documento_identidad').name).toBe('dni.pdf')
    expect(solicitud.get('compromiso_responsabilidad').name).toBe('compromiso.pdf')
  })

  it('envía tiempo_prestamo_minutos cuando se informa minutos', () => {
    const solicitud = construirSolicitudPrestamo({
      dni: '12345678',
      material: { id: 'material-vr', es_alto_valor: false },
      instanciaId: 'instancia-vr',
      minutos: 180,
      checklist: [{ elemento: 'Visor VR', observacion: '', foto: new File(['foto'], 'vr.png', { type: 'image/png' }) }],
    })

    expect(solicitud.get('tiempo_prestamo_minutos')).toBe('180')
    expect(solicitud.has('tiempo_prestamo_dias')).toBe(false)
  })

  it('omite los campos PDF cuando el material no requiere garantía', () => {
    const solicitud = construirSolicitudPrestamo({
      dni: '12345678',
      material: { id: 'material-1', es_alto_valor: false },
      instanciaId: 'instancia-1',
      dias: '5',
      checklist: [{ elemento: 'Equipo', observacion: '', foto: new File(['foto'], 'equipo.png', { type: 'image/png' }) }],
      documentoIdentidad: new File(['%PDF-'], 'dni.pdf', { type: 'application/pdf' }),
      compromisoResponsabilidad: new File(['%PDF-'], 'compromiso.pdf', {
        type: 'application/pdf',
      }),
    })

    expect(solicitud.has('documento_identidad')).toBe(false)
    expect(solicitud.has('compromiso_responsabilidad')).toBe(false)
  })
})
frontend/src/validacionesPrestamo.test.js:11:  validarFormularioPrestamo,
frontend/src/validacionesPrestamo.test.js:24:describe('validarFormularioPrestamo', () => {
frontend/src/validacionesPrestamo.test.js:26:    expect(validarFormularioPrestamo(formularioValido)).toEqual({})
frontend/src/validacionesPrestamo.test.js:30:    const errores = validarFormularioPrestamo({
frontend/src/validacionesPrestamo.test.js:47:    const errores = validarFormularioPrestamo({
frontend/src/validacionesPrestamo.test.js:56:    const errores = validarFormularioPrestamo({
frontend/src/validacionesPrestamo.test.js:66:    const errores = validarFormularioPrestamo({
frontend/src/validacionesPrestamo.test.js:82:    const errores = validarFormularioPrestamo({
frontend/src/validacionesPrestamo.test.js:117:      validarFormularioPrestamo({
frontend/src/validacionesPrestamo.test.js:125:      validarFormularioPrestamo({
frontend/src/validacionesPrestamo.test.js:134:      validarFormularioPrestamo({
frontend/src/validacionesPrestamo.test.js:174:    const errores = validarFormularioPrestamo({
frontend/src/prestamos/solicitudPrestamo.test.js:3:import { construirSolicitudPrestamo } from './solicitudPrestamo'
frontend/src/prestamos/solicitudPrestamo.test.js:5:describe('construirSolicitudPrestamo', () => {
frontend/src/prestamos/solicitudPrestamo.test.js:12:    const solicitud = construirSolicitudPrestamo({
frontend/src/prestamos/solicitudPrestamo.test.js:36:    const solicitud = construirSolicitudPrestamo({
frontend/src/prestamos/solicitudPrestamo.test.js:49:    const solicitud = construirSolicitudPrestamo({

```

**Tool: bash**

**Input:**
```json
{
  "command": "cat frontend/package.json",
  "workdir": "/home/shiarowo/PERSONAL/Presticad"
}
```

**Output:**
```
{
  "name": "presticad-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite --host 0.0.0.0",
    "build": "vite build",
    "preview": "vite preview --host 0.0.0.0",
    "test": "vitest run"
  },
  "dependencies": {
    "@fontsource-variable/inter": "^5.3.0",
    "intl-tel-input": "^25.15.1",
    "libphonenumber-js": "^1.13.15",
    "lucide-react": "^1.52.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router": "^7.18.4"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.3.3",
    "@vitejs/plugin-react": "^4.3.4",
    "tailwindcss": "^4.3.3",
    "vite": "^6.0.7",
    "vitest": "^5.0.2"
  }
}

```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 3.7s)

_Thinking:_

Need update frontend tests likely. Let's implement.

First `solicitudPrestamo.js`.

**Tool: edit**

**Input:**
```json
{
  "filePath": "/home/shiarowo/PERSONAL/Presticad/frontend/src/prestamos/solicitudPrestamo.js",
  "oldString": "  fotosChecklist = checklist.map((item) => item.foto),\n  documentoIdentidad,\n  compromisoResponsabilidad,\n}) {",
  "newString": "  fotosChecklist = checklist.map((item) => item.foto),\n  documentoIdentidad,\n  compromisoResponsabilidad,\n  esExcepcion = false,\n}) {"
}
```

**Output:**
```
Edit applied successfully.
```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 3.9s)

**Tool: edit**

**Input:**
```json
{
  "filePath": "/home/shiarowo/PERSONAL/Presticad/frontend/src/prestamos/solicitudPrestamo.js",
  "oldString": "  const materialAltoValor = esMaterialAltoValor(material)\n  if (materialAltoValor && documentoIdentidad) {\n    solicitud.append('documento_identidad', documentoIdentidad)\n  }\n  if (materialAltoValor && compromisoResponsabilidad) {\n    solicitud.append('compromiso_responsabilidad', compromisoResponsabilidad)\n  }",
  "newString": "  const requiereGarantia = esExcepcion || esMaterialAltoValor(material)\n  if (requiereGarantia && documentoIdentidad) {\n    solicitud.append('documento_identidad', documentoIdentidad)\n  }\n  if (requiereGarantia && compromisoResponsabilidad) {\n    solicitud.append('compromiso_responsabilidad', compromisoResponsabilidad)\n  }"
}
```

**Output:**
```
Edit applied successfully.
```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 2.5s)

_Thinking:_

Validation.

**Tool: edit**

**Input:**
```json
{
  "filePath": "/home/shiarowo/PERSONAL/Presticad/frontend/src/validacionesPrestamo.js",
  "oldString": "  checklist,\n  documentoIdentidad,\n  compromisoResponsabilidad,\n}) {",
  "newString": "  checklist,\n  documentoIdentidad,\n  compromisoResponsabilidad,\n  esExcepcion = false,\n}) {"
}
```

**Output:**
```
Edit applied successfully.
```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 2.9s)

**Tool: edit**

**Input:**
```json
{
  "filePath": "/home/shiarowo/PERSONAL/Presticad/frontend/src/validacionesPrestamo.js",
  "oldString": "  if (esMaterialAltoValor(material)) {\n    const errorDocumentoIdentidad = validarArchivoGarantia(",
  "newString": "  if (esExcepcion || esMaterialAltoValor(material)) {\n    const errorDocumentoIdentidad = validarArchivoGarantia("
}
```

**Output:**
```
Edit applied successfully.
```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 3.1s)

_Thinking:_

Estado helper.

**Tool: edit**

**Input:**
```json
{
  "filePath": "/home/shiarowo/PERSONAL/Presticad/frontend/src/prestamos/estadoPrestamo.js",
  "oldString": "export function presentarEstadoPrestamo(estado) {\n  return PRESENTACION_ESTADOS[estado] || {\n    texto: 'Estado desconocido',\n    clase: 'prestamo-estado--desconocido',\n  }\n}",
  "newString": "export function presentarEstadoPrestamo(estado) {\n  return PRESENTACION_ESTADOS[estado] || {\n    texto: 'Estado desconocido',\n    clase: 'prestamo-estado--desconocido',\n  }\n}\n\nexport function textoEstadoPrestamo(prestamo, estado = prestamo.estado) {\n  if (prestamo.es_excepcion && estado === 'activo') return 'Activo - Excepción'\n  return presentarEstadoPrestamo(estado).texto\n}"
}
```

**Output:**
```
Edit applied successfully.
```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 3.2s)

_Thinking:_

Need components import text helper. ListaPrestamos import and use.

**Tool: edit**

**Input:**
```json
{
  "filePath": "/home/shiarowo/PERSONAL/Presticad/frontend/src/components/prestamos/ListaPrestamos.jsx",
  "oldString": "import { ordenarPrestamos } from '../../prestamos/estadoPrestamo'",
  "newString": "import { ordenarPrestamos, textoEstadoPrestamo } from '../../prestamos/estadoPrestamo'"
}
```

**Output:**
```
Edit applied successfully.
```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 2.6s)

**Tool: edit**

**Input:**
```json
{
  "filePath": "/home/shiarowo/PERSONAL/Presticad/frontend/src/components/prestamos/ListaPrestamos.jsx",
  "oldString": "                  <BadgeEstado estado={prestamo.estado_visible} />",
  "newString": "                  <BadgeEstado\n                    estado={prestamo.estado_visible}\n                    texto={textoEstadoPrestamo(prestamo, prestamo.estado_visible)}\n                  />"
}
```

**Output:**
```
Edit applied successfully.
```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 3.2s)

_Thinking:_

Historial.

**Tool: edit**

**Input:**
```json
{
  "filePath": "/home/shiarowo/PERSONAL/Presticad/frontend/src/prestamos/ListaHistorialPrestamos.jsx",
  "oldString": "import BadgeEstado from '../components/ui/BadgeEstado'\nimport DetallePrestamo from '../components/prestamos/DetallePrestamo'\nimport { esDevoluble } from '../constantes/devolucion'\nimport { obtenerPrestamoAdyacente } from './historialPrestamos'",
  "newString": "import BadgeEstado from '../components/ui/BadgeEstado'\nimport DetallePrestamo from '../components/prestamos/DetallePrestamo'\nimport { esDevoluble } from '../constantes/devolucion'\nimport { textoEstadoPrestamo } from './estadoPrestamo'\nimport { obtenerPrestamoAdyacente } from './historialPrestamos'"
}
```

**Output:**
```
Edit applied successfully.
```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 4.4s)

**Tool: edit**

**Input:**
```json
{
  "filePath": "/home/shiarowo/PERSONAL/Presticad/frontend/src/prestamos/ListaHistorialPrestamos.jsx",
  "oldString": "              <BadgeEstado estado={prestamo.estado} />",
  "newString": "              <BadgeEstado\n                estado={prestamo.estado}\n                texto={textoEstadoPrestamo(prestamo)}\n              />"
}
```

**Output:**
```
Edit applied successfully.
```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 3.2s)

_Thinking:_

Detail import and use, plus show campo excepcion maybe banner. Add `esExcepcion = detalle?.es_excepcion ?? prestamo.es_excepcion`. Badge. Maybe add Campo "Tipo de préstamo". Good.

Detalle imports.

**Tool: edit**

**Input:**
```json
{
  "filePath": "/home/shiarowo/PERSONAL/Presticad/frontend/src/components/prestamos/DetallePrestamo.jsx",
  "oldString": "import { formatearDuracionMinutos } from '../../constantes/checklistPrestamo'\nimport BadgeEstado from '../ui/BadgeEstado'",
  "newString": "import { formatearDuracionMinutos } from '../../constantes/checklistPrestamo'\nimport { textoEstadoPrestamo } from '../../prestamos/estadoPrestamo'\nimport BadgeEstado from '../ui/BadgeEstado'"
}
```

**Output:**
```
Edit applied successfully.
```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 4.9s)

**Tool: edit**

**Input:**
```json
{
  "filePath": "/home/shiarowo/PERSONAL/Presticad/frontend/src/components/prestamos/DetallePrestamo.jsx",
  "oldString": "  const estado = detalle?.estado ?? prestamo.estado_visible ?? prestamo.estado\n  const material = detalle?.material",
  "newString": "  const estado = detalle?.estado ?? prestamo.estado_visible ?? prestamo.estado\n  const esExcepcion = detalle?.es_excepcion ?? prestamo.es_excepcion\n  const material = detalle?.material"
}
```

**Output:**
```
Edit applied successfully.
```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 4.2s)

**Tool: edit**

**Input:**
```json
{
  "filePath": "/home/shiarowo/PERSONAL/Presticad/frontend/src/components/prestamos/DetallePrestamo.jsx",
  "oldString": "            <CampoDetalle etiqueta=\"Estado\"><BadgeEstado estado={estado} /></CampoDetalle>\n          </dl>",
  "newString": "            <CampoDetalle etiqueta=\"Estado\">\n              <BadgeEstado estado={estado} texto={textoEstadoPrestamo({ es_excepcion: esExcepcion }, estado)} />\n            </CampoDetalle>\n            {esExcepcion && (\n              <CampoDetalle etiqueta=\"Tipo de préstamo\">\n                Excepción académica\n              </CampoDetalle>\n            )}\n          </dl>"
}
```

**Output:**
```
Edit applied successfully.
```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 3.9s)

_Thinking:_

Now RegistrarPrestamo. Multiple edits. Need carefully.

Add esExcepcion initial/reset.

**Tool: edit**

**Input:**
```json
{
  "filePath": "/home/shiarowo/PERSONAL/Presticad/frontend/src/pages/RegistrarPrestamo.jsx",
  "oldString": "  checklist: [{ elemento: '', observacion: '', foto: null, fotoPrevia: '' }],\n  documentoIdentidad: null,\n  compromisoResponsabilidad: null,\n}",
  "newString": "  checklist: [{ elemento: '', observacion: '', foto: null, fotoPrevia: '' }],\n  documentoIdentidad: null,\n  compromisoResponsabilidad: null,\n  esExcepcion: false,\n}"
}
```

**Output:**
```
Edit applied successfully.
```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 3.4s)

_Thinking:_

Update actualizar reset on material.

**Tool: edit**

**Input:**
```json
{
  "filePath": "/home/shiarowo/PERSONAL/Presticad/frontend/src/pages/RegistrarPrestamo.jsx",
  "oldString": "        ? {\n            instanciaId: '',\n            documentoIdentidad: null,\n            compromisoResponsabilidad: null,\n          }\n        : {}),",
  "newString": "        ? {\n            instanciaId: '',\n            documentoIdentidad: null,\n            compromisoResponsabilidad: null,\n            esExcepcion: false,\n          }\n        : {}),"
}
```

**Output:**
```
Edit applied successfully.
```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 5.8s)

_Thinking:_

Derived logic. Need exact block. Replace tierCumple etc.

**Tool: edit**

**Input:**
```json
{
  "filePath": "/home/shiarowo/PERSONAL/Presticad/frontend/src/pages/RegistrarPrestamo.jsx",
  "oldString": "  const tierCumple = Boolean(\n    perfilVerificadoActual && materialSeleccionado\n    && NIVEL_TIER[perfilVerificadoActual.reputacion_tier] >= NIVEL_TIER[materialSeleccionado.tier_minimo_requerido],\n  )\n  const perfilHabilitado = perfilVerificadoActual?.rol === 'prestatario' && perfilVerificadoActual?.estado === 'activo'\n  const verificacionPendiente = /^\\d{8}$/.test(formulario.dni.trim())\n    && (consultandoPerfil || !perfilVerificadoActual && !errorPerfil)\n  const bloqueadoPorElegibilidad = Boolean(\n    materialSeleccionado && /^\\d{8}$/.test(formulario.dni.trim())\n    && (verificacionPendiente || errorPerfil || !perfilVerificadoActual || !perfilHabilitado || !tierCumple),\n  )",
  "newString": "  const tierCumple = Boolean(\n    perfilVerificadoActual && materialSeleccionado\n    && NIVEL_TIER[perfilVerificadoActual.reputacion_tier] >= NIVEL_TIER[materialSeleccionado.tier_minimo_requerido],\n  )\n  const perfilHabilitado = perfilVerificadoActual?.rol === 'prestatario' && perfilVerificadoActual?.estado === 'activo'\n  const puedeSolicitarExcepcion = Boolean(\n    perfilHabilitado && materialSeleccionado && !tierCumple\n    && perfilVerificadoActual?.reputacion_tier === 'restringido',\n  )\n  const excepcionActiva = Boolean(puedeSolicitarExcepcion && formulario.esExcepcion)\n  const requiereGarantia = Boolean(\n    excepcionActiva || esMaterialAltoValor(materialSeleccionado),\n  )\n  const verificacionPendiente = /^\\d{8}$/.test(formulario.dni.trim())\n    && (consultandoPerfil || !perfilVerificadoActual && !errorPerfil)\n  const bloqueadoPorElegibilidad = Boolean(\n    materialSeleccionado && /^\\d{8}$/.test(formulario.dni.trim())\n    && (\n      verificacionPendiente || errorPerfil || !perfilVerificadoActual || !perfilHabilitado\n      || (!tierCumple && !excepcionActiva)\n    ),\n  )"
}
```

**Output:**
```
Edit applied successfully.
```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 4.7s)

_Thinking:_

Need toggle function maybe `actualizar('esExcepcion', checked)` works with camposError no mapping, and material-specific reset only. It clears `errores.esExcepcion` fine. But when toggling docs errors? Not necessary. Add maybe explicit? no.

Need validation call add esExcepcion. Request add and endpoint.

**Tool: edit**

**Input:**
```json
{
  "filePath": "/home/shiarowo/PERSONAL/Presticad/frontend/src/pages/RegistrarPrestamo.jsx",
  "oldString": "      checklist: formulario.checklist,\n      documentoIdentidad: formulario.documentoIdentidad,\n      compromisoResponsabilidad: formulario.compromisoResponsabilidad,\n    }",
  "newString": "      checklist: formulario.checklist,\n      documentoIdentidad: formulario.documentoIdentidad,\n      compromisoResponsabilidad: formulario.compromisoResponsabilidad,\n      esExcepcion: excepcionActiva,\n    }"
}
```

**Output:**
```
Edit applied successfully.
```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 4.3s)

**Tool: edit**

**Input:**
```json
{
  "filePath": "/home/shiarowo/PERSONAL/Presticad/frontend/src/pages/RegistrarPrestamo.jsx",
  "oldString": "        checklist: formulario.checklist,\n        documentoIdentidad: formulario.documentoIdentidad,\n        compromisoResponsabilidad: formulario.compromisoResponsabilidad,\n      })\n      const errorTamano = validarTamanoSolicitud(solicitud)\n      if (errorTamano) {\n        setError(errorTamano)\n        return\n      }\n      const respuesta = await api.post('/prestamos/', solicitud)",
  "newString": "        checklist: formulario.checklist,\n        documentoIdentidad: formulario.documentoIdentidad,\n        compromisoResponsabilidad: formulario.compromisoResponsabilidad,\n        esExcepcion: excepcionActiva,\n      })\n      const errorTamano = validarTamanoSolicitud(solicitud)\n      if (errorTamano) {\n        setError(errorTamano)\n        return\n      }\n      const respuesta = await api.post(\n        excepcionActiva ? '/prestamos/excepcion/' : '/prestamos/',\n        solicitud,\n      )"
}
```

**Output:**
```
Edit applied successfully.
```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 6.8s)

_Thinking:_

Need UI panel. Modify profile card text and add checkbox after profile card perhaps. We need current block. We'll insert after profile block before instancia. Let's craft.

Existing profile card:
```
{materialSeleccionado && (
 <p ...>
  Tier requerido...
  {!tierCumple && <strong>No cumple...bloqueado.</strong>}
  {tierCumple && perfilHabilitado && <strong> Cumple ...</strong>}
 </p>
)}
```
Change to messages:
- if tierCumple: "Cumple"
- if !tierCumple and puedeSolicitarExcepcion: "No cumple... Puedes registrar una excepción académica."
- if !tierCumple and not puede: "No cumple... registro bloqueado."
Maybe perfilHabilitado false existing.

Add exception panel only `puedeSolicitarExcepcion`.
```
<label className=...>
<input type=checkbox checked=... onChange.../>
<div><span>Registrar como préstamo excepcional</span><p>Autoriza ... exige ambos PDFs, duplica deducción por daño y no duplica cobro.</p></div>
</label>
```
Maybe state active changes border. Use conditional classes.

Need use `excepcionActiva`. Insert.

**Tool: edit**

**Input:**
```json
{
  "filePath": "/home/shiarowo/PERSONAL/Presticad/frontend/src/pages/RegistrarPrestamo.jsx",
  "oldString": "                {materialSeleccionado && (\n                  <p className=\"mt-1\">\n                    Tier requerido: {ETIQUETA_TIER[materialSeleccionado.tier_minimo_requerido] || materialSeleccionado.tier_minimo_requerido}.\n                    {' '}{!tierCumple && <strong>No cumple el requisito; el registro está bloqueado.</strong>}\n                    {tierCumple && perfilHabilitado && <strong> Cumple el requisito.</strong>}\n                  </p>\n                )}\n              </div>\n            )}\n            <Campo",
  "newString": "                {materialSeleccionado && (\n                  <p className=\"mt-1\">\n                    Tier requerido: {ETIQUETA_TIER[materialSeleccionado.tier_minimo_requerido] || materialSeleccionado.tier_minimo_requerido}.\n                    {tierCumple && perfilHabilitado && <strong> Cumple el requisito.</strong>}\n                    {!tierCumple && puedeSolicitarExcepcion && (\n                      <strong> No cumple el requisito; puedes registrar una excepción académica.</strong>\n                    )}\n                    {!tierCumple && !puedeSolicitarExcepcion && (\n                      <strong> No cumple el requisito; el registro está bloqueado.</strong>\n                    )}\n                  </p>\n                )}\n              </div>\n            )}\n            {puedeSolicitarExcepcion && (\n              <label\n                className={`flex cursor-pointer gap-3 rounded-xl border p-4 text-sm ${\n                  excepcionActiva\n                    ? 'border-acento-400 bg-acento-50 text-acento-900 dark:border-acento-600 dark:bg-acento-500/15 dark:text-acento-200'\n                    : 'border-borde bg-superficie text-texto'\n                }`}\n              >\n                <input\n                  type=\"checkbox\"\n                  checked={formulario.esExcepcion}\n                  onChange={(evento) => actualizar('esExcepcion', evento.target.checked)}\n                  className=\"mt-1 h-4 w-4 shrink-0\"\n                />\n                <span>\n                  <span className=\"block font-semibold\">Registrar como préstamo excepcional</span>\n                  <span className=\"mt-1 block text-texto-suave\">\n                    Autoriza este material pese al Tier Restringido del prestatario. Exige ambos\n                    documentos de garantía y duplica la deducción por daño; el cobro económico no se duplica.\n                  </span>\n                </span>\n              </label>\n            )}\n            <Campo"
}
```

**Output:**
```
Edit applied successfully.
```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 4.7s)

_Thinking:_

Need guarantee block condition and legend text.

**Tool: edit**

**Input:**
```json
{
  "filePath": "/home/shiarowo/PERSONAL/Presticad/frontend/src/pages/RegistrarPrestamo.jsx",
  "oldString": "            {esMaterialAltoValor(materialSeleccionado) && (\n              <fieldset\n                key={formulario.materialId}\n                className=\"grid gap-3 rounded-xl border border-acento-300 bg-acento-50/50 p-4 dark:border-acento-700/60 dark:bg-acento-500/10\"\n              >\n                <legend className=\"px-2 text-sm font-bold text-acento-800 dark:text-acento-300\">\n                  Garantía obligatoria para material de alto valor\n                </legend>",
  "newString": "            {requiereGarantia && (\n              <fieldset\n                key={formulario.materialId}\n                className=\"grid gap-3 rounded-xl border border-acento-300 bg-acento-50/50 p-4 dark:border-acento-700/60 dark:bg-acento-500/10\"\n              >\n                <legend className=\"px-2 text-sm font-bold text-acento-800 dark:text-acento-300\">\n                  {excepcionActiva\n                    ? 'Garantía obligatoria para préstamo excepcional'\n                    : 'Garantía obligatoria para material de alto valor'}\n                </legend>"
}
```

**Output:**
```
Edit applied successfully.
```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 3.5s)

_Thinking:_

Submit disabled.

**Tool: edit**

**Input:**
```json
{
  "filePath": "/home/shiarowo/PERSONAL/Presticad/frontend/src/pages/RegistrarPrestamo.jsx",
  "oldString": "                deshabilitado={bloqueadoPorElegibilidad || Boolean(\n                  esMaterialAltoValor(materialSeleccionado)\n                  && (!formulario.documentoIdentidad || !formulario.compromisoResponsabilidad)\n                )}",
  "newString": "                deshabilitado={bloqueadoPorElegibilidad || Boolean(\n                  requiereGarantia\n                  && (!formulario.documentoIdentidad || !formulario.compromisoResponsabilidad)\n                )}"
}
```

**Output:**
```
Edit applied successfully.
```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 3.7s)

_Thinking:_

Need maybe success message indicate exception? `prestamoCreado.es_excepcion` maybe show. Optional. Add to success text maybe:
```
Préstamo registrado como activo{prestamoCreado.es_excepcion ? ' (excepción)' : ''}...
```
Fine.

**Tool: edit**

**Input:**
```json
{
  "filePath": "/home/shiarowo/PERSONAL/Presticad/frontend/src/pages/RegistrarPrestamo.jsx",
  "oldString": "          <p className=\"font-semibold\">\n            Préstamo registrado como activo para {prestamoCreado.usuario_nombre}.\n          </p>",
  "newString": "          <p className=\"font-semibold\">\n            Préstamo registrado como activo{prestamoCreado.es_excepcion ? ' con excepción académica' : ''} para {prestamoCreado.usuario_nombre}.\n          </p>"
}
```

**Output:**
```
Edit applied successfully.
```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 3.4s)

_Thinking:_

Need if toggle after docs maybe no issue. Need map API field maybe. No.

Need update tests frontend. Add tests to validaciones and solicitud and estado. Also backend tests.

Before tests run lint? no lint script. Build later.

Need add backend tests. Determine class placement. Add service tests in RegistrarPrestamoServiceTestCase after tier test maybe. Need `storage_garantias_temporal` function defined somewhere. Search.

**Tool: bash**

**Input:**
```json
{
  "command": "grep -n 'def storage_garantias_temporal' -n backend/apps/prestamos/tests.py && sed -n '120,180p' backend/apps/prestamos/tests.py",
  "workdir": "/home/shiarowo/PERSONAL/Presticad"
}
```

**Output:**
```
145:def storage_garantias_temporal():

    @unittest.skipUnless(
        almacenamiento_prestamos.AlmacenamientoPrivadoGarantiasCloudinary is not None,
        "Cloudinary no está instalado en este entorno.",
    )
    def test_url_privada_usa_prefijo_y_tipo_de_recurso(self):
        storage = almacenamiento_prestamos.AlmacenamientoPrivadoGarantiasCloudinary()
        with patch.object(storage, "_get_prefix", return_value="Presticad"):
            with patch.object(
                almacenamiento_prestamos,
                "cloudinary_url",
                return_value=("https://res.cloudinary.com/demo/raw/upload/Presticad/reporte.pdf", {}),
            ) as crear_url:
                url = storage.url("reporte.pdf")

        self.assertIn("Presticad/reporte.pdf", url)
        crear_url.assert_called_once_with(
            "Presticad/reporte.pdf",
            resource_type="raw",
            type="upload",
            secure=True,
        )


@contextmanager
def storage_garantias_temporal():
    with tempfile.TemporaryDirectory() as directorio:
        almacenamiento = FileSystemStorage(location=directorio)
        with (
            patch.object(Garantia._meta.get_field("documento_identidad"), "storage", almacenamiento),
            patch.object(
                Garantia._meta.get_field("compromiso_responsabilidad"),
                "storage",
                almacenamiento,
            ),
            patch.object(FotoChecklist._meta.get_field("imagen"), "storage", almacenamiento),
        ):
            yield directorio


class AlmacenamientoGarantiaTestCase(SimpleTestCase):
    def test_storage_privado_no_genera_url_publica(self):
        with self.assertRaisesRegex(ValueError, "endpoint protegido"):
            storages["garantias"].url("documentos/prueba.pdf")

    def test_los_campos_de_garantia_usan_el_storage_privado(self):
        for nombre in ("documento_identidad", "compromiso_responsabilidad"):
            campo = Garantia._meta.get_field(nombre)
            self.assertIs(campo.storage, storages["garantias"])

    def test_las_fotos_de_checklist_usan_el_storage_privado(self):
        campo = FotoChecklist._meta.get_field("imagen")
        self.assertIs(campo.storage, storages["garantias"])

    def test_valida_las_extensiones_y_mime_de_imagen_admitidos(self):
        formatos = (
            ("JPEG", "prueba.jpg", "image/jpeg"),
            ("PNG", "prueba.png", "image/png"),
            ("WEBP", "prueba.webp", "image/webp"),
        )
        for formato, nombre, tipo in formatos:

```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 5.8s)

_Thinking:_

Need backend service test. Add around after `test_rechaza_tier_insuficiente...` maybe. Use restricted user. `crear_usuario` default reputation maybe standard? Need check registrar_usuario defaults. Existing restricted test sets -480. We can create `reputacion_puntaje=-100, reputacion_tier="restringido"`. Material tier "avanzado". Need docs. Test:
```
def test_excepcion_directa_permite_material_superior_con_garantia(self):
    restringido = crear_usuario(... reputacion_puntaje=-100, reputacion_tier="restringido")
    material = crear_material(codigo_material="EQ-EXC", tier_minimo_requerido="avanzado")
    with self.assertRaises(PrestamoError) as ctx:
       self._registrar(dni=restringido, material_id=material.id, es_excepcion=True)
    self.assertEqual(ctx.exception.campo,"documento_identidad")
    with storage...:
      prestamo=self._registrar(... docs, es_excepcion=True)
      self.assertTrue(prestamo.es_excepcion)
      self.assertTrue(prestamo.requiere_garantia)
      self.assertTrue(prestamo.garantia_completa)
```
But `_registrar` uses `self.material` default; can override. Good.
- rejects normal user with exception:
```
with raises: self._registrar(material_id=advanced, es_excepcion=True, docs) maybe current prestatario tier default? likely estandar. Need docs to ensure it reaches eligibility before docs? eligibility before docs, so no docs needed. assert campo es_excepcion.
```
- rejects accessible material for restricted:
restricted user + default self.material tier? default maybe estandar. If restricted accessible? Check TIERS. Need inspect.

**Tool: bash**

**Input:**
```json
{
  "command": "cat backend/apps/inventario/constants.py | sed -n '1,90p' && grep -n 'reputacion_puntaje\\|reputacion_tier' backend/apps/usuarios/services.py | head -40",
  "workdir": "/home/shiarowo/PERSONAL/Presticad"
}
```

**Output:**
```
# constants.py — Enums/choices del dominio de inventario (tipo, estado)

TIPOS_MATERIAL = [
    ("equipo", "Equipo"),
    ("libro", "Libro"),
    ("objeto", "Objeto"),
]

UMBRAL_PRECIO_ALTO_VALOR = 200

ESTADOS_MATERIAL = [
    ("disponible", "Disponible"),
    ("en_mantenimiento", "En Mantenimiento"),
    ("reservado", "Reservado"),
    ("prestado", "Prestado"),
]

ESTADOS_INSTANCIA = [
    ("disponible", "Disponible"),
    ("reservado", "Reservado"),
    ("prestado", "Prestado"),
    ("en_mantenimiento", "En Mantenimiento"),
    ("de_baja", "De Baja"),
]

# Estados permitidos al registrar ejemplares nuevos. Préstamo y reserva se
# asignan desde sus flujos operativos, no durante el alta del inventario.
ESTADOS_INICIALES_INSTANCIA = [
    ("disponible", "Disponible"),
    ("en_mantenimiento", "En mantenimiento"),
]

# Mapeo de Tiers de materiales accesibles según el Tier de reputación del usuario (RN03, HU05)
TIERS_ACCESIBLES = {
    "restringido": ("restringido",),
    "estandar": ("restringido", "estandar"),
    "avanzado": ("restringido", "estandar", "avanzado"),
}

# HU04: límite común para las filas de lote y registro por detalle.
MAXIMO_EJEMPLARES_REGISTRO = 50

MODOS_REGISTRO_MATERIAL = [
    ("unico", "Único"),
    ("lote", "Lote"),
    ("detalle", "Detalle"),
]

# Rango permitido para el parámetro configurable de tiempo máximo de préstamo
# de un material (en minutos): mínimo 30 minutos y máximo 15 días (21600 minutos).
MINIMO_TIEMPO_MAXIMO_PRESTAMO_MINUTOS = 30
MAXIMO_TIEMPO_MAXIMO_PRESTAMO_MINUTOS = 15 * 24 * 60

# Tiempo máximo de préstamo por defecto (en minutos) según el Tier mínimo del material:
# - Avanzado: 6 horas (360 min) — equipos especializados/restringidos dentro del campus
# - Estándar: 24 horas / 1 día (1440 min)
# - Restringido: 3 días (4320 min)
TIEMPO_MAXIMO_DEFAULT_POR_TIER = {
    "avanzado": 360,
    "estandar": 1440,
    "restringido": 4320,
}
DEFAULT_TIEMPO_MAXIMO_PRESTAMO_MINUTOS = TIEMPO_MAXIMO_DEFAULT_POR_TIER["estandar"]

176:        "reputacion_puntaje": usuario.reputacion_puntaje,
177:        "reputacion_tier": usuario.reputacion_tier,
218:    puntaje_nuevo = puntaje_reputacion_ajustado(usuario.reputacion_puntaje + delta)
219:    usuario.reputacion_puntaje = puntaje_nuevo
220:    usuario.reputacion_tier = tier_por_puntaje(puntaje_nuevo)
222:        update_fields=["reputacion_puntaje", "reputacion_tier", "updated_at"],

```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 3.6s)

_Thinking:_

Default material likely tier restringido? `crear_material` doesn't set tier, model default maybe restringido. Check.

**Tool: bash**

**Input:**
```json
{
  "command": "grep -n 'tier_minimo_requerido\\|reputacion_tier\\|reputacion_puntaje' backend/apps/inventario/models.py backend/apps/usuarios/models.py | head -40",
  "workdir": "/home/shiarowo/PERSONAL/Presticad"
}
```

**Output:**
```
backend/apps/inventario/models.py:35:# rango de `Usuario.reputacion_puntaje` (-500 a 500).
backend/apps/inventario/models.py:109:    tier_minimo_requerido = models.CharField(
backend/apps/inventario/models.py:196:            self.tier_minimo_requerido = "avanzado"
backend/apps/usuarios/models.py:69:    reputacion_puntaje = models.IntegerField(
backend/apps/usuarios/models.py:74:    reputacion_tier = models.CharField(

```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 3.8s)

**Tool: bash**

**Input:**
```json
{
  "command": "sed -n '100,120p' backend/apps/inventario/models.py && sed -n '60,85p' backend/apps/usuarios/models.py && sed -n '185,205p' backend/apps/inventario/models.py",
  "workdir": "/home/shiarowo/PERSONAL/Presticad"
}
```

**Output:**
```
        upload_to=ruta_foto,
        blank=True,
        validators=[validar_foto],
        verbose_name="Foto del material",
        help_text="Imagen del material: JPG, PNG o WEBP, hasta 4 MB.",
    )

    # Parámetros de reputación por objeto (value object `AtributosReputacion`,
    # RN06). Las sanciones de la devolución se calculan con estos valores.
    tier_minimo_requerido = models.CharField(
        max_length=20,
        choices=TIERS,
        default=DEFAULT_TIER_MINIMO,
        verbose_name="Tier mínimo requerido",
    )
    tiempo_maximo_prestamo = models.PositiveIntegerField(
        default=DEFAULT_TIEMPO_MAXIMO_PRESTAMO_MINUTOS,
        validators=[
            MinValueValidator(MINIMO_TIEMPO_MAXIMO_PRESTAMO_MINUTOS),
            MaxValueValidator(MAXIMO_TIEMPO_MAXIMO_PRESTAMO_MINUTOS),
        ],
    )
    rol = models.ForeignKey(
        Rol,
        on_delete=models.PROTECT,
        related_name="usuarios",
        default=rol_prestatario_por_defecto,
    )
    estado = models.CharField(max_length=20, choices=ESTADOS_USUARIO, default="activo")

    reputacion_puntaje = models.IntegerField(
        default=0,
        validators=[MinValueValidator(-500), MaxValueValidator(500)],
        verbose_name="Puntaje de reputación",
    )
    reputacion_tier = models.CharField(
        max_length=20, choices=TIERS, default="estandar", verbose_name="Tier de reputación"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Usuario"
        verbose_name_plural = "Usuarios"
        ordering = ["apellido", "nombre"]

        """RN05: los materiales de alto valor exigen garantía al prestarlos."""
        if self.precio is not None and Decimal(str(self.precio)) > 0:
            return Decimal(str(self.precio)) > Decimal(UMBRAL_PRECIO_ALTO_VALOR)
        return bool(self.es_alto_valor)

    def save(self, *args, **kwargs):
        """Mantiene la clasificación sincronizada con el precio del material."""
        if self.precio is None:
            self.precio = Decimal("0")
        self.es_alto_valor = self.requiere_garantia()
        if Decimal(str(self.precio)) > Decimal(UMBRAL_PRECIO_ALTO_VALOR):
            self.tier_minimo_requerido = "avanzado"
        super().save(*args, **kwargs)

    @property
    def total_instancias(self):
        """Total de instancias físicas. Fallback a stock si no tiene instancias creadas."""
        instancias = list(self.instancias.all())
        return len(instancias) if instancias else self.stock

    @property

```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 3.3s)

_Thinking:_

Need default tier check.

**Tool: bash**

**Input:**
```json
{
  "command": "grep -n 'DEFAULT_TIER_MINIMO' backend/apps/inventario/*.py",
  "workdir": "/home/shiarowo/PERSONAL/Presticad"
}
```

**Output:**
```
backend/apps/inventario/models.py:28:DEFAULT_TIER_MINIMO = "estandar"
backend/apps/inventario/models.py:112:        default=DEFAULT_TIER_MINIMO,

```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 12.1s)

_Thinking:_

Restricted with default estandar is inaccessible, so exception valid. Non-restricted with advanced invalid. Accessible material for restricted needs tier restringido.

Tests API direct: add in RegistrarPrestamoAPITestCase perhaps separate class. Use restricted and material advanced. Need ensure material time max default for advanced = 360, payload 3 days (4320) would fail duration after eligibility. Set `tiempo_prestamo_minutos=60`, docs. Or material with `tiempo_maximo_prestamo=4320` explicitly? `crear_material` if tier provided and no tiempo_max then doesn't set default? Its helper: if neither time nor tier in changes, set time 4320. If tier provided, leaves default model based on tier? Does `registrar_material` set defaults by tier? Existing test shows advanced material gets 360 when created with tier and no time. So use 60 minutes.

Service tests use `_registrar` defaults `tiempo_prestamo_dias=3`; for advanced material that would fail duration. Use `tiempo_prestamo_minutos=60, tiempo_prestamo_dias=None` for exception with advanced. Or create custom tier with `tiempo_maximo_prestamo=4320`. We can pass `tiempo_prestamo_minutos=60`. Good.

API direct class test:
- helper `_payload_multipart` from parent can accept material_id, tiempo_minutos, docs; but it always uses `self.material` and sets fotos. We can subclass `RegistrarPrestamoAPITestCase`? Then inherits tests too, not ideal. Create new class with own setup. Or add tests inside existing class using its `_iniciar_sesion`, `_payload_multipart`. Add:
```
def test_post_excepcion_directa_requiere_garantia_y_fuerza_flag(self):
  restringido=crear_usuario(... tier restricted)
  material=crear_material(codigo_material="API-EXC",tier_minimo_requerido="avanzado")
  instancia=material.instancias.get()
  self._iniciar_sesion(self.gestor)
  datos=self._payload_multipart(dni_prestatario=restringido.dni, material_id=str(material.id), instancia_id=str(instancia.id), tiempo_prestamo_minutos=60, documento_identidad=..., compromiso=...)
  datos.pop("tiempo_prestamo_dias")? `_payload` default includes tiempo_prestamo_dias=3 AND `cambios` adds minutes. Serializer accepts both? Existing registrar prioritizes minutes. But duration days 3 remains; service `_resolver` picks minutes. Fine. But serializer validates both. Fine.
  with storage: response=...
  assert 201, es_excepcion True, requires_garantia True.
```
But endpoint URL `URL_EXCEPCION`. Need tests manager only maybe existing permission covers; add prestatario gets 403? Could skip or add.
- Rejected normal user? service tests enough.

Need double damage test in DevolucionBase. Add:
```
def test_excepcion_duplica_solo_la_deduccion_por_dano(self):
  self.prestamo.es_excepcion=True; save
  checklist partial...
  dev = self._devolver(fecha_limite, checklist)
  assert base 30, ded 60, cobro 40, puntos -45
```
Wait bonification at exact fecha_limite: a_tiempo true, 15. -45. Good. Ensure `prestamo.requiere_garantia`? Not needed for devolution. Fine.

Need serializer tests maybe existing exact expected JSON no issue.

Need apply tests. Use edit.

**Tool: edit**

**Input:**
```json
{
  "filePath": "/home/shiarowo/PERSONAL/Presticad/backend/apps/prestamos/tests.py",
  "oldString": "    def test_rechaza_usuario_suspendido(self):",
  "newString": "    def test_excepcion_directa_permite_material_superior_con_garantia(self):\n        restringido = crear_usuario(\n            \"restringido-excepcion@unsa.edu.pe\",\n            \"10000031\",\n            reputacion_puntaje=-100,\n            reputacion_tier=\"restringido\",\n        )\n        material = crear_material(\n            codigo_material=\"EQ-EXC-01\",\n            tier_minimo_requerido=\"avanzado\",\n        )\n\n        with self.assertRaises(PrestamoError) as contexto:\n            self._registrar(\n                dni_prestatario=restringido.dni,\n                material_id=material.id,\n                tiempo_prestamo_minutos=60,\n                tiempo_prestamo_dias=None,\n                es_excepcion=True,\n            )\n        self.assertEqual(contexto.exception.campo, \"documento_identidad\")\n\n        with storage_garantias_temporal():\n            prestamo = self._registrar(\n                dni_prestatario=restringido.dni,\n                material_id=material.id,\n                tiempo_prestamo_minutos=60,\n                tiempo_prestamo_dias=None,\n                es_excepcion=True,\n                documento_identidad=crear_pdf(\"dni-excepcion.pdf\"),\n                compromiso_responsabilidad=crear_pdf(\"compromiso-excepcion.pdf\"),\n            )\n\n            self.assertTrue(prestamo.es_excepcion)\n            self.assertTrue(prestamo.requiere_garantia)\n            self.assertTrue(prestamo.garantia_completa)\n\n    def test_excepcion_directa_rechaza_usuario_no_restringido(self):\n        material = crear_material(\n            codigo_material=\"EQ-EXC-02\",\n            tier_minimo_requerido=\"avanzado\",\n        )\n\n        with self.assertRaises(PrestamoError) as contexto:\n            self._registrar(\n                material_id=material.id,\n                tiempo_prestamo_minutos=60,\n                tiempo_prestamo_dias=None,\n                es_excepcion=True,\n            )\n\n        self.assertEqual(contexto.exception.campo, \"es_excepcion\")\n        self.assertEqual(Prestamo.objects.count(), 0)\n\n    def test_excepcion_directa_rechaza_material_accesible_para_restringido(self):\n        restringido = crear_usuario(\n            \"restringido-accesible@unsa.edu.pe\",\n            \"10000032\",\n            reputacion_puntaje=-100,\n            reputacion_tier=\"restringido\",\n        )\n        material = crear_material(\n            codigo_material=\"EQ-EXC-03\",\n            tier_minimo_requerido=\"restringido\",\n        )\n\n        with self.assertRaises(PrestamoError) as contexto:\n            self._registrar(\n                dni_prestatario=restringido.dni,\n                material_id=material.id,\n                es_excepcion=True,\n            )\n\n        self.assertEqual(contexto.exception.campo, \"es_excepcion\")\n        self.assertEqual(Prestamo.objects.count(), 0)\n\n    def test_rechaza_usuario_suspendido(self):"
}
```

**Output:**
```
Edit applied successfully.
```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 3.9s)

_Thinking:_

Need API tests. Add to RegistrarPrestamoAPITestCase before class end? Need find end around 1540? It goes to 1830 maybe. Search next class.

**Tool: bash**

**Input:**
```json
{
  "command": "grep -n '^class ' backend/apps/prestamos/tests.py | sed -n '1,25p'",
  "workdir": "/home/shiarowo/PERSONAL/Presticad"
}
```

**Output:**
```
103:class AlmacenamientoPresticadCloudinaryTestCase(SimpleTestCase):
160:class AlmacenamientoGarantiaTestCase(SimpleTestCase):
320:class ModuloPrestamosTestCase(SimpleTestCase):
328:class RegistrarPrestamoServiceTestCase(TestCase):
748:class RegistrarPrestamoConcurrenciaTestCase(TransactionTestCase):
794:class ConsultarPrestamosServiceTestCase(TestCase):
848:class HistorialPrestamosServiceTestCase(TestCase):
909:class MisPrestamosAPITestCase(APITestCase):
1000:class HistorialPrestamosAPITestCase(APITestCase):
1222:class BuscarPrestatariosAPITestCase(APITestCase):
1310:class RegistrarPrestamoAPITestCase(APITestCase):
1606:class DescargarGarantiaAPITestCase(APITestCase):
1827:class DescargarFotoChecklistAPITestCase(APITestCase):
1907:class DevolucionBaseTestCase(TestCase):
1961:class EstimarDevolucionServiceTestCase(DevolucionBaseTestCase):
2025:class RegistrarDevolucionServiceTestCase(DevolucionBaseTestCase):
2383:class ReporteDevolucionTestCase(DevolucionBaseTestCase):
2462:class DevolucionAPITestCase(DevolucionBaseTestCase):
2742:class ReportesDevolucionAPITestCase(DevolucionBaseTestCase):

```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 3.4s)

_Thinking:_

Add near end before line 1606. Inspect last tests 1560-1606.

**Tool: bash**

**Input:**
```json
{
  "command": "sed -n '1540,1608p' backend/apps/prestamos/tests.py",
  "workdir": "/home/shiarowo/PERSONAL/Presticad"
}
```

**Output:**
```

        respuesta = self.client.post(
            self.URL,
            self._payload(tiempo_prestamo_dias=0, checklist_inicial=[]),
            format="json",
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn("tiempo_prestamo_dias", respuesta.json())
        self.assertIn("checklist_inicial", respuesta.json())
        self.assertEqual(Prestamo.objects.count(), 0)

    def test_post_rechaza_campos_no_autorizados(self):
        self._iniciar_sesion(self.gestor)

        respuesta = self.client.post(
            self.URL,
            self._payload_multipart(usuario_id=999, estado="devuelto"),
            format="multipart",
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn("usuario_id", respuesta.json())
        self.assertIn("estado", respuesta.json())
        self.assertEqual(Prestamo.objects.count(), 0)

    def test_post_rechaza_los_booleanos_obsoletos_de_garantia(self):
        self._iniciar_sesion(self.gestor)

        respuesta = self.client.post(
            self.URL,
            self._payload_multipart(garantia_documento_identidad_recibido=True),
            format="multipart",
        )

        self.assertEqual(respuesta.status_code, 400)
        self.assertIn("garantia_documento_identidad_recibido", respuesta.json())
        self.assertEqual(Prestamo.objects.count(), 0)

    def test_post_dni_inexistente_responde_404(self):
        self._iniciar_sesion(self.gestor)

        with storage_garantias_temporal():
            respuesta = self.client.post(
                self.URL,
                self._payload_multipart(dni_prestatario="29999999"),
                format="multipart",
            )

        self.assertEqual(respuesta.status_code, 404)
        self.assertEqual(Prestamo.objects.count(), 0)

    def test_post_requiere_token_csrf_con_sesion(self):
        gestor = self.gestor
        cliente = APIClient(enforce_csrf_checks=True)
        sesion = cliente.session
        sesion[CLAVE_SESION_USUARIO_ID] = gestor.id
        sesion[CLAVE_SESION_ULTIMA_ACTIVIDAD] = timezone.now().isoformat()
        sesion.save()

        respuesta = cliente.post(self.URL, self._payload(), format="json")

        self.assertEqual(respuesta.status_code, 403)
        self.assertEqual(Prestamo.objects.count(), 0)


class DescargarGarantiaAPITestCase(APITestCase):
    URL = "/api/prestamos/{prestamo_id}/garantia/{tipo}/"


```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 6.8s)

_Thinking:_

Add tests there. Need `_payload_multipart` with `tiempo_prestamo_minutos=60` still includes days 3 but service picks minutes; okay. Need avoid conflicting? Serializer allows both no cross validation. Great.

Add two tests: success and prestatario 403 or normal user rejected? Use success plus service rejection enough. Need endpoint server forces flag (can't pass field because serializer rejects es_excepcion if in payload; direct endpoint force). Test success verifies. Add missing docs direct returns 400 maybe service test. Fine.

Potential instance selected from material advanced. Good.

**Tool: edit**

**Input:**
```json
{
  "filePath": "/home/shiarowo/PERSONAL/Presticad/backend/apps/prestamos/tests.py",
  "oldString": "    def test_post_requiere_token_csrf_con_sesion(self):\n        gestor = self.gestor\n        cliente = APIClient(enforce_csrf_checks=True)\n        sesion = cliente.session\n        sesion[CLAVE_SESION_USUARIO_ID] = gestor.id\n        sesion[CLAVE_SESION_ULTIMA_ACTIVIDAD] = timezone.now().isoformat()\n        sesion.save()\n\n        respuesta = cliente.post(self.URL, self._payload(), format=\"json\")\n\n        self.assertEqual(respuesta.status_code, 403)\n        self.assertEqual(Prestamo.objects.count(), 0)\n\n\nclass DescargarGarantiaAPITestCase(APITestCase):",
  "newString": "    def test_post_requiere_token_csrf_con_sesion(self):\n        gestor = self.gestor\n        cliente = APIClient(enforce_csrf_checks=True)\n        sesion = cliente.session\n        sesion[CLAVE_SESION_USUARIO_ID] = gestor.id\n        sesion[CLAVE_SESION_ULTIMA_ACTIVIDAD] = timezone.now().isoformat()\n        sesion.save()\n\n        respuesta = cliente.post(self.URL, self._payload(), format=\"json\")\n\n        self.assertEqual(respuesta.status_code, 403)\n        self.assertEqual(Prestamo.objects.count(), 0)\n\n    def test_post_excepcion_registra_flag_y_garantia_obligatoria(self):\n        restringido = crear_usuario(\n            \"restringido-api@unsa.edu.pe\",\n            \"20000031\",\n            reputacion_puntaje=-100,\n            reputacion_tier=\"restringido\",\n        )\n        material = crear_material(\n            codigo_material=\"API-EXC-01\",\n            tier_minimo_requerido=\"avanzado\",\n        )\n        self._iniciar_sesion(self.gestor)\n        datos = self._payload_multipart(\n            dni_prestatario=restringido.dni,\n            material_id=str(material.id),\n            instancia_id=str(material.instancias.get().id),\n            tiempo_prestamo_minutos=60,\n            documento_identidad=crear_pdf(\"dni-excepcion.pdf\"),\n            compromiso_responsabilidad=crear_pdf(\"compromiso-excepcion.pdf\"),\n        )\n\n        with storage_garantias_temporal():\n            respuesta = self.client.post(\n                \"/api/prestamos/excepcion/\",\n                datos,\n                format=\"multipart\",\n            )\n\n        self.assertEqual(respuesta.status_code, 201, respuesta.content)\n        self.assertTrue(respuesta.json()[\"es_excepcion\"])\n        self.assertTrue(respuesta.json()[\"requiere_garantia\"])\n        self.assertTrue(respuesta.json()[\"garantia_completa\"])\n        self.assertTrue(Prestamo.objects.get().es_excepcion)\n\n    def test_post_excepcion_como_prestatario_responde_403(self):\n        self._iniciar_sesion(self.prestatario)\n\n        respuesta = self.client.post(\n            \"/api/prestamos/excepcion/\",\n            self._payload(),\n            format=\"json\",\n        )\n\n        self.assertEqual(respuesta.status_code, 403)\n        self.assertEqual(Prestamo.objects.count(), 0)\n\n\nclass DescargarGarantiaAPITestCase(APITestCase):"
}
```

**Output:**
```
Edit applied successfully.
```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 3.5s)

_Thinking:_

Add devolution test. Place in RegistrarDevolucionServiceTestCase after partial.

**Tool: bash**

**Input:**
```json
{
  "command": "grep -n 'def test_dano_parcial_guarda_el_contrato' backend/apps/prestamos/tests.py && sed -n '2215,2255p' backend/apps/prestamos/tests.py",
  "workdir": "/home/shiarowo/PERSONAL/Presticad"
}
```

**Output:**
```
2253:    def test_dano_parcial_guarda_el_contrato_actual_del_checklist(self):
            fecha_devolucion=self.prestamo.fecha_limite + timedelta(days=1, hours=1),
        )

        resultado = devolucion.resultado
        self.assertFalse(resultado["a_tiempo"])
        self.assertFalse(resultado["en_tiempo_gracia"])
        self.assertEqual(resultado["dias_tardanza"], 2)
        self.assertEqual(resultado["bonificacion"], 0)
        self.assertEqual(resultado["deduccion_tardanza"], 20)
        self.assertEqual(resultado["puntos_delta"], -20)
        self.assertEqual(resultado["reputacion_despues"], -20)

    def test_tiempo_gracia_30_minutos_no_aplica_sancion_por_tardanza(self):
        devolucion_en_gracia = self._devolver(
            fecha_devolucion=self.prestamo.fecha_limite + timedelta(minutes=30),
        )

        resultado = devolucion_en_gracia.resultado
        self.assertFalse(resultado["a_tiempo"])
        self.assertTrue(resultado["en_tiempo_gracia"])
        self.assertEqual(resultado["dias_tardanza"], 0)
        self.assertEqual(resultado["bonificacion"], 0)
        self.assertEqual(resultado["deduccion_tardanza"], 0)
        self.assertEqual(resultado["puntos_delta"], 0)

    def test_pasado_el_tiempo_de_gracia_aplica_sancion_por_tardanza(self):
        devolucion_fuera_gracia = self._devolver(
            fecha_devolucion=self.prestamo.fecha_limite + timedelta(minutes=31),
        )

        resultado = devolucion_fuera_gracia.resultado
        self.assertFalse(resultado["a_tiempo"])
        self.assertFalse(resultado["en_tiempo_gracia"])
        self.assertEqual(resultado["dias_tardanza"], 1)
        self.assertEqual(resultado["bonificacion"], 0)
        self.assertEqual(resultado["deduccion_tardanza"], 10)
        self.assertEqual(resultado["puntos_delta"], -10)

    def test_dano_parcial_guarda_el_contrato_actual_del_checklist(self):
        checklist = [
            {"elemento": "Carcasa", "estado": "dano_parcial", "observacion": "Rasguño"},

```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 2.7s)

_Thinking:_

Add after partial test maybe around 2273.

**Tool: bash**

**Input:**
```json
{
  "command": "sed -n '2253,2305p' backend/apps/prestamos/tests.py",
  "workdir": "/home/shiarowo/PERSONAL/Presticad"
}
```

**Output:**
```
    def test_dano_parcial_guarda_el_contrato_actual_del_checklist(self):
        checklist = [
            {"elemento": "Carcasa", "estado": "dano_parcial", "observacion": "Rasguño"},
            {"elemento": "Cable", "estado": "sin_cambios", "observacion": ""},
        ]

        devolucion = self._devolver(
            fecha_devolucion=self.prestamo.fecha_limite,
            checklist=checklist,
        )

        resultado = devolucion.resultado
        self.assertEqual(resultado["dano"], "dano_parcial")
        self.assertEqual(resultado["deduccion_dano"], 30)
        self.assertEqual(resultado["cobro_economico"], "40.00")
        self.assertEqual(resultado["puntos_delta"], -15)
        self.assertEqual(
            set(devolucion.checklist_devolucion[0]),
            {"elemento", "estado", "observacion"},
        )

    def test_dano_total_aplica_deduccion_y_cobro_de_reposicion(self):
        checklist = [
            {"elemento": "Carcasa", "estado": "dano_total", "observacion": "Roto"},
            {"elemento": "Cable", "estado": "sin_cambios", "observacion": ""},
        ]

        devolucion = self._devolver(
            fecha_devolucion=self.prestamo.fecha_limite,
            checklist=checklist,
        )

        resultado = devolucion.resultado
        self.assertEqual(resultado["dano"], "dano_total")
        self.assertEqual(resultado["deduccion_dano"], 60)
        self.assertEqual(resultado["cobro_economico"], "200.00")
        self.assertEqual(resultado["puntos_delta"], -45)

    def test_cobro_nulo_cuando_el_material_no_tiene_costo_parametrizado(self):
        self.material.costo_reparacion = None
        self.material.costo_reposicion = None
        self.material.save(update_fields=["costo_reparacion", "costo_reposicion"])
        checklist = [
            {"elemento": "Carcasa", "estado": "dano_parcial", "observacion": "Leve"},
            {"elemento": "Cable", "estado": "sin_cambios", "observacion": ""},
        ]

        devolucion = self._devolver(fecha_devolucion=self.prestamo.fecha_limite, checklist=checklist)

        self.assertEqual(devolucion.resultado["dano"], "dano_parcial")
        self.assertIsNone(devolucion.resultado["cobro_economico"])

    def test_el_peor_dano_prevalece_entre_elementos(self):

```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 4.3s)

**Tool: edit**

**Input:**
```json
{
  "filePath": "/home/shiarowo/PERSONAL/Presticad/backend/apps/prestamos/tests.py",
  "oldString": "    def test_dano_total_aplica_deduccion_y_cobro_de_reposicion(self):",
  "newString": "    def test_excepcion_duplica_solo_la_deduccion_por_dano(self):\n        self.prestamo.es_excepcion = True\n        self.prestamo.save(update_fields=[\"es_excepcion\"])\n        checklist = [\n            {\"elemento\": \"Carcasa\", \"estado\": \"dano_parcial\", \"observacion\": \"Rasguño\"},\n            {\"elemento\": \"Cable\", \"estado\": \"sin_cambios\", \"observacion\": \"\"},\n        ]\n\n        devolucion = self._devolver(\n            fecha_devolucion=self.prestamo.fecha_limite,\n            checklist=checklist,\n        )\n\n        resultado = devolucion.resultado\n        self.assertEqual(resultado[\"deduccion_dano_base\"], 30)\n        self.assertEqual(resultado[\"deduccion_dano\"], 60)\n        self.assertEqual(resultado[\"cobro_economico\"], \"40.00\")\n        self.assertEqual(resultado[\"puntos_delta\"], -45)\n\n    def test_dano_total_aplica_deduccion_y_cobro_de_reposicion(self):"
}
```

**Output:**
```
Edit applied successfully.
```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 3.4s)

_Thinking:_

Need maybe add `deduccion_dano_base` assertions existing? no.

Need update frontend tests. `estadoPrestamo.test.js` add import and test. `solicitudPrestamo.test.js` add exception test. `validacionesPrestamo.test.js` add maybe one. Let's inspect validations test helper.

**Tool: bash**

**Input:**
```json
{
  "command": "sed -n '1,230p' frontend/src/validacionesPrestamo.test.js",
  "workdir": "/home/shiarowo/PERSONAL/Presticad"
}
```

**Output:**
```
import { describe, expect, it } from 'vitest'

import {
  ayudaRangoDuracion,
  calcularFechaLimiteEstimada,
  evaluarCambioDuracion,
  mapearErroresFotoChecklist,
  obtenerMinutosMaximosMaterial,
  obtenerElementosSinFoto,
  validarFoto,
  validarFormularioPrestamo,
} from './validacionesPrestamo'
import { TAMANO_MAXIMO_GARANTIA_BYTES } from './constantes/garantia'
import { TAMANO_MAXIMO_FOTO_CHECKLIST_BYTES } from './constantes/checklistPrestamo'

const formularioValido = {
  dni: '12345678',
  material: { id: 'mat-1', es_alto_valor: false },
  instanciaId: 'instancia-1',
  dias: '5',
  checklist: [{ elemento: 'Pantalla', observacion: '', foto: { name: 'pantalla.jpg', type: 'image/jpeg', size: 100 } }],
}

describe('validarFormularioPrestamo', () => {
  it('acepta una entrega regular válida', () => {
    expect(validarFormularioPrestamo(formularioValido)).toEqual({})
  })

  it('requiere DNI de ocho dígitos, material, duración y checklist completos', () => {
    const errores = validarFormularioPrestamo({
      ...formularioValido,
      dni: 'abc',
      material: null,
      instanciaId: '',
      dias: 0,
      checklist: [{ elemento: '', observacion: '', foto: formularioValido.checklist[0].foto }],
    })

    expect(errores).toHaveProperty('dni')
    expect(errores).toHaveProperty('material')
    expect(errores).toHaveProperty('instancia_id')
    expect(errores).toHaveProperty('dias')
    expect(errores).toHaveProperty('checklist')
  })

  it('requiere seleccionar una instancia específica del material', () => {
    const errores = validarFormularioPrestamo({
      ...formularioValido,
      instanciaId: '',
    })

    expect(errores).toHaveProperty('instancia_id')
  })

  it('exige ambos PDF para un material de alto valor', () => {
    const errores = validarFormularioPrestamo({
      ...formularioValido,
      material: { id: 'mat-2', es_alto_valor: true },
    })

    expect(errores).toHaveProperty('documento_identidad')
    expect(errores).toHaveProperty('compromiso_responsabilidad')
  })

  it('rechaza extensión, tipo MIME y tamaño incorrectos en los PDF', () => {
    const errores = validarFormularioPrestamo({
      ...formularioValido,
      material: { id: 'mat-2', es_alto_valor: true },
      documentoIdentidad: { name: 'dni.txt', type: 'application/pdf', size: 100 },
      compromisoResponsabilidad: {
        name: 'compromiso.pdf',
        type: 'text/plain',
        size: TAMANO_MAXIMO_GARANTIA_BYTES + 1,
      },
    })

    expect(errores.documento_identidad).toMatch(/extensión \.pdf/)
    expect(errores.compromiso_responsabilidad).toMatch(/application\/pdf/)
  })

  it('rechaza un PDF que supera el tamaño máximo configurado', () => {
    const errores = validarFormularioPrestamo({
      ...formularioValido,
      material: { id: 'mat-2', es_alto_valor: true },
      documentoIdentidad: {
        name: 'dni.pdf',
        type: 'application/pdf',
        size: TAMANO_MAXIMO_GARANTIA_BYTES + 1,
      },
      compromisoResponsabilidad: {
        name: 'compromiso.pdf',
        type: 'application/pdf',
        size: 100,
      },
    })

    expect(errores.documento_identidad).toMatch(/no debe superar/)
    expect(errores).not.toHaveProperty('compromiso_responsabilidad')
  })

  it('calcula la fecha estimada y rechaza duraciones fuera del mínimo de 15 min o máximo del material', () => {
    const fechaLimite = calcularFechaLimiteEstimada(3, 'horas', { tiempo_maximo_prestamo: 360 })

    expect(fechaLimite).toBeInstanceOf(Date)
    expect(calcularFechaLimiteEstimada(10, 'minutos')).toBeNull()
    expect(calcularFechaLimiteEstimada(7, 'horas', { tiempo_maximo_prestamo: 360 })).toBeNull()
    expect(calcularFechaLimiteEstimada(6, 'horas', { tier_minimo_requerido: 'avanzado' })).not.toBeNull()
  })

  it('limita la duración mínima a 15 minutos y la máxima según el material (defaults por Tier)', () => {
    expect(obtenerMinutosMaximosMaterial({ tier_minimo_requerido: 'avanzado' })).toBe(360)
    expect(obtenerMinutosMaximosMaterial({ tier_minimo_requerido: 'estandar' })).toBe(1440)
    expect(obtenerMinutosMaximosMaterial({ tier_minimo_requerido: 'restringido' })).toBe(4320)
    expect(obtenerMinutosMaximosMaterial({ tiempo_maximo_prestamo: 180 })).toBe(180)

    expect(
      validarFormularioPrestamo({
        ...formularioValido,
        duracionValor: '10',
        duracionUnidad: 'minutos',
      }).dias,
    ).toBe('El tiempo mínimo de préstamo es de 15 minutos.')

    expect(
      validarFormularioPrestamo({
        ...formularioValido,
        material: { id: 'vr-1', es_alto_valor: false, tier_minimo_requerido: 'avanzado' },
        duracionValor: '7',
        duracionUnidad: 'horas',
      }).dias,
    ).toBe('El tiempo solicitado supera el máximo permitido para este material (6 horas).')

    expect(
      validarFormularioPrestamo({
        ...formularioValido,
        material: { id: 'vr-1', es_alto_valor: false, tier_minimo_requerido: 'avanzado' },
        duracionValor: '6',
        duracionUnidad: 'horas',
      }),
    ).toEqual({})

    expect(ayudaRangoDuracion({ tier_minimo_requerido: 'avanzado' })).toMatch(/6 horas/)
    expect(ayudaRangoDuracion({ tier_minimo_requerido: 'avanzado' })).toMatch(/30 min de tiempo de gracia/)
  })

  it('conserva el último valor válido y avisa ante duraciones fuera del rango permitido', () => {
    const materialVr = { tier_minimo_requerido: 'avanzado' }
    expect(evaluarCambioDuracion('10', '30', 'minutos', materialVr)).toEqual({
      valor: '30',
      error: 'El tiempo mínimo de préstamo es de 15 minutos.',
    })
    expect(evaluarCambioDuracion('7', '6', 'horas', materialVr)).toEqual({
      valor: '6',
      error: 'El tiempo solicitado supera el máximo permitido para este material (6 horas).',
    })
    expect(evaluarCambioDuracion('-1', '3', 'horas', materialVr)).toEqual({
      valor: '3',
      error: 'La duración debe ser de al menos 15 minutos y máximo 6 horas.',
    })
    expect(evaluarCambioDuracion('0', '3', 'horas', materialVr)).toEqual({
      valor: '3',
      error: 'La duración debe ser de al menos 15 minutos y máximo 6 horas.',
    })
    expect(evaluarCambioDuracion('1.5', '3', 'horas', materialVr)).toEqual({
      valor: '3',
      error: 'La duración debe ser de al menos 15 minutos y máximo 6 horas.',
    })
    expect(evaluarCambioDuracion('6', '3', 'horas', materialVr)).toEqual({ valor: '6', error: '' })
    expect(evaluarCambioDuracion('15', '30', 'minutos', materialVr)).toEqual({ valor: '15', error: '' })
    expect(evaluarCambioDuracion('', '3', 'horas', materialVr)).toEqual({ valor: '', error: '' })
  })

  it('requiere fotos válidas por elemento y permite observación opcional', () => {
    const errores = validarFormularioPrestamo({
      ...formularioValido,
      checklist: [
        { elemento: 'Pantalla', observacion: '', foto: null },
        { elemento: 'Teclado', observacion: 'Revisado', foto: formularioValido.checklist[0].foto },
      ],
    })

    expect(errores.fotosChecklist[0]).toMatch(/Adjunta una foto/)
    expect(errores.fotosChecklist).not.toHaveProperty('1')
  })

  it('valida extensión, tipo MIME y tamaño de fotos', () => {
    expect(validarFoto({ name: 'captura.gif', type: 'image/gif', size: 10 })).toMatch(/JPG, PNG o WEBP/)
    expect(validarFoto({ name: 'captura.png', type: 'text/plain', size: 10 })).toMatch(/tipo JPG/)
    expect(validarFoto({
      name: 'captura.png',
      type: 'image/png',
      size: TAMANO_MAXIMO_FOTO_CHECKLIST_BYTES + 1,
    })).toMatch(/no debe superar/)
  })

  it('identifica las filas que no tienen foto para mostrarlas en la advertencia', () => {
    expect(obtenerElementosSinFoto([
      { elemento: 'Pantalla', foto: null },
      { elemento: 'Teclado', foto: { name: 'teclado.png' } },
      { elemento: '', foto: null },
    ])).toEqual([
      { indice: 0, elemento: 'Pantalla' },
      { indice: 2, elemento: 'Elemento 3' },
    ])
  })

  it('mapea los errores de foto del backend a sus índices de fila', () => {
    expect(mapearErroresFotoChecklist({ 1: ['La imagen no es válida.'] })).toEqual({
      1: 'La imagen no es válida.',
    })
    expect(mapearErroresFotoChecklist(null)).toEqual({})
  })
})

```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 3.5s)

_Thinking:_

Add tests.

**Tool: edit**

**Input:**
```json
{
  "filePath": "/home/shiarowo/PERSONAL/Presticad/frontend/src/validacionesPrestamo.test.js",
  "oldString": "  it('rechaza extensión, tipo MIME y tamaño incorrectos en los PDF', () => {",
  "newString": "  it('exige ambos PDF cuando se registra una excepción académica', () => {\n    const errores = validarFormularioPrestamo({\n      ...formularioValido,\n      esExcepcion: true,\n    })\n\n    expect(errores).toHaveProperty('documento_identidad')\n    expect(errores).toHaveProperty('compromiso_responsabilidad')\n  })\n\n  it('rechaza extensión, tipo MIME y tamaño incorrectos en los PDF', () => {"
}
```

**Output:**
```
Edit applied successfully.
```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 4.8s)

_Thinking:_

Solicitud test.

**Tool: edit**

**Input:**
```json
{
  "filePath": "/home/shiarowo/PERSONAL/Presticad/frontend/src/prestamos/solicitudPrestamo.test.js",
  "oldString": "  it('omite los campos PDF cuando el material no requiere garantía', () => {",
  "newString": "  it('incluye ambos PDF en una excepción aunque el material no sea de alto valor', () => {\n    const documentoIdentidad = new File(['%PDF-'], 'dni.pdf', { type: 'application/pdf' })\n    const compromisoResponsabilidad = new File(['%PDF-'], 'compromiso.pdf', {\n      type: 'application/pdf',\n    })\n    const solicitud = construirSolicitudPrestamo({\n      dni: '12345678',\n      material: { id: 'material-1', es_alto_valor: false },\n      instanciaId: 'instancia-1',\n      dias: '5',\n      checklist: [{ elemento: 'Equipo', observacion: '', foto: new File(['foto'], 'equipo.png', { type: 'image/png' }) }],\n      documentoIdentidad,\n      compromisoResponsabilidad,\n      esExcepcion: true,\n    })\n\n    expect(solicitud.get('documento_identidad')).toBe(documentoIdentidad)\n    expect(solicitud.get('compromiso_responsabilidad')).toBe(compromisoResponsabilidad)\n  })\n\n  it('omite los campos PDF cuando el material no requiere garantía', () => {"
}
```

**Output:**
```
Edit applied successfully.
```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 2.9s)

_Thinking:_

Estado test.

**Tool: edit**

**Input:**
```json
{
  "filePath": "/home/shiarowo/PERSONAL/Presticad/frontend/src/prestamos/estadoPrestamo.test.js",
  "oldString": "import {\n  obtenerEstadoVisible,\n  ordenarPrestamos,\n  presentarEstadoPrestamo,\n} from './estadoPrestamo'",
  "newString": "import {\n  obtenerEstadoVisible,\n  ordenarPrestamos,\n  presentarEstadoPrestamo,\n  textoEstadoPrestamo,\n} from './estadoPrestamo'"
}
```

**Output:**
```
Edit applied successfully.
```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 3.2s)

**Tool: edit**

**Input:**
```json
{
  "filePath": "/home/shiarowo/PERSONAL/Presticad/frontend/src/prestamos/estadoPrestamo.test.js",
  "oldString": "describe('obtenerEstadoVisible', () => {",
  "newString": "describe('textoEstadoPrestamo', () => {\n  it('identifica un préstamo activo registrado como excepción', () => {\n    expect(textoEstadoPrestamo({ es_excepcion: true }, 'activo')).toBe('Activo - Excepción')\n  })\n\n  it('conserva la etiqueta regular cuando no es excepción', () => {\n    expect(textoEstadoPrestamo({ es_excepcion: false }, 'activo')).toBe('Activo')\n  })\n})\n\ndescribe('obtenerEstadoVisible', () => {"
}
```

**Output:**
```
Edit applied successfully.
```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 59.4s)

_Thinking:_

Need maybe update `DevolucionResultadoSerializer` tests? Adding optional won't break. Report serializer maybe no.

Need test file maybe a syntax issue in tests: `self._payload_multipart` includes `tiempo_prestamo_dias=3` and `tiempo_prestamo_minutos=60`; serializer validated both. Service picks minutes. Fine.

Need run backend tests. First perhaps `python manage.py makemigrations --check`, test targeted. Use docker.

**Tool: bash**

**Input:**
```json
{
  "command": "docker compose exec -T backend python manage.py makemigrations --check --dry-run && docker compose exec -T backend python manage.py test apps.prestamos.tests.RegistrarPrestamoServiceTestCase apps.prestamos.tests.RegistrarPrestamoAPITestCase apps.prestamos.tests.RegistrarDevolucionServiceTestCase",
  "workdir": "/home/shiarowo/PERSONAL/Presticad",
  "timeout": 240000
}
```

**Output:**
```
No changes detected
Creating test database for alias 'default'...
Found 67 test(s).
System check identified no issues (0 silenced).
...................................................................
----------------------------------------------------------------------
Ran 67 tests in 49.447s

OK
Destroying test database for alias 'default'...

```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 3.1s)

_Thinking:_

Great. Need run frontend tests.

**Tool: bash**

**Input:**
```json
{
  "command": "npm test",
  "workdir": "/home/shiarowo/PERSONAL/Presticad/frontend",
  "timeout": 240000
}
```

**Output:**
```
/bin/bash: line 1: npm: command not found

```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 5.3s)

_Thinking:_

npm not host. Use docker compose exec frontend npm test.

**Tool: bash**

**Input:**
```json
{
  "command": "docker compose exec -T frontend npm test",
  "workdir": "/home/shiarowo/PERSONAL/Presticad",
  "timeout": 240000
}
```

**Output:**
```

> presticad-frontend@0.1.0 test
> vitest run


[1m[30m[46m RUN [49m[39m[22m [36mv5.1.0 [39m[90m/app[39m

 [32m✓[39m src/prestamos/historialPrestamos.test.js [2m([22m[2m12 tests[22m[2m)[22m[32m 22[2mms[22m[39m
 [32m✓[39m src/prestamos/prestatarios.test.js [2m([22m[2m8 tests[22m[2m)[22m[32m 20[2mms[22m[39m
 [32m✓[39m src/prestamos/estadoPrestamo.test.js [2m([22m[2m10 tests[22m[2m)[22m[32m 20[2mms[22m[39m
 [32m✓[39m src/prestamos/navegacionPrestamos.test.js [2m([22m[2m5 tests[22m[2m)[22m[32m 18[2mms[22m[39m
 [32m✓[39m src/prestamos/instanciasPrestamo.test.js [2m([22m[2m5 tests[22m[2m)[22m[32m 12[2mms[22m[39m
 [32m✓[39m src/validacionesTelefono.test.js [2m([22m[2m12 tests[22m[2m)[22m[32m 40[2mms[22m[39m
 [32m✓[39m src/prestamos/solicitudPrestamo.test.js [2m([22m[2m4 tests[22m[2m)[22m[32m 95[2mms[22m[39m
 [32m✓[39m src/api/client.test.js [2m([22m[2m21 tests[22m[2m)[22m[32m 148[2mms[22m[39m
 [32m✓[39m src/catalogo/fichaTecnica.test.js [2m([22m[2m7 tests[22m[2m)[22m[32m 31[2mms[22m[39m
 [32m✓[39m src/validacionesDevolucion.test.js [2m([22m[2m6 tests[22m[2m)[22m[32m 34[2mms[22m[39m
 [32m✓[39m src/validacionesPrestamo.test.js [2m([22m[2m14 tests[22m[2m)[22m[32m 35[2mms[22m[39m
 [32m✓[39m src/inventario/registroMaterial.test.js [2m([22m[2m10 tests[22m[2m)[22m[32m 89[2mms[22m[39m
 [32m✓[39m src/inventario/agregarEjemplares.test.js [2m([22m[2m8 tests[22m[2m)[22m[32m 53[2mms[22m[39m
 [32m✓[39m src/prestamos/reportesDevolucion.test.js [2m([22m[2m6 tests[22m[2m)[22m[32m 16[2mms[22m[39m
 [32m✓[39m src/prestamos/filtroPrestamos.test.js [2m([22m[2m7 tests[22m[2m)[22m[32m 16[2mms[22m[39m
 [32m✓[39m src/prestamos/tamanoSolicitud.test.js [2m([22m[2m3 tests[22m[2m)[22m[32m 48[2mms[22m[39m
 [32m✓[39m src/prestamos/MisPrestamos.test.js [2m([22m[2m4 tests[22m[2m)[22m[32m 13[2mms[22m[39m
 [32m✓[39m src/inventario/eliminacionMaterial.test.js [2m([22m[2m3 tests[22m[2m)[22m[32m 12[2mms[22m[39m
 [32m✓[39m src/components/MaterialForm.test.jsx [2m([22m[2m4 tests[22m[2m)[22m[32m 15[2mms[22m[39m

[2m Test Files [22m [1m[32m19 passed[39m[22m[90m (19)[39m
[2m      Tests [22m [1m[32m149 passed[39m[22m[90m (149)[39m
[2m   Start at [22m 01:03:25
[2m   Duration [22m 1.35s[2m (transform 56%, import 24%, tests 15%, worker 4%)[22m


```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 180.8s)

_Thinking:_

Need run full backend tests? At minimum full suite maybe 300+ tests could take. Plan says full. Do. Also frontend build. But first maybe inspect git diff and run code style? No lint script. Could run `python manage.py test` full. Might take ~5 min. Do with timeout 600000. Also npm build. Parallel? Could run in parallel, but resource okay. Use separate tool calls in one message? We can run in parallel. But instruction says parallel tool calls. Do both.

**Tool: bash**

**Input:**
```json
{
  "command": "docker compose exec -T backend python manage.py test",
  "workdir": "/home/shiarowo/PERSONAL/Presticad",
  "timeout": 600000
}
```

**Output:**
```
Found 351 test(s).
Creating test database for alias 'default'...
System check identified no issues (0 silenced).
.........................................................................F.....................................................................................F.....F...................................................................................................................................................................................ss....
======================================================================
FAIL: test_registrar_como_gestor_responde_201 (apps.inventario.tests.MaterialesAPITestCase.test_registrar_como_gestor_responde_201)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/app/apps/inventario/tests.py", line 857, in test_registrar_como_gestor_responde_201
    self.assertEqual(cuerpo["bonificacion_tiempo"], 5)
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 15 != 5

======================================================================
FAIL: test_get_lista_global_paginada_y_sin_datos_privados (apps.prestamos.tests.HistorialPrestamosAPITestCase.test_get_lista_global_paginada_y_sin_datos_privados)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/app/apps/prestamos/tests.py", line 1072, in test_get_lista_global_paginada_y_sin_datos_privados
    self.assertEqual(set(prestamo), self.CAMPOS_HISTORIAL)
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: Items in the first set but not the second:
'es_excepcion'

======================================================================
FAIL: test_get_devuelve_solo_prestamos_propios_y_campos_publicos (apps.prestamos.tests.MisPrestamosAPITestCase.test_get_devuelve_solo_prestamos_propios_y_campos_publicos)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/app/apps/prestamos/tests.py", line 973, in test_get_devuelve_solo_prestamos_propios_y_campos_publicos
    self.assertEqual(set(datos[0]), self.CAMPOS_PUBLICOS)
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: Items in the first set but not the second:
'es_excepcion'

----------------------------------------------------------------------
Ran 351 tests in 173.567s

FAILED (failures=3, skipped=2)
Destroying test database for alias 'default'...

```

**Tool: bash**

**Input:**
```json
{
  "command": "docker compose exec -T frontend npm run build",
  "workdir": "/home/shiarowo/PERSONAL/Presticad",
  "timeout": 300000
}
```

**Output:**
```

> presticad-frontend@0.1.0 build
> vite build

vite v6.4.5 building for production...
transforming...
✓ 2256 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                              1.20 kB │ gzip:   0.62 kB
dist/assets/inter-vietnamese-wght-normal-CBcvBZtf.woff2     10.25 kB
dist/assets/inter-greek-ext-wght-normal-DlzME5K_.woff2      11.23 kB
dist/assets/inter-cyrillic-wght-normal-DqGufNeO.woff2       18.75 kB
dist/assets/inter-greek-wght-normal-CkhJZR-_.woff2          19.00 kB
dist/assets/inter-cyrillic-ext-wght-normal-BOeWTOD4.woff2   25.96 kB
dist/assets/flags-a2kmUSbF.webp                             28.19 kB
dist/assets/inter-latin-wght-normal-Dx4kXJAl.woff2          48.26 kB
dist/assets/flags@2x-gR6KPp3x.webp                          66.45 kB
dist/assets/inter-latin-ext-wght-normal-DO1Apj_S.woff2      85.07 kB
dist/assets/index-CE2tNu1H.css                              65.74 kB │ gzip:  14.43 kB
dist/assets/utils-3P6Si2Fo.js                              264.34 kB │ gzip:  58.47 kB
dist/assets/index-CS5B0Nq-.js                              580.21 kB │ gzip: 164.21 kB

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 6.93s

```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 5.1s)

_Thinking:_

Full backend reveals existing failure in inventario unrelated? It expected 5 but got 15 likely pre-existing? Need investigate whether our changes caused? No, inventory test unrelated. Could be known baseline failure due date? Need not fix unrelated unless newly caused? It may be existing in branch. We should verify on baseline? But current branch only our changes. Could our model field affect? No. Could migration? no. Likely existing test failure. But must mention. We need fix two expected field sets due added fields. That's our changes. Update tests CAMPOS. Inventory failure likely unrelated, but full suite should pass ideally. Need inspect inventory test to see maybe pre-existing due environment settings. Could be model time? Not our concern but maybe test expects 5 from default material but got 15 due settings? We should not modify unrelated? The user asked continue implementation. Full suite failure is a concern. Need see if pre-existing on development maybe. Could run that single test after stashing? We don't commit. But likely existing. Let's inspect test and code.

**Tool: bash**

**Input:**
```json
{
  "command": "grep -n 'CAMPOS_PUBLICOS\\|CAMPOS_HISTORIAL' backend/apps/prestamos/tests.py | head -20 && sed -n '830,870p' backend/apps/inventario/tests.py",
  "workdir": "/home/shiarowo/PERSONAL/Presticad"
}
```

**Output:**
```
911:    CAMPOS_PUBLICOS = {
973:        self.assertEqual(set(datos[0]), self.CAMPOS_PUBLICOS)
1003:    CAMPOS_HISTORIAL = {
1072:        self.assertEqual(set(prestamo), self.CAMPOS_HISTORIAL)
        self.assertEqual(
            respuesta.json()["detail"], "Inicia sesión para gestionar el inventario."
        )
        self.assertEqual(Material.objects.count(), 0)

    def test_registrar_como_prestatario_responde_403(self):
        """El rol `prestatario` no gestiona el inventario (criterio 5)."""
        self._autenticar("prestatario@unsa.edu.pe", "prestatario")

        respuesta = self.client.post(self.LIST_URL, self._payload_valido(), format="json")

        self.assertEqual(respuesta.status_code, 403)
        self.assertEqual(
            respuesta.json()["detail"],
            "Solo un gestor o un administrador puede gestionar el inventario.",
        )
        self.assertEqual(Material.objects.count(), 0)

    def test_registrar_como_gestor_responde_201(self):
        self._autenticar("gestor@unsa.edu.pe", "gestor")

        respuesta = self.client.post(self.LIST_URL, self._payload_valido(), format="json")

        self.assertEqual(respuesta.status_code, 201, respuesta.content)
        cuerpo = respuesta.json()
        self.assertEqual(cuerpo["estado"], "disponible")
        self.assertEqual(cuerpo["unidades_disponibles"], 1)
        self.assertEqual(cuerpo["bonificacion_tiempo"], 5)
        self.assertEqual(Material.objects.count(), 1)

    def test_registrar_como_administrador_responde_201(self):
        self._autenticar("admin@unsa.edu.pe", "administrador")

        respuesta = self.client.post(self.LIST_URL, self._payload_valido(), format="json")

        self.assertEqual(respuesta.status_code, 201, respuesta.content)

    def test_registrar_con_codigo_duplicado_responde_409(self):
        self._autenticar("gestor@unsa.edu.pe", "gestor")
        registrar_material(nombre="Otro", codigo_material="OBJ-001", tipo="objeto")


```

**Tool: bash**

**Input:**
```json
{
  "command": "git status --short && git diff --stat && git log --oneline -3",
  "workdir": "/home/shiarowo/PERSONAL/Presticad"
}
```

**Output:**
```
 M backend/apps/prestamos/consultar_serializers.py
 M backend/apps/prestamos/models.py
 M backend/apps/prestamos/serializers.py
 M backend/apps/prestamos/services.py
 M backend/apps/prestamos/tests.py
 M backend/apps/prestamos/urls.py
 M backend/apps/prestamos/views.py
 M frontend/src/components/prestamos/DetallePrestamo.jsx
 M frontend/src/components/prestamos/ListaPrestamos.jsx
 M frontend/src/pages/RegistrarPrestamo.jsx
 M frontend/src/prestamos/ListaHistorialPrestamos.jsx
 M frontend/src/prestamos/estadoPrestamo.js
 M frontend/src/prestamos/estadoPrestamo.test.js
 M frontend/src/prestamos/solicitudPrestamo.js
 M frontend/src/prestamos/solicitudPrestamo.test.js
 M frontend/src/validacionesPrestamo.js
 M frontend/src/validacionesPrestamo.test.js
?? backend/apps/prestamos/migrations/0008_prestamo_es_excepcion.py
 backend/apps/prestamos/consultar_serializers.py    |   4 +
 backend/apps/prestamos/models.py                   |   6 +-
 backend/apps/prestamos/serializers.py              |   2 +
 backend/apps/prestamos/services.py                 |  40 +++++-
 backend/apps/prestamos/tests.py                    | 141 +++++++++++++++++++++
 backend/apps/prestamos/urls.py                     |   6 +
 backend/apps/prestamos/views.py                    |  47 ++++---
 .../src/components/prestamos/DetallePrestamo.jsx   |  11 +-
 .../src/components/prestamos/ListaPrestamos.jsx    |   7 +-
 frontend/src/pages/RegistrarPrestamo.jsx           |  62 ++++++++-
 frontend/src/prestamos/ListaHistorialPrestamos.jsx |   6 +-
 frontend/src/prestamos/estadoPrestamo.js           |   5 +
 frontend/src/prestamos/estadoPrestamo.test.js      |  11 ++
 frontend/src/prestamos/solicitudPrestamo.js        |   7 +-
 frontend/src/prestamos/solicitudPrestamo.test.js   |  20 +++
 frontend/src/validacionesPrestamo.js               |   3 +-
 frontend/src/validacionesPrestamo.test.js          |  10 ++
 17 files changed, 350 insertions(+), 38 deletions(-)
b4501a2 docs(reservas): agregar plan de implementacion de reservas y excepciones
785c872 docs(reservas): actualizar requisitos, backlog y DDD para lista de espera
c0f3746 Merge pull request #52 from Shiar-owo/feature/validacion-telefono-usuario

```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 3.0s)

_Thinking:_

Inventory failure likely pre-existing. Need update CAMPOS sets. Inspect lines.

**Tool: bash**

**Input:**
```json
{
  "command": "sed -n '900,930p' backend/apps/prestamos/tests.py && sed -n '995,1020p' backend/apps/prestamos/tests.py && grep -n 'bonificacion_tiempo.*5\\|DEFAULT.*BONIF\\|bonificacion_tiempo' backend/apps/inventario/models.py backend/apps/inventario/services.py | head -20",
  "workdir": "/home/shiarowo/PERSONAL/Presticad"
}
```

**Output:**
```
        )
        self.assertEqual(
            [prestamo.estado_consulta for prestamo in resultado],
            ["vencido", "vencido", "activo", "devuelto"],
        )
        vencido_antiguo.refresh_from_db()
        self.assertEqual(vencido_antiguo.estado, "activo")


class MisPrestamosAPITestCase(APITestCase):
    URL = "/api/prestamos/mis-prestamos/"
    CAMPOS_PUBLICOS = {
        "id",
        "material_id",
        "material_nombre",
        "material_codigo",
        "codigo_ejemplar",
        "fecha_entrega",
        "fecha_limite",
        "tiempo_prestamo_minutos",
        "tiempo_prestamo_dias",
        "estado",
    }

    def setUp(self):
        self.prestatario = crear_usuario("mis-prestamos@unsa.edu.pe", "20000101")
        self.otro_prestatario = crear_usuario("otro-mis-prestamos@unsa.edu.pe", "20000102")
        self.gestor = crear_usuario("gestor-mis-prestamos@unsa.edu.pe", "20000103", rol="gestor")
        self.administrador = crear_usuario(
            "admin-mis-prestamos@unsa.edu.pe",
            "20000104",
        self.assertEqual(respuesta.json()[0]["estado"], "vencido")
        prestamo.refresh_from_db()
        self.assertEqual(prestamo.estado, "activo")


class HistorialPrestamosAPITestCase(APITestCase):
    URL = "/api/prestamos/historial/"
    URL_DETALLE = "/api/prestamos/{prestamo_id}/historial/"
    CAMPOS_HISTORIAL = {
        "id",
        "prestatario_nombre",
        "material_id",
        "material_nombre",
        "material_codigo",
        "codigo_ejemplar",
        "fecha_entrega",
        "fecha_limite",
        "tiempo_prestamo_minutos",
        "tiempo_prestamo_dias",
        "estado",
    }

    def setUp(self):
        self.gestor = crear_usuario("gestor-historial-api@unsa.edu.pe", "20000201", rol="gestor")
        self.administrador = crear_usuario(
            "admin-historial-api@unsa.edu.pe", "20000202", rol="administrador"
backend/apps/inventario/models.py:29:DEFAULT_BONIFICACION_TIEMPO = 15
backend/apps/inventario/models.py:124:    bonificacion_tiempo = models.PositiveIntegerField(
backend/apps/inventario/models.py:125:        default=DEFAULT_BONIFICACION_TIEMPO,
backend/apps/inventario/services.py:48:        "bonificacion_tiempo",
backend/apps/inventario/services.py:234:    bonificacion_tiempo=None,
backend/apps/inventario/services.py:399:        "bonificacion_tiempo": bonificacion_tiempo,

```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 4.6s)

_Thinking:_

Update tests. Could the inventory test be a genuinely pre-existing failure from default changed to 15 but test stale. We should maybe not fix unrelated but full suite pass requires. It's a one-line test expectation outdated. Did we change default? No. Maybe in previous work default changed to 15. We can update test expectation to default constant? It's outside task. Better mention? But to have green suite, update test to expect `DEFAULT_BONIFICACION_TIEMPO` or 15. But that changes unrelated test. Is it safe? Yes if requirement says default 15. Let's inspect payload maybe sets tier and service defaults? But code default is 15, test says 5. It's stale. Updating aligns. Should we include? It's not part HU but necessary full suite. Maybe mention in final. Do.

First add `es_excepcion` to sets.

**Tool: edit**

**Input:**
```json
{
  "filePath": "/home/shiarowo/PERSONAL/Presticad/backend/apps/prestamos/tests.py",
  "oldString": "        \"tiempo_prestamo_dias\",\n        \"estado\",\n    }\n\n    def setUp(self):\n        self.prestatario = crear_usuario(\"mis-prestamos@unsa.edu.pe\", \"20000101\")",
  "newString": "        \"tiempo_prestamo_dias\",\n        \"estado\",\n        \"es_excepcion\",\n    }\n\n    def setUp(self):\n        self.prestatario = crear_usuario(\"mis-prestamos@unsa.edu.pe\", \"20000101\")"
}
```

**Output:**
```
Edit applied successfully.
```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 3.6s)

**Tool: edit**

**Input:**
```json
{
  "filePath": "/home/shiarowo/PERSONAL/Presticad/backend/apps/prestamos/tests.py",
  "oldString": "        \"tiempo_prestamo_dias\",\n        \"estado\",\n    }\n\n    def setUp(self):\n        self.gestor = crear_usuario(\"gestor-historial-api@unsa.edu.pe\", \"20000201\", rol=\"gestor\")",
  "newString": "        \"tiempo_prestamo_dias\",\n        \"estado\",\n        \"es_excepcion\",\n    }\n\n    def setUp(self):\n        self.gestor = crear_usuario(\"gestor-historial-api@unsa.edu.pe\", \"20000201\", rol=\"gestor\")"
}
```

**Output:**
```
Edit applied successfully.
```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 2.5s)

_Thinking:_

Inventory test update. Need import constant? Inspect imports top of inventory tests.

**Tool: bash**

**Input:**
```json
{
  "command": "sed -n '1,45p' backend/apps/inventario/tests.py",
  "workdir": "/home/shiarowo/PERSONAL/Presticad"
}
```

**Output:**
```
"""Tests del módulo inventario."""
import json
import os
import tempfile
from io import BytesIO
from pathlib import Path

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import SimpleTestCase, TestCase, TransactionTestCase, override_settings
from django.utils import timezone
from PIL import Image
from rest_framework.test import APITestCase

from apps.inventario.models import InstanciaMaterial, Material
from apps.inventario.serializers import (
    FotoMaterial,
    InstanciaMaterialModificacionSerializer,
    MaterialActualizacionSerializer,
    MaterialRegistroSerializer,
    MaterialSerializer,
)
from apps.inventario.validators import TAMANIO_MAXIMO, validar_foto
from apps.usuarios.models import Rol
from apps.usuarios.services import registrar_usuario
from apps.usuarios.sesiones import CLAVE_SESION_ULTIMA_ACTIVIDAD, CLAVE_SESION_USUARIO_ID
from apps.inventario.services import (
    InventarioError,
    MaterialNoEncontradoError,
    actualizar_material,
    buscar_materiales,
    cambiar_estado_material,
    listar_materiales,
    normalizar_codigo,
    obtener_material,
    parametros_reputacion_por_defecto,
    registrar_material,
)

# Formatos que acepta la foto, con su `content_type` y su extensión.
FORMATOS_FOTO = {
    "JPEG": ("image/jpeg", ".jpg"),

```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 3.1s)

_Thinking:_

Could just change 5 to 15, but better constant import. Yet tests often literal. Let's inspect payload maybe explicit expectation from old default. Use `self.assertEqual(cuerpo["bonificacion_tiempo"], 15)`. Minimal.

**Tool: edit**

**Input:**
```json
{
  "filePath": "/home/shiarowo/PERSONAL/Presticad/backend/apps/inventario/tests.py",
  "oldString": "        self.assertEqual(cuerpo[\"bonificacion_tiempo\"], 5)",
  "newString": "        self.assertEqual(cuerpo[\"bonificacion_tiempo\"], 15)"
}
```

**Output:**
```
Edit applied successfully.
```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 183.7s)

_Thinking:_

Need run full again. Before maybe inspect `git diff` for issues. Also frontend `ListaHistorialPrestamos` path from src/prestamos to components is `../components` correct. It already imports `../components/ui/BadgeEstado`, yes. Good.

Potential bug: `textoEstadoPrestamo({ es_excepcion: esExcepcion }, estado)` uses default `estado = prestamo.estado`, but we pass estado explicitly, good.

Potential bug: detail serializer `PrestamoHistorialDetalle` includes es_excepcion by replaceAll. Yes.

Potential bug: regular `RegistrarPrestamoSerializer` rejects `es_excepcion` field since not declared. Direct endpoint force. Good.

Potential bug: `_validar_elegibilidad` exception with material tier lower but user restricted and `tiers_permitidos` maybe None if unknown. Rejects. Good.

Potential bug: direct exception with high value material: requires docs and guarantee. Good.

Potential bug: `Prestamo.requiere_garantia` now makes direct exception guarantee required; `garantia_completa` true. Good.

Potential bug: `_calcular_resultado` doubling zero no effect. good.

Potential issue: When `es_excepcion=True`, devolution `puntos_delta` could be negative. good.

Potential issue: direct exception API success test payload includes "tiempo_prestamo_dias":3 and "tiempo_prestamo_minutos":60. Serializer accepts both, service chooses minutes. Good.

Need maybe add migration deploy. Run full tests.

**Tool: bash**

**Input:**
```json
{
  "command": "docker compose exec -T backend python manage.py test",
  "workdir": "/home/shiarowo/PERSONAL/Presticad",
  "timeout": 600000
}
```

**Output:**
```
Found 351 test(s).
Creating test database for alias 'default'...
System check identified no issues (0 silenced).
.........................................................................................................................................................................................................................................................................................................................................................ss....
----------------------------------------------------------------------
Ran 351 tests in 175.473s

OK (skipped=2)
Destroying test database for alias 'default'...

```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 5.2s)

_Thinking:_

Need maybe run frontend tests/build after final changes? We didn't change frontend since build? We changed no frontend after build except none. Tests were before build. All okay. But after changes frontend only test files before build? Build includes source already. Fine. Need maybe run `git diff --check` for whitespace.

**Tool: bash**

**Input:**
```json
{
  "command": "git diff --check && docker compose exec -T backend python manage.py makemigrations --check --dry-run",
  "workdir": "/home/shiarowo/PERSONAL/Presticad",
  "timeout": 120000
}
```

**Output:**
```
No changes detected

```

**Tool: bash**

**Input:**
```json
{
  "command": "git diff -- backend/apps/prestamos/services.py backend/apps/prestamos/views.py frontend/src/pages/RegistrarPrestamo.jsx | sed -n '1,260p'",
  "workdir": "/home/shiarowo/PERSONAL/Presticad"
}
```

**Output:**
```
diff --git a/backend/apps/prestamos/services.py b/backend/apps/prestamos/services.py
index 57c855e..2594fa7 100644
--- a/backend/apps/prestamos/services.py
+++ b/backend/apps/prestamos/services.py
@@ -220,7 +220,7 @@ def _obtener_prestatario_bloqueado(dni):
         ) from error
 
 
-def _validar_elegibilidad(usuario, material):
+def _validar_elegibilidad(usuario, material, *, es_excepcion=False):
     if usuario.rol.nombre != "prestatario":
         raise PrestamoError(
             "dni_prestatario",
@@ -233,6 +233,19 @@ def _validar_elegibilidad(usuario, material):
         )
 
     tiers_permitidos = TIERS_ACCESIBLES.get(usuario.reputacion_tier)
+    if es_excepcion:
+        if (
+            usuario.reputacion_tier != "restringido"
+            or tiers_permitidos is None
+            or material.tier_minimo_requerido in tiers_permitidos
+        ):
+            raise PrestamoError(
+                "es_excepcion",
+                "El préstamo excepcional solo aplica a usuarios Restringidos "
+                "con material de un Tier superior.",
+            )
+        return
+
     if tiers_permitidos is None or material.tier_minimo_requerido not in tiers_permitidos:
         raise PrestamoError(
             "dni_prestatario",
@@ -336,7 +349,13 @@ def _validar_fotos_checklist(checklist_inicial, fotos_checklist):
             ) from error
 
 
-def _validar_documentos_garantia(material, documento_identidad, compromiso_responsabilidad):
+def _validar_documentos_garantia(
+    material,
+    documento_identidad,
+    compromiso_responsabilidad,
+    *,
+    es_excepcion=False,
+):
     documentos = (
         ("documento_identidad", documento_identidad, "El documento de identidad en PDF"),
         (
@@ -345,7 +364,7 @@ def _validar_documentos_garantia(material, documento_identidad, compromiso_respo
             "El compromiso de responsabilidad en PDF",
         ),
     )
-    requiere_garantia = material.requiere_garantia()
+    requiere_garantia = es_excepcion or material.requiere_garantia()
     if not requiere_garantia:
         for campo, archivo, _ in documentos:
             if archivo is not None:
@@ -358,7 +377,8 @@ def _validar_documentos_garantia(material, documento_identidad, compromiso_respo
             if archivo is None:
                 raise PrestamoError(
                     campo,
-                    f"{descripcion} es obligatorio para materiales de alto valor.",
+                    f"{descripcion} es obligatorio para préstamos excepcionales "
+                    "y materiales de alto valor.",
                 )
 
     for campo, archivo, _ in documentos:
@@ -579,6 +599,7 @@ def registrar_prestamo(
     documento_identidad=None,
     compromiso_responsabilidad=None,
     fecha_entrega=None,
+    es_excepcion=False,
 ):
     """Registra la entrega con elegibilidad, garantía y control atómico de stock."""
     minutos_prestamo, dias_prestamo, campo_duracion = _resolver_duracion_prestamo(
@@ -605,7 +626,7 @@ def registrar_prestamo(
             status_code=404,
         ) from error
 
-    _validar_elegibilidad(prestatario, material)
+    _validar_elegibilidad(prestatario, material, es_excepcion=es_excepcion)
     _validar_duracion_material(material, minutos_prestamo, campo_duracion)
 
     if material.estado in ("en_mantenimiento", "reservado"):
@@ -615,11 +636,12 @@ def registrar_prestamo(
             status_code=409,
         )
 
-    requiere_garantia = material.requiere_garantia()
+    requiere_garantia = es_excepcion or material.requiere_garantia()
     _validar_documentos_garantia(
         material,
         documento_identidad,
         compromiso_responsabilidad,
+        es_excepcion=es_excepcion,
     )
 
     try:
@@ -655,6 +677,7 @@ def registrar_prestamo(
         tiempo_prestamo_minutos=minutos_prestamo,
         tiempo_prestamo_dias=dias_prestamo,
         estado="activo",
+        es_excepcion=es_excepcion,
         checklist_inicial=checklist_inicial,
         instancia_id=instancia_elegida["id"],
     )
@@ -869,6 +892,10 @@ def _calcular_resultado(prestamo, checklist, fecha_devolucion):
         deduccion_dano = 0
         cobro = None
 
+    deduccion_dano_base = deduccion_dano
+    if prestamo.es_excepcion:
+        deduccion_dano *= 2
+
     puntos_delta = bonificacion - deduccion_tardanza - deduccion_dano
     reputacion_antes = usuario.reputacion_puntaje
     reputacion_despues = puntaje_reputacion_ajustado(reputacion_antes + puntos_delta)
@@ -881,6 +908,7 @@ def _calcular_resultado(prestamo, checklist, fecha_devolucion):
         "deduccion_tardanza": deduccion_tardanza,
         "dano": dano,
         "hay_dano": dano != "sin_cambios",
+        "deduccion_dano_base": deduccion_dano_base,
         "deduccion_dano": deduccion_dano,
         "cobro_economico": str(cobro) if cobro is not None else None,
         "puntos_delta": puntos_delta,
diff --git a/backend/apps/prestamos/views.py b/backend/apps/prestamos/views.py
index 29ca246..5ab4e91 100644
--- a/backend/apps/prestamos/views.py
+++ b/backend/apps/prestamos/views.py
@@ -52,6 +52,28 @@ from apps.prestamos.services import (
 )
 
 
+def _registrar_prestamo(request, *, es_excepcion=False):
+    serializer = RegistrarPrestamoSerializer(data=request.data)
+    serializer.is_valid(raise_exception=True)
+
+    try:
+        prestamo = registrar_prestamo(
+            **serializer.validated_data,
+            registrado_por=request.usuario_autenticado,
+            es_excepcion=es_excepcion,
+        )
+    except PrestamoError as error:
+        return Response(
+            {error.campo: [error.mensaje]},
+            status=error.status_code,
+        )
+
+    return Response(
+        PrestamoRegistroSerializer(prestamo).data,
+        status=status.HTTP_201_CREATED,
+    )
+
+
 class RegistrarPrestamoView(APIView):
     """Registra la entrega de un material: POST /api/prestamos/."""
 
@@ -59,24 +81,17 @@ class RegistrarPrestamoView(APIView):
     parser_classes = [MultiPartParser, FormParser, JSONParser]
 
     def post(self, request):
-        serializer = RegistrarPrestamoSerializer(data=request.data)
-        serializer.is_valid(raise_exception=True)
+        return _registrar_prestamo(request)
 
-        try:
-            prestamo = registrar_prestamo(
-                **serializer.validated_data,
-                registrado_por=request.usuario_autenticado,
-            )
-        except PrestamoError as error:
-            return Response(
-                {error.campo: [error.mensaje]},
-                status=error.status_code,
-            )
 
-        return Response(
-            PrestamoRegistroSerializer(prestamo).data,
-            status=status.HTTP_201_CREATED,
-        )
+class RegistrarPrestamoExcepcionalView(APIView):
+    """Registra una excepción académica directa: POST /api/prestamos/excepcion/."""
+
+    permission_classes = [EsGestorDeAlmacen]
+    parser_classes = [MultiPartParser, FormParser, JSONParser]
+
+    def post(self, request):
+        return _registrar_prestamo(request, es_excepcion=True)
 
 
 class BuscarPrestatariosView(APIView):
diff --git a/frontend/src/pages/RegistrarPrestamo.jsx b/frontend/src/pages/RegistrarPrestamo.jsx
index 40e5e35..cf0bcb8 100644
--- a/frontend/src/pages/RegistrarPrestamo.jsx
+++ b/frontend/src/pages/RegistrarPrestamo.jsx
@@ -42,6 +42,7 @@ const FORMULARIO_INICIAL = {
   checklist: [{ elemento: '', observacion: '', foto: null, fotoPrevia: '' }],
   documentoIdentidad: null,
   compromisoResponsabilidad: null,
+  esExcepcion: false,
 }
 
 const NIVEL_TIER = { restringido: 0, estandar: 1, avanzado: 2 }
@@ -197,11 +198,22 @@ function RegistrarPrestamo() {
     && NIVEL_TIER[perfilVerificadoActual.reputacion_tier] >= NIVEL_TIER[materialSeleccionado.tier_minimo_requerido],
   )
   const perfilHabilitado = perfilVerificadoActual?.rol === 'prestatario' && perfilVerificadoActual?.estado === 'activo'
+  const puedeSolicitarExcepcion = Boolean(
+    perfilHabilitado && materialSeleccionado && !tierCumple
+    && perfilVerificadoActual?.reputacion_tier === 'restringido',
+  )
+  const excepcionActiva = Boolean(puedeSolicitarExcepcion && formulario.esExcepcion)
+  const requiereGarantia = Boolean(
+    excepcionActiva || esMaterialAltoValor(materialSeleccionado),
+  )
   const verificacionPendiente = /^\d{8}$/.test(formulario.dni.trim())
     && (consultandoPerfil || !perfilVerificadoActual && !errorPerfil)
   const bloqueadoPorElegibilidad = Boolean(
     materialSeleccionado && /^\d{8}$/.test(formulario.dni.trim())
-    && (verificacionPendiente || errorPerfil || !perfilVerificadoActual || !perfilHabilitado || !tierCumple),
+    && (
+      verificacionPendiente || errorPerfil || !perfilVerificadoActual || !perfilHabilitado
+      || (!tierCumple && !excepcionActiva)
+    ),
   )
 
   function actualizar(campo, valor) {
@@ -221,6 +233,7 @@ function RegistrarPrestamo() {
             instanciaId: '',
             documentoIdentidad: null,
             compromisoResponsabilidad: null,
+            esExcepcion: false,
           }
         : {}),
     }))
@@ -340,6 +353,7 @@ function RegistrarPrestamo() {
       checklist: formulario.checklist,
       documentoIdentidad: formulario.documentoIdentidad,
       compromisoResponsabilidad: formulario.compromisoResponsabilidad,
+      esExcepcion: excepcionActiva,
     }
     const validacion = validarFormularioPrestamo(datosValidacion)
     setErrores(validacion)
@@ -363,13 +377,17 @@ function RegistrarPrestamo() {
         checklist: formulario.checklist,
         documentoIdentidad: formulario.documentoIdentidad,
         compromisoResponsabilidad: formulario.compromisoResponsabilidad,
+        esExcepcion: excepcionActiva,
       })
       const errorTamano = validarTamanoSolicitud(solicitud)
       if (errorTamano) {
         setError(errorTamano)
         return
       }
-      const respuesta = await api.post('/prestamos/', solicitud)
+      const respuesta = await api.post(
+        excepcionActiva ? '/prestamos/excepcion/' : '/prestamos/',
+        solicitud,
+      )

```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 3.1s)

_Thinking:_

Diff okay. Need maybe format line length? Existing JSX long line already. Fine.

Need consider missing `es_excepcion` in `PrestamoDevolucionDetalle`? We added via replaceAll to all state fields. Let's check.

**Tool: bash**

**Input:**
```json
{
  "command": "grep -n -A3 '\"tiempo_prestamo_dias\",' backend/apps/prestamos/consultar_serializers.py backend/apps/prestamos/serializers.py",
  "workdir": "/home/shiarowo/PERSONAL/Presticad"
}
```

**Output:**
```
backend/apps/prestamos/consultar_serializers.py:71:            "tiempo_prestamo_dias",
backend/apps/prestamos/consultar_serializers.py-72-            "estado",
backend/apps/prestamos/consultar_serializers.py-73-            "es_excepcion",
backend/apps/prestamos/consultar_serializers.py-74-        )
--
backend/apps/prestamos/consultar_serializers.py:104:            "tiempo_prestamo_dias",
backend/apps/prestamos/consultar_serializers.py-105-            "estado",
backend/apps/prestamos/consultar_serializers.py-106-            "es_excepcion",
backend/apps/prestamos/consultar_serializers.py-107-        )
--
backend/apps/prestamos/consultar_serializers.py:192:            "tiempo_prestamo_dias",
backend/apps/prestamos/consultar_serializers.py-193-            "estado",
backend/apps/prestamos/consultar_serializers.py-194-            "es_excepcion",
backend/apps/prestamos/consultar_serializers.py-195-            "checklist_inicial",
--
backend/apps/prestamos/consultar_serializers.py:264:            "tiempo_prestamo_dias",
backend/apps/prestamos/consultar_serializers.py-265-            "estado",
backend/apps/prestamos/consultar_serializers.py-266-            "es_excepcion",
backend/apps/prestamos/consultar_serializers.py-267-            "prestatario_nombre",
--
backend/apps/prestamos/serializers.py:260:            "tiempo_prestamo_dias",
backend/apps/prestamos/serializers.py-261-            "estado",
backend/apps/prestamos/serializers.py-262-            "es_excepcion",
backend/apps/prestamos/serializers.py-263-            "checklist_inicial",

```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 4.2s)

_Thinking:_

Wait there are 4 occurrences in consultar (line 71,104,192,264) not 5. Good.

Need maybe `PrestamoHistorialDetalle` docs section says no guarantee if not high value. For exception it should show guarantee docs, but current condition:
```
{!esMaterialAltoValor(material) ? <p>No requiere docs</p> : <ul>...}
```
For exception material not high value, it will wrongly say no docs required, even if guarantee exists. Need fix! In DetallePrestamo, use exception flag/requires guarantee. Derive:
```
const tieneGarantia = esExcepcion || esMaterialAltoValor(material)
...
{!tieneGarantia ? ... : ...}
```
Also if borrowed exception and guarantee docs, display. Do. Need maybe detail serializer doesn't include `requiere_garantia`; could use es_excepcion or material. Fine.

Edit.

**Tool: edit**

**Input:**
```json
{
  "filePath": "/home/shiarowo/PERSONAL/Presticad/frontend/src/components/prestamos/DetallePrestamo.jsx",
  "oldString": "            {!esMaterialAltoValor(material) ? (\n              <p className=\"mt-2 text-sm text-texto-suave\">Este material no requiere documentos de garantía.</p>\n            ) : (",
  "newString": "            {!esExcepcion && !esMaterialAltoValor(material) ? (\n              <p className=\"mt-2 text-sm text-texto-suave\">Este material no requiere documentos de garantía.</p>\n            ) : ("
}
```

**Output:**
```
Edit applied successfully.
```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 3.2s)

_Thinking:_

Need maybe `puedeEditarGarantia` logic for exception? In historial, manager can edit docs? The parent likely computes from material? Need inspect caller `HistorialPrestamos.jsx`.

**Tool: bash**

**Input:**
```json
{
  "command": "grep -RIn 'puedeEditarGarantia' frontend/src --exclude='DetallePrestamo.jsx' --exclude='ListaHistorialPrestamos.jsx' && grep -RIn 'esMaterialAltoValor' frontend/src/pages frontend/src/components/prestamos | head -30",
  "workdir": "/home/shiarowo/PERSONAL/Presticad"
}
```

**Output:**
```
frontend/src/prestamos/HistorialPrestamos.jsx:200:          puedeEditarGarantia={usuario?.rol === 'gestor'}
frontend/src/pages/RegistrarPrestamo.jsx:23:import { esMaterialAltoValor } from '../constantes/catalogo'
frontend/src/pages/RegistrarPrestamo.jsx:207:    excepcionActiva || esMaterialAltoValor(materialSeleccionado),
frontend/src/components/prestamos/DetallePrestamo.jsx:5:import { ETIQUETAS_ESTADO, esMaterialAltoValor } from '../../constantes/catalogo'
frontend/src/components/prestamos/DetallePrestamo.jsx:256:                {esMaterialAltoValor(material) ? 'Sí' : 'No'}
frontend/src/components/prestamos/DetallePrestamo.jsx:342:            {!esExcepcion && !esMaterialAltoValor(material) ? (

```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 4.3s)

_Thinking:_

Good.

Need maybe "Alto valor" field for exception says No but still docs, okay because separate type.

Need backend plan said `_sincronizar_estado_material...` no branch1.

Need maybe expose exception in report list? Not required.

Need maybe update `DevolucionResultadoSerializer` frontend to show base? Not required but maybe if user sees doubled deduction without explanation. Could add UI note. We can add in `DevolucionPrestamo` if `estimacion.deduccion_dano_base !== undefined && estimacion.deduccion_dano !== base` show "Excepción académica: deducción por daño duplicada (base X)". But does devolution page know `es_excepcion` from detail? `PrestamoDevolucionDetalle` includes. Need inspect page state and result UI. Might be worthwhile but branch1 scope. Plan said badge and double damage. It might be enough backend. But UX should explain. Add field to result serializer already. In `DevolucionPrestamo`, `detalle` maybe. Need inspect around result.

**Tool: bash**

**Input:**
```json
{
  "command": "sed -n '1,120p' frontend/src/pages/DevolucionPrestamo.jsx && sed -n '145,300p' frontend/src/pages/DevolucionPrestamo.jsx",
  "workdir": "/home/shiarowo/PERSONAL/Presticad"
}
```

**Output:**
```
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Download } from 'lucide-react'

import { api, ErrorApi } from '../api/client'
import useTituloPagina from '../hooks/useTituloPagina'
import {
  ESTADOS_CHECKLIST_DEVOLUCION,
  ETIQUETAS_DANO,
  ETIQUETAS_ESTADO_DEVOLUCION,
  esDevoluble,
} from '../constantes/devolucion'
import {
  armarChecklistDevolucion,
  construirFormularioDevolucion,
  obtenerElementosSinFotoDevolucion,
  serializarChecklistDevolucion,
  validarChecklistDevolucion,
} from '../validacionesDevolucion'
import { validarTamanoSolicitud } from '../prestamos/tamanoSolicitud'
import { ETIQUETAS_TIER } from '../constantes/roles'
import Campo from '../components/ui/Campo'
import Boton from '../components/ui/Boton'
import Tarjeta from '../components/ui/Tarjeta'
import Skeleton from '../components/ui/Skeleton'
import ErrorAlerta from '../components/ui/ErrorAlerta'
import EstadoVacio from '../components/ui/EstadoVacio'
import BadgeEstado from '../components/ui/BadgeEstado'
import AdvertenciaModal from '../components/ui/AdvertenciaModal'

const OPCIONES_ESTADO = ESTADOS_CHECKLIST_DEVOLUCION.map((valor) => ({
  valor,
  etiqueta: ETIQUETAS_ESTADO_DEVOLUCION[valor],
}))

const DEMORA_ESTIMACION_MS = 400

function mensajeApi(error) {
  const datos = error instanceof ErrorApi ? error.datos : null
  if (datos?.detail) return datos.detail
  if (datos && typeof datos === 'object') {
    const primerError = Object.values(datos).flat()[0]
    if (primerError) return String(primerError)
  }
  return 'No se pudo completar la operación. Revisa la conexión e inténtalo otra vez.'
}

function mensajeFotoApi(error) {
  const errores = error instanceof ErrorApi ? error.datos?.fotos_checklist : null
  const mensajes = Array.isArray(errores)
    ? errores.flat(Infinity)
    : errores && typeof errores === 'object'
      ? Object.values(errores).flat(Infinity)
      : []
  return mensajes.find((mensaje) => typeof mensaje === 'string') ?? ''
}

function fechaLegible(valor) {
  if (!valor) return '—'
  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(valor))
}

function moneda(valor) {
  if (valor === null || valor === undefined || valor === '') return null
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
  }).format(Number(valor))
}

function firmarPuntos(delta) {
  if (delta > 0) return `+${delta} puntos`
  if (delta < 0) return `${delta} puntos`
  return '0 puntos'
}

function etiquetaTier(tier) {
  return ETIQUETAS_TIER[tier] ?? tier
}

function CampoResumen({ etiqueta, children }) {
  return (
    <div className="rounded-xl border border-borde bg-superficie p-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-texto-suave">
        {etiqueta}
      </dt>
      <dd className="mt-1 break-words text-sm font-medium text-texto">{children}</dd>
    </div>
  )
}

function ResumenSanciones({ estimacion }) {
  if (!estimacion) return null

  const cobro = moneda(estimacion.cobro_economico)
  const tono = estimacion.puntos_delta >= 0 ? 'exito' : 'advertencia'

  return (
    <div
      className="grid gap-3 rounded-xl border border-borde bg-superficie p-4 sm:grid-cols-2 lg:grid-cols-3"
      aria-live="polite"
    >
      <CampoResumen etiqueta="Entrega">
        {estimacion.a_tiempo
          ? 'A tiempo (sin tardanza)'
          : estimacion.en_tiempo_gracia || estimacion.dias_tardanza === 0
            ? 'En tiempo de gracia (30 min, sin sanción)'
            : `Tardía por ${estimacion.dias_tardanza} día(s)`}
      </CampoResumen>
      <CampoResumen etiqueta="Sanción por tiempo">
        {estimacion.a_tiempo
          ? `Bonificación +${estimacion.bonificacion} puntos`
          : estimacion.en_tiempo_gracia || estimacion.dias_tardanza === 0
            ? '0 puntos (tiempo de gracia de 30 min)'
            : `Deducción −${estimacion.deduccion_tardanza} puntos`}
      </CampoResumen>
      <CampoResumen etiqueta="Daño detectado">
  const navigate = useNavigate()

  const [detalle, setDetalle] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')
  const [filas, setFilas] = useState([])
  const [errores, setErrores] = useState({})
  const [estimacion, setEstimacion] = useState(null)
  const [estimando, setEstimando] = useState(false)
  const [errorEstimacion, setErrorEstimacion] = useState('')
  const [intentoEstimacion, setIntentoEstimacion] = useState(0)
  const [etapa, setEtapa] = useState('edicion')
  const [guardando, setGuardando] = useState(false)
  const [errorEnvio, setErrorEnvio] = useState('')
  const [resultado, setResultado] = useState(null)
  const [elementosSinFoto, setElementosSinFoto] = useState(null)
  const formularioRef = useRef(null)
  const referenciasFotos = useRef([])
  const urlsTemporales = useRef(new Set())

  const prestamoId = useMemo(() => Number(parametroId), [parametroId])
  const idValido = Number.isInteger(prestamoId) && prestamoId > 0

  useEffect(() => () => {
    urlsTemporales.current.forEach((url) => URL.revokeObjectURL(url))
    urlsTemporales.current.clear()
  }, [])

  useEffect(() => {
    if (!idValido) {
      setCargando(false)
      setErrorCarga('No existe el préstamo indicado.')
      return undefined
    }

    let vigente = true
    setCargando(true)
    setErrorCarga('')
    api
      .get(`/prestamos/${prestamoId}/`)
      .then((datos) => {
        if (!vigente) return
        setDetalle(datos)
        setFilas(armarChecklistDevolucion(datos.checklist_inicial))
      })
      .catch((errorApi) => {
        if (vigente) setErrorCarga(mensajeApi(errorApi))
      })
      .finally(() => {
        if (vigente) setCargando(false)
      })

    return () => {
      vigente = false
    }
  }, [prestamoId, idValido])

  const checklistValido = validarChecklistDevolucion(filas).checklist === undefined
  const devoluble = detalle ? esDevoluble(detalle.estado) : false

  useEffect(() => {
    if (!detalle || !devoluble || etapa === 'exito' || !checklistValido) {
      setEstimacion(null)
      setEstimando(false)
      return undefined
    }

    let vigente = true
    setEstimando(true)
    setErrorEstimacion('')
    const temporizador = setTimeout(() => {
      api
        .post(`/prestamos/${prestamoId}/devolucion/estimar/`, {
          checklist: serializarChecklistDevolucion(filas),
        })
        .then((respuesta) => {
          if (vigente) setEstimacion(respuesta)
        })
        .catch((errorApi) => {
          if (vigente) {
            setEstimacion(null)
            setErrorEstimacion(mensajeApi(errorApi))
          }
        })
        .finally(() => {
          if (vigente) setEstimando(false)
        })
    }, DEMORA_ESTIMACION_MS)

    return () => {
      vigente = false
      clearTimeout(temporizador)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filas, detalle, devoluble, etapa, checklistValido, intentoEstimacion])

  function actualizarFila(indice, campo, valor) {
    setFilas((actual) =>
      actual.map((fila, posicion) =>
        posicion === indice ? { ...fila, [campo]: valor } : fila,
      ),
    )
    setErrores((actual) => {
      const erroresFila = { ...actual.filas?.[indice] }
      const campos = campo === 'estado' ? ['estado', 'foto', 'observacion'] : [campo]
      campos.forEach((nombre) => delete erroresFila[nombre])
      return {
        ...actual,
        checklist: undefined,
        filas: { ...actual.filas, [indice]: erroresFila },
      }
    })
    setErrorEnvio('')
  }

  function cambiarFoto(indice, archivo) {
    const fila = filas[indice]
    if (fila?.fotoPrevia) {
      URL.revokeObjectURL(fila.fotoPrevia)
      urlsTemporales.current.delete(fila.fotoPrevia)
    }
    const fotoPrevia = archivo ? URL.createObjectURL(archivo) : ''
    if (fotoPrevia) urlsTemporales.current.add(fotoPrevia)
    if (referenciasFotos.current[indice]) referenciasFotos.current[indice].value = ''
    setFilas((actual) => actual.map((elemento, posicion) => (
      posicion === indice ? { ...elemento, foto: archivo, fotoPrevia } : elemento
    )))
    setErrores((actual) => {
      const erroresFila = { ...actual.filas?.[indice] }
      delete erroresFila.foto
      return { ...actual, filas: { ...actual.filas, [indice]: erroresFila } }
    })
    setErrorEnvio('')
  }

  function enfocarPrimerError(indicePreferido = null) {
    window.requestAnimationFrame(() => {
      const control = indicePreferido === null
        ? formularioRef.current?.querySelector('[aria-invalid="true"]')
        : referenciasFotos.current[indicePreferido]
      if (!control) return
      control.scrollIntoView({ behavior: 'smooth', block: 'center' })
      control.focus({ preventScroll: true })
    })
  }

  function cerrarAdvertenciaFotos() {
    const primerIndice = elementosSinFoto?.[0]?.indice ?? null
    setElementosSinFoto(null)
    if (primerIndice !== null) enfocarPrimerError(primerIndice)
  }

  function irAlResumen(evento) {
    evento.preventDefault()
    const validacion = validarChecklistDevolucion(filas)
    setErrores(validacion)

```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 3.3s)

_Thinking:_

Need see render of detalle/badge.

**Tool: bash**

**Input:**
```json
{
  "command": "grep -n 'detalle\\.\\|BadgeEstado\\|ResumenSanciones' frontend/src/pages/DevolucionPrestamo.jsx | head -60 && sed -n '360,470p' frontend/src/pages/DevolucionPrestamo.jsx",
  "workdir": "/home/shiarowo/PERSONAL/Presticad"
}
```

**Output:**
```
28:import BadgeEstado from '../components/ui/BadgeEstado'
95:function ResumenSanciones({ estimacion }) {
203:  const devoluble = detalle ? esDevoluble(detalle.estado) : false
393:          mensaje={`El préstamo del material ${detalle.material_nombre} está en estado "${detalle.estado}" y ya no puede recibir una devolución.`}
412:            Préstamo #{detalle.id} · {detalle.material_nombre} · Código de Material: {detalle.material_codigo}
413:            {detalle.codigo_ejemplar && <> · Código de Ejemplar: {detalle.codigo_ejemplar}</>}
425:            Reputación de {detalle.prestatario_nombre}:{' '}
437:        <ResumenSanciones estimacion={resultado} />
470:            <CampoResumen etiqueta="Material">{detalle.material_nombre}</CampoResumen>
471:            <CampoResumen etiqueta="Código de Material">{detalle.material_codigo}</CampoResumen>
472:            <CampoResumen etiqueta="Código de Ejemplar">{detalle.codigo_ejemplar || '—'}</CampoResumen>
474:              {detalle.prestatario_nombre} · DNI {detalle.prestatario_dni}
477:              <BadgeEstado estado={detalle.estado} />
480:              {fechaLegible(detalle.fecha_entrega)}
483:              {fechaLegible(detalle.fecha_limite)}
485:            <CampoResumen etiqueta="Duración">{detalle.tiempo_prestamo_dias} días</CampoResumen>
583:            <ResumenSanciones estimacion={estimacion} />
639:          <CampoResumen etiqueta="Material">{detalle.material_nombre}</CampoResumen>
640:          <CampoResumen etiqueta="Código de Material">{detalle.material_codigo}</CampoResumen>
641:          <CampoResumen etiqueta="Código de Ejemplar">{detalle.codigo_ejemplar || '—'}</CampoResumen>
642:          <CampoResumen etiqueta="Prestatario">{detalle.prestatario_nombre}</CampoResumen>
644:            <BadgeEstado estado={detalle.estado} />
646:          <CampoResumen etiqueta="Fecha de entrega">{fechaLegible(detalle.fecha_entrega)}</CampoResumen>
647:          <CampoResumen etiqueta="Fecha límite">{fechaLegible(detalle.fecha_limite)}</CampoResumen>
648:          <CampoResumen etiqueta="Duración">{detalle.tiempo_prestamo_dias} días</CampoResumen>
779:            <ResumenSanciones estimacion={estimacion} />
    window.open(resultado.reporte_url, '_blank', 'noopener,noreferrer')
  }

  if (cargando) {
    return (
      <section aria-label="Registrar devolución">
        <div className="space-y-3" role="status" aria-live="polite">
          <p className="text-sm text-texto-suave">Cargando datos del préstamo…</p>
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </section>
    )
  }

  if (errorCarga || !detalle) {
    return (
      <section aria-label="Registrar devolución" className="grid gap-4">
        <ErrorAlerta mensaje={errorCarga || 'No existe el préstamo indicado.'} />
        <div>
          <Boton variante="secundario" onClick={() => navigate('/panel/historial')}>
            Volver al historial
          </Boton>
        </div>
      </section>
    )
  }

  if (!devoluble) {
    return (
      <section aria-label="Registrar devolución" className="grid gap-4">
        <EstadoVacio
          titulo="Este préstamo no admite devolución"
          mensaje={`El préstamo del material ${detalle.material_nombre} está en estado "${detalle.estado}" y ya no puede recibir una devolución.`}
        />
        <div>
          <Boton variante="secundario" onClick={() => navigate('/panel/historial')}>
            Volver al historial
          </Boton>
        </div>
      </section>
    )
  }

  if (etapa === 'exito' && resultado) {
    return (
      <section aria-labelledby="titulo-devolucion-exito">
        <header className="mb-5">
          <h2 id="titulo-devolucion-exito" className="text-xl font-bold text-texto">
            Devolución registrada
          </h2>
          <p className="mt-1 text-sm text-texto-suave">
            Préstamo #{detalle.id} · {detalle.material_nombre} · Código de Material: {detalle.material_codigo}
            {detalle.codigo_ejemplar && <> · Código de Ejemplar: {detalle.codigo_ejemplar}</>}
          </p>
        </header>

        <div
          className="mb-4 rounded-xl border border-marca-200 bg-marca-50 p-4 text-sm text-marca-800 dark:border-marca-700/60 dark:bg-marca-500/15 dark:text-marca-300"
          role="status"
        >
          <p className="font-semibold">
            La devolución quedó registrada con {firmarPuntos(resultado.puntos_delta)}.
          </p>
          <p className="mt-1">
            Reputación de {detalle.prestatario_nombre}:{' '}
            <strong>
              {resultado.reputacion_antes} ({etiquetaTier(resultado.tier_antes)}) →{' '}
              {resultado.reputacion_despues} ({etiquetaTier(resultado.tier_despues)})
            </strong>
          </p>
          <p className="mt-1">
            Cobro económico:{' '}
            <strong>{moneda(resultado.cobro_economico) ?? 'sin cobro'}</strong>
          </p>
        </div>

        <ResumenSanciones estimacion={resultado} />

        <div className="mt-5 flex flex-wrap gap-2">
          {resultado.hay_dano && resultado.reporte_url && (
            <Boton icono={Download} onClick={descargarReporte}>
              Descargar reporte de daños (PDF)
            </Boton>
          )}
          <Boton variante="secundario" onClick={() => navigate('/panel/historial')}>
            Volver al historial
          </Boton>
        </div>
      </section>
    )
  }

  if (etapa === 'resumen') {
    return (
      <section aria-labelledby="titulo-resumen-devolucion">
        <header className="mb-5">
          <h2 id="titulo-resumen-devolucion" className="text-xl font-bold text-texto">
            Resumen antes de confirmar
          </h2>
          <p className="mt-1 text-sm text-texto-suave">
            Revisa el estado final del material y las sanciones calculadas. La confirmación
            registra la devolución de forma permanente.
          </p>
        </header>

        {errorEnvio && <ErrorAlerta mensaje={errorEnvio} className="mb-4" />}

        <Tarjeta className="p-6">
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <CampoResumen etiqueta="Material">{detalle.material_nombre}</CampoResumen>

```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 12.2s)

_Thinking:_

Devolucion detail serializer now includes es_excepcion, so can update badge and show info. Not necessary but nice. Maybe add to `ResumenSanciones` explanation if base differs. Since user's plan expected transparency. Let's do small change:
```
const danoDuplicado = estimacion.deduccion_dano_base !== undefined && estimacion.deduccion_dano !== estimacion.deduccion_dano_base
...
<CampoResumen etiqueta="Daño detectado">
...
{danoDuplicado && <span className="mt-1 block text-xs ...">Excepción académica: deducción duplicada desde {base} puntos.</span>}
```
But CampoResumen `dd` can contain. Fine.
And badge text with `textoEstadoPrestamo` for `detalle`. Not critical. Could avoid extra changes. But leave as is maybe.

Need consider direct exception route test and frontend. Done.

Need maybe `api client` error with field `es_excepcion` not mapped; general error okay.

Need maybe add direct exception button visible only restricted. Good.

Need maybe update the plan doc? Not required.

Need maybe run frontend tests after JSX detail change (no test coverage). Build already before this change; rerun build quickly maybe. Also full backend already after test updates. But we changed only frontend detail after build. Run frontend test + build in parallel.

**Tool: bash**

**Input:**
```json
{
  "command": "docker compose exec -T frontend npm test",
  "workdir": "/home/shiarowo/PERSONAL/Presticad",
  "timeout": 240000
}
```

**Output:**
```

> presticad-frontend@0.1.0 test
> vitest run


[1m[30m[46m RUN [49m[39m[22m [36mv5.1.0 [39m[90m/app[39m

 [32m✓[39m src/validacionesPrestamo.test.js [2m([22m[2m14 tests[22m[2m)[22m[32m 28[2mms[22m[39m
 [32m✓[39m src/catalogo/fichaTecnica.test.js [2m([22m[2m7 tests[22m[2m)[22m[32m 38[2mms[22m[39m
 [32m✓[39m src/prestamos/estadoPrestamo.test.js [2m([22m[2m10 tests[22m[2m)[22m[32m 31[2mms[22m[39m
 [32m✓[39m src/prestamos/navegacionPrestamos.test.js [2m([22m[2m5 tests[22m[2m)[22m[32m 15[2mms[22m[39m
 [32m✓[39m src/prestamos/solicitudPrestamo.test.js [2m([22m[2m4 tests[22m[2m)[22m[32m 50[2mms[22m[39m
 [32m✓[39m src/prestamos/tamanoSolicitud.test.js [2m([22m[2m3 tests[22m[2m)[22m[32m 54[2mms[22m[39m
 [32m✓[39m src/validacionesTelefono.test.js [2m([22m[2m12 tests[22m[2m)[22m[32m 38[2mms[22m[39m
 [32m✓[39m src/inventario/registroMaterial.test.js [2m([22m[2m10 tests[22m[2m)[22m[32m 83[2mms[22m[39m
 [32m✓[39m src/validacionesDevolucion.test.js [2m([22m[2m6 tests[22m[2m)[22m[32m 17[2mms[22m[39m
 [32m✓[39m src/prestamos/prestatarios.test.js [2m([22m[2m8 tests[22m[2m)[22m[32m 18[2mms[22m[39m
 [32m✓[39m src/api/client.test.js [2m([22m[2m21 tests[22m[2m)[22m[32m 69[2mms[22m[39m
 [32m✓[39m src/prestamos/historialPrestamos.test.js [2m([22m[2m12 tests[22m[2m)[22m[32m 25[2mms[22m[39m
 [32m✓[39m src/inventario/agregarEjemplares.test.js [2m([22m[2m8 tests[22m[2m)[22m[32m 85[2mms[22m[39m
 [32m✓[39m src/prestamos/MisPrestamos.test.js [2m([22m[2m4 tests[22m[2m)[22m[32m 9[2mms[22m[39m
 [32m✓[39m src/inventario/eliminacionMaterial.test.js [2m([22m[2m3 tests[22m[2m)[22m[32m 6[2mms[22m[39m
 [32m✓[39m src/prestamos/reportesDevolucion.test.js [2m([22m[2m6 tests[22m[2m)[22m[32m 15[2mms[22m[39m
 [32m✓[39m src/prestamos/filtroPrestamos.test.js [2m([22m[2m7 tests[22m[2m)[22m[32m 16[2mms[22m[39m
 [32m✓[39m src/prestamos/instanciasPrestamo.test.js [2m([22m[2m5 tests[22m[2m)[22m[32m 9[2mms[22m[39m
 [32m✓[39m src/components/MaterialForm.test.jsx [2m([22m[2m4 tests[22m[2m)[22m[32m 7[2mms[22m[39m

[2m Test Files [22m [1m[32m19 passed[39m[22m[90m (19)[39m
[2m      Tests [22m [1m[32m149 passed[39m[22m[90m (149)[39m
[2m   Start at [22m 01:10:23
[2m   Duration [22m 1.04s[2m (import 42%, transform 26%, tests 24%, worker 8%)[22m


```

**Tool: bash**

**Input:**
```json
{
  "command": "docker compose exec -T frontend npm run build",
  "workdir": "/home/shiarowo/PERSONAL/Presticad",
  "timeout": 300000
}
```

**Output:**
```

> presticad-frontend@0.1.0 build
> vite build

vite v6.4.5 building for production...
transforming...
✓ 2256 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                              1.20 kB │ gzip:   0.62 kB
dist/assets/inter-vietnamese-wght-normal-CBcvBZtf.woff2     10.25 kB
dist/assets/inter-greek-ext-wght-normal-DlzME5K_.woff2      11.23 kB
dist/assets/inter-cyrillic-wght-normal-DqGufNeO.woff2       18.75 kB
dist/assets/inter-greek-wght-normal-CkhJZR-_.woff2          19.00 kB
dist/assets/inter-cyrillic-ext-wght-normal-BOeWTOD4.woff2   25.96 kB
dist/assets/flags-a2kmUSbF.webp                             28.19 kB
dist/assets/inter-latin-wght-normal-Dx4kXJAl.woff2          48.26 kB
dist/assets/flags@2x-gR6KPp3x.webp                          66.45 kB
dist/assets/inter-latin-ext-wght-normal-DO1Apj_S.woff2      85.07 kB
dist/assets/index-CE2tNu1H.css                              65.74 kB │ gzip:  14.43 kB
dist/assets/utils-3P6Si2Fo.js                              264.34 kB │ gzip:  58.47 kB
dist/assets/index-C4VKIe6Z.js                              580.21 kB │ gzip: 164.21 kB
✓ built in 6.88s

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.

```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 7.1s)

_Thinking:_

Need maybe update todo to completed. But before final, should we commit? User didn't explicitly ask. No. Need maybe check `git status` and maybe summary. But could maybe mark all todos complete. Need maybe inspect diff for accidental `backend/apps/inventario/tests.py` change. We changed unrelated test. Should note. Do we keep? It's stale expectation. Since full suite now passes. Fine.

Need maybe check current branch and no migration applied? We only generated migration, did not migrate dev database. For tests, test DB applied. Dev DB not migrated, but code may run server with missing column. Should we run migrate? For local dev maybe yes, but user didn't ask. Usually after migration generation we can run migrate to keep local environment working. But changing dev database is side effect, but expected. The plan likely includes migrate. Should we run `docker compose exec backend python manage.py migrate`? It will apply to dev DB. This is a local dev environment. However no need if not running. But the UI might crash until migration. Better run. But is that "make changes to user's system"? It's okay, migration intended. Yet instructions only commit when asked; migrations are normal. Do it? We can mention if not. The test run created test db only. The live backend still lacks column, so if user opens app, it may error. Run migrate.

**Tool: bash**

**Input:**
```json
{
  "command": "docker compose exec -T backend python manage.py migrate",
  "workdir": "/home/shiarowo/PERSONAL/Presticad",
  "timeout": 120000
}
```

**Output:**
```
Operations to perform:
  Apply all migrations: admin, auth, contenttypes, inventario, prestamos, sessions, usuarios
Running migrations:
  Applying prestamos.0008_prestamo_es_excepcion... OK

```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 2.8s)

_Thinking:_

Need update todo completed.

**Tool: todowrite**

**Input:**
```json
{
  "todos": [
    {
      "content": "Crear rama feature/prestamo-excepcional",
      "status": "completed",
      "priority": "high"
    },
    {
      "content": "Agregar Prestamo.es_excepcion y migración",
      "status": "completed",
      "priority": "high"
    },
    {
      "content": "Implementar servicios de excepción directa y doble daño",
      "status": "completed",
      "priority": "high"
    },
    {
      "content": "Agregar endpoint, serializers y frontend de excepción",
      "status": "completed",
      "priority": "high"
    },
    {
      "content": "Escribir y ejecutar pruebas backend/frontend",
      "status": "completed",
      "priority": "high"
    }
  ]
}
```

**Output:**
```
[
  {
    "content": "Crear rama feature/prestamo-excepcional",
    "status": "completed",
    "priority": "high"
  },
  {
    "content": "Agregar Prestamo.es_excepcion y migración",
    "status": "completed",
    "priority": "high"
  },
  {
    "content": "Implementar servicios de excepción directa y doble daño",
    "status": "completed",
    "priority": "high"
  },
  {
    "content": "Agregar endpoint, serializers y frontend de excepción",
    "status": "completed",
    "priority": "high"
  },
  {
    "content": "Escribir y ejecutar pruebas backend/frontend",
    "status": "completed",
    "priority": "high"
  }
]
```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 4.1s)

_Thinking:_

Need final concise, mention implemented and tests. But instructions final should be short. Yet maybe user expects progress. We can include key files. Mention 351 backend, 149 frontend, build passed. Mention not committed. Mention one unrelated test updated default 15. Maybe no need.

Need maybe mention branch. Concise 4 lines. No emojis. Could say:

"Rama `feature/prestamo-excepcional` implementada: `Prestamo.es_excepcion`, migración `0008`, endpoint `POST /api/prestamos/excepcion/`, garantía obligatoria, doble deducción por daño, badges/frontend y tests. Migración aplicada a la DB local.

Verificación: 351 tests backend OK (2 skip), 149 frontend OK, `npm run build` OK. También ajusté una aserción obsoleta de bonificación (5→15) en inventario para dejar la suite verde. No hice commit."

Need perhaps mention no commit. Good. But "No hice commit" perhaps user may want. Fine.

Need ensure under 4 lines? It's 3 paragraphs maybe 4 lines. Accept.

Implementada la rama `feature/prestamo-excepcional`: `Prestamo.es_excepcion`, migración `0008`, endpoint `POST /api/prestamos/excepcion/`, garantía obligatoria, doble deducción por daño, badges y flujo frontend. Migración aplicada a la base local.

Verificación: 351 tests backend OK (2 omitidos), 149 tests frontend OK y `npm run build` OK. También corregí una aserción obsoleta de bonificación en inventario (`5 → 15`) para dejar la suite completa en verde.

No se hizo commit.

---

## User

ya, pero busca la consistencia para que se note en todo momento que ese préstamo fue por excepción académica. Por ejemplo, en los reportes generados no se especifica que fue una excepción académica. EN el historial de préstamos así como hay una etiqueta de "Devuelto" y "Activo". También deberían existir una etiquetas de pŕestamo por "Excepción académica}"

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 7.4s)

_Thinking:_

We need implement consistency across all views/reports. Need inspect where badges, reports. User asks: "ya, pero busca la consistencia para que se note en todo momento que ese préstamo fue por excepción académica. Por ejemplo, en los reportes generados no se especifica que fue una excepción académica. EN el historial de préstamos así como hay una etiqueta de "Devuelto" y "Activo". También deberían existir una etiquetas de pŕestamo por 'Excepción académica'"

Need understand code. Need ensure reports include exception label. History badges: currently badge text "Activo - Excepción" only if active. User wants tag "Excepción académica" (probably separate badge) in history like state badges, regardless maybe also detail. Better add separate badge alongside state in history lists and detail. The status badge remains "Activo"/"Devuelto"; separate orange/purple badge "Excepción académica". Need consistency in:
- Reports generated PDFs (damage report likely `generar_reporte_dano`, maybe other reports? Search report generation).
- Historial list and detail, MisPrestamos, maybe Devolucion pages.
- APIs serializers already include es_excepcion in all? Need verify.
- Report list UI (ReportsDevolucion) maybe includes exception if report data? User says "reportes generados" likely PDF of damage. Could also include report query. Need inspect `reportes.py`, `generar_reporte_dano`, report PDF. Also maybe report download UI. Need include condition in PDF header. Maybe `Devolucion` report stores result only; can access prestamo.es_excepcion via relation. Need add row "Tipo de préstamo: Excepción académica".
- Maybe any generated "reporte" in other modules? Search `generar_reporte`.

**Tool: bash**

**Input:**
```json
{
  "command": "grep -RIn 'generar_reporte\\|reporte' backend/apps/prestamos/reportes.py backend/apps/prestamos/services.py backend/apps/prestamos/views.py | head -120",
  "workdir": "/home/shiarowo/PERSONAL/Presticad"
}
```

**Output:**
```
backend/apps/prestamos/reportes.py:1:"""Generación del reporte PDF de daños en la devolución (RN10, HU11).
backend/apps/prestamos/reportes.py:112:def generar_reporte_dano(devolucion):
backend/apps/prestamos/reportes.py:113:    """Construye el PDF del reporte de daños y devuelve sus bytes."""
backend/apps/prestamos/reportes.py:318:            "devolución. Conserva este reporte como evidencia del estado en "
backend/apps/prestamos/services.py:27:from apps.prestamos.reportes import generar_reporte_dano
backend/apps/prestamos/services.py:179:def consultar_reportes_devolucion(
backend/apps/prestamos/services.py:185:    """Listado de devoluciones con reporte de daños para su consulta (RN10).
backend/apps/prestamos/services.py:190:    reportes = (
backend/apps/prestamos/services.py:191:        Devolucion.objects.exclude(reporte="")
backend/apps/prestamos/services.py:202:        reportes = reportes.filter(resultado__dano=dano)
backend/apps/prestamos/services.py:204:        reportes = reportes.filter(fecha_devolucion__date__gte=fecha_desde)
backend/apps/prestamos/services.py:206:        reportes = reportes.filter(fecha_devolucion__date__lte=fecha_hasta)
backend/apps/prestamos/services.py:208:        reportes = reportes.filter(realizado_por_id=gestor_id)
backend/apps/prestamos/services.py:209:    return reportes
backend/apps/prestamos/services.py:932:def _generar_reporte_de_dano(devolucion):
backend/apps/prestamos/services.py:934:    nombre = f"reporte-dano-prestamo-{devolucion.prestamo_id}.pdf"
backend/apps/prestamos/services.py:935:    contenido = ContentFile(generar_reporte_dano(devolucion))
backend/apps/prestamos/services.py:936:    devolucion.reporte.save(nombre, contenido, save=True)
backend/apps/prestamos/services.py:1023:            _generar_reporte_de_dano(devolucion)
backend/apps/prestamos/views.py:36:    url_reporte_publica,
backend/apps/prestamos/views.py:46:    consultar_reportes_devolucion,
backend/apps/prestamos/views.py:283:        datos["reporte_url"] = url_reporte_publica(devolucion)
backend/apps/prestamos/views.py:352:    """GET /api/prestamos/devoluciones/{id}/reporte/ — descarga el PDF (RN10)."""
backend/apps/prestamos/views.py:354:    # Tanto gestores como administradores tienen acceso a los reportes de daños.
backend/apps/prestamos/views.py:364:        if not devolucion.reporte:
backend/apps/prestamos/views.py:366:                {"reporte": ["Esta devolución no tiene reporte de daños."]},
backend/apps/prestamos/views.py:370:        # En producción (Cloudinary) el reporte está en la CDN; redirigir a la URL.
backend/apps/prestamos/views.py:373:            url = devolucion.reporte.url
backend/apps/prestamos/views.py:381:            archivo = devolucion.reporte.open("rb")
backend/apps/prestamos/views.py:384:                {"detail": "El archivo del reporte de daños no existe."},
backend/apps/prestamos/views.py:389:            f'attachment; filename="reporte-dano-prestamo-{devolucion.prestamo_id}.pdf"'
backend/apps/prestamos/views.py:401:    """GET /api/prestamos/devoluciones/reportes/ — consulta paginada (RN10)."""
backend/apps/prestamos/views.py:416:        reportes = consultar_reportes_devolucion(**consulta.validated_data)
backend/apps/prestamos/views.py:417:        pagina = self.paginate_queryset(reportes)

```

**Tool: bash**

**Input:**
```json
{
  "command": "grep -RIn 'BadgeEstado\\|estado_visible\\|es_excepcion\\|Excepción\\|Excepcion' frontend/src backend/apps/prestamos --exclude='*.test.*' --exclude-dir=migrations | head -240",
  "workdir": "/home/shiarowo/PERSONAL/Presticad"
}
```

**Output:**
```
frontend/src/prestamos/solicitudPrestamo.js:13:  esExcepcion = false,
frontend/src/prestamos/solicitudPrestamo.js:32:  const requiereGarantia = esExcepcion || esMaterialAltoValor(material)
frontend/src/prestamos/estadoPrestamo.js:30:  if (prestamo.es_excepcion && estado === 'activo') return 'Activo - Excepción'
frontend/src/prestamos/estadoPrestamo.js:38:      estado_visible: obtenerEstadoVisible(prestamo, ahora),
frontend/src/prestamos/estadoPrestamo.js:41:      const aVencido = a.estado_visible === 'vencido'
frontend/src/prestamos/estadoPrestamo.js:42:      const bVencido = b.estado_visible === 'vencido'
frontend/src/prestamos/filtroPrestamos.js:7:    const estadoVisible = prestamo.estado_visible ?? obtenerEstadoVisible(prestamo, ahora)
frontend/src/prestamos/ListaHistorialPrestamos.jsx:1:import BadgeEstado from '../components/ui/BadgeEstado'
frontend/src/prestamos/ListaHistorialPrestamos.jsx:52:              <BadgeEstado
frontend/src/components/prestamos/ListaPrestamos.jsx:5:import BadgeEstado from '../ui/BadgeEstado'
frontend/src/components/prestamos/ListaPrestamos.jsx:57:                  <BadgeEstado
frontend/src/components/prestamos/ListaPrestamos.jsx:58:                    estado={prestamo.estado_visible}
frontend/src/components/prestamos/ListaPrestamos.jsx:59:                    texto={textoEstadoPrestamo(prestamo, prestamo.estado_visible)}
frontend/src/components/prestamos/DetallePrestamo.jsx:8:import BadgeEstado from '../ui/BadgeEstado'
frontend/src/components/prestamos/DetallePrestamo.jsx:135:  const estado = detalle?.estado ?? prestamo.estado_visible ?? prestamo.estado
frontend/src/components/prestamos/DetallePrestamo.jsx:136:  const esExcepcion = detalle?.es_excepcion ?? prestamo.es_excepcion
frontend/src/components/prestamos/DetallePrestamo.jsx:220:              <BadgeEstado estado={estado} texto={textoEstadoPrestamo({ es_excepcion: esExcepcion }, estado)} />
frontend/src/components/prestamos/DetallePrestamo.jsx:222:            {esExcepcion && (
frontend/src/components/prestamos/DetallePrestamo.jsx:224:                Excepción académica
frontend/src/components/prestamos/DetallePrestamo.jsx:342:            {!esExcepcion && !esMaterialAltoValor(material) ? (
frontend/src/components/FichaTecnicaModal.jsx:19:import BadgeEstado from './ui/BadgeEstado'
frontend/src/components/FichaTecnicaModal.jsx:322:                            <BadgeEstado estado={inst.estado} texto={inst.estadoLegible} />
frontend/src/components/ui/BadgeEstado.jsx:35:function BadgeEstado({ estado, texto = '' }) {
frontend/src/components/ui/BadgeEstado.jsx:48:export default BadgeEstado
frontend/src/validacionesPrestamo.js:51:  esExcepcion = false,
frontend/src/validacionesPrestamo.js:97:  if (esExcepcion || esMaterialAltoValor(material)) {
frontend/src/pages/RegistrarPrestamo.jsx:45:  esExcepcion: false,
frontend/src/pages/RegistrarPrestamo.jsx:201:  const puedeSolicitarExcepcion = Boolean(
frontend/src/pages/RegistrarPrestamo.jsx:205:  const excepcionActiva = Boolean(puedeSolicitarExcepcion && formulario.esExcepcion)
frontend/src/pages/RegistrarPrestamo.jsx:236:            esExcepcion: false,
frontend/src/pages/RegistrarPrestamo.jsx:356:      esExcepcion: excepcionActiva,
frontend/src/pages/RegistrarPrestamo.jsx:380:        esExcepcion: excepcionActiva,
frontend/src/pages/RegistrarPrestamo.jsx:454:            Préstamo registrado como activo{prestamoCreado.es_excepcion ? ' con excepción académica' : ''} para {prestamoCreado.usuario_nombre}.
frontend/src/pages/RegistrarPrestamo.jsx:521:                    {!tierCumple && puedeSolicitarExcepcion && (
frontend/src/pages/RegistrarPrestamo.jsx:524:                    {!tierCumple && !puedeSolicitarExcepcion && (
frontend/src/pages/RegistrarPrestamo.jsx:531:            {puedeSolicitarExcepcion && (
frontend/src/pages/RegistrarPrestamo.jsx:541:                  checked={formulario.esExcepcion}
frontend/src/pages/RegistrarPrestamo.jsx:542:                  onChange={(evento) => actualizar('esExcepcion', evento.target.checked)}
frontend/src/pages/UsuariosRoles.jsx:10:import BadgeEstado from '../components/ui/BadgeEstado'
frontend/src/pages/UsuariosRoles.jsx:136:                        <BadgeEstado estado="activo" />
frontend/src/pages/DevolucionPrestamo.jsx:28:import BadgeEstado from '../components/ui/BadgeEstado'
frontend/src/pages/DevolucionPrestamo.jsx:477:              <BadgeEstado estado={detalle.estado} />
frontend/src/pages/DevolucionPrestamo.jsx:644:            <BadgeEstado estado={detalle.estado} />
frontend/src/pages/SeleccionarPrestamoDevolucion.jsx:9:import BadgeEstado from '../components/ui/BadgeEstado'
frontend/src/pages/SeleccionarPrestamoDevolucion.jsx:193:                  <BadgeEstado estado={prestamo.estado} />
frontend/src/pages/ReportesDanos.jsx:17:import BadgeEstado from '../components/ui/BadgeEstado'
frontend/src/pages/ReportesDanos.jsx:213:                    <BadgeEstado
backend/apps/prestamos/tests.py:592:                es_excepcion=True,
backend/apps/prestamos/tests.py:602:                es_excepcion=True,
backend/apps/prestamos/tests.py:607:            self.assertTrue(prestamo.es_excepcion)
backend/apps/prestamos/tests.py:622:                es_excepcion=True,
backend/apps/prestamos/tests.py:625:        self.assertEqual(contexto.exception.campo, "es_excepcion")
backend/apps/prestamos/tests.py:644:                es_excepcion=True,
backend/apps/prestamos/tests.py:647:        self.assertEqual(contexto.exception.campo, "es_excepcion")
backend/apps/prestamos/tests.py:922:        "es_excepcion",
backend/apps/prestamos/tests.py:1016:        "es_excepcion",
backend/apps/prestamos/tests.py:1091:    def test_get_filtra_estado_visible_y_rechaza_estado_invalido(self):
backend/apps/prestamos/tests.py:1153:    def test_detalle_expone_ficha_individual_checklist_y_estado_visible(self):
backend/apps/prestamos/tests.py:1636:        self.assertTrue(respuesta.json()["es_excepcion"])
backend/apps/prestamos/tests.py:1639:        self.assertTrue(Prestamo.objects.get().es_excepcion)
backend/apps/prestamos/tests.py:2277:        self.prestamo.es_excepcion = True
backend/apps/prestamos/tests.py:2278:        self.prestamo.save(update_fields=["es_excepcion"])
backend/apps/prestamos/urls.py:14:    RegistrarPrestamoExcepcionalView,
backend/apps/prestamos/urls.py:23:        RegistrarPrestamoExcepcionalView.as_view(),
backend/apps/prestamos/views.py:55:def _registrar_prestamo(request, *, es_excepcion=False):
backend/apps/prestamos/views.py:63:            es_excepcion=es_excepcion,
backend/apps/prestamos/views.py:87:class RegistrarPrestamoExcepcionalView(APIView):
backend/apps/prestamos/views.py:94:        return _registrar_prestamo(request, es_excepcion=True)
backend/apps/prestamos/consultar_serializers.py:73:            "es_excepcion",
backend/apps/prestamos/consultar_serializers.py:106:            "es_excepcion",
backend/apps/prestamos/consultar_serializers.py:194:            "es_excepcion",
backend/apps/prestamos/consultar_serializers.py:266:            "es_excepcion",
backend/apps/prestamos/serializers.py:262:            "es_excepcion",
backend/apps/prestamos/services.py:223:def _validar_elegibilidad(usuario, material, *, es_excepcion=False):
backend/apps/prestamos/services.py:236:    if es_excepcion:
backend/apps/prestamos/services.py:243:                "es_excepcion",
backend/apps/prestamos/services.py:357:    es_excepcion=False,
backend/apps/prestamos/services.py:367:    requiere_garantia = es_excepcion or material.requiere_garantia()
backend/apps/prestamos/services.py:602:    es_excepcion=False,
backend/apps/prestamos/services.py:629:    _validar_elegibilidad(prestatario, material, es_excepcion=es_excepcion)
backend/apps/prestamos/services.py:639:    requiere_garantia = es_excepcion or material.requiere_garantia()
backend/apps/prestamos/services.py:644:        es_excepcion=es_excepcion,
backend/apps/prestamos/services.py:680:        es_excepcion=es_excepcion,
backend/apps/prestamos/services.py:896:    if prestamo.es_excepcion:
backend/apps/prestamos/models.py:93:    es_excepcion = models.BooleanField(
backend/apps/prestamos/models.py:129:        return self.es_excepcion or self.material.requiere_garantia()

```

**Tool: bash**

**Input:**
```json
{
  "command": "sed -n '1,360p' backend/apps/prestamos/reportes.py",
  "workdir": "/home/shiarowo/PERSONAL/Presticad"
}
```

**Output:**
```
"""Generación del reporte PDF de daños en la devolución (RN10, HU11).

Toda devolución que detecta daño parcial o total debe producir este PDF como
evidencia auditable: datos del préstamo, actores, tipo de daño, elementos
dañados contrastados con el checklist inicial y la sanción aplicada.
"""
from io import BytesIO

from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

AZUL_INSTITUCIONAL = colors.HexColor("#003c84")
AZUL_CLARO = colors.HexColor("#e3edf7")
BORDE = colors.HexColor("#c2d2e4")

ETIQUETAS_DANO = {
    "dano_parcial": "DAÑO PARCIAL",
    "dano_total": "DAÑO TOTAL",
}

ETIQUETAS_ESTADO = {
    "sin_cambios": "Sin cambios",
    "dano_parcial": "Daño parcial",
    "dano_total": "Daño total",
}


def _formatear_fecha(valor):
    if not valor:
        return "—"
    return timezone.localtime(valor).strftime("%d/%m/%Y %H:%M")


def _estilos():
    base = getSampleStyleSheet()
    return {
        "marca": ParagraphStyle(
            "Marca",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=11,
            textColor=AZUL_INSTITUCIONAL,
            spaceAfter=2,
        ),
        "titulo": ParagraphStyle(
            "Titulo",
            parent=base["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=16,
            textColor=colors.HexColor("#123a63"),
            spaceAfter=4,
        ),
        "seccion": ParagraphStyle(
            "Seccion",
            parent=base["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=12,
            textColor=AZUL_INSTITUCIONAL,
            spaceBefore=12,
            spaceAfter=6,
        ),
        "cuerpo": ParagraphStyle(
            "Cuerpo",
            parent=base["Normal"],
            fontSize=10,
            leading=14,
        ),
        "nota": ParagraphStyle(
            "Nota",
            parent=base["Normal"],
            fontSize=8,
            textColor=colors.HexColor("#2f5578"),
        ),
        "celda": ParagraphStyle(
            "Celda",
            parent=base["Normal"],
            fontSize=9,
            leading=12,
        ),
        "celda_negrita": ParagraphStyle(
            "CeldaNegrita",
            parent=base["Normal"],
            fontSize=9,
            leading=12,
            fontName="Helvetica-Bold",
        ),
    }


def _tabla(filas, anchos, estilos):
    tabla = Table(filas, colWidths=anchos, hAlign="LEFT")
    tabla.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), AZUL_CLARO),
                ("GRID", (0, 0), (-1, -1), 0.5, BORDE),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return tabla


def generar_reporte_dano(devolucion):
    """Construye el PDF del reporte de daños y devuelve sus bytes."""
    prestamo = devolucion.prestamo
    material = prestamo.material
    prestatario = prestamo.usuario
    gestor = devolucion.realizado_por
    resultado = devolucion.resultado
    estilos = _estilos()

    nombre_prestatario = (
        f"{prestatario.nombre} {prestatario.apellido}".strip()
    )
    nombre_gestor = f"{gestor.nombre} {gestor.apellido}".strip()

    buffer = BytesIO()
    documento = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
        title=f"Reporte de daños - préstamo {prestamo.pk}",
        author="PrestiCad",
    )

    historia = [
        Paragraph("PrestiCad · Sistema de préstamos e inventario", estilos["marca"]),
        Paragraph("Reporte de daños en devolución", estilos["titulo"]),
        Paragraph(
            f"Emitido el {_formatear_fecha(devolucion.fecha_devolucion)} · "
            f"Documento generado automáticamente (RN10).",
            estilos["cuerpo"],
        ),
        Spacer(1, 8),
        Paragraph("Datos del préstamo", estilos["seccion"]),
    ]

    datos_prestamo = [
        (Paragraph("Préstamo N°", estilos["celda_negrita"]), str(prestamo.pk)),
        (Paragraph("Material", estilos["celda_negrita"]), material.nombre),
        (
            Paragraph("Código de Material", estilos["celda_negrita"]),
            material.codigo_material,
        ),
        (
            Paragraph("Código de Ejemplar", estilos["celda_negrita"]),
            prestamo.instancia.codigo_ejemplar if prestamo.instancia_id else "—",
        ),
        (
            Paragraph("Fecha de entrega", estilos["celda_negrita"]),
            _formatear_fecha(prestamo.fecha_entrega),
        ),
        (
            Paragraph("Fecha límite", estilos["celda_negrita"]),
            _formatear_fecha(prestamo.fecha_limite),
        ),
        (
            Paragraph("Fecha de devolución", estilos["celda_negrita"]),
            _formatear_fecha(devolucion.fecha_devolucion),
        ),
        (
            Paragraph("Prestatario", estilos["celda_negrita"]),
            f"{nombre_prestatario} · DNI {prestatario.dni}",
        ),
        (
            Paragraph("Registrado por", estilos["celda_negrita"]),
            nombre_gestor,
        ),
        (
            Paragraph("Tipo de daño", estilos["celda_negrita"]),
            Paragraph(
                f"<b>{ETIQUETAS_DANO.get(resultado['dano'], 'SIN DAÑOS')}</b>",
                estilos["celda"],
            ),
        ),
    ]
    historia.append(
        _tabla(datos_prestamo, [4.5 * cm, 12.3 * cm], estilos)
    )

    checklist_inicial = prestamo.checklist_inicial or []
    fotos_iniciales = {
        foto.indice: foto
        for foto in prestamo.fotos_checklist.filter(fase="inicial")
    }
    fotos_finales = {
        foto.indice: foto
        for foto in prestamo.fotos_checklist.filter(fase="final")
    }
    daniados = [
        (indice, item)
        for indice, item in enumerate(devolucion.checklist_devolucion)
        if item.get("estado") != "sin_cambios"
    ]

    def celda_foto(foto):
        if foto is None or not foto.imagen:
            return Paragraph("—", estilos["celda"])
        with foto.imagen.open("rb") as archivo:
            imagen = Image(
                BytesIO(archivo.read()),
                width=2.2 * cm,
                height=1.7 * cm,
                kind="bound",
            )
        imagen.hAlign = "LEFT"
        return imagen

    historia.append(Paragraph("Elementos dañados", estilos["seccion"]))
    filas = [
        [
            Paragraph("Elemento", estilos["celda_negrita"]),
            Paragraph("Observación inicial", estilos["celda_negrita"]),
            Paragraph("Estado devuelto", estilos["celda_negrita"]),
            Paragraph("Observación de devolución", estilos["celda_negrita"]),
            Paragraph("Foto inicial", estilos["celda_negrita"]),
            Paragraph("Foto final", estilos["celda_negrita"]),
        ]
    ]
    for indice, item in daniados:
        inicial = checklist_inicial[indice] if indice < len(checklist_inicial) else {}
        if not isinstance(inicial, dict):
            inicial = {}
        filas.append(
            [
                Paragraph(item.get("elemento", ""), estilos["celda"]),
                Paragraph(str(inicial.get("observacion", "")).strip() or "—", estilos["celda"]),
                Paragraph(
                    ETIQUETAS_ESTADO.get(item.get("estado"), item.get("estado", "")),
                    estilos["celda"],
                ),
                Paragraph(str(item.get("observacion", "")).strip() or "—", estilos["celda"]),
                celda_foto(fotos_iniciales.get(indice)),
                celda_foto(fotos_finales.get(indice)),
            ]
        )
    historia.append(
        Table(
            filas,
            colWidths=[2.5 * cm, 3.0 * cm, 2.6 * cm, 3.0 * cm, 2.8 * cm, 2.8 * cm],
            hAlign="LEFT",
            style=TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), AZUL_INSTITUCIONAL),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("GRID", (0, 0), (-1, -1), 0.5, BORDE),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]
            ),
        )
    )

    cobro = resultado["cobro_economico"]
    if cobro is None:
        cobro_texto = "Sin costo parametrizado para este material"
    else:
        cobro_texto = f"S/ {cobro}"

    puntos = [
        (
            Paragraph("Bonificación por entrega a tiempo", estilos["celda_negrita"]),
            f"+{resultado['bonificacion']} pts"
            if resultado["a_tiempo"]
            else "No aplica (entrega fuera de plazo)",
        ),
        (
            Paragraph(
                f"Deducción por tardanza · {resultado['dias_tardanza']} día(s)",
                estilos["celda_negrita"],
            ),
            f"-{resultado['deduccion_tardanza']} pts"
            if resultado["deduccion_tardanza"]
            else "No aplica",
        ),
        (
            Paragraph("Deducción por daño", estilos["celda_negrita"]),
            f"-{resultado['deduccion_dano']} pts"
            if resultado["deduccion_dano"]
            else "No aplica",
        ),
        (
            Paragraph("Impacto neto en reputación", estilos["celda_negrita"]),
            f"{resultado['puntos_delta']:+d} pts",
        ),
        (
            Paragraph("Reputación resultante", estilos["celda_negrita"]),
            f"{resultado['reputacion_antes']} ({resultado['tier_antes'].title()})"
            f" → {resultado['reputacion_despues']} ({resultado['tier_despues'].title()})",
        ),
        (
            Paragraph("Cobro económico", estilos["celda_negrita"]),
            cobro_texto,
        ),
    ]
    historia.append(Paragraph("Sanciones aplicadas", estilos["seccion"]))
    historia.append(_tabla(puntos, [8.5 * cm, 8.3 * cm], estilos))

    historia.append(Spacer(1, 16))
    historia.append(
        Paragraph(
            "Documento generado por PrestiCad en la registración de la "
            "devolución. Conserva este reporte como evidencia del estado en "
            "que fue recibido el material.",
            estilos["nota"],
        )
    )

    documento.build(historia)
    return buffer.getvalue()

```

**Tool: bash**

**Input:**
```json
{
  "command": "sed -n '1,260p' frontend/src/prestamos/ReportesDevolucion.jsx 2>/dev/null || find frontend/src -iname '*Reporte*' -maxdepth 4 -type f",
  "workdir": "/home/shiarowo/PERSONAL/Presticad"
}
```

**Output:**
```
frontend/src/prestamos/reportesDevolucion.test.js
frontend/src/prestamos/reportesDevolucion.js
frontend/src/pages/ReportesDanos.jsx

```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 11.1s)

_Thinking:_

Need inspect ReportesDanos and serializers; report list should include exception. Backend `ReporteDevolucionSerializer` currently fields no es_excepcion. Add source `prestamo.es_excepcion` perhaps and maybe `tipo_prestamo`. UI badge. Also "SeleccionarPrestamoDevolucion" list has badge; devolution page badges; maybe all history. Search all `BadgeEstado` in prestamos. Need add secondary badge. Could create reusable component `BadgeExcepcion` maybe. Need follow patterns. Create `frontend/src/components/prestamos/BadgeExcepcion.jsx`? Or UI `BadgeExcepcionAcademica`. Better a new component in `components/prestamos/BadgeExcepcionAcademica.jsx` using styles. Could also use `BadgeEstado` with variant? `BadgeEstado` only state mapping. New `EtiquetaExcepcion`? Name in Spanish maybe `BadgeExcepcionAcademica`. Existing folders mostly English components names? `BadgeEstado`. We'll add `BadgeExcepcion.jsx` with text "Excepción académica" and style maybe aviso/info. User specifically wants tag. Use `BadgeEstado estado="excepcion"`? Could add mapping `excepcion: 'aviso'` and label "Excepción académica", then call `<BadgeEstado estado="excepcion" />`; but semantics mixing state. Better new component.

Need maybe badge in report list. Inspect `ReportesDanos`. Also `SeleccionarPrestamoDevolucion`. History is `ListaHistorialPrestamos`. MisPrestamos `ListaPrestamos`. Detail. Devolucion page. Maybe `ListaHistorialPrestamos` uses full prestamo object with es_excepcion from serializer. Good. `SeleccionarPrestamoDevolucion` likely receives history serializer with es_excepcion. Good. `ReportesDanos` needs backend field.

Need reports:
1. PDF `generar_reporte_dano`: add "Tipo de préstamo" row with "Excepción académica" if flag else "Regular". Also if exception, add explicit note in sanciones "Deducción por daño duplicada por excepción académica (base X)". Need ensure `deduccion_dano_base` may be missing in old devolutions; use `resultado.get("deduccion_dano_base")`. Add maybe title "Reporte de daños en devolución" and subtitle "Préstamo por excepción académica" if true so obvious at top. Better add a highlighted paragraph after subtitle. Could use red/acento color. Keep institutional. Add row and note.
2. Report query UI and API list include exception.
3. Any CSV? only PDF.

Need consistency in history badges. Implement separate badge in list item. Need state badge remain. For detail maybe also add to `dl` or next to title. Currently detail has Campo "Tipo de préstamo" with text. User wants label. Add badge next to title/state maybe. In detail, use badge in state row plus separate? Could add a `BadgeExcepcionAcademica` in title area. Need maybe in `DetallePrestamo` heading:
```
<div className="flex items-center gap-2">
<h3>Detalle</h3>
{esExcepcion && <BadgeExcepcionAcademica />}
</div>
```
and keep state. Remove Campo "Tipo"? Could keep. Better badge visible at top. Maybe replace Campo "Tipo de préstamo" with badge? Keep both? Consistency. Add badge next to title; remove type field to avoid redundancy. But user asks always note; keep badge near status and list. Simpler:
- list items: state badge plus exception badge.
- detail: in state `CampoDetalle`, show both badges inline. Remove separate "Tipo" field.
- Devolucion page: status badge plus exception if detalle.es_excepcion in both resumen and header. 
- SeleccionarPrestamoDevolucion list: add exception badge.
- ReportesDanos: add exception badge in each row; backend field.

Need maybe in `MisPrestamos` list and `Historial` list, if exception then label alongside state. Good.
Need maybe "Activo - Excepción" text in state badge now redundant if separate badge. User explicitly says "así como hay una etiqueta de 'Devuelto' y 'Activo'. También deberían existir una etiquetas de préstamo por 'Excepción académica'." So separate badge. Then state badge should show plain "Activo" and separate exception tag. Remove custom `textoEstadoPrestamo` special? Could keep? It would show "Activo - Excepción" plus tag "Excepción académica", redundant. Better change `textoEstadoPrestamo` to just regular state? Could remove function and tests? The previous requirement said "Badge visible: Activo - Excepción", but new user clarifies separate tag. We should align new. So modify `textoEstadoPrestamo` maybe remove exception logic or stop using. But we created tests. Better not keep dead weird function. Could remove `textoEstadoPrestamo` and its tests, use plain state. But existing test expects exception. User wants both state and exception labels. We can keep function returns plain state? That's pointless. Remove function and test. But maybe keep for backwards compatibility not needed. Clean up.

Need add `es_excepcion` maybe to `PrestamoDevolucionDetalleSerializer` already yes. `ReporteDevolucionSerializer` add.

Need PDF test. Existing `ReporteDevolucionTestCase` likely reads PDF bytes? Inspect.

**Tool: bash**

**Input:**
```json
{
  "command": "sed -n '1,230p' frontend/src/pages/ReportesDanos.jsx && sed -n '1,230p' frontend/src/pages/SeleccionarPrestamoDevolucion.jsx",
  "workdir": "/home/shiarowo/PERSONAL/Presticad"
}
```

**Output:**
```
import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'

import { api } from '../api/client'
import useTituloPagina from '../hooks/useTituloPagina'
import { ETIQUETAS_DANO } from '../constantes/devolucion'
import {
  TAMANO_PAGINA_REPORTES,
  construirRutaReportes,
  validarRespuestaReportes,
} from '../prestamos/reportesDevolucion'
import Campo from '../components/ui/Campo'
import Boton from '../components/ui/Boton'
import Skeleton from '../components/ui/Skeleton'
import ErrorAlerta from '../components/ui/ErrorAlerta'
import EstadoVacio from '../components/ui/EstadoVacio'
import BadgeEstado from '../components/ui/BadgeEstado'

const CONSULTA_INICIAL = { cargando: true, error: '', datos: null }
const FILTROS_INICIALES = { dano: 'todos', fechaDesde: '', fechaHasta: '' }

const OPCIONES_DANO = [
  { valor: 'todos', etiqueta: 'Todos los daños' },
  { valor: 'dano_parcial', etiqueta: 'Daño parcial' },
  { valor: 'dano_total', etiqueta: 'Daño total' },
]

const VARIANTES_DANO = {
  dano_parcial: 'prestado',
  dano_total: 'en_mantenimiento',
}

function moneda(valor) {
  if (valor === null || valor === undefined || valor === '') return '—'
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
  }).format(Number(valor))
}

function fechaLegible(valor) {
  if (!valor) return '—'
  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(valor))
}

function firmarPuntos(delta) {
  if (delta > 0) return `+${delta}`
  if (delta < 0) return String(delta)
  return '0'
}

function ReportesDanos() {
  useTituloPagina('Reportes de daños')
  const [filtros, setFiltros] = useState(FILTROS_INICIALES)
  const [pagina, setPagina] = useState(1)
  const [intento, setIntento] = useState(0)
  const [consulta, setConsulta] = useState(CONSULTA_INICIAL)

  const rangoFechasInvalido = Boolean(
    filtros.fechaDesde
    && filtros.fechaHasta
    && filtros.fechaDesde > filtros.fechaHasta,
  )

  useEffect(() => {
    let activa = true

    if (rangoFechasInvalido) {
      setConsulta({
        cargando: false,
        error: 'La fecha inicial no puede ser posterior a la fecha final.',
        datos: null,
      })
      return undefined
    }

    setConsulta({ cargando: true, error: '', datos: null })
    api
      .get(construirRutaReportes({ ...filtros, pagina }))
      .then(validarRespuestaReportes)
      .then((datos) => {
        if (activa) setConsulta({ cargando: false, error: '', datos })
      })
      .catch(() => {
        if (activa) {
          setConsulta({
            cargando: false,
            error: 'No fue posible consultar los reportes de daños. Intenta nuevamente.',
            datos: null,
          })
        }
      })

    return () => {
      activa = false
    }
  }, [filtros, pagina, intento, rangoFechasInvalido])

  function cambiarFiltro(campo, valor) {
    setFiltros((actual) => ({ ...actual, [campo]: valor }))
    setPagina(1)
  }

  const hayFiltros = filtros.dano !== 'todos' || filtros.fechaDesde || filtros.fechaHasta

  if (consulta.cargando) {
    return (
      <div className="space-y-3" role="status" aria-live="polite">
        <p className="text-sm text-texto-suave">Cargando reportes de daños…</p>
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
    )
  }

  if (consulta.error) {
    return (
      <section aria-label="Reportes de daños" className="grid gap-4">
        <CabeceraReportes />
        <ErrorAlerta mensaje={consulta.error} />
        {!rangoFechasInvalido && (
          <Boton
            variante="secundario"
            className="w-full sm:w-auto"
            onClick={() => setIntento((valor) => valor + 1)}
          >
            Reintentar
          </Boton>
        )}
      </section>
    )
  }

  const { count, next, previous, results } = consulta.datos
  const totalPaginas = Math.max(1, Math.ceil(count / TAMANO_PAGINA_REPORTES))

  return (
    <section aria-label="Reportes de daños">
      <CabeceraReportes />

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Campo
          etiqueta="Tipo de daño"
          opciones={OPCIONES_DANO}
          valor={filtros.dano}
          onCambio={(evento) => cambiarFiltro('dano', evento.target.value)}
        />
        <Campo
          etiqueta="Devuelto desde"
          tipo="date"
          valor={filtros.fechaDesde}
          onCambio={(evento) => cambiarFiltro('fechaDesde', evento.target.value)}
        />
        <Campo
          etiqueta="Devuelto hasta"
          tipo="date"
          valor={filtros.fechaHasta}
          onCambio={(evento) => cambiarFiltro('fechaHasta', evento.target.value)}
        />
      </div>

      {results.length === 0 ? (
        <div className="mt-6">
          <EstadoVacio
            titulo={hayFiltros ? 'Sin reportes con estos filtros' : 'Aún no hay reportes de daños'}
            mensaje={
              hayFiltros
                ? 'Prueba con otros criterios de búsqueda.'
                : 'Los reportes aparecerán aquí cuando una devolución detecte daño parcial o total.'
            }
          />
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-borde bg-white dark:bg-superficie">
          <table className="w-full min-w-[720px] text-sm">
            <caption className="sr-only">Listado de reportes de daños</caption>
            <thead>
              <tr className="border-b border-borde text-left text-xs font-semibold uppercase tracking-wide text-texto-suave">
                <th scope="col" className="px-4 py-3">Material</th>
                <th scope="col" className="px-4 py-3">Prestatario</th>
                <th scope="col" className="px-4 py-3">Gestor</th>
                <th scope="col" className="px-4 py-3">Devolución</th>
                <th scope="col" className="px-4 py-3">Daño</th>
                <th scope="col" className="px-4 py-3">Sanción</th>
                <th scope="col" className="px-4 py-3">Cobro</th>
                <th scope="col" className="px-4 py-3">
                  <span className="sr-only">Reporte</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {results.map((reporte) => (
                <tr
                  key={reporte.devolucion_id}
                  className="border-b border-borde last:border-b-0 text-texto"
                >
                  <td className="px-4 py-3">
                    <span className="block font-semibold">{reporte.material_nombre}</span>
                    <span className="block text-xs text-texto-suave">
                      Código de Material: {reporte.material_codigo}
                      {reporte.codigo_ejemplar && <> · Código de Ejemplar: {reporte.codigo_ejemplar}</>}
                    </span>
                  </td>
                  <td className="px-4 py-3">{reporte.prestatario_nombre}</td>
                  <td className="px-4 py-3">{reporte.gestor_nombre}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {fechaLegible(reporte.fecha_devolucion)}
                  </td>
                  <td className="px-4 py-3">
                    <BadgeEstado
                      estado={VARIANTES_DANO[reporte.dano] ?? 'desconocido'}
                      texto={ETIQUETAS_DANO[reporte.dano] ?? reporte.dano}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        reporte.puntos_delta >= 0
                          ? 'font-semibold text-acento-700'
                          : 'font-semibold text-error'
                      }
                    >
                      {firmarPuntos(reporte.puntos_delta)} pts
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {moneda(reporte.cobro_economico)}
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { RotateCcw } from 'lucide-react'

import { api } from '../api/client'
import useTituloPagina from '../hooks/useTituloPagina'
import Campo from '../components/ui/Campo'
import SelectorPrestatario from '../components/prestamos/SelectorPrestatario'
import BadgeEstado from '../components/ui/BadgeEstado'
import Boton from '../components/ui/Boton'
import Skeleton from '../components/ui/Skeleton'
import ErrorAlerta from '../components/ui/ErrorAlerta'
import EstadoVacio from '../components/ui/EstadoVacio'
import {
  construirRutaHistorial,
  iniciarCargaHistorial,
  TAMANO_PAGINA_HISTORIAL,
  validarRespuestaHistorial,
} from '../prestamos/historialPrestamos'

const CONSULTA_INICIAL = { cargando: true, error: '', datos: null }

const OPCIONES_ESTADO_PENDIENTE = [
  { valor: 'devoluble', etiqueta: 'Todos los pendientes (activos y vencidos)' },
  { valor: 'activo', etiqueta: 'Solo activos' },
  { valor: 'vencido', etiqueta: 'Solo vencidos' },
]

function fechaLegible(valor) {
  if (!valor) return '—'
  const fecha = new Date(valor)
  if (Number.isNaN(fecha.getTime())) return valor
  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(fecha)
}

export default function SeleccionarPrestamoDevolucion() {
  useTituloPagina('Registrar devolución')
  const navigate = useNavigate()
  const [estado, setEstado] = useState('devoluble')
  const [dniEntrada, setDniEntrada] = useState('')
  const [dniFiltro, setDniFiltro] = useState('')
  const [pagina, setPagina] = useState(1)
  const [intento, setIntento] = useState(0)
  const [consulta, setConsulta] = useState(CONSULTA_INICIAL)

  useEffect(() => {
    let activa = true
    setConsulta(iniciarCargaHistorial)

    api
      .get(construirRutaHistorial({ estado, pagina, dni: dniFiltro }))
      .then(validarRespuestaHistorial)
      .then((datos) => {
        if (activa) {
          setConsulta({ cargando: false, error: '', datos })
        }
      })
      .catch(() => {
        if (activa) {
          setConsulta({
            cargando: false,
            error: 'No fue posible consultar los préstamos pendientes de devolución.',
            datos: null,
          })
        }
      })

    return () => {
      activa = false
    }
  }, [estado, pagina, dniFiltro, intento])

  if (consulta.cargando && !consulta.datos) {
    return (
      <div className="space-y-3" role="status" aria-live="polite">
        <p className="text-sm text-texto-suave">Cargando préstamos pendientes de devolución…</p>
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
    )
  }

  if (consulta.error && !consulta.datos) {
    return (
      <section aria-label="Registrar devolución" className="grid gap-4">
        <header>
          <h2 className="text-xl font-bold text-texto">Registrar devolución</h2>
          <p className="mt-1 text-sm text-texto-suave">
            Selecciona el préstamo pendiente para inspeccionar el ejemplar y registrar su devolución.
          </p>
        </header>
        <ErrorAlerta mensaje={consulta.error} />
        <Boton
          variante="secundario"
          className="w-full sm:w-auto"
          onClick={() => setIntento((valor) => valor + 1)}
        >
          Reintentar
        </Boton>
      </section>
    )
  }

  const { count, next, previous, results } = consulta.datos
  const totalPaginas = Math.max(1, Math.ceil(count / TAMANO_PAGINA_HISTORIAL))

  return (
    <section aria-label="Registrar devolución" aria-busy={consulta.cargando}>
      <header className="mb-5">
        <h2 className="text-xl font-bold text-texto">Registrar devolución</h2>
        <p className="mt-1 text-sm text-texto-suave">
          Selecciona un préstamo activo o vencido para revisar el checklist del ejemplar y registrar su devolución.
        </p>
      </header>

      <div className="my-4 grid gap-4 sm:max-w-3xl sm:grid-cols-[18rem_minmax(0,24rem)] sm:items-start">
        <Campo
          etiqueta="Estado del préstamo"
          opciones={OPCIONES_ESTADO_PENDIENTE}
          valor={estado}
          onCambio={(evento) => {
            setEstado(evento.target.value)
            setPagina(1)
          }}
        />
        <div className="grid gap-3">
          <SelectorPrestatario
            valor={dniEntrada}
            etiqueta="Buscar por prestatario"
            ayuda="Escribe el DNI para filtrar los préstamos pendientes del prestatario."
            onCambio={(valor) => {
              setDniEntrada(valor)
              setDniFiltro('')
              setPagina(1)
            }}
            onSeleccionar={(prestatario) => {
              setDniEntrada(prestatario.dni)
              setDniFiltro(prestatario.dni)
              setPagina(1)
            }}
          />
          {dniFiltro && (
            <Boton
              variante="secundario"
              tipo="button"
              className="w-fit"
              onClick={() => {
                setDniEntrada('')
                setDniFiltro('')
                setPagina(1)
              }}
            >
              Quitar filtro de prestatario
            </Boton>
          )}
        </div>
      </div>

      {consulta.cargando && consulta.datos && (
        <p className="mb-3 text-xs text-texto-suave" role="status" aria-live="polite">
          Actualizando listado…
        </p>
      )}

      {results.length === 0 ? (
        <div className="mt-6">
          <EstadoVacio
            titulo={
              dniFiltro
                ? 'Sin préstamos pendientes para este prestatario'
                : 'No hay préstamos pendientes de devolución'
            }
            mensaje={
              dniFiltro
                ? 'El prestatario indicado no tiene préstamos activos o vencidos con este filtro.'
                : 'Cuando existan préstamos activos o vencidos aparecerán aquí para registrar su devolución.'
            }
          />
        </div>
      ) : (
        <ul className="mt-4 grid gap-3">
          {results.map((prestamo) => (
            <li
              key={prestamo.id}
              className="flex flex-col justify-between gap-4 rounded-xl border border-borde bg-white p-4 dark:bg-superficie sm:flex-row sm:items-center"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-texto">{prestamo.material_nombre}</span>
                  <BadgeEstado estado={prestamo.estado} />
                </div>
                <p className="text-sm text-texto-suave">
                  Prestatario: <strong className="font-medium text-texto">{prestamo.prestatario_nombre}</strong> · Código de Material: {prestamo.material_codigo}
                  {prestamo.codigo_ejemplar && <> · Código de Ejemplar: {prestamo.codigo_ejemplar}</>}
                </p>
                <p className="text-xs text-texto-suave">
                  Entrega: {fechaLegible(prestamo.fecha_entrega)} · Fecha límite: {fechaLegible(prestamo.fecha_limite)}
                </p>
              </div>
              <div className="shrink-0">
                <Boton
                  tipo="button"
                  icono={RotateCcw}
                  onClick={() => navigate(`/panel/devolucion/${prestamo.id}`)}
                >
                  Registrar devolución
                </Boton>
              </div>
            </li>
          ))}
        </ul>
      )}

      {count > 0 && (
        <nav className="mt-6 flex flex-wrap items-center justify-center gap-3" aria-label="Páginas de préstamos pendientes">
          <Boton
            variante="secundario"
            tipo="button"
            deshabilitado={!previous}
            onClick={() => setPagina((actual) => actual - 1)}
          >
            Anterior
          </Boton>
          <span className="text-sm text-texto-suave" aria-live="polite">
            Página {pagina} de {totalPaginas} · {count} préstamos
          </span>
          <Boton

```

**Tool: bash**

**Input:**
```json
{
  "command": "cat frontend/src/prestamos/reportesDevolucion.js && cat frontend/src/prestamos/reportesDevolucion.test.js",
  "workdir": "/home/shiarowo/PERSONAL/Presticad"
}
```

**Output:**
```
export const TAMANO_PAGINA_REPORTES = 25

export function construirRutaReportes({
  dano = 'todos',
  fechaDesde = '',
  fechaHasta = '',
  pagina = 1,
} = {}) {
  const parametros = new URLSearchParams({
    page: String(pagina),
    page_size: String(TAMANO_PAGINA_REPORTES),
  })

  if (dano && dano !== 'todos') parametros.set('dano', dano)
  if (fechaDesde) parametros.set('fecha_desde', fechaDesde)
  if (fechaHasta) parametros.set('fecha_hasta', fechaHasta)

  return `/prestamos/devoluciones/reportes/?${parametros.toString()}`
}

export function validarRespuestaReportes(datos) {
  const esListaValida = datos && Array.isArray(datos.results)
  const esConteoValido = Number.isInteger(datos?.count) && datos.count >= 0
  const esEnlaceValido = (enlace) => enlace === null || typeof enlace === 'string'

  if (
    !esListaValida
    || !esConteoValido
    || !esEnlaceValido(datos.next)
    || !esEnlaceValido(datos.previous)
  ) {
    throw new Error('La respuesta del listado de reportes no tiene el formato esperado.')
  }

  return datos
}
import { describe, expect, it } from 'vitest'

import {
  construirRutaReportes,
  validarRespuestaReportes,
} from './reportesDevolucion'

describe('construirRutaReportes', () => {
  it('solicita la primera página con el tamaño acordado', () => {
    expect(construirRutaReportes()).toBe(
      '/prestamos/devoluciones/reportes/?page=1&page_size=25',
    )
  })

  it('incluye el tipo de daño cuando se filtra', () => {
    expect(construirRutaReportes({ dano: 'dano_parcial', pagina: 2 })).toBe(
      '/prestamos/devoluciones/reportes/?page=2&page_size=25&dano=dano_parcial',
    )
  })

  it('omite el filtro para todos los daños', () => {
    expect(construirRutaReportes({ dano: 'todos' })).toBe(
      '/prestamos/devoluciones/reportes/?page=1&page_size=25',
    )
  })

  it('incluye el rango de fechas solo cuando hay valores', () => {
    expect(
      construirRutaReportes({ fechaDesde: '2026-01-01', fechaHasta: '2026-01-31' }),
    ).toBe(
      '/prestamos/devoluciones/reportes/?page=1&page_size=25&fecha_desde=2026-01-01&fecha_hasta=2026-01-31',
    )
  })
})

describe('validarRespuestaReportes', () => {
  it('conserva la respuesta paginada válida', () => {
    const respuesta = {
      count: 1,
      next: null,
      previous: null,
      results: [{ devolucion_id: 1, dano: 'dano_parcial' }],
    }

    expect(validarRespuestaReportes(respuesta)).toBe(respuesta)
  })

  it('rechaza una respuesta que no incluye lista o conteo válido', () => {
    expect(() => validarRespuestaReportes([])).toThrow(
      'La respuesta del listado de reportes no tiene el formato esperado.',
    )
    expect(() => validarRespuestaReportes({ count: -1, results: [] })).toThrow()
  })
})

```

**Tool: bash**

**Input:**
```json
{
  "command": "sed -n '2383,2470p' backend/apps/prestamos/tests.py && sed -n '2742,2890p' backend/apps/prestamos/tests.py",
  "workdir": "/home/shiarowo/PERSONAL/Presticad"
}
```

**Output:**
```
    def test_rechaza_prestamo_reservado(self):
        self.prestamo.estado = "reservado"
        self.prestamo.save(update_fields=["estado"])

        with self.assertRaises(PrestamoError) as contexto:
            self._devolver()

        self.assertEqual(contexto.exception.status_code, 409)
        self.assertEqual(Devolucion.objects.count(), 0)

    def test_no_libera_la_unidad_si_quedan_prestamos_activos(self):
        material = crear_material(
            nombre="Laptops",
            codigo_material="EQ-102",
            stock=2,
        )
        segundo = crear_usuario("segundo-dev@unsa.edu.pe", "10000023")
        primero = registrar_prestamo(
            dni_prestatario=self.prestatario.dni,
            material_id=material.id,
            tiempo_prestamo_dias=3,
            checklist_inicial=CHECKLIST,
            registrado_por=self.gestor,
        )
        registrar_prestamo(
            dni_prestatario=segundo.dni,
            material_id=material.id,
            tiempo_prestamo_dias=3,
            checklist_inicial=CHECKLIST,
            registrado_por=self.gestor,
        )

        registrar_devolucion(
            prestamo_id=primero.id,
            checklist_devolucion=self.checklist_ok,
            realizado_por=self.gestor,
        )

        material.refresh_from_db()
        self.assertEqual(material.estado, "prestado")

    def test_rechaza_checklist_con_estado_no_valido(self):
        checklist = [{"elemento": "Carcasa", "estado": "regular", "observacion": ""}]

        with self.assertRaises(PrestamoError) as contexto:
            self._devolver(checklist=checklist)

        self.assertEqual(contexto.exception.status_code, 400)
        self.assertEqual(Devolucion.objects.count(), 0)

    def test_rechaza_checklist_vacio(self):
        with self.assertRaises(PrestamoError) as contexto:
            self._devolver(checklist=[])

        self.assertEqual(contexto.exception.status_code, 400)

    def test_rechaza_prestamo_inexistente(self):
        with self.assertRaises(PrestamoError) as contexto:
            registrar_devolucion(
                prestamo_id=99999,
                checklist_devolucion=self.checklist_ok,
                realizado_por=self.gestor,
            )

        self.assertEqual(contexto.exception.status_code, 404)


class ReporteDevolucionTestCase(DevolucionBaseTestCase):
    """RN10: la devolución con daño siempre deja un PDF persistido."""

    def _contenido_reporte(self, devolucion):
        with devolucion.reporte.open("rb") as archivo:
            return archivo.read()

    def test_dano_parcial_genera_reporte_pdf_persistido(self):
        checklist = [
            {"elemento": "Carcasa", "estado": "dano_parcial", "observacion": "Rasguño"},
            {"elemento": "Cable", "estado": "sin_cambios", "observacion": ""},
        ]

        devolucion = self._devolver(
            fecha_devolucion=self.prestamo.fecha_limite,
            checklist=checklist,
            fotos_checklist=[crear_foto_checklist(color="red"), None],
        )

        self.assertTrue(devolucion.reporte)
        self.assertTrue(devolucion.reporte.name.startswith("devoluciones/"))
        self.assertEqual(respuesta.status_code, 201, respuesta.content)
        datos = respuesta.json()
        self.assertEqual(datos["hay_dano"], False)
        self.assertEqual(datos["reporte_url"], "")

    def test_post_segunda_devolucion_responde_409(self):
        self._iniciar_sesion(self.gestor)
        self._post_multipart()

        respuesta = self._post_multipart()

        self.assertEqual(respuesta.status_code, 409)
        self.assertEqual(Devolucion.objects.count(), 1)

    def test_get_reporte_devuelve_pdf_para_descarga(self):
        self._iniciar_sesion(self.gestor)
        creacion = self._post_multipart()
        devolucion_id = creacion.json()["devolucion_id"]

        respuesta = self.client.get(f"/api/prestamos/devoluciones/{devolucion_id}/reporte/")

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta["Content-Type"], "application/pdf")
        self.assertIn(
            f'reporte-dano-prestamo-{self.prestamo.id}.pdf',
            respuesta["Content-Disposition"],
        )
        contenido = b"".join(respuesta.streaming_content)
        self.assertEqual(contenido[:4], b"%PDF")

    def test_get_reporte_de_devolucion_sin_dano_responde_404(self):
        self._iniciar_sesion(self.gestor)
        creacion = self.client.post(
            self.url,
            {
                "checklist": [
                    {"elemento": "Carcasa", "estado": "sin_cambios", "observacion": ""},
                    {"elemento": "Cable", "estado": "sin_cambios", "observacion": ""},
                ]
            },
            format="json",
        )
        devolucion_id = creacion.json()["devolucion_id"]

        respuesta = self.client.get(f"/api/prestamos/devoluciones/{devolucion_id}/reporte/")

        self.assertEqual(respuesta.status_code, 404)

    def test_get_reporte_inexistente_responde_404(self):
        self._iniciar_sesion(self.gestor)

        respuesta = self.client.get("/api/prestamos/devoluciones/99999/reporte/")

        self.assertEqual(respuesta.status_code, 404)

    def test_get_reporte_como_administrador_responde_200(self):
        self._iniciar_sesion(self.gestor)
        creacion = self._post_multipart()
        devolucion_id = creacion.json()["devolucion_id"]
        self._iniciar_sesion(self.administrador)

        respuesta = self.client.get(f"/api/prestamos/devoluciones/{devolucion_id}/reporte/")

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta["Content-Type"], "application/pdf")


class ReportesDevolucionAPITestCase(DevolucionBaseTestCase):
    """Listado paginado de reportes de daños para su consulta (RN10, T11.14)."""

    def setUp(self):
        super().setUp()
        self.client = APIClient()
        self.administrador = crear_usuario(
            "admin-reportes@unsa.edu.pe", "10000025", rol="administrador"
        )
        self.otro_gestor = crear_usuario(
            "gestor-reportes@unsa.edu.pe", "10000026", rol="gestor"
        )
        self.url = "/api/prestamos/devoluciones/reportes/"
        self.checklist_dano = [
            {
                "elemento": "Carcasa",
                "estado": "dano_parcial",
                "observacion": "Rasguño",
            },
            {"elemento": "Cable", "estado": "sin_cambios", "observacion": ""},
        ]
        self.devolucion = self._devolver(checklist=self.checklist_dano)

    def _iniciar_sesion(self, usuario):
        sesion = self.client.session
        sesion[CLAVE_SESION_USUARIO_ID] = usuario.id
        sesion[CLAVE_SESION_ULTIMA_ACTIVIDAD] = timezone.now().isoformat()
        sesion.save()

    def _devolver_otro_prestamo(self):
        otro_material = crear_material(codigo_material="EQ-REPORTES-OTRO")
        prestamo = registrar_prestamo(
            dni_prestatario=self.prestatario.dni,
            material_id=otro_material.id,
            tiempo_prestamo_dias=3,
            checklist_inicial=CHECKLIST,
            registrado_por=self.gestor,
        )
        return registrar_devolucion(
            prestamo_id=prestamo.id,
            checklist_devolucion=self.checklist_ok,
            realizado_por=self.gestor,
        )

    def test_listado_sin_sesion_responde_403(self):
        respuesta = self.client.get(self.url)

        self.assertEqual(respuesta.status_code, 403)

    def test_listado_como_prestatario_responde_403(self):
        self._iniciar_sesion(self.prestatario)

        respuesta = self.client.get(self.url)

        self.assertEqual(respuesta.status_code, 403)

    def test_listado_como_gestor_devuelve_formato_paginado(self):
        self._iniciar_sesion(self.gestor)

        respuesta = self.client.get(f"{self.url}?page=1&page_size=10")

        self.assertEqual(respuesta.status_code, 200, respuesta.content)
        datos = respuesta.json()
        self.assertEqual(datos["count"], 1)
        self.assertIsNone(datos["next"])
        self.assertIsNone(datos["previous"])
        fila = datos["results"][0]
        self.assertEqual(fila["devolucion_id"], self.devolucion.id)
        self.assertEqual(fila["prestamo_id"], self.prestamo.id)
        self.assertEqual(fila["material_codigo"], self.material.codigo_material)
        self.assertEqual(fila["codigo_ejemplar"], self.prestamo.instancia.codigo_ejemplar)
        self.assertEqual(fila["prestatario_nombre"], "Ana Torres")
        self.assertEqual(fila["gestor_nombre"], "Ana Torres")
        self.assertEqual(fila["dano"], "dano_parcial")
        self.assertEqual(fila["deduccion_dano"], 30)
        self.assertEqual(fila["cobro_economico"], "40.00")
        self.assertIn("reporte_url", fila)
        self.assertTrue(fila["reporte_url"].endswith(".pdf"))

    def test_listado_como_administrador_devuelve_200(self):
        self._iniciar_sesion(self.administrador)


```

**Tool: bash**

**Input:**
```json
{
  "command": "grep -n 'CAMPOS_REPORTE\\|CAMPOS\\|reportes' backend/apps/prestamos/tests.py | sed -n '1,100p'",
  "workdir": "/home/shiarowo/PERSONAL/Presticad"
}
```

**Output:**
```
911:    CAMPOS_PUBLICOS = {
974:        self.assertEqual(set(datos[0]), self.CAMPOS_PUBLICOS)
1004:    CAMPOS_HISTORIAL = {
1074:        self.assertEqual(set(prestamo), self.CAMPOS_HISTORIAL)
2810:    """Listado paginado de reportes de daños para su consulta (RN10, T11.14)."""
2816:            "admin-reportes@unsa.edu.pe", "10000025", rol="administrador"
2819:            "gestor-reportes@unsa.edu.pe", "10000026", rol="gestor"
2821:        self.url = "/api/prestamos/devoluciones/reportes/"

```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 2.8s)

_Thinking:_

Need complete ReportesDanos rest for table structure.

**Tool: bash**

**Input:**
```json
{
  "command": "sed -n '200,320p' frontend/src/pages/ReportesDanos.jsx",
  "workdir": "/home/shiarowo/PERSONAL/Presticad"
}
```

**Output:**
```
                  <td className="px-4 py-3">
                    <span className="block font-semibold">{reporte.material_nombre}</span>
                    <span className="block text-xs text-texto-suave">
                      Código de Material: {reporte.material_codigo}
                      {reporte.codigo_ejemplar && <> · Código de Ejemplar: {reporte.codigo_ejemplar}</>}
                    </span>
                  </td>
                  <td className="px-4 py-3">{reporte.prestatario_nombre}</td>
                  <td className="px-4 py-3">{reporte.gestor_nombre}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {fechaLegible(reporte.fecha_devolucion)}
                  </td>
                  <td className="px-4 py-3">
                    <BadgeEstado
                      estado={VARIANTES_DANO[reporte.dano] ?? 'desconocido'}
                      texto={ETIQUETAS_DANO[reporte.dano] ?? reporte.dano}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        reporte.puntos_delta >= 0
                          ? 'font-semibold text-acento-700'
                          : 'font-semibold text-error'
                      }
                    >
                      {firmarPuntos(reporte.puntos_delta)} pts
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {moneda(reporte.cobro_economico)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Boton
                      variante="secundario"
                      tamanio="pequeno"
                      tipo="button"
                      icono={Download}
                      onClick={() =>
                        window.open(reporte.reporte_url, '_blank', 'noopener,noreferrer')}
                    >
                      Descargar
                    </Boton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {count > 0 && (
        <nav className="mt-6 flex flex-wrap items-center justify-center gap-3" aria-label="Páginas de reportes">
          <Boton
            variante="secundario"
            tipo="button"
            deshabilitado={!previous}
            onClick={() => setPagina((actual) => actual - 1)}
          >
            Anterior
          </Boton>
          <span className="text-sm text-texto-suave" aria-live="polite">
            Página {pagina} de {totalPaginas} · {count} reportes
          </span>
          <Boton
            variante="secundario"
            tipo="button"
            deshabilitado={!next}
            onClick={() => setPagina((actual) => actual + 1)}
          >
            Siguiente
          </Boton>
        </nav>
      )}
    </section>
  )
}

function CabeceraReportes() {
  return (
    <header>
      <h2 className="text-xl font-bold text-texto">Reportes de daños</h2>
      <p className="mt-1 text-sm text-texto-suave">
        Listado de reportes PDF generados ante daños en las devoluciones. Descarga cada
        reporte para su archivo.
      </p>
    </header>
  )
}

export default ReportesDanos

```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 2.9s)

_Thinking:_

Need reports generated maybe only PDF. Add to PDF and list.

Need inspect `ReporteDevolucionTestCase` tests only PDF header. We can add test reading text? PDF compressed maybe use pypdf? requirements? Check.

**Tool: bash**

**Input:**
```json
{
  "command": "cat backend/requirements.txt && grep -n 'pypdf\\|PyPDF' -R backend",
  "workdir": "/home/shiarowo/PERSONAL/Presticad"
}
```

**Output:**
```
Django==6.1.1
djangorestframework==3.18.1
django-cors-headers==4.9.0
psycopg[binary]==3.3.6
python-dotenv==1.1.1
Pillow==12.3.0
django-cloudinary-storage==0.3.0
cloudinary==1.46.2
reportlab==5.0.1
gunicorn==23.0.0
phonenumbers~=8.13.52

```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 7.6s)

_Thinking:_

No pypdf. Could test source function output contains? PDF text compressed. Could mock paragraphs? Or just unit test data helper if refactor `_datos_prestamo`? Maybe not. We can add test with `unittest.mock.patch` on `Paragraph`? Better add a pure helper `_tipo_prestamo(prestamo)` maybe test. But to verify PDF contains label, if PDF uses text and uncompressed? Reportlab usually compresses? Could inspect actual bytes string with `b"Excepci"` maybe not due encoding. Existing tests likely not. We can add source-level? Not ideal.

Better create pure helper `datos_prestamo_reporte(prestamo, devolucion)`? Too much. Could add test using `pypdf` not installed. Could check via reportlab? Maybe PDF text could appear as hex string. We can generate and search for "Excepci" bytes with `extract` not. But test can assert no? Perhaps use `pdfplumber` not.

Could install? No.

Alternative test with mock: patch `apps.prestamos.reportes.Paragraph` and inspect call args? But then all flow broken? Could patch only wrapper? We can test a small helper returning rows. Maybe refactor to include `_datos_prestamo` helper and unit test. But not necessary perhaps. Yet quality.

Need also maybe "reportes generados" could mean report list, which we will test. PDF change straightforward.

Need implement reusable badge component maybe also include in report list. Let's create:
`frontend/src/components/prestamos/BadgeExcepcionAcademica.jsx`
```
function BadgeExcepcionAcademica({ className='' }) { return <span className={`inline-flex... ${className}`}>Excepción académica</span>}
```
Use `bg-violet...`? Tailwind theme maybe only marca/acento. Existing accent. Use `bg-amber-100 text-amber-900 ring-amber-300 dark...` but palette? Tailwind supports. Could use `aviso` style same as BadgeEstado. Maybe distinguish: use border dashed? Simpler:
```
className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900 ring-1 ring-amber-300 dark:bg-amber-500/20 dark:text-amber-200 dark:ring-amber-700/60"
```
No icon to keep simple.

But `BadgeEstado` currently `aviso` is same amber accent. Exception could be red? Not error. Use violet maybe `bg-purple-50 text-purple-700 ring-purple-200`. Tailwind 4 default supports. But app palette maybe custom. Could use `bg-acento-100 text-acento-900 ring-acento-300` same as aviso; okay but distinguish label. Maybe use `border border-dashed`? I'd use `bg-amber-50 ...`. Let's check existing color tokens.

**Tool: bash**

**Input:**
```json
{
  "command": "grep -RIn 'amber-\\|purple-\\|violet-' frontend/src | head -30 && sed -n '1,160p' frontend/src/index.css 2>/dev/null || grep -RIn '@theme' frontend/src --include='*.css'",
  "workdir": "/home/shiarowo/PERSONAL/Presticad"
}
```

**Output:**
```
frontend/src/components/TarjetaMaterial.jsx:96:                  <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
frontend/src/components/FichaTecnicaModal.jsx:166:                  <div className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
frontend/src/components/FichaTecnicaModal.jsx:168:                      className="size-5 shrink-0 text-amber-600 dark:text-amber-400"
frontend/src/components/FichaTecnicaModal.jsx:173:                      <p className="mt-0.5 text-amber-800 dark:text-amber-300">
frontend/src/components/FichaTecnicaModal.jsx:243:                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 font-medium text-amber-700 ring-1 ring-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-800">
frontend/src/components/FichaTecnicaModal.jsx:244:                      <span className="size-1.5 rounded-full bg-amber-600" />
frontend/src/components/ui/AdvertenciaModal.jsx:30:        className="w-full max-w-lg rounded-xl border border-amber-300 bg-superficie p-6 shadow-2xl dark:border-amber-700"
frontend/src/components/ui/AdvertenciaModal.jsx:32:        <h2 id="advertencia-modal-titulo" className="text-lg font-bold text-amber-800 dark:text-amber-300">
frontend/src/components/MaterialForm.jsx:830:              <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
frontend/src/components/MaterialForm.jsx:1027:              <span aria-hidden="true" className="mr-1 font-bold text-amber-600 dark:text-amber-400">*</span>
frontend/src/estilos.css:16:@theme {
frontend/src/estilos.css:71:@theme inline {

```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 6.9s)

_Thinking:_

Use amber.

Need decide whether remove `textoEstadoPrestamo`. Could keep but not use? Better replace usages with plain state, remove function/test. But maybe some value if "Activo - Excepción". User now wants tag. Remove to avoid redundancy. Deletion from tests. Do.

Need update `BadgeEstado`? no.

Need maybe `ListaPrestamos` current state visible and exception. Add badge next to state:
```
<div className="flex flex-wrap items-center gap-2">
 <BadgeEstado estado=... />
 {prestamo.es_excepcion && <BadgeExcepcionAcademica />}
</div>
```
Same in history, select, detail, devolution. Maybe `ReportesDanos`.

Need `HistorialPrestamos` pagination serializer includes flag. Already. `MisPrestamos` includes. `Seleccionar` uses history endpoint includes. Good.

Need `DetallePrestamo` serializer includes. Good.

Need `PrestamoDevolucionDetalle` includes. Good.

Need `ReporteDevolucionSerializer` add `es_excepcion = serializers.BooleanField(source="prestamo.es_excepcion", read_only=True)` and fields. Then UI.

Need PDF modify:
- Add `ETIQUETA_TIPO` perhaps.
- top after "Emitido..." add if exception:
```
if prestamo.es_excepcion:
  historia.append(Paragraph("PRÉSTAMO POR EXCEPCIÓN ACADÉMICA", estilos["excepcion"]))
```
Add style `excepcion` red/amber. Could make a table row. Add row in `datos_prestamo`: `("Tipo de préstamo", "Excepción académica" if ... else "Regular")`.
- In sanctions row:
```
etiqueta_dano = "Deducción por daño (duplicada por excepción académica)" if exception else "Deducción por daño"
```
Maybe show base:
```
if exception and base not None and base != ded: value = f"-{ded} pts (base {base} x2)"
```
Need ensure old result without base. Use `.get`.
- Add note above sanctions? Fine.

Need maybe include exception in report filename? No.

Need perhaps report list filter for exception? User didn't ask, only show label. Could add in table. No filter.

Need maybe report list API test assert `es_excepcion`. Add.

Need maybe "consistency at all times" in PDF and UI. Maybe also include `es_excepcion` in `DevolucionResultadoSerializer`? Result itself doesn't know. Could add to response views? `_respuesta_resultado` could add `es_excepcion` from prestamo? But frontend detail already. Not necessary. Yet "at all times" maybe devolution success should show badge; it has detalle flag. Good.

Need maybe PDFs generated by report query? The list is not PDF. Fine.

Need maybe `reporte` generation only for damage. If no damage no PDF. Only exceptions with no damage won't have report. But user says reports generated. Fine.

Need maybe audit in admin? Search admin templates.

**Tool: bash**

**Input:**
```json
{
  "command": "find backend -path '*templates*' -type f | head -50 && grep -RIn 'Prestamo\\|prestamo' backend --include='*.html' | head -80",
  "workdir": "/home/shiarowo/PERSONAL/Presticad"
}
```

**Output:**
```
(no output)
```

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 599.6s)

---

## User

procede con la implementacion

---

## Assistant (Build · DeepSeek V4.1 Flash Free · 15.0s)

---

