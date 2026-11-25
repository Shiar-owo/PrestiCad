"""Lógica de dominio para cálculo de solapamiento temporal y disponibilidad en calendario (HU06, HU08)."""
from datetime import date, datetime, time, timedelta

from django.db.models import Q
from django.utils import timezone

from apps.inventario.models import InstanciaMaterial, Material
from apps.prestamos.constants import ESTADOS_QUE_OCUPAN_UNIDAD
from apps.prestamos.models import Prestamo
from apps.reservas.constants import (
    DIAS_LABORABLES,
    HORA_RESERVA_MAXIMO_FIN,
    HORA_RESERVA_MINIMO_INICIO,
    MINUTO_RESERVA_MAXIMO_FIN,
    TOLERANCIA_RECOJO_MINUTOS,
)


def hay_solapamiento(inicio_a, fin_a, inicio_b, fin_b):
    """Determina si dos intervalos de tiempo abiertos/cerrados se solapan estrictamente."""
    if not (inicio_a and fin_a and inicio_b and fin_b):
        return False
    return inicio_a < fin_b and fin_a > inicio_b


def _normalizar_fecha_local(valor):
    """Convierte date o datetime (naive o aware) a date en zona horaria local."""
    if valor is None:
        return None
    if isinstance(valor, datetime):
        if timezone.is_aware(valor):
            return timezone.localtime(valor).date()
        return valor.date()
    return valor


def obtener_dia_no_laborable(fecha_valor):
    """Devuelve el registro `DiaNoLaborable` si la fecha fue inhabilitada por un admin."""
    from apps.reservas.models import DiaNoLaborable

    fecha_local = _normalizar_fecha_local(fecha_valor)
    if fecha_local is None:
        return None
    return DiaNoLaborable.objects.filter(fecha=fecha_local).first()


def obtener_mapa_dias_no_laborables(desde, hasta):
    """Obtiene en una consulta el mapa `{date: DiaNoLaborable}` del rango indicado."""
    from apps.reservas.models import DiaNoLaborable

    return {
        registro.fecha: registro
        for registro in DiaNoLaborable.objects.filter(fecha__gte=desde, fecha__lte=hasta)
    }


def obtener_instancias_disponibles_en_rango(
    material_id,
    fecha_inicio,
    fecha_fin,
    *,
    excluir_reserva_id=None,
    excluir_prestamo_id=None,
    bloquear_filas=False,
):
    """Devuelve las instancias operativas del material libres de préstamos y reservas en el rango.

    Una instancia está libre si:
    1. No está en mantenimiento ni dada de baja física.
    2. No tiene ningún préstamo activo o vencido que solape [fecha_inicio, fecha_fin].
    3. No tiene ninguna reserva confirmada ('reservada') que solape [fecha_inicio, fecha_fin].
    """
    if fecha_inicio is None or fecha_fin is None:
        return InstanciaMaterial.objects.none()

    instancias = InstanciaMaterial.objects.filter(material_id=material_id).exclude(
        estado__in=["en_mantenimiento", "de_baja"]
    )
    if bloquear_filas:
        instancias = instancias.select_for_update()

    # IDs de instancias ocupadas por préstamos vigentes que cruzan el rango
    prestamos_ocupantes = Prestamo.objects.filter(
        material_id=material_id,
        instancia_id__isnull=False,
        estado__in=ESTADOS_QUE_OCUPAN_UNIDAD,
        fecha_entrega__lt=fecha_fin,
        fecha_limite__gt=fecha_inicio - timedelta(minutes=TOLERANCIA_RECOJO_MINUTOS),
    )
    if excluir_prestamo_id:
        prestamos_ocupantes = prestamos_ocupantes.exclude(pk=excluir_prestamo_id)
    instancias_con_prestamo = prestamos_ocupantes.values_list("instancia_id", flat=True)

    # IDs de instancias ocupadas por reservas confirmadas que cruzan el rango
    from apps.reservas.models import Reserva

    reservas_ocupantes = Reserva.objects.filter(
        material_id=material_id,
        instancia_id__isnull=False,
        estado="reservada",
        fecha_inicio__isnull=False,
        fecha_fin__isnull=False,
        fecha_inicio__lt=fecha_fin,
        fecha_fin__gt=fecha_inicio - timedelta(minutes=TOLERANCIA_RECOJO_MINUTOS),
    )
    if excluir_reserva_id:
        reservas_ocupantes = reservas_ocupantes.exclude(pk=excluir_reserva_id)
    instancias_con_reserva = reservas_ocupantes.values_list("instancia_id", flat=True)

    instancias_ocupadas = set(instancias_con_prestamo) | set(instancias_con_reserva)

    return instancias.exclude(id__in=instancias_ocupadas).order_by("codigo_ejemplar")


def verificar_instancia_disponible_en_rango(
    instancia_id,
    fecha_inicio,
    fecha_fin,
    *,
    excluir_reserva_id=None,
    excluir_prestamo_id=None,
):
    """Comprueba si una instancia específica no tiene colisiones en el rango solicitado."""
    if not instancia_id or not fecha_inicio or not fecha_fin:
        return False

    try:
        instancia = InstanciaMaterial.objects.get(pk=instancia_id)
    except (InstanciaMaterial.DoesNotExist, ValueError, TypeError):
        return False

    if instancia.estado in ("en_mantenimiento", "de_baja"):
        return False

    prestamo_choca = Prestamo.objects.filter(
        instancia_id=instancia.id,
        estado__in=ESTADOS_QUE_OCUPAN_UNIDAD,
        fecha_entrega__lt=fecha_fin,
        fecha_limite__gt=fecha_inicio - timedelta(minutes=TOLERANCIA_RECOJO_MINUTOS),
    )
    if excluir_prestamo_id:
        prestamo_choca = prestamo_choca.exclude(pk=excluir_prestamo_id)
    if prestamo_choca.exists():
        return False

    from apps.reservas.models import Reserva

    reserva_choca = Reserva.objects.filter(
        instancia_id=instancia.id,
        estado="reservada",
        fecha_inicio__isnull=False,
        fecha_fin__isnull=False,
        fecha_inicio__lt=fecha_fin,
        fecha_fin__gt=fecha_inicio - timedelta(minutes=TOLERANCIA_RECOJO_MINUTOS),
    )
    if excluir_reserva_id:
        reserva_choca = reserva_choca.exclude(pk=excluir_reserva_id)
    if reserva_choca.exists():
        return False

    return True


def consultar_disponibilidad_calendario(
    material_id,
    desde=None,
    hasta=None,
    *,
    incluir_prestatario=False,
):
    """Devuelve el resumen de disponibilidad día por día para visualización de calendario.

    Para cada día del rango, calcula cuántos ejemplares están disponibles y qué franjas
    se encuentran ocupadas por reservas o préstamos activos, considerando días inhabilitados.
    """
    ahora = timezone.now()
    hoy = timezone.localtime(ahora).date()
    if desde is None:
        desde = hoy
    elif isinstance(desde, str):
        desde = datetime.strptime(desde, "%Y-%m-%d").date()

    if hasta is None:
        hasta = desde + timedelta(days=30)
    elif isinstance(hasta, str):
        hasta = datetime.strptime(hasta, "%Y-%m-%d").date()

    material = Material.objects.prefetch_related("instancias").get(pk=material_id)
    total_ejemplares = material.instancias.exclude(estado__in=["en_mantenimiento", "de_baja"]).count()
    if total_ejemplares == 0:
        total_ejemplares = material.stock if material.estado != "en_mantenimiento" else 0

    tz = timezone.get_current_timezone()

    inicio_dt = timezone.make_aware(datetime.combine(desde, time(0, 0)), tz)
    fin_dt = timezone.make_aware(datetime.combine(hasta, time(23, 59, 59)), tz)

    mapa_no_laborables = obtener_mapa_dias_no_laborables(desde, hasta)

    # Préstamos en el rango
    prestamos = list(
        Prestamo.objects.select_related("instancia", "usuario")
        .filter(
            material_id=material.id,
            estado__in=ESTADOS_QUE_OCUPAN_UNIDAD,
            fecha_entrega__lt=fin_dt,
            fecha_limite__gt=inicio_dt - timedelta(minutes=TOLERANCIA_RECOJO_MINUTOS),
        )
        .order_by("fecha_entrega")
    )

    # Reservas confirmadas en el rango
    from apps.reservas.models import Reserva

    reservas = list(
        Reserva.objects.select_related("instancia", "usuario")
        .filter(
            material_id=material.id,
            estado="reservada",
            fecha_inicio__isnull=False,
            fecha_fin__isnull=False,
            fecha_inicio__lt=fin_dt,
            fecha_fin__gt=inicio_dt - timedelta(minutes=TOLERANCIA_RECOJO_MINUTOS),
        )
        .order_by("fecha_inicio")
    )

    dias_resultado = []
    cursor = desde
    while cursor <= hasta:
        dia_inicio_dt = timezone.make_aware(
            datetime.combine(cursor, time(HORA_RESERVA_MINIMO_INICIO, 0)), tz
        )
        dia_fin_dt = timezone.make_aware(
            datetime.combine(cursor, time(HORA_RESERVA_MAXIMO_FIN, MINUTO_RESERVA_MAXIMO_FIN)), tz
        )
        dia_inhabilitado = mapa_no_laborables.get(cursor)
        es_laborable = (cursor.weekday() in DIAS_LABORABLES) and (dia_inhabilitado is None)

        # Ejemplares libres en el horario de atención de este día
        ejemplares_libres_dia = obtener_instancias_disponibles_en_rango(
            material.id, dia_inicio_dt, dia_fin_dt
        ).count() if (total_ejemplares > 0 and es_laborable) else 0

        # Franjas ocupadas este día
        franjas_dia = []
        for p in prestamos:
            if hay_solapamiento(dia_inicio_dt, dia_fin_dt, p.fecha_entrega, p.fecha_limite + timedelta(minutes=TOLERANCIA_RECOJO_MINUTOS)):
                entrada = {
                    "tipo": "prestamo",
                    "id": str(p.id),
                    "codigo_ejemplar": p.instancia.codigo_ejemplar if p.instancia else "",
                    "inicio": p.fecha_entrega.isoformat(),
                    "fin": (p.fecha_limite + timedelta(minutes=TOLERANCIA_RECOJO_MINUTOS)).isoformat(),
                }
                if incluir_prestatario and p.usuario:
                    entrada["prestatario"] = f"{p.usuario.nombre} {p.usuario.apellido}".strip()
                franjas_dia.append(entrada)

        for r in reservas:
            if hay_solapamiento(dia_inicio_dt, dia_fin_dt, r.fecha_inicio, r.fecha_fin + timedelta(minutes=TOLERANCIA_RECOJO_MINUTOS)):
                entrada = {
                    "tipo": "reserva",
                    "id": str(r.id),
                    "codigo_ejemplar": r.instancia.codigo_ejemplar if r.instancia else "",
                    "inicio": r.fecha_inicio.isoformat(),
                    "fin": (r.fecha_fin + timedelta(minutes=TOLERANCIA_RECOJO_MINUTOS)).isoformat(),
                }
                if incluir_prestatario and r.usuario:
                    entrada["prestatario"] = f"{r.usuario.nombre} {r.usuario.apellido}".strip()
                franjas_dia.append(entrada)

        dias_resultado.append(
            {
                "fecha": cursor.isoformat(),
                "es_laborable": es_laborable,
                "es_dia_inhabilitado": dia_inhabilitado is not None,
                "motivo_inhabilitado": dia_inhabilitado.motivo if dia_inhabilitado else "",
                "disponible": bool(es_laborable and ejemplares_libres_dia > 0 and cursor >= hoy),
                "ejemplares_libres": ejemplares_libres_dia if es_laborable else 0,
                "ejemplares_totales": total_ejemplares,
                "ocupaciones": franjas_dia,
            }
        )
        cursor += timedelta(days=1)

    return {
        "material_id": str(material.id),
        "total_ejemplares": total_ejemplares,
        "dias": dias_resultado,
    }
