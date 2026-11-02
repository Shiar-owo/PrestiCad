"""Capa de servicios: reglas de negocio del módulo inventario.

Las vistas son delgadas y delegan aquí. Los servicios NO acceden a tablas de
otros módulos; se comunican con ellos solo a través de sus propios servicios.
"""
import logging

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models.deletion import ProtectedError

from apps.inventario.constants import (
    DEFAULT_TIEMPO_MAXIMO_PRESTAMO_MINUTOS,
    ESTADOS_INICIALES_INSTANCIA,
    ESTADOS_INSTANCIA,
    ESTADOS_MATERIAL,
    MAXIMO_EJEMPLARES_REGISTRO,
    MAXIMO_TIEMPO_MAXIMO_PRESTAMO_MINUTOS,
    MINIMO_TIEMPO_MAXIMO_PRESTAMO_MINUTOS,
    TIEMPO_MAXIMO_DEFAULT_POR_TIER,
    UMBRAL_PRECIO_ALTO_VALOR,
)
from apps.inventario.models import InstanciaMaterial, Material
from apps.inventario.validators import validar_foto

logger = logging.getLogger(__name__)

# Campos que un gestor puede modificar sobre un material existente. Los
# identificadores y las marcas de tiempo quedan fuera a propósito: son
# invariantes del agregado.
CAMPOS_EDITABLES = frozenset(
    {
        "nombre",
        "descripcion",
        "codigo_material",
        "tipo",
        "estado",
        "es_alto_valor",
        "precio",
        "marca",
        "modelo",
        "numero_serie",
        "color",
        "foto",
        "tier_minimo_requerido",
        "tiempo_maximo_prestamo",
        "bonificacion_tiempo",
        "deduccion_tardanza",
        "deduccion_dano_parcial",
        "deduccion_dano_total",
        "costo_reparacion",
        "costo_reposicion",
        "stock",
    }
)

# Campos de texto donde se recortan espacios sobrantes al guardar. `foto` no
# aparece porque es un archivo: no tiene `.strip()`.
CAMPOS_TEXTO = (
    "descripcion",
    "marca",
    "modelo",
    "numero_serie",
    "color",
)

CODIGO_DUPLICADO_MENSAJE = "El Código de Material ya está registrado."


class InventarioError(Exception):
    """Error de negocio del módulo inventario.

    Lleva el campo, el mensaje en español y el estado HTTP para que el módulo
    consumidor traduzca el error a su respuesta sin conocer los modelos.
    """

    def __init__(self, campo, mensaje, status_code=400, indice=None):
        self.campo = campo
        self.mensaje = mensaje
        self.status_code = status_code
        self.indice = indice
        super().__init__(mensaje)


class MaterialNoEncontradoError(Exception):
    """No existe un material con el id indicado."""


def normalizar_codigo(codigo):
    """Normaliza el Código de Material para que la unicidad no dependa de mayúsculas."""
    return codigo.strip().upper()


def parametros_reputacion_por_defecto():
    """Devuelve una copia de los defaults de reputación indexados por Tier."""
    config = settings.MATERIALES_REPUTACION_DEFAULTS
    if all(isinstance(valores, dict) for valores in config.values()):
        return {tier: dict(valores) for tier, valores in config.items()}
    return dict(config)


def obtener_tiempo_maximo_por_defecto_tier(tier):
    """Devuelve el tiempo máximo de préstamo por defecto (en minutos) según el Tier del material."""
    return TIEMPO_MAXIMO_DEFAULT_POR_TIER.get(tier, DEFAULT_TIEMPO_MAXIMO_PRESTAMO_MINUTOS)


def _validar_tiempo_maximo_prestamo(valor):
    """Valida que el tiempo máximo de préstamo del material esté entre 30 minutos y 15 días."""
    if isinstance(valor, bool):
        raise InventarioError(
            "tiempo_maximo_prestamo",
            "El tiempo máximo de préstamo debe ser un número entero de minutos.",
        )
    try:
        minutos = int(valor)
    except (TypeError, ValueError) as exc:
        raise InventarioError(
            "tiempo_maximo_prestamo",
            "El tiempo máximo de préstamo debe ser un número entero de minutos.",
        ) from exc
    if (
        minutos < MINIMO_TIEMPO_MAXIMO_PRESTAMO_MINUTOS
        or minutos > MAXIMO_TIEMPO_MAXIMO_PRESTAMO_MINUTOS
    ):
        raise InventarioError(
            "tiempo_maximo_prestamo",
            f"El tiempo máximo de préstamo del material debe estar entre "
            f"{MINIMO_TIEMPO_MAXIMO_PRESTAMO_MINUTOS} minutos y 15 días "
            f"({MAXIMO_TIEMPO_MAXIMO_PRESTAMO_MINUTOS} minutos).",
        )
    return minutos


def obtener_material(material_id):
    """Devuelve un material por su id o lanza `MaterialNoEncontradoError`."""
    try:
        return Material.objects.get(pk=material_id)
    except (Material.DoesNotExist, ValueError, TypeError) as exc:
        raise MaterialNoEncontradoError(f"No existe un material con id={material_id}") from exc


@transaction.atomic
def eliminar_material(material_id):
    """Elimina un material y sus ejemplares cuando no tienen préstamos asociados."""
    material = obtener_material(material_id)
    instancias = list(material.instancias.all())

    if material.estado in ("prestado", "reservado") or any(
        instancia.estado in ("prestado", "reservado") for instancia in instancias
    ):
        raise InventarioError(
            "material",
            "No se puede eliminar un material prestado o reservado.",
            status_code=409,
        )

    fotos = []
    for elemento in [material, *instancias]:
        if elemento.foto:
            fotos.append((elemento.foto.storage, elemento.foto.name))

    try:
        material.delete()
    except ProtectedError as error:
        raise InventarioError(
            "material",
            "No se puede eliminar el material porque tiene historial de préstamos asociado.",
            status_code=409,
        ) from error

    for storage, nombre in fotos:
        transaction.on_commit(lambda storage=storage, nombre=nombre: _eliminar_foto(storage, nombre))


def listar_materiales():
    """Devuelve todos los materiales del inventario ordenados por nombre."""
    return Material.objects.all()


def buscar_materiales(
    q=None,
    *,
    categoria=None,
    tipo=None,
    estado=None,
):
    """Busca y filtra materiales del inventario según criterios de consulta (HU05, T05.01).

    - `q`: Búsqueda parcial e insensible a mayúsculas sobre el nombre del material (criterio 1).
    - `categoria` (o `tipo`): Filtra por tipo/categoría de material ('equipo', 'libro', 'objeto') (criterio 2).
    - `estado`: Filtra por estado ('disponible', 'prestado', 'reservado', 'en_mantenimiento') (criterio 3).
    Devuelve un `QuerySet` de `Material` ordenado alfabéticamente por nombre.
    """
    queryset = Material.objects.prefetch_related("instancias").all().order_by("nombre")

    if q:
        q_limpio = q.strip()
        if q_limpio:
            queryset = queryset.filter(nombre__icontains=q_limpio)

    filtro_tipo = categoria or tipo
    if filtro_tipo:
        filtro_tipo_limpio = filtro_tipo.strip().lower()
        if filtro_tipo_limpio:
            queryset = queryset.filter(tipo=filtro_tipo_limpio)

    if estado:
        estado_limpio = estado.strip().lower()
        if estado_limpio:
            queryset = queryset.filter(estado=estado_limpio)

    return queryset


@transaction.atomic
def registrar_material(
    *,
    nombre,
    codigo_material,
    tipo,
    estado="disponible",
    descripcion="",
    stock=1,
    es_alto_valor=None,
    precio=None,
    marca="",
    modelo="",
    numero_serie="",
    color="",
    foto=None,
    tier_minimo_requerido=None,
    tiempo_maximo_prestamo=None,
    bonificacion_tiempo=None,
    deduccion_tardanza=None,
    deduccion_dano_parcial=None,
    deduccion_dano_total=None,
    costo_reparacion=None,
    costo_reposicion=None,
    estado_inicial_ejemplares="disponible",
    modo=None,
    ubicacion="",
    observaciones="",
    instancias=None,
):
    """Registra un material en el inventario.

    Reglas de negocio (HU04):
    - El Código de Material es único en el sistema (criterio 4) y se
      normaliza a mayúsculas para que "inv-01" y "INV-01" sean el mismo
      material.
    - Cada ejemplar inicia disponible o en mantenimiento.
    - Se pueden registrar varias unidades del mismo material (criterio 5).
    - Los parámetros de reputación no informados se completan con los valores
      por defecto configurables (criterio 3, T04.04).
    - La foto es opcional y se valida antes de guardar: hasta 4 MB y en JPG,
      PNG o WEBP (criterio 1).

    Eleva `InventarioError` si el código ya está registrado o `ValidationError`
    si la foto no cumple las restricciones.
    """
    codigo = normalizar_codigo(codigo_material)
    try:
        _verificar_codigo_disponible(codigo)
    except InventarioError as error:
        error.status_code = 409
        raise

    nombre = nombre.strip()
    if not nombre:
        raise InventarioError("nombre", "El nombre del material es obligatorio.")
    if stock < 1:
        raise InventarioError("stock", "El stock debe ser al menos 1 unidad.")
    estados_iniciales_validos = {clave for clave, _ in ESTADOS_INICIALES_INSTANCIA}
    if not isinstance(estado, str) or estado not in estados_iniciales_validos:
        raise InventarioError("estado", "El estado inicial del material no es válido.")
    if not isinstance(estado_inicial_ejemplares, str) or estado_inicial_ejemplares not in estados_iniciales_validos:
        raise InventarioError(
            "estado_inicial_ejemplares",
            "El estado inicial de los ejemplares no es válido.",
        )
    filas = list(instancias or [])
    if modo == "unico":
        stock = 1
        filas = [{
            "codigo_ejemplar": f"{codigo}-01",
            "numero_serie": numero_serie,
            "ubicacion": ubicacion,
            "observaciones": observaciones,
            "estado": estado_inicial_ejemplares,
        }]
    elif modo is None:
        filas = [
            {
                "codigo_ejemplar": f"{codigo}-{i:02d}",
                "numero_serie": numero_serie if stock == 1 else "",
                "ubicacion": "",
                "estado": estado_inicial_ejemplares,
            }
            for i in range(1, stock + 1)
        ]
    elif modo in ("lote", "detalle"):
        if not 2 <= len(filas) <= MAXIMO_EJEMPLARES_REGISTRO:
            raise InventarioError(
                "instancias",
                f"Registra entre 2 y {MAXIMO_EJEMPLARES_REGISTRO} ejemplares.",
            )
        if stock != len(filas):
            raise InventarioError("stock", "El stock debe coincidir con la cantidad de ejemplares.")
    else:
        raise InventarioError("modo", "Modo de registro inválido.")
    if foto is not None:
        validar_foto(foto)

    codigos = set()
    filas_preparadas = []
    for indice, fila in enumerate(filas):
        if not isinstance(fila, dict):
            raise InventarioError("instancias", "La fila debe ser un objeto válido.", indice=indice)
        if modo in ("lote", None):
            codigo_fila = fila["codigo_ejemplar"] if modo is None else f"{codigo}-{indice + 1:02d}"
            ubicacion_fila = fila.get("ubicacion") or ubicacion
        else:
            codigo_fila = str(fila.get("codigo_ejemplar", "")).strip()
            if not codigo_fila:
                raise InventarioError("codigo_ejemplar", "El código del ejemplar es obligatorio.", indice=indice)
            ubicacion_fila = fila.get("ubicacion", "")
        estado_fila = fila.get("estado", estado_inicial_ejemplares)
        if modo == "detalle" and estado == "en_mantenimiento":
            estado_fila = "en_mantenimiento"
        if not isinstance(estado_fila, str) or estado_fila not in estados_iniciales_validos:
            raise InventarioError(
                "estado",
                "El estado inicial del ejemplar no es válido.",
                indice=indice,
            )
        clave = codigo_fila.casefold()
        if clave in codigos:
            raise InventarioError(
                "codigo_ejemplar", "El código del ejemplar está duplicado en el registro.", indice=indice
            )
        codigos.add(clave)
        if InstanciaMaterial.objects.filter(codigo_ejemplar__iexact=codigo_fila).exists():
            raise InventarioError(
                "codigo_ejemplar", "El código del ejemplar ya está registrado.", status_code=409, indice=indice
            )
        foto_fila = fila.get("foto")
        if foto_fila is None and modo in ("unico", "lote"):
            foto_fila = foto
        color_fila = fila.get("color", "")
        if not isinstance(color_fila, str):
            raise InventarioError("color", "El color del ejemplar debe ser texto.", indice=indice)
        if len(color_fila) > 30:
            raise InventarioError("color", "El color admite máximo 30 caracteres.", indice=indice)
        if foto_fila is not None:
            try:
                validar_foto(foto_fila)
            except ValidationError as error:
                raise InventarioError("foto", error.messages[0], indice=indice) from error
        if len(codigo_fila) > 50:
            raise InventarioError("codigo_ejemplar", "El código admite máximo 50 caracteres.", indice=indice)
        filas_preparadas.append({
            "codigo_ejemplar": codigo_fila,
            "numero_serie": "" if modo == "lote" else fila.get("numero_serie", ""),
            "estado": estado_fila,
            "ubicacion": ubicacion_fila,
            "observaciones": fila.get("observaciones", ""),
            "foto": foto_fila,
            "color": color_fila.strip(),
        })

    estado_material = estado
    if modo in ("unico", "lote"):
        estado_material = estado_inicial_ejemplares
    elif modo == "detalle" and filas_preparadas:
        if all(fila["estado"] == "en_mantenimiento" for fila in filas_preparadas):
            estado_material = "en_mantenimiento"
        elif all(fila["estado"] == "disponible" for fila in filas_preparadas):
            estado_material = "disponible"

    campos = {
        "nombre": nombre,
        "descripcion": descripcion.strip(),
        "codigo_material": codigo,
        "tipo": tipo,
        "stock": stock,
        "estado": estado_material,
        "es_alto_valor": es_alto_valor,
        "precio": precio,
        "marca": marca.strip(),
        "modelo": modelo.strip(),
        "numero_serie": numero_serie.strip() if modo in ("unico", None) else "",
        "color": color.strip(),
        "foto": foto,
    }

    reputacion = {
        "tier_minimo_requerido": tier_minimo_requerido,
        "bonificacion_tiempo": bonificacion_tiempo,
        "deduccion_tardanza": deduccion_tardanza,
        "deduccion_dano_parcial": deduccion_dano_parcial,
        "deduccion_dano_total": deduccion_dano_total,
        "costo_reparacion": costo_reparacion,
        "costo_reposicion": costo_reposicion,
    }
    if precio is not None and reputacion["costo_reposicion"] is None:
        reputacion["costo_reposicion"] = precio
    # Los parámetros no informados quedan con el valor por defecto configurable
    # (criterio 3): lo que sí llega, gana.
    precio_efectivo = 0 if precio is None else precio
    es_alto_valor = (
        precio_efectivo > UMBRAL_PRECIO_ALTO_VALOR
        if precio is not None
        else bool(es_alto_valor)
    )
    campos["precio"] = precio_efectivo
    campos["es_alto_valor"] = es_alto_valor
    todos_defaults = parametros_reputacion_por_defecto()
    forzar_avanzado = precio is not None and es_alto_valor
    if all(isinstance(v, dict) for v in todos_defaults.values()):
        tier = "avanzado" if forzar_avanzado else (reputacion["tier_minimo_requerido"] or "estandar")
        defaults = dict(todos_defaults[tier])
        defaults["tier_minimo_requerido"] = tier
    else:
        defaults = dict(todos_defaults)
        if forzar_avanzado:
            defaults["tier_minimo_requerido"] = "avanzado"
    defaults.update({campo: valor for campo, valor in reputacion.items() if valor is not None})
    tier_efectivo = defaults["tier_minimo_requerido"]
    if tiempo_maximo_prestamo is None or tiempo_maximo_prestamo == "":
        defaults["tiempo_maximo_prestamo"] = obtener_tiempo_maximo_por_defecto_tier(tier_efectivo)
    else:
        defaults["tiempo_maximo_prestamo"] = _validar_tiempo_maximo_prestamo(tiempo_maximo_prestamo)
    campos.update(defaults)

    archivos_guardados = []
    archivos_recibidos = [archivo for archivo in [foto, *(fila["foto"] for fila in filas_preparadas)] if archivo]
    try:
        material = Material.objects.create(**campos)
        if material.foto:
            archivos_guardados.append((material.foto.storage, material.foto.name))
        instancia_en_proceso = None
        for fila in filas_preparadas:
            instancia_en_proceso = InstanciaMaterial(
                material=material,
                codigo_ejemplar=fila["codigo_ejemplar"],
                numero_serie=fila["numero_serie"],
                estado=fila["estado"],
                color=fila["color"],
                observaciones=fila["observaciones"],
                ubicacion=fila["ubicacion"],
                foto=fila["foto"],
            )
            instancia_en_proceso.save()
            instancia = instancia_en_proceso
            if instancia.foto:
                archivos_guardados.append((instancia.foto.storage, instancia.foto.name))
        return material
    except Exception as exc:
        instancia_en_proceso = locals().get("instancia_en_proceso")
        if instancia_en_proceso and instancia_en_proceso.foto and instancia_en_proceso.foto.name:
            archivos_guardados.append(
                (instancia_en_proceso.foto.storage, instancia_en_proceso.foto.name)
            )
        material_en_proceso = locals().get("material")
        if material_en_proceso and material_en_proceso.foto and material_en_proceso.foto.name:
            archivos_guardados.append((material_en_proceso.foto.storage, material_en_proceso.foto.name))
        almacenamiento_fotos = InstanciaMaterial._meta.get_field("foto").storage
        for archivo in archivos_recibidos:
            nombre_archivo = getattr(archivo, "name", "")
            if nombre_archivo and almacenamiento_fotos.exists(nombre_archivo):
                archivos_guardados.append((almacenamiento_fotos, nombre_archivo))
        for storage, nombre_archivo in archivos_guardados:
            _eliminar_foto(storage, nombre_archivo)
        if isinstance(exc, IntegrityError) and "codigo_ejemplar" in str(exc):
            raise InventarioError(
                "codigo_ejemplar", "El código del ejemplar ya está registrado.", status_code=409
            ) from exc
        if isinstance(exc, IntegrityError) and ("codigo_material" in str(exc) or "codigo_inventario" in str(exc)):
            raise InventarioError("codigo_material", CODIGO_DUPLICADO_MENSAJE, status_code=409) from exc
        raise


@transaction.atomic
def actualizar_material(material_id, **campos):
    """Actualiza los datos y parámetros de un material existente (HU04, criterio 7).

    Solo se persisten los campos editables: los identificadores y las marcas
    de tiempo son invariantes del agregado.

    Eleva `MaterialNoEncontradoError` si el material no existe,
    `InventarioError` si el código está duplicado, el estado es inválido o se
    intenta escribir un campo no editable, y `ValidationError` si la foto no
    cumple las restricciones.
    """
    material = obtener_material(material_id)

    if "precio" in campos:
        es_alto_valor = campos["precio"] > UMBRAL_PRECIO_ALTO_VALOR
        campos["es_alto_valor"] = es_alto_valor
        if es_alto_valor:
            campos["tier_minimo_requerido"] = "avanzado"
        elif material.es_alto_valor and "tier_minimo_requerido" not in campos:
            campos["tier_minimo_requerido"] = "estandar"
    elif material.requiere_garantia():
        campos["es_alto_valor"] = True
        campos["tier_minimo_requerido"] = "avanzado"

    # Si cambia el Tier, los parámetros omitidos adoptan sus nuevos defaults.
    # Los valores enviados explícitamente (incluidos los personalizados) ganan.
    tier_nuevo = campos.get("tier_minimo_requerido")
    if tier_nuevo and tier_nuevo != material.tier_minimo_requerido:
        defaults = parametros_reputacion_por_defecto()[tier_nuevo]
        for campo, valor in defaults.items():
            campos.setdefault(campo, valor)
        if material.tiempo_maximo_prestamo == obtener_tiempo_maximo_por_defecto_tier(
            material.tier_minimo_requerido
        ):
            campos.setdefault(
                "tiempo_maximo_prestamo",
                obtener_tiempo_maximo_por_defecto_tier(tier_nuevo),
            )

    no_permitidos = set(campos) - CAMPOS_EDITABLES
    if no_permitidos:
        raise InventarioError(
            "material",
            f"Campos no editables: {', '.join(sorted(no_permitidos))}.",
        )

    actualizar_estado_general = "estado" in campos
    estado_general_solicitado = campos.pop("estado", None)

    if "codigo_material" in campos:
        codigo = normalizar_codigo(campos["codigo_material"])
        _verificar_codigo_disponible(codigo, material.id)
        campos["codigo_material"] = codigo

    if actualizar_estado_general:
        _verificar_estado(estado_general_solicitado)
        if estado_general_solicitado not in ("disponible", "en_mantenimiento"):
            raise InventarioError(
                "estado", "El estado general solo puede cambiarse a 'Disponible' o 'En Mantenimiento'."
            )

        instancias_elegibles = material.instancias.filter(
            estado__in=("disponible", "en_mantenimiento")
        )
        if not instancias_elegibles.exists():
            raise InventarioError(
                "estado",
                "No se puede cambiar el estado general porque no hay ejemplares Disponibles o En mantenimiento.",
            )
        instancias_elegibles.update(estado=estado_general_solicitado)

    if "nombre" in campos:
        campos["nombre"] = campos["nombre"].strip()
        if not campos["nombre"]:
            raise InventarioError("nombre", "El nombre del material es obligatorio.")

    if "stock" in campos and campos["stock"] < 1:
        raise InventarioError("stock", "El stock debe ser al menos 1 unidad.")

    if "tiempo_maximo_prestamo" in campos:
        campos["tiempo_maximo_prestamo"] = _validar_tiempo_maximo_prestamo(
            campos["tiempo_maximo_prestamo"]
        )

    if "stock" in campos and campos["stock"] > material.stock:
        conteo_actual = material.instancias.count()
        diferencia = campos["stock"] - conteo_actual
        if diferencia > 0:
            nuevas = []
            base = conteo_actual
            for i in range(1, diferencia + 1):
                idx = base + i
                cod_ej = f"{material.codigo_material}-{idx:02d}"
                while InstanciaMaterial.objects.filter(codigo_ejemplar=cod_ej).exists():
                    idx += 1
                    cod_ej = f"{material.codigo_material}-{idx:02d}"
                nuevas.append(
                    InstanciaMaterial(
                        material=material,
                        codigo_ejemplar=cod_ej,
                        numero_serie="",
                        estado="disponible",
                        observaciones="",
                        ubicacion="",
                    )
                )
            InstanciaMaterial.objects.bulk_create(nuevas)

    if campos.get("foto") is not None:
        validar_foto(campos["foto"])

    # La foto que se va a reemplazar se borra al final, después de confirmar
    # la transacción: si el guardado falla, el material conserva su imagen.
    # Se guardan el storage y el nombre, no el `FieldFile`, porque
    # `FieldFile.delete()` hace `setattr(self.instance, campo, None)` sobre el
    # material y dejaría la foto nueva en `None` en memoria.
    foto_anterior = material.foto.name if "foto" in campos and material.foto else None

    for campo in CAMPOS_TEXTO:
        if campo in campos and isinstance(campos[campo], str):
            campos[campo] = campos[campo].strip()

    for campo, valor in campos.items():
        setattr(material, campo, valor)

    campos_actualizados = [*campos, "updated_at"]
    if actualizar_estado_general:
        _sincronizar_estado_material_desde_instancias(material)
        campos_actualizados.append("estado")
    material.save(update_fields=campos_actualizados)

    if foto_anterior and foto_anterior != material.foto.name:
        storage_foto = material.foto.storage
        transaction.on_commit(lambda: _eliminar_foto(storage_foto, foto_anterior))

    return material


def cambiar_estado_material(material_id, nuevo_estado):
    """Cambia el estado de un material (HU04, criterio 8: 'En Mantenimiento').

    RN01: un material solo puede prestarse si está 'Disponible', por eso el
    estado se cambia de forma explícita y validada, nunca implícitamente.
    """
    return actualizar_material(material_id, estado=nuevo_estado)


def _verificar_codigo_disponible(codigo, material_id_actual=None):
    """Lanza `InventarioError` si el código ya pertenece a otro material."""
    materiales = Material.objects.filter(codigo_material__iexact=codigo)
    if material_id_actual is not None:
        materiales = materiales.exclude(pk=material_id_actual)
    if materiales.exists():
        raise InventarioError("codigo_material", CODIGO_DUPLICADO_MENSAJE)


def _verificar_estado(estado):
    """Lanza `InventarioError` si el estado no pertenece a la taxonomía."""
    estados_validos = {clave for clave, _ in ESTADOS_MATERIAL}
    if estado not in estados_validos:
        raise InventarioError("estado", "El estado del material no es válido.")


def _sincronizar_estado_material_desde_instancias(material):
    """Sincroniza `material.estado` según los estados actuales de sus ejemplares."""
    estados = set(material.instancias.values_list("estado", flat=True))
    if not estados:
        return
    if "disponible" in estados:
        material.estado = "disponible"
    elif estados == {"en_mantenimiento"}:
        material.estado = "en_mantenimiento"
    elif "prestado" in estados:
        material.estado = "prestado"
    elif "reservado" in estados:
        material.estado = "reservado"


def _eliminar_foto(storage, nombre):
    """Borra el archivo de la foto reemplazada.

    Se borra por storage y nombre, no con `FieldFile.delete()`: aquel método
    además de borrar deja el atributo del material en `None`, y como la foto
    anterior y la nueva comparten instancia, se perdería la nueva.

    El error se registra pero no se propaga: para cuando se llega aquí la
    edición ya está confirmada, así que fallar la petición dejaría al cliente
    con un error sobre un cambio que en realidad sí se aplicó. Queda un
    archivo huérfano en el storage, que es preferible a perder la imagen
    vigente.
    """
    try:
        storage.delete(nombre)
    except Exception:  # noqa: BLE001 - el storage puede fallar de muchas formas
        logger.warning(
            "No se pudo borrar la foto anterior %s; queda como archivo huérfano.",
            nombre,
            exc_info=True,
        )


def listar_instancias_material(material_id, *, estado=None):
    """Devuelve las instancias de un material, opcionalmente filtradas por estado."""
    material = obtener_material(material_id)
    instancias = material.instancias.all()

    if estado is not None and estado.strip():
        estado_normalizado = estado.strip().lower()
        estados_validos = {valor for valor, _ in ESTADOS_INSTANCIA}
        if estado_normalizado not in estados_validos:
            raise InventarioError("estado", "El estado de la instancia no es válido.")
        instancias = instancias.filter(estado=estado_normalizado)

    return instancias.order_by("codigo_ejemplar")


@transaction.atomic
def marcar_instancia_prestada(material_id, instancia_id=None):
    """Bloquea y marca prestada una instancia del material.

    Si se indica `instancia_id`, valida esa unidad exacta; si no, conserva la
    selección automática por código para los clientes existentes.
    """
    consulta = InstanciaMaterial.objects.select_for_update()
    if instancia_id is None:
        instancia = (
            consulta.filter(material_id=material_id, estado="disponible")
            .order_by("codigo_ejemplar")
            .first()
        )
        if instancia is None:
            raise InventarioError(
                "material_id",
                "No quedan unidades disponibles de este material.",
                status_code=409,
            )
    else:
        try:
            instancia = consulta.get(pk=instancia_id)
        except (InstanciaMaterial.DoesNotExist, ValueError, TypeError) as error:
            raise InventarioError(
                "instancia_id",
                "No existe la instancia indicada.",
                status_code=404,
            ) from error

        if instancia.material_id != material_id:
            raise InventarioError(
                "instancia_id",
                "La instancia no pertenece al material indicado.",
            )
        if instancia.estado != "disponible":
            raise InventarioError(
                "instancia_id",
                "La instancia no está disponible para préstamo.",
                status_code=409,
            )

    instancia.estado = "prestado"
    instancia.save(update_fields=("estado", "updated_at"))
    return {
        "id": instancia.id,
        "codigo_ejemplar": instancia.codigo_ejemplar,
    }


@transaction.atomic
def registrar_devolucion_instancia(
    material_id,
    *,
    instancia_id=None,
    estado_final,
    observaciones=None,
):
    """Actualiza la instancia asociada o aplica el fallback de préstamos históricos."""
    estados_validos = {valor for valor, _ in ESTADOS_INSTANCIA}
    if estado_final not in estados_validos:
        raise InventarioError("estado", "El estado de la instancia no es válido.")

    if instancia_id is None:
        instancia = (
            InstanciaMaterial.objects.select_for_update()
            .filter(material_id=material_id, estado="prestado")
            .first()
        )
        if instancia is None:
            return None
    else:
        try:
            instancia = InstanciaMaterial.objects.select_for_update().get(pk=instancia_id)
        except (InstanciaMaterial.DoesNotExist, ValueError, TypeError) as error:
            raise InventarioError(
                "instancia_id",
                "No existe la instancia asociada al préstamo.",
                status_code=404,
            ) from error

        if instancia.material_id != material_id:
            raise InventarioError(
                "instancia_id",
                "La instancia asociada no pertenece al material del préstamo.",
            )
        if instancia.estado != "prestado":
            raise InventarioError(
                "instancia_id",
                "La instancia asociada no figura como prestada.",
                status_code=409,
            )

    instancia.estado = estado_final
    campos_actualizados = ["estado", "updated_at"]
    if observaciones is not None:
        instancia.observaciones = observaciones
        campos_actualizados.append("observaciones")
    instancia.save(update_fields=campos_actualizados)
    return {"id": instancia.id, "estado": instancia.estado}


@transaction.atomic
def crear_instancia_material(
    material_id,
    *,
    codigo_ejemplar,
    numero_serie="",
    estado="disponible",
    color="",
    foto=None,
    observaciones="",
    ubicacion="",
):
    """Crea una nueva instancia física para un material existente."""
    return crear_instancias_material(
        material_id,
        [
            {
                "codigo_ejemplar": codigo_ejemplar,
                "numero_serie": numero_serie,
                "estado": estado,
                "color": color,
                "foto": foto,
                "observaciones": observaciones,
                "ubicacion": ubicacion,
            }
        ],
    )[0]


@transaction.atomic
def crear_instancias_material(material_id, filas):
    """Crea varias instancias juntas y aumenta el stock según las nuevas filas."""
    if not isinstance(filas, list) or not 1 <= len(filas) <= MAXIMO_EJEMPLARES_REGISTRO:
        raise InventarioError(
            "instancias",
            f"Registra entre 1 y {MAXIMO_EJEMPLARES_REGISTRO} ejemplares.",
        )

    try:
        material = Material.objects.select_for_update().get(pk=material_id)
    except (Material.DoesNotExist, ValueError, TypeError) as error:
        raise MaterialNoEncontradoError(f"No existe un material con id={material_id}") from error

    codigos_en_filas = set()
    filas_preparadas = []
    estados_validos = {clave for clave, _ in ESTADOS_INSTANCIA}
    for indice, fila in enumerate(filas):
        if not isinstance(fila, dict):
            raise InventarioError("instancias", "La fila debe ser un objeto válido.", indice=indice)
        codigo_original = str(fila.get("codigo_ejemplar", "")).strip()
        if not codigo_original:
            raise InventarioError(
                "codigo_ejemplar", "El código del ejemplar es obligatorio.", indice=indice
            )
        codigo = normalizar_codigo(codigo_original)
        if len(codigo) > 50:
            raise InventarioError(
                "codigo_ejemplar", "El código admite máximo 50 caracteres.", indice=indice
            )
        clave = codigo.casefold()
        if clave in codigos_en_filas:
            raise InventarioError(
                "codigo_ejemplar", "El código del ejemplar está duplicado en el registro.", indice=indice
            )
        codigos_en_filas.add(clave)
        if InstanciaMaterial.objects.filter(codigo_ejemplar__iexact=codigo).exists():
            raise InventarioError(
                "codigo_ejemplar",
                "El código de ejemplar ya está registrado.",
                status_code=409,
                indice=indice,
            )

        estado = fila.get("estado", "disponible")
        if estado not in estados_validos:
            raise InventarioError("estado", "El estado de la instancia no es válido.", indice=indice)
        color = fila.get("color", "")
        if not isinstance(color, str):
            raise InventarioError("color", "El color del ejemplar debe ser texto.", indice=indice)
        if len(color) > 30:
            raise InventarioError("color", "El color admite máximo 30 caracteres.", indice=indice)
        foto = fila.get("foto")
        if foto is not None:
            try:
                validar_foto(foto)
            except ValidationError as error:
                raise InventarioError("foto", error.messages[0], indice=indice) from error
        filas_preparadas.append({
            "codigo_ejemplar": codigo,
            "numero_serie": fila.get("numero_serie", ""),
            "estado": estado,
            "color": color.strip(),
            "foto": foto,
            "observaciones": fila.get("observaciones", ""),
            "ubicacion": fila.get("ubicacion", ""),
        })

    instancias_creadas = []
    instancia_en_proceso = None
    indice_en_proceso = None
    try:
        for indice_en_proceso, fila in enumerate(filas_preparadas):
            instancia_en_proceso = InstanciaMaterial(
                material=material,
                codigo_ejemplar=fila["codigo_ejemplar"],
                numero_serie=fila["numero_serie"].strip() if fila["numero_serie"] else "",
                estado=fila["estado"],
                color=fila["color"].strip() if fila["color"] else "",
                foto=fila["foto"],
                observaciones=fila["observaciones"].strip() if fila["observaciones"] else "",
                ubicacion=fila["ubicacion"].strip() if fila["ubicacion"] else "",
            )
            instancia_en_proceso.save()
            instancias_creadas.append(instancia_en_proceso)

        material.stock = max(material.stock, material.instancias.count())
        _sincronizar_estado_material_desde_instancias(material)
        material.save(update_fields=["stock", "estado", "updated_at"])
        return instancias_creadas
    except Exception as error:
        archivos_guardados = [
            (instancia.foto.storage, instancia.foto.name)
            for instancia in [*instancias_creadas, instancia_en_proceso]
            if instancia and instancia.foto and instancia.foto.name
        ]
        for almacenamiento, nombre in archivos_guardados:
            _eliminar_foto(almacenamiento, nombre)
        if isinstance(error, IntegrityError) and "codigo_ejemplar" in str(error):
            raise InventarioError(
                "codigo_ejemplar",
                "El código de ejemplar ya está registrado.",
                status_code=409,
                indice=indice_en_proceso,
            ) from error
        raise


def actualizar_instancia_material(instancia_id, **campos):
    """Actualiza datos, estado o notas de una instancia física."""
    try:
        instancia = InstanciaMaterial.objects.select_related("material").get(pk=instancia_id)
    except (InstanciaMaterial.DoesNotExist, ValueError, TypeError) as error:
        raise InventarioError("instancia_id", "No existe la instancia indicada.") from error

    if "codigo_ejemplar" in campos:
        codigo = normalizar_codigo(campos["codigo_ejemplar"])
        if (
            InstanciaMaterial.objects.filter(codigo_ejemplar__iexact=codigo)
            .exclude(pk=instancia.pk)
            .exists()
        ):
            raise InventarioError("codigo_ejemplar", "El código de ejemplar ya pertenece a otra unidad.")
        instancia.codigo_ejemplar = codigo

    if "estado" in campos:
        estado = campos["estado"]
        estados_validos = {clave for clave, _ in ESTADOS_INSTANCIA}
        if estado not in estados_validos:
            raise InventarioError("estado", "El estado de la instancia no es válido.")
        if estado != instancia.estado:
            if instancia.estado in ("prestado", "reservado"):
                raise InventarioError(
                    "estado",
                    f"No se puede cambiar manualmente el estado de un ejemplar '{instancia.get_estado_display()}'.",
                    status_code=409,
                )
            if estado not in ("disponible", "en_mantenimiento"):
                raise InventarioError(
                    "estado",
                    "Solo se puede cambiar manualmente el estado hacia 'Disponible' o 'En Mantenimiento'.",
                )
        instancia.estado = estado

    if campos.get("foto") is not None:
        validar_foto(campos["foto"])

    foto_anterior = instancia.foto.name if "foto" in campos and instancia.foto else None

    for campo in ("numero_serie", "color", "observaciones", "ubicacion"):
        if campo in campos and isinstance(campos[campo], str):
            setattr(instancia, campo, campos[campo].strip())

    if "foto" in campos:
        instancia.foto = campos["foto"]

    instancia.save()
    if "estado" in campos:
        _sincronizar_estado_material_desde_instancias(instancia.material)
        instancia.material.save(update_fields=["estado", "updated_at"])

    foto_nueva = instancia.foto.name if instancia.foto else None
    if foto_anterior and foto_anterior != foto_nueva:
        storage_foto = InstanciaMaterial._meta.get_field("foto").storage
        transaction.on_commit(lambda: _eliminar_foto(storage_foto, foto_anterior))

    return instancia


def eliminar_instancia_material(instancia_id):
    """Elimina una instancia física si no está prestada ni reservada."""
    try:
        instancia = InstanciaMaterial.objects.select_related("material").get(pk=instancia_id)
    except (InstanciaMaterial.DoesNotExist, ValueError, TypeError) as error:
        raise InventarioError("instancia_id", "No existe la instancia indicada.") from error

    if instancia.estado in ("prestado", "reservado"):
        raise InventarioError(
            "instancia",
            f"No se puede eliminar una unidad en estado '{instancia.get_estado_display()}'.",
        )

    material = instancia.material
    if material.instancias.count() <= 1:
        raise InventarioError(
            "instancia",
            "No se puede eliminar el último ejemplar por separado; elimina el material completo.",
            status_code=409,
        )

    foto = (instancia.foto.storage, instancia.foto.name) if instancia.foto else None
    try:
        instancia.delete()
    except ProtectedError as error:
        raise InventarioError(
            "instancia",
            "No se puede eliminar el ejemplar porque tiene historial de préstamos asociado.",
            status_code=409,
        ) from error

    total = material.instancias.count()
    if total < material.stock:
        material.stock = total
        material.save(update_fields=["stock", "updated_at"])

    if foto:
        storage, nombre = foto
        transaction.on_commit(lambda: _eliminar_foto(storage, nombre))
