"""Servicios transaccionales del módulo de reservas, lista de espera y autopromoción."""
from datetime import timedelta

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Case, IntegerField, Q, Value, When
from django.utils import timezone

from apps.compartido.constants import MAXIMO_DURACION_PACTADA_MINUTOS
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
    MINUTO_RESERVA_MAXIMO_FIN,
    HORAS_ESPERA,
    MENSAJES_ERROR_RESERVA,
    MINIMO_MINUTOS_RESERVA,
    TOLERANCIA_RECOJO_MINUTOS,
)
from apps.reservas.disponibilidad import (
    hay_solapamiento,
    obtener_dia_no_laborable,
    obtener_instancias_disponibles_en_rango,
    verificar_instancia_disponible_en_rango,
)
from apps.reservas.models import DiaNoLaborable, Reserva
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
    """Ordena determinísticamente la cola: fecha_solicitud (FIFO) -> Tier -> id (RN11)."""
    return queryset.annotate(
        _orden_tier=Case(
            When(usuario__reputacion_tier="avanzado", then=Value(0)),
            When(usuario__reputacion_tier="estandar", then=Value(1)),
            When(usuario__reputacion_tier="restringido", then=Value(2)),
            default=Value(9),
            output_field=IntegerField(),
        ),
    ).order_by("fecha_solicitud", "_orden_tier", "id")


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


def _validar_sin_prestamos_vencidos(usuario_id, ahora=None):
    from apps.prestamos.services import tiene_prestamos_vencidos

    if tiene_prestamos_vencidos(usuario_id, ahora=ahora):
        raise ReservaError(
            "reserva",
            MENSAJES_ERROR_RESERVA["prestamos_vencidos_pendiente"],
            status_code=409,
        )



def _validar_justificacion(justificacion):
    justificacion_limpia = str(justificacion or "").strip()
    if not justificacion_limpia:
        raise ReservaError("justificacion", MENSAJES_ERROR_RESERVA["justificacion_obligatoria"])
    return justificacion_limpia


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
            )
            .filter(
                Q(es_excepcion=False) | Q(excepcion_aprobada=True)
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

    promovidas = []
    instancias_asignadas_ids = set()
    for reserva in candidatas_vigentes:
        instancia = None
        if reserva.fecha_inicio and reserva.fecha_fin:
            libres = list(
                obtener_instancias_disponibles_en_rango(
                    material.id,
                    reserva.fecha_inicio,
                    reserva.fecha_fin,
                    bloquear_filas=True,
                ).exclude(id__in=instancias_asignadas_ids)
            )
            if libres:
                instancia = libres[0]
        else:
            instancia = (
                InstanciaMaterial.objects.select_for_update()
                .filter(material_id=material.id, estado="disponible")
                .exclude(id__in=instancias_asignadas_ids)
                .order_by("codigo_ejemplar")
                .first()
            )

        if instancia is not None:
            instancias_asignadas_ids.add(instancia.id)
            try:
                servicios_inventario.marcar_instancia_reservada(
                    material.id,
                    instancia_id=instancia.id,
                )
                instancia.estado = "reservado"
            except servicios_inventario.InventarioError:
                pass
            reserva.instancia = instancia
            reserva.estado = "reservada"
            reserva.fecha_confirmacion = ahora
            # Mismo criterio que `crear_reserva`: el plazo de recojo es el fin del
            # rango reservado; las 24 h solo aplican a datos antiguos sin rango.
            reserva.fecha_limite_recojo = reserva.fecha_inicio + timedelta(minutes=TOLERANCIA_RECOJO_MINUTOS)
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


def contar_dias_fin_de_semana(fecha_inicio, fecha_fin):
    """Cuenta cuántos sábados y domingos completos existen entre dos fechas laborables."""
    if not fecha_inicio or not fecha_fin or fecha_fin <= fecha_inicio:
        return 0
    inicio_local = timezone.localtime(fecha_inicio) if timezone.is_aware(fecha_inicio) else fecha_inicio
    fin_local = timezone.localtime(fecha_fin) if timezone.is_aware(fecha_fin) else fecha_fin
    if inicio_local.weekday() >= 5 or fin_local.weekday() >= 5:
        return 0
    cursor = inicio_local.date() + timedelta(days=1)
    limite = fin_local.date()
    dias_fin_semana = 0
    while cursor < limite:
        if cursor.weekday() in (5, 6):
            dias_fin_semana += 1
        cursor += timedelta(days=1)
    return dias_fin_semana


def calcular_minutos_habiles(fecha_inicio, fecha_fin):
    """Calcula la duración en minutos entre dos fechas (todos los días intermedios cuentan)."""
    if not fecha_inicio or not fecha_fin:
        return 0
    return max(0, int((fecha_fin - fecha_inicio).total_seconds() // 60))


def _validar_horario_reserva(
    fecha_inicio,
    fecha_fin,
    *,
    maximo_minutos=None,
    ahora=None,
):
    """Valida que la reserva esté dentro del horario de atención y días laborables.
    Recojo y devolución pactados deben quedar de lunes a viernes entre 08:00 y 17:30.
    Todos los días intermedios (incluyendo fines de semana) cuentan en el cálculo de duración."""
    ahora = ahora or timezone.now()
    if fecha_inicio is None or fecha_fin is None:
        campo = "fecha_inicio" if fecha_inicio is None else "fecha_fin"
        raise ReservaError(campo, "Debe indicar la fecha y hora de inicio y fin de la reserva.")
    if fecha_inicio <= ahora:
        raise ReservaError("fecha_inicio", "La fecha de inicio debe ser posterior al momento actual.")
    for etiqueta, valor in (("fecha_inicio", fecha_inicio), ("fecha_fin", fecha_fin)):
        valor_local = timezone.localtime(valor) if timezone.is_aware(valor) else valor
        if valor_local.weekday() not in DIAS_LABORABLES:
            raise ReservaError(
                etiqueta,
                "Solo se permite reservar de lunes a viernes (días laborables).",
            )
        dia_inhabilitado = obtener_dia_no_laborable(valor_local)
        if dia_inhabilitado is not None:
            raise ReservaError(
                etiqueta,
                f"El día {valor_local.strftime('%d/%m/%Y')} está inhabilitado ({dia_inhabilitado.motivo}). Selecciona otro día laborable.",
            )
        minutos_dia = valor_local.hour * 60 + valor_local.minute
        if not (HORA_RESERVA_MINIMO_INICIO * 60 <= minutos_dia <= HORA_RESERVA_MAXIMO_FIN * 60 + 30):
            raise ReservaError(
                etiqueta,
                f"El horario pactado es de {HORA_RESERVA_MINIMO_INICIO:02d}:00 a "
                f"{HORA_RESERVA_MAXIMO_FIN:02d}:{MINUTO_RESERVA_MAXIMO_FIN:02d}.",
            )

    if fecha_fin <= fecha_inicio:
        raise ReservaError(
            "fecha_fin",
            "La fecha y hora de fin debe ser posterior a la de inicio.",
        )

    minutos_habiles = calcular_minutos_habiles(fecha_inicio, fecha_fin)
    if minutos_habiles < MINIMO_MINUTOS_RESERVA:
        raise ReservaError(
            "fecha_fin",
            "La reserva debe tener una duración mínima de 1 hora (60 minutos).",
        )
    maximo_configurado = maximo_minutos or MAXIMO_DURACION_PACTADA_MINUTOS
    maximo_efectivo = min(maximo_configurado, MAXIMO_DURACION_PACTADA_MINUTOS)
    if minutos_habiles > maximo_efectivo:
        from apps.prestamos.constants import formatear_duracion_minutos

        limite_legible = formatear_duracion_minutos(maximo_efectivo)
        raise ReservaError(
            "fecha_fin",
            f"La duración de la reserva supera el tiempo máximo permitido para este material ({limite_legible}).",
        )


@transaction.atomic
def crear_reserva(
    *,
    usuario,
    material_id,
    justificacion,
    instancia_id=None,
    fecha_inicio=None,
    fecha_fin=None,
    ahora=None,
):
    """Confirma una reserva normal solo si hay un ejemplar libre en ese rango.

    Orden de bloqueo consistente:
    1. Usuario (`select_for_update`)
    2. Material (`select_for_update`)
    3. Ejemplar libre durante todo el rango solicitado
    """
    ahora = ahora or timezone.now()
    _validar_usuario_prestatario(usuario)
    justificacion_limpia = _validar_justificacion(justificacion)

    material = _obtener_material_bloqueado(material_id)

    # Para materiales de Tier avanzado, inicio y fin deben ser el mismo día; solo se eligen horas.
    _validar_horario_reserva(
        fecha_inicio,
        fecha_fin,
        maximo_minutos=material.tiempo_maximo_prestamo,
        ahora=ahora,
    )

    usuario_bloqueado = (
        Usuario.objects.select_for_update().select_related("rol").get(pk=usuario.pk)
    )
    _validar_usuario_prestatario(usuario_bloqueado)
    _validar_sin_prestamos_vencidos(usuario_bloqueado.pk, ahora=ahora)

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

    instancia_elegida = None
    if instancia_id is not None:
        try:
            instancia_candidata = (
                InstanciaMaterial.objects.select_for_update()
                .get(pk=instancia_id, material_id=material.id)
            )
        except (InstanciaMaterial.DoesNotExist, ValueError, TypeError):
            raise ReservaError(
                "instancia_id",
                "No existe la instancia indicada para este material.",
                status_code=404,
            )
        if fecha_inicio and fecha_fin:
            disponible_rango = verificar_instancia_disponible_en_rango(
                instancia_candidata.id, fecha_inicio, fecha_fin
            )
            if not disponible_rango:
                raise ReservaError(
                    "instancia_id",
                    "La instancia seleccionada no está disponible en el horario solicitado.",
                    status_code=409,
                )
        elif instancia_candidata.estado != "disponible":
            raise ReservaError(
                "instancia_id",
                "La instancia seleccionada no está disponible para reservar.",
                status_code=409,
            )
        instancia_elegida = instancia_candidata
    elif material.estado != "en_mantenimiento":
        if fecha_inicio and fecha_fin:
            instancia_elegida = obtener_instancias_disponibles_en_rango(
                material.id, fecha_inicio, fecha_fin, bloquear_filas=True
            ).first()
        else:
            instancia_elegida = (
                InstanciaMaterial.objects.select_for_update()
                .filter(material_id=material.id, estado="disponible")
                .order_by("codigo_ejemplar")
                .first()
            )

    if instancia_elegida is None:
        raise ReservaError(
            "fecha_inicio",
            "No hay ejemplares disponibles durante el rango seleccionado. Elige otro horario.",
            status_code=409,
        )

    fecha_limite_recojo = (
        fecha_inicio + timedelta(minutes=TOLERANCIA_RECOJO_MINUTOS)
        if fecha_inicio else ahora + timedelta(minutes=TOLERANCIA_RECOJO_MINUTOS)
    )

    if instancia_elegida is not None:
        try:
            servicios_inventario.marcar_instancia_reservada(
                material.id,
                instancia_id=instancia_elegida.id,
            )
            instancia_elegida.estado = "reservado"
        except servicios_inventario.InventarioError:
            pass
        reserva = Reserva.objects.create(
            usuario=usuario_bloqueado,
            material=material,
            instancia=instancia_elegida,
            justificacion=justificacion_limpia,
            estado="reservada",
            es_excepcion=False,
            fecha_solicitud=ahora,
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
            fecha_confirmacion=ahora,
            fecha_limite_recojo=fecha_limite_recojo,
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
    justificacion,
    documento_identidad,
    compromiso_responsabilidad,
    fecha_inicio=None,
    fecha_fin=None,
    ahora=None,
):
    """Crea una solicitud excepcional para un prestatario Restringido o Estándar (HU06, HU13)."""
    ahora = ahora or timezone.now()
    _validar_usuario_prestatario(usuario)
    justificacion_limpia = _validar_justificacion(justificacion)
    _validar_documentos_garantia_reserva(documento_identidad, compromiso_responsabilidad)

    usuario_bloqueado = (
        Usuario.objects.select_for_update().select_related("rol").get(pk=usuario.pk)
    )
    _validar_usuario_prestatario(usuario_bloqueado)
    _validar_sin_prestamos_vencidos(usuario_bloqueado.pk, ahora=ahora)
    material = _obtener_material_bloqueado(material_id)
    _validar_horario_reserva(
        fecha_inicio,
        fecha_fin,
        maximo_minutos=material.tiempo_maximo_prestamo,
        ahora=ahora,
    )

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

    if not obtener_instancias_disponibles_en_rango(
        material.id, fecha_inicio, fecha_fin, bloquear_filas=True
    ).exists():
        raise ReservaError(
            "fecha_inicio",
            "No hay ejemplares disponibles durante el rango seleccionado. Elige otro horario.",
            status_code=409,
        )

    reserva = Reserva.objects.create(
        usuario=usuario_bloqueado,
        material=material,
        instancia=None,
        justificacion=justificacion_limpia,
        estado="en_espera",
        es_excepcion=True,
        fecha_solicitud=ahora,
        fecha_inicio=fecha_inicio,
        fecha_fin=fecha_fin,
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
    """Aprueba una excepción y asigna un ejemplar libre para su rango."""
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
    if reserva.excepcion_aprobada:
        raise ReservaError(
            "estado",
            "La excepción académica ya fue aprobada previamente.",
            status_code=409,
        )

    if reserva.fecha_inicio and reserva.fecha_fin:
        instancia = obtener_instancias_disponibles_en_rango(
            reserva.material_id,
            reserva.fecha_inicio,
            reserva.fecha_fin,
            bloquear_filas=True,
        ).first()
    else:
        instancia = InstanciaMaterial.objects.select_for_update().filter(
            material_id=reserva.material_id, estado="disponible"
        ).order_by("codigo_ejemplar").first()
    if instancia is None:
        raise ReservaError(
            "fecha_inicio",
            "No hay ejemplares disponibles durante el rango solicitado. La solicitud no puede aprobarse.",
            status_code=409,
        )
    try:
        servicios_inventario.marcar_instancia_reservada(
            reserva.material_id, instancia_id=instancia.id
        )
    except servicios_inventario.InventarioError as error:
        raise ReservaError(error.campo, error.mensaje, status_code=error.status_code) from error
    instancia.estado = "reservado"

    reserva.instancia = instancia
    reserva.estado = "reservada"
    reserva.excepcion_aprobada = True
    reserva.fecha_confirmacion = ahora
    reserva.fecha_limite_recojo = (
        reserva.fecha_inicio + timedelta(minutes=TOLERANCIA_RECOJO_MINUTOS)
        if reserva.fecha_inicio else ahora + timedelta(minutes=TOLERANCIA_RECOJO_MINUTOS)
    )
    reserva.save(
        update_fields=(
            "instancia", "estado", "excepcion_aprobada", "fecha_confirmacion",
            "fecha_limite_recojo", "updated_at",
        )
    )
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
    """Procesa reservas confirmadas tras 30 min y solicitudes en espera tras 72 h (HU07)."""
    ahora = ahora or timezone.now()
    penalizacion = getattr(settings, "RESERVA_PENALIZACION_PUNTOS", 20)

    confirmadas_vencidas = list(
        Reserva.objects.select_for_update(of=("self",))
        .select_related("usuario", "material", "instancia")
        .filter(
            estado="reservada",
            fecha_limite_recojo__lt=ahora,
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
            actualizar_reputacion(
                reserva.usuario,
                -abs(penalizacion),
                tipo="sancion_reserva_vencida",
                puntos_solicitados=-abs(penalizacion),
                reserva_id=str(reserva.id),
                descripcion=f"Sanción por reserva expirada #{reserva.id} ({reserva.material.nombre})",
                fecha=ahora,
            )
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

    # Incluir también cualquier material que tenga solicitudes en espera (normales
    # o excepciones aprobadas) y ejemplares disponibles (respaldo periódico RN11 / HU08).
    materiales_con_espera = set(
        Reserva.objects.filter(estado="en_espera")
        .filter(Q(es_excepcion=False) | Q(excepcion_aprobada=True))
        .values_list("material_id", flat=True)
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
def cancelar_reserva(*, reserva_id, motivo="Cancelada por el usuario.", realizado_por=None, ahora=None):
    """Cancela una reserva activa (reservada o en espera) sin penalización y libera su ejemplar si tenía uno (HU07, HU08)."""
    ahora = ahora or timezone.now()
    motivo_limpio = str(motivo or "").strip() or "Cancelada por el usuario."

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

    if reserva.estado not in ESTADOS_ACTIVOS:
        raise ReservaError(
            "estado",
            MENSAJES_ERROR_RESERVA["estado_invalido_cancelar"],
            status_code=409,
        )

    if reserva.instancia_id:
        try:
            instancia_obj = InstanciaMaterial.objects.get(pk=reserva.instancia_id)
            if instancia_obj.estado == "reservado":
                servicios_inventario.liberar_instancia_reservada(
                    reserva.instancia_id,
                    estado_final="disponible",
                    disparar_autopromocion=False,
                )
        except (InstanciaMaterial.DoesNotExist, servicios_inventario.InventarioError):
            pass

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
    """Calcula la posición 1-based en la cola normal o excepción aprobada en espera."""
    if reserva.estado != "en_espera":
        return None
    if reserva.es_excepcion and not getattr(reserva, "excepcion_aprobada", False):
        return None
    ids_ordenados = list(
        _anotar_orden_cola(
            Reserva.objects.filter(
                material_id=reserva.material_id,
                estado="en_espera",
            ).filter(
                Q(es_excepcion=False) | Q(excepcion_aprobada=True)
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
            .filter(material_id=material.id, estado="en_espera")
            .filter(Q(es_excepcion=False) | Q(excepcion_aprobada=True))
        )
    )
    for indice, solicitud in enumerate(en_espera_normales, start=1):
        solicitud.posicion_cola = indice

    en_espera_excepciones = list(
        Reserva.objects.select_related("usuario", "material", "instancia")
        .filter(
            material_id=material.id,
            estado="en_espera",
            es_excepcion=True,
            excepcion_aprobada=False,
        )
        .order_by("fecha_solicitud", "id")
    )
    for solicitud in en_espera_excepciones:
        solicitud.posicion_cola = None

    reservas_confirmadas = list(
        _queryset_reservas_confirmadas_vigentes().filter(material_id=material.id)
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


def consultar_cola_general():
    """Devuelve el estado consolidado de todas las reservas (en espera y confirmadas) de todos los materiales."""
    en_espera_normales = list(
        _anotar_orden_cola(
            Reserva.objects.select_related("usuario", "material", "instancia")
            .filter(estado="en_espera")
            .filter(Q(es_excepcion=False) | Q(excepcion_aprobada=True))
        )
    )
    for indice, solicitud in enumerate(en_espera_normales, start=1):
        solicitud.posicion_cola = indice

    en_espera_excepciones = list(
        Reserva.objects.select_related("usuario", "material", "instancia")
        .filter(
            estado="en_espera",
            es_excepcion=True,
            excepcion_aprobada=False,
        )
        .order_by("fecha_solicitud", "id")
    )
    for solicitud in en_espera_excepciones:
        solicitud.posicion_cola = None

    reservas_confirmadas = list(_queryset_reservas_confirmadas_vigentes())

    return {
        "material": None,
        "en_espera": en_espera_normales + en_espera_excepciones,
        "en_espera_normales": en_espera_normales,
        "en_espera_excepciones": en_espera_excepciones,
        "reservas_confirmadas": reservas_confirmadas,
        "instancias_disponibles": [],
    }


def _queryset_reservas_confirmadas_vigentes(ahora=None):
    ahora = ahora or timezone.now()
    return (
        Reserva.objects.select_related("usuario", "material", "instancia")
        .filter(
            estado="reservada",
            instancia__isnull=False,
            instancia__estado="reservado",
            fecha_limite_recojo__gte=ahora,
        )
        .order_by("fecha_limite_recojo", "fecha_confirmacion", "id")
    )


def obtener_reserva_confirmada_para_conversion(reserva_id, *, ahora=None):
    """Obtiene una reserva que conserva un ejemplar reservado y aún puede convertirse."""
    return _queryset_reservas_confirmadas_vigentes(ahora=ahora).filter(pk=reserva_id).first()


def consultar_reservas_confirmadas(dni=None, *, ahora=None):
    """Lista las reservas confirmadas vigentes para convertirlas en préstamo, filtrando opcionalmente por DNI."""
    queryset = _queryset_reservas_confirmadas_vigentes(ahora=ahora)
    if dni is not None:
        dni_limpio = str(dni).strip()
        if dni_limpio:
            queryset = queryset.filter(usuario__dni__startswith=dni_limpio)
    return queryset


def listar_dias_no_laborables(desde=None, hasta=None):
    """Lista los días inhabilitados por administración ordenados por fecha."""
    queryset = DiaNoLaborable.objects.select_related("creado_por").all()
    if desde is not None:
        queryset = queryset.filter(fecha__gte=desde)
    if hasta is not None:
        queryset = queryset.filter(fecha__lte=hasta)
    return queryset


def _contar_reservas_en_fecha(fecha_objetivo):
    """Cuenta reservas confirmadas cuyo recojo o devolución cae en `fecha_objetivo`."""
    from datetime import datetime, time

    tz = timezone.get_current_timezone()
    inicio_dia = timezone.make_aware(datetime.combine(fecha_objetivo, time(0, 0)), tz)
    fin_dia = timezone.make_aware(datetime.combine(fecha_objetivo, time(23, 59, 59)), tz)
    return (
        Reserva.objects.filter(
            estado="reservada",
            fecha_inicio__isnull=False,
            fecha_fin__isnull=False,
        )
        .filter(
            Q(fecha_inicio__range=(inicio_dia, fin_dia))
            | Q(fecha_fin__range=(inicio_dia, fin_dia))
        )
        .count()
    )


@transaction.atomic
def crear_dia_no_laborable(*, fecha, motivo, creado_por):
    """Inhabilita un día laborable específico (feriado, cierre, mantenimiento)."""
    motivo_limpio = str(motivo or "").strip()
    if not motivo_limpio:
        raise ReservaError("motivo", "El motivo de inhabilitación es obligatorio.")
    if fecha.weekday() not in DIAS_LABORABLES:
        raise ReservaError(
            "fecha",
            "Los sábados y domingos ya son días no laborables por defecto.",
        )
    if DiaNoLaborable.objects.filter(fecha=fecha).exists():
        raise ReservaError(
            "fecha",
            f"El día {fecha.strftime('%d/%m/%Y')} ya se encuentra inhabilitado.",
            status_code=409,
        )
    registro = DiaNoLaborable.objects.create(
        fecha=fecha,
        motivo=motivo_limpio,
        creado_por=creado_por,
    )
    reservas_afectadas = _contar_reservas_en_fecha(fecha)
    return registro, reservas_afectadas


@transaction.atomic
def eliminar_dia_no_laborable(dia_id):
    """Vuelve a habilitar un día previamente marcado como no laborable."""
    try:
        registro = DiaNoLaborable.objects.get(pk=dia_id)
    except (DiaNoLaborable.DoesNotExist, ValueError, TypeError) as error:
        raise ReservaError(
            "dia_id",
            "No existe el día no laborable indicado.",
            status_code=404,
        ) from error
    registro.delete()
