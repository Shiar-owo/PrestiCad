import json
import re

from django.conf import settings
from rest_framework import serializers

from apps.compartido.serializers import RechazarCamposNoPermitidosMixin
from apps.prestamos.constants import (
    ESTADOS_CHECKLIST_DEVOLUCION,
    MAXIMO_DIAS_PRESTAMO,
    MINIMO_DIGITOS_BUSQUEDA_PRESTATARIO,
    TAMANO_MAXIMO_SOLICITUD_BYTES,
)
from apps.prestamos.models import Devolucion, Garantia, Prestamo
from apps.prestamos.validators import validar_foto_checklist, validar_pdf_garantia


def _validar_tamano_total_archivos(archivos):
    total = sum(getattr(archivo, "size", 0) for archivo in archivos if archivo)
    if total > TAMANO_MAXIMO_SOLICITUD_BYTES:
        raise serializers.ValidationError({
            "archivos": [
                "El total de archivos de la solicitud no debe superar 4 MB."
            ],
        })


class ChecklistInicialItemSerializer(serializers.Serializer):
    elemento = serializers.CharField(max_length=100)
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

class BusquedaPrestatarioSerializer(serializers.Serializer):
    """Valida el prefijo de DNI usado para sugerir prestatarios al gestor."""

    dni = serializers.CharField(max_length=8, allow_blank=False, trim_whitespace=True)

    def validate_dni(self, value):
        minimo = MINIMO_DIGITOS_BUSQUEDA_PRESTATARIO
        if not re.fullmatch(rf"\d{{{minimo},8}}", value):
            raise serializers.ValidationError(
                f"El DNI de búsqueda debe contener entre {minimo} y 8 dígitos."
            )
        return value


class FiltroHistorialPrestamosSerializer(serializers.Serializer):
    """Valida el DNI completo opcional del filtro de historial global."""

    dni = serializers.CharField(max_length=8, allow_blank=False, trim_whitespace=True)

    def validate_dni(self, value):
        if not re.fullmatch(r"\d{8}", value):
            raise serializers.ValidationError(
                "El DNI debe tener exactamente 8 dígitos numéricos."
            )
        return value


class ActualizarDocumentoGarantiaSerializer(serializers.Serializer):
    """Valida el reemplazo o eliminación de un documento PDF de garantía."""

    archivo = serializers.FileField(
        required=False,
        allow_empty_file=False,
        validators=[validar_pdf_garantia],
    )
    eliminar = serializers.BooleanField(required=False, default=False)

    def validate(self, attrs):
        if bool(attrs.get("archivo")) == attrs["eliminar"]:
            raise serializers.ValidationError(
                "Adjunta un PDF para reemplazar o indica que deseas eliminar el documento."
            )
        return attrs


class RegistrarPrestamoSerializer(
    RechazarCamposNoPermitidosMixin,
    serializers.Serializer,
):
    dni_prestatario = serializers.CharField(max_length=8)
    material_id = serializers.UUIDField()
    instancia_id = serializers.UUIDField(required=False)
    tiempo_prestamo_dias = serializers.IntegerField(
        min_value=1,
        max_value=MAXIMO_DIAS_PRESTAMO,
        error_messages={
            "min_value": "El tiempo de préstamo debe ser al menos un día.",
            "max_value": f"La duración máxima del préstamo es de {MAXIMO_DIAS_PRESTAMO} días.",
        },
    )
    checklist_inicial = ChecklistInicialItemSerializer(many=True, allow_empty=False)
    fotos_checklist = serializers.ListField(
        child=serializers.ImageField(validators=[validar_foto_checklist]),
        write_only=True,
        required=False,
    )
    documento_identidad = serializers.FileField(
        required=False,
        validators=[validar_pdf_garantia],
    )
    compromiso_responsabilidad = serializers.FileField(
        required=False,
        validators=[validar_pdf_garantia],
    )

    def to_internal_value(self, data):
        checklist = data.get("checklist_inicial") if hasattr(data, "get") else None
        if isinstance(checklist, str):
            try:
                checklist = json.loads(checklist)
            except (TypeError, ValueError) as error:
                raise serializers.ValidationError({
                    "checklist_inicial": "El checklist inicial debe ser una lista JSON válida.",
                }) from error
            if hasattr(data, "getlist"):
                data = {campo: data.get(campo) for campo in data.keys()}
            else:
                data = dict(data)
            data["checklist_inicial"] = checklist
        if isinstance(checklist, list):
            if hasattr(data, "keys"):
                datos = {
                    campo: data.get(campo)
                    for campo in data.keys()
                }
            else:
                datos = dict(data)
            fotos = [datos.get(f"foto_checklist_{indice}") for indice in range(len(checklist))]
            for indice in range(len(checklist)):
                datos.pop(f"foto_checklist_{indice}", None)
            indices_sin_foto = [
                indice
                for indice, foto in enumerate(fotos)
                if foto is None
            ]
            if indices_sin_foto:
                errores = {
                    indice: [
                        (
                            f'El elemento «{str(checklist[indice].get("elemento", "")).strip()}» '
                            "requiere una foto."
                            if isinstance(checklist[indice], dict)
                            else f"La fila {indice + 1} requiere una foto."
                        )
                    ]
                    for indice in indices_sin_foto
                }
                raise serializers.ValidationError({"fotos_checklist": errores})
            datos["fotos_checklist"] = fotos
            data = datos
        return super().to_internal_value(data)

    def validate(self, attrs):
        datos_iniciales = self.initial_data
        archivos_permitidos = {
            f"foto_checklist_{indice}"
            for indice in range(len(attrs["checklist_inicial"]))
        }
        if hasattr(datos_iniciales, "keys"):
            self.initial_data = {
                campo: datos_iniciales.get(campo)
                for campo in datos_iniciales.keys()
                if campo not in archivos_permitidos
            }
        try:
            super().validate(attrs)
        finally:
            self.initial_data = datos_iniciales

        if len(attrs.get("fotos_checklist", [])) != len(attrs["checklist_inicial"]):
            raise serializers.ValidationError({
                "fotos_checklist": "Adjunta una foto por cada elemento del checklist inicial.",
            })
        _validar_tamano_total_archivos([
            attrs.get("documento_identidad"),
            attrs.get("compromiso_responsabilidad"),
            *attrs.get("fotos_checklist", []),
        ])
        return attrs

    def validate_dni_prestatario(self, value):
        dni = value.strip()
        if not re.fullmatch(r"\d{8}", dni):
            raise serializers.ValidationError("El DNI debe tener exactamente 8 dígitos.")
        return dni


class PrestamoRegistroSerializer(serializers.ModelSerializer):
    usuario_id = serializers.IntegerField(source="usuario.id", read_only=True)
    usuario_nombre = serializers.SerializerMethodField()
    material_id = serializers.UUIDField(source="material.id", read_only=True)
    material_nombre = serializers.CharField(source="material.nombre", read_only=True)
    material_codigo = serializers.CharField(
        source="material.codigo_inventario",
        read_only=True,
    )
    instancia_id = serializers.UUIDField(read_only=True, allow_null=True)
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

    Los parámetros de paginación (`page`, `page_size`) los valida el
    paginador, por eso el usuario de la vista los excluye antes de validar.
    """

    dano = serializers.ChoiceField(
        choices=ESTADOS_CHECKLIST_DEVOLUCION,
        required=False,
    )
    fecha_desde = serializers.DateField(required=False)
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
        source="prestamo.material.codigo_inventario",
        read_only=True,
    )
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

    def get_gestor_nombre(self, devolucion):
        gestor = devolucion.realizado_por
        return f"{gestor.nombre} {gestor.apellido}".strip()

    def get_reporte_url(self, devolucion):
        return url_reporte_publica(devolucion)
