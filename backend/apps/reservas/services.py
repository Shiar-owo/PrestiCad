"""Servicios transaccionales del módulo de reservas, lista de espera y autopromoción."""
from datetime import timedelta

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Case, IntegerField, Value, When
from django.utils import timezone

from apps.inventario import services as servicios_inventario
from apps.inventario.constants import TIERS_ACCESIBLES
from apps.inventario.models import InstanciaMaterial, Material
from apps.prestamos.constants import TAMANO_MAXIMO_SOLICITUD_BYTES
from apps.prestamos.services import (
    PrestamoError,
    crear_garantia_registrada,
    obtener_documento_garantia_reserva as _obtener_documento_garantia_reserva_prestamo,
)
from apps.prestamos.validators import validar_pdf_garantia
from apps.reservas.constants import (
    DIAS_LABORABLES,
    ESTADOS_ACTIVOS,
    HORA_RESERVA_MAXIMO_FIN,
    HORA_RESERVA_MINIMO_INICIO,
    HORARIO_ATENCION_FIN,
    HORARIO_ATENCION_INICIO,
    HORAS_ESPERA,
    HORAS_RECOJO,
    MENSAJES_ERROR_RESERVA,
    TOLERANCIA_RECOJO_MINUTOS,
    VALORES_PRIORIDAD_RESERVA,
)
from apps.reservas.models import Reserva
from apps.usuarios.models import Usuario
from apps.usuarios.services import actualizar_reputacion


class ReservaError(Exception):
    """Error de dominio y validación del módulo de reservas."""

    def __init__(self, campo, mensaje, status_code=400):
        self.campo = campo
        self.mensaje = mensaje
        self.status_code = status_code
        super().__init__(mensaje)


def _anotar_orden_cola(queryset):
    """Ordena determinísticamente la cola: prioridad -> fecha_solicitud -> Tier -> id (RN11)."""
    return queryset.annotate(
        _orden_prioridad=Case(
            When(prioridad="alta", then=Value(0)),
            When(prioridad="media", then=Value(1)),
            When(prioridad="baja", then=Value(2)),
            default=Value(9),
            output_field=IntegerField(),
        ),
        _orden_tier=Case(
            When(usuario__reputacion_tier="avanzado", then=Value(0)),
            When(usuario__reputacion_tier="estandar", then=Value(1)),
            When(usuario__reputacion_tier="restringido", then=Value(2)),
            default=Value(9),
            output_field=IntegerField(),
        ),
    ).order_by("_orden_prioridad", "fecha_solicitud", "_orden_tier", "id")


def _validar_usuario_prestatario(usuario):
    if usuario is None or not getattr(usuario, "id", None):
        raise ReservaError(
            "usuario",
            MENSAJES_ERROR_RESERVA["solo_prestatario"],
            status_code=403,
        )
    rol_nombre = getattr(getattr(usuario, "rol", None), "nombre", None)
    if rol_nombre != "prestatario":
        raise ReservaError(
            "usuario",
            MENSAJES_ERROR_RESERVA["solo_prestatario"],
            status_code=403,
        )
    if usuario.estado != "activo":
        raise ReservaError(
            "usuario",
            MENSAJES_ERROR_RESERVA["usuario_inactivo"],
            status_code=403,
        )


def _obtener_material_bloqueado(material_id):
    try:
        return Material.objects.select_for_update().get(pk=material_id)
    except (Material.DoesNotExist, ValueError, TypeError) as error:
        raise ReservaError(
            "material_id",
            MENSAJES_ERROR_RESERVA["material_no_encontrado"],
            status_code=404,
        ) from error


def _validar_maximo_reservas_activas(usuario_id):
    maximo = getattr(settings, "MAXIMO_RESERVAS_ACTIVAS", 3)
    activas = Reserva.objects.filter(
        usuario_id=usuario_id,
        estado__in=ESTADOS_ACTIVOS,
    ).count()
    if activas >= maximo:
        raise ReservaError(
            "reserva",
            f"{MENSAJES_ERROR_RESERVA['maximo_reservas_activas']} (máximo {maximo}).",
            status_code=409,
        )


def _validar_campos_solicitud(prioridad, justificacion):
    prioridad_limpia = str(prioridad or "").strip().lower()
    if prioridad_limpia not in VALORES_PRIORIDAD_RESERVA:
        raise ReservaError("prioridad", MENSAJES_ERROR_RESERVA["prioridad_invalida"])

    justificacion_limpia = str(justificacion or "").strip()
    if not justificacion_limpia:
        raise ReservaError("justificacion", MENSAJES_ERROR_RESERVA["justificacion_obligatoria"])

    return prioridad_limpia, justificacion_limpia


@transaction.atomic
def autopromover_material(material_id, *, ahora=None):
    """Promueve atómicamente solicitudes normales en espera mientras existan ejemplares libres.

    Orden de bloqueo consistente para evitar deadlocks:
    1. Material (`select_for_update`)
    2. Reservas candidatas en espera (`select_for_update(of=("self",))`)
    3. Instancias disponibles del material (`select_for_update`)
    """
    ahora = ahora or timezone.now()
    try:
        material = Material.objects.select_for_update().get(pk=material_id)
    except (Material.DoesNotExist, ValueError, TypeError):
        return []

    candidatas = list(
        _anotar_orden_cola(
            Reserva.objects.select_for_update(of=("self",))
            .select_related("usuario", "material")
            .filter(
                material_id=material.id,
                estado="en_espera",
                es_excepcion=False,
            )
        )
    )
    if not candidatas:
        return []

    candidatas_vigentes = []
    for reserva in candidatas:
        if reserva.fecha_limite_espera and reserva.fecha_limite_espera < ahora:
            reserva.estado = "expirada"
            reserva.save(update_fields=["estado", "updated_at"])
        else:
            candidatas_vigentes.append(reserva)

    if not candidatas_vigentes:
        return []

    instancias_disponibles = list(
        InstanciaMaterial.objects.select_for_update()
        .filter(material_id=material.id, estado="disponible")
        .order_by("codigo_ejemplar")
    )
    if not instancias_disponibles:
        return []

    promovidas = []
    for reserva, instancia in zip(candidatas_vigentes, instancias_disponibles):
        servicios_inventario.marcar_instancia_reservada(
            material.id,
            instancia_id=instancia.id,
        )
        instancia.estado = "reservado"
        reserva.instancia = instancia
        reserva.estado = "reservada"
        reserva.fecha_confirmacion = ahora
        reserva.fecha_limite_recojo = ahora + timedelta(hours=HORAS_RECOJO)
        reserva.save(
            update_fields=[
                "instancia",
                "estado",
                "fecha_confirmacion",
                "fecha_limite_recojo",
                "updated_at",
            ]
        )
        promovidas.append(reserva)

    return promovidas


def _validar_horario_reserva(fecha_inicio, fecha_fin):
    """Valida que la reserva esté dentro del horario de atención y días laborables."""
    for etiqueta, valor in (("fecha_inicio", fecha_inicio), ("fecha_fin", fecha_fin)):
        if valor.weekday() not in DIAS_LABORABLES:
            raise ReservaError(
                etiqueta,
                "La reserva solo puede realizarse de lunes a viernes (días laborables).",
            )
        minutos_dia = valor.hour * 60 + valor.minute
        if not (
            HORA_RESERVA_MINIMO_INICIO * 60 <= minutos_dia <= HORA_RESERVA_MAXIMO_FIN * 60
        ):
            raise ReservaError(
                etiqueta,
                f"La reserva debe estar dentro del horario de atención "
                f"({HORA_RESERVA_MINIMO_INICIO}:00 a {HORA_RESERVA_MAXIMO_FIN}:00).",
            )
    if fecha_fin <= fecha_inicio:
        raise ReservaError(
            "fecha_fin",
            "La fecha y hora de fin debe ser posterior a la de inicio.",
        )


@transaction.atomic
def crear_reserva(
    *,
    usuario,
    material_id,
    prioridad,
    justificacion,
    instancia_id=None,
    fecha_inicio=None,
    fecha_fin=None,
    ahora=None,
):
    """Crea una solicitud de reserva normal o la registra en lista de espera (HU06).

    Orden de bloqueo consistente:
    1. Usuario (`select_for_update`)
    2. Material (`select_for_update`)
    3. Autopromoción previa de la cola existente
    4. Instancia disponible (si no queda cola pendiente)
    """
    ahora = ahora or timezone.now()
    _validar_usuario_prestatario(usuario)
    prioridad_limpia, justificacion_limpia = _validar_campos_solicitud(prioridad, justificacion)

    if fecha_inicio is not None or fecha_fin is not None:
        _validar_horario_reserva(fecha_inicio, fecha_fin)

    usuario_bloqueado = (
        Usuario.objects.select_for_update().select_related("rol").get(pk=usuario.pk)
    )
    _validar_usuario_prestatario(usuario_bloqueado)
    material = _obtener_material_bloqueado(material_id)

    tiers_permitidos = TIERS_ACCESIBLES.get(usuario_bloqueado.reputacion_tier, ())
    if material.tier_minimo_requerido not in tiers_permitidos:
        if usuario_bloqueado.reputacion_tier in ("restringido", "estandar"):
            raise ReservaError(
                "material_id",
                MENSAJES_ERROR_RESERVA["tier_insuficiente_excepcion_disponible"],
                status_code=400,
            )
        raise ReservaError(
            "material_id",
            MENSAJES_ERROR_RESERVA["tier_insuficiente"],
            status_code=400,
        )

    _validar_maximo_reservas_activas(usuario_bloqueado.id)

    # RN11 / HU06 criterio 5: antes de confirmar una nueva solicitud normal,
    # autopromover la cola existente para que no se salte a quienes ya esperan.
    autopromover_material(material.id, ahora=ahora)

    cola_pendiente = Reserva.objects.filter(
        material_id=material.id,
        estado="en_espera",
        es_excepcion=False,
    ).exists()

    instancia_elegida = None
    if instancia_id is not None:
        try:
            instancia_elegida = (
                InstanciaMaterial.objects.select_for_update()
                .get(pk=instancia_id, material_id=material.id)
            )
        except (InstanciaMaterial.DoesNotExist, ValueError, TypeError):
            raise ReservaError(
                "instancia_id",
                "No existe la instancia indicada para este material.",
                status_code=404,
            )
        if instancia_elegida.estado != "disponible":
            raise ReservaError(
                "instancia_id",
                "La instancia seleccionada no está disponible para reservar.",
                status_code=409,
            )
    elif not cola_pendiente and material.estado != "en_mantenimiento":
        instancia_elegida = (
            InstanciaMaterial.objects.select_for_update()
            .filter(material_id=material.id, estado="disponible")
            .order_by("codigo_ejemplar")
            .first()
        )

    fecha_limite_recojo = fecha_fin or (ahora + timedelta(hours=HORAS_RECOJO))

    if instancia_elegida is not None:
        servicios_inventario.marcar_instancia_reservada(
            material.id,
            instancia_id=instancia_elegida.id,
        )
        instancia_elegida.estado = "reservado"
        reserva = Reserva.objects.create(
            usuario=usuario_bloqueado,
            material=material,
            instancia=instancia_elegida,
            prioridad=prioridad_limpia,
            justificacion=justificacion_limpia,
            estado="reservada",
            es_excepcion=False,
            fecha_solicitud=ahora,
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
            fecha_confirmacion=ahora,
            fecha_limite_espera=ahora + timedelta(hours=HORAS_ESPERA),
            fecha_limite_recojo=fecha_limite_recojo,
        )
    else:
        reserva = Reserva.objects.create(
            usuario=usuario_bloqueado,
            material=material,
            instancia=None,
            prioridad=prioridad_limpia,
            justificacion=justificacion_limpia,
            estado="en_espera",
            es_excepcion=False,
            fecha_solicitud=ahora,
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
            fecha_limite_espera=ahora + timedelta(hours=HORAS_ESPERA),
        )

    return reserva


def _validar_documentos_garantia_reserva(documento_identidad, compromiso_responsabilidad):
    documentos = (
        ("documento_identidad", documento_identidad, "El documento de identidad en PDF"),
        (
            "compromiso_responsabilidad",
            compromiso_responsabilidad,
            "El compromiso de responsabilidad en PDF",
        ),
    )
    for campo, archivo, descripcion in documentos:
        if archivo is None:
            raise ReservaError(
                campo,
                f"{descripcion} es obligatorio para reservas excepcionales.",
            )
        try:
            validar_pdf_garantia(archivo)
        except ValidationError as error:
            raise ReservaError(campo, error.messages[0]) from error

    total_bytes = sum(getattr(archivo, "size", 0) for _, archivo, _ in documentos if archivo)
    if total_bytes > TAMANO_MAXIMO_SOLICITUD_BYTES:
        raise ReservaError(
            "archivos",
            "El total de archivos de la solicitud no debe superar 4 MB.",
        )


@transaction.atomic
def crear_reserva_excepcional(
    *,
    usuario,
    material_id,
    prioridad,
    justificacion,
    documento_identidad,
    compromiso_responsabilidad,
    ahora=None,
):
    """Crea una solicitud excepcional para un prestatario Restringido o Estándar (HU06, HU13)."""
    ahora = ahora or timezone.now()
    _validar_usuario_prestatario(usuario)
    prioridad_limpia, justificacion_limpia = _validar_campos_solicitud(prioridad, justificacion)
    _validar_documentos_garantia_reserva(documento_identidad, compromiso_responsabilidad)

    usuario_bloqueado = (
        Usuario.objects.select_for_update().select_related("rol").get(pk=usuario.pk)
    )
    _validar_usuario_prestatario(usuario_bloqueado)
    material = _obtener_material_bloqueado(material_id)

    tiers_permitidos = TIERS_ACCESIBLES.get(usuario_bloqueado.reputacion_tier, ())
    aplica_excepcion = (
        usuario_bloqueado.reputacion_tier in ("restringido", "estandar")
        and material.tier_minimo_requerido not in tiers_permitidos
    )
    if not aplica_excepcion:
        raise ReservaError(
            "es_excepcion",
            MENSAJES_ERROR_RESERVA["excepcion_solo_restringido"],
            status_code=400,
        )

    _validar_maximo_reservas_activas(usuario_bloqueado.id)

    reserva = Reserva.objects.create(
        usuario=usuario_bloqueado,
        material=material,
        instancia=None,
        prioridad=prioridad_limpia,
        justificacion=justificacion_limpia,
        estado="en_espera",
        es_excepcion=True,
        fecha_solicitud=ahora,
        fecha_limite_espera=ahora + timedelta(hours=HORAS_ESPERA),
    )

    crear_garantia_registrada(
        documento_identidad=documento_identidad,
        compromiso_responsabilidad=compromiso_responsabilidad,
        reserva=reserva,
    )
    return reserva


@transaction.atomic
def aprobar_excepcion(*, reserva_id, realizado_por=None, ahora=None):
    """Aprueba una reserva excepcional asignándole un ejemplar disponible tras promover la cola normal (HU08, HU13)."""
    ahora = ahora or timezone.now()
    try:
        reserva = (
            Reserva.objects.select_for_update(of=("self",))
            .select_related("usuario", "material", "instancia")
            .get(pk=reserva_id)
        )
    except (Reserva.DoesNotExist, ValueError, TypeError) as error:
        raise ReservaError(
            "reserva_id",
            MENSAJES_ERROR_RESERVA["reserva_no_encontrada"],
            status_code=404,
        ) from error

    if not reserva.es_excepcion:
        raise ReservaError(
            "es_excepcion",
            "Solo las solicitudes por excepción académica pueden aprobarse mediante este flujo.",
            status_code=400,
        )
    if reserva.estado != "en_espera":
        raise ReservaError(
            "estado",
            "Solo se pueden aprobar solicitudes excepcionales que se encuentran en espera.",
            status_code=409,
        )
    if reserva.expiro(ahora):
        reserva.estado = "expirada"
        reserva.save(update_fields=["estado", "updated_at"])
        raise ReservaError(
            "estado",
            "La solicitud excepcional ha expirado y ya no puede aprobarse.",
            status_code=409,
        )
    if not reserva.garantia_completa:
        raise ReservaError(
            "garantia",
            "La solicitud excepcional requiere la garantía completa registrada (DNI y compromiso firmado).",
            status_code=409,
        )

    # Primero autopromover la cola normal para no saltar a quienes esperan con Tier suficiente
    autopromover_material(reserva.material_id, ahora=ahora)

    try:
        instancia_reservada = servicios_inventario.marcar_instancia_reservada(
            reserva.material_id,
        )
    except servicios_inventario.InventarioError as error:
        raise ReservaError(
            "instancia",
            MENSAJES_ERROR_RESERVA["sin_instancia_disponible"],
            status_code=409,
        ) from error

    reserva.instancia_id = instancia_reservada["id"]
    reserva.estado = "reservada"
    reserva.fecha_confirmacion = ahora
    reserva.fecha_limite_recojo = ahora + timedelta(hours=HORAS_RECOJO)
    reserva.save(
        update_fields=[
            "instancia",
            "estado",
            "fecha_confirmacion",
            "fecha_limite_recojo",
            "updated_at",
        ]
    )
    reserva.refresh_from_db()
    return reserva


def obtener_documento_garantia_reserva(reserva_id, tipo):
    """Obtiene el documento PDF de garantía asociado a una reserva excepcional."""
    try:
        return _obtener_documento_garantia_reserva_prestamo(reserva_id, tipo)
    except PrestamoError as error:
        raise ReservaError(
            error.campo,
            error.mensaje,
            status_code=error.status_code,
        ) from error


@transaction.atomic
def expirar_reservas(*, ahora=None):
    """Procesa vencimientos de reservas confirmadas (24 h) y solicitudes en espera (72 h) (HU07)."""
    ahora = ahora or timezone.now()
    penalizacion = getattr(settings, "RESERVA_PENALIZACION_PUNTOS", 20)

    confirmadas_vencidas = list(
        Reserva.objects.select_for_update(of=("self",))
        .select_related("usuario", "material", "instancia")
        .filter(
            estado="reservada",
            fecha_limite_recojo__lt=ahora - timedelta(minutes=TOLERANCIA_RECOJO_MINUTOS),
        )
        .order_by("fecha_limite_recojo", "id")
    )

    reservas_vencidas = 0
    instancias_liberadas = 0
    materiales_afectados = set()

    for reserva in confirmadas_vencidas:
        if reserva.instancia_id:
            try:
                servicios_inventario.liberar_instancia_reservada(
                    reserva.instancia_id,
                    estado_final="disponible",
                    disparar_autopromocion=False,
                )
                instancias_liberadas += 1
            except servicios_inventario.InventarioError:
                pass
        reserva.estado = "cancelada_por_vencimiento"
        reserva.motivo_cancelacion = MENSAJES_ERROR_RESERVA["motivo_vencimiento_recojo"]
        reserva.save(update_fields=["estado", "motivo_cancelacion", "updated_at"])
        if penalizacion > 0:
            actualizar_reputacion(reserva.usuario, -abs(penalizacion))
        reservas_vencidas += 1
        materiales_afectados.add(reserva.material_id)

    esperas_vencidas = list(
        Reserva.objects.select_for_update(of=("self",))
        .filter(
            estado="en_espera",
            fecha_limite_espera__lt=ahora,
        )
        .order_by("fecha_limite_espera", "id")
    )
    solicitudes_expiradas = 0
    for reserva in esperas_vencidas:
        reserva.estado = "expirada"
        reserva.save(update_fields=["estado", "updated_at"])
        solicitudes_expiradas += 1

    # Incluir también cualquier material que tenga solicitudes normales en espera
    # y ejemplares disponibles (respaldo periódico RN11 / HU08).
    materiales_con_espera = set(
        Reserva.objects.filter(
            estado="en_espera",
            es_excepcion=False,
        ).values_list("material_id", flat=True)
    )
    materiales_para_promover = materiales_afectados | materiales_con_espera

    reservas_promovidas = 0
    for mat_id in sorted(materiales_para_promover, key=str):
        promovidas = autopromover_material(mat_id, ahora=ahora)
        reservas_promovidas += len(promovidas)

    return {
        "reservas_vencidas": reservas_vencidas,
        "solicitudes_expiradas": solicitudes_expiradas,
        "instancias_liberadas": instancias_liberadas,
        "reservas_promovidas": reservas_promovidas,
    }


@transaction.atomic
def cancelar_reserva(*, reserva_id, motivo, realizado_por=None, ahora=None):
    """Cancela manualmente una reserva confirmada sin penalización y libera su ejemplar (HU07, HU08)."""
    ahora = ahora or timezone.now()
    motivo_limpio = str(motivo or "").strip()
    if not motivo_limpio:
        raise ReservaError("motivo", MENSAJES_ERROR_RESERVA["motivo_obligatorio"])

    try:
        reserva = (
            Reserva.objects.select_for_update(of=("self",))
            .select_related("usuario", "material", "instancia")
            .get(pk=reserva_id)
        )
    except (Reserva.DoesNotExist, ValueError, TypeError) as error:
        raise ReservaError(
            "reserva_id",
            MENSAJES_ERROR_RESERVA["reserva_no_encontrada"],
            status_code=404,
        ) from error

    if reserva.estado != "reservada":
        raise ReservaError(
            "estado",
            MENSAJES_ERROR_RESERVA["estado_invalido_cancelar"],
            status_code=409,
        )

    if reserva.instancia_id:
        servicios_inventario.liberar_instancia_reservada(
            reserva.instancia_id,
            estado_final="disponible",
            disparar_autopromocion=False,
        )

    reserva.estado = "cancelada"
    reserva.motivo_cancelacion = motivo_limpio
    reserva.save(update_fields=["estado", "motivo_cancelacion", "updated_at"])

    autopromover_material(reserva.material_id, ahora=ahora)
    return reserva


@transaction.atomic
def rechazar_reserva(*, reserva_id, motivo, realizado_por=None):
    """Rechaza una solicitud en espera (normal o excepcional) indicando el motivo (HU08)."""
    motivo_limpio = str(motivo or "").strip()
    if not motivo_limpio:
        raise ReservaError("motivo", MENSAJES_ERROR_RESERVA["motivo_obligatorio"])

    try:
        reserva = (
            Reserva.objects.select_for_update(of=("self",))
            .select_related("usuario", "material", "instancia")
            .get(pk=reserva_id)
        )
    except (Reserva.DoesNotExist, ValueError, TypeError) as error:
        raise ReservaError(
            "reserva_id",
            MENSAJES_ERROR_RESERVA["reserva_no_encontrada"],
            status_code=404,
        ) from error

    if reserva.estado != "en_espera":
        raise ReservaError(
            "estado",
            MENSAJES_ERROR_RESERVA["estado_invalido_rechazar"],
            status_code=409,
        )

    reserva.estado = "rechazada"
    reserva.motivo_rechazo = motivo_limpio
    reserva.save(update_fields=["estado", "motivo_rechazo", "updated_at"])
    return reserva


def calcular_posicion_en_cola(reserva):
    """Calcula la posición 1-based en la cola normal si la reserva está en espera y no es excepción."""
    if reserva.estado != "en_espera" or reserva.es_excepcion:
        return None
    ids_ordenados = list(
        _anotar_orden_cola(
            Reserva.objects.filter(
                material_id=reserva.material_id,
                estado="en_espera",
                es_excepcion=False,
            )
        ).values_list("id", flat=True)
    )
    try:
        return ids_ordenados.index(reserva.id) + 1
    except ValueError:
        return None


def consultar_mis_reservas(usuario_id):
    """Devuelve las reservas y solicitudes del prestatario autenticado."""
    return (
        Reserva.objects.select_related("usuario", "material", "instancia", "prestamo")
        .filter(usuario_id=usuario_id)
        .order_by("-fecha_solicitud", "-created_at")
    )


def consultar_cola_material(material_id):
    """Devuelve el estado consolidado de la cola de un material (en espera, confirmadas y disponibles)."""
    try:
        material = Material.objects.prefetch_related("instancias").get(pk=material_id)
    except (Material.DoesNotExist, ValueError, TypeError) as error:
        raise ReservaError(
            "material_id",
            MENSAJES_ERROR_RESERVA["material_no_encontrado"],
            status_code=404,
        ) from error

    en_espera_normales = list(
        _anotar_orden_cola(
            Reserva.objects.select_related("usuario", "material", "instancia")
            .filter(material_id=material.id, estado="en_espera", es_excepcion=False)
        )
    )
    for indice, solicitud in enumerate(en_espera_normales, start=1):
        solicitud.posicion_cola = indice

    en_espera_excepciones = list(
        Reserva.objects.select_related("usuario", "material", "instancia")
        .filter(material_id=material.id, estado="en_espera", es_excepcion=True)
        .order_by("fecha_solicitud", "id")
    )
    for solicitud in en_espera_excepciones:
        solicitud.posicion_cola = None

    reservas_confirmadas = list(
        Reserva.objects.select_related("usuario", "material", "instancia")
        .filter(material_id=material.id, estado="reservada")
        .order_by("fecha_limite_recojo", "fecha_confirmacion", "id")
    )
    instancias_disponibles = list(
        InstanciaMaterial.objects.filter(material_id=material.id, estado="disponible")
        .order_by("codigo_ejemplar")
    )

    return {
        "material": material,
        "en_espera": en_espera_normales + en_espera_excepciones,
        "en_espera_normales": en_espera_normales,
        "en_espera_excepciones": en_espera_excepciones,
        "reservas_confirmadas": reservas_confirmadas,
        "instancias_disponibles": instancias_disponibles,
    }


def consultar_reservas_confirmadas(dni=None, *, ahora=None):
    """Lista las reservas confirmadas vigentes para convertirlas en préstamo, filtrando opcionalmente por DNI."""
    ahora = ahora or timezone.now()
    queryset = (
        Reserva.objects.select_related("usuario", "material", "instancia")
        .filter(
            estado="reservada",
            instancia__isnull=False,
        )
        .exclude(fecha_limite_recojo__lt=ahora)
        .order_by("fecha_limite_recojo", "fecha_confirmacion", "id")
    )
    if dni is not None:
        dni_limpio = str(dni).strip()
        if dni_limpio:
            queryset = queryset.filter(usuario__dni__startswith=dni_limpio)
    return queryset
