"""Capa de servicios: reglas de negocio del módulo inventario.

Las vistas son delgadas y delegan aquí. Los servicios NO acceden a tablas de
otros módulos; se comunican con ellos solo a través de sus propios servicios.
"""
import logging

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction

from apps.inventario.constants import (
    ESTADOS_INSTANCIA,
    ESTADOS_MATERIAL,
    TIERS_ACCESIBLES,
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
        "codigo_inventario",
        "tipo",
        "estado",
        "es_alto_valor",
        "marca",
        "modelo",
        "numero_serie",
        "color",
        "estado_fisico",
        "foto",
        "tier_minimo_requerido",
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
    "estado_fisico",
)

CODIGO_DUPLICADO_MENSAJE = "El código de inventario ya está registrado."


class InventarioError(Exception):
    """Error de negocio del módulo inventario.

    Lleva el campo afectado y un mensaje en español para mostrarlo en la
    respuesta HTTP (la vista lo traduce a un 409 Conflict o un 400).
    """

    def __init__(self, campo, mensaje):
        self.campo = campo
        self.mensaje = mensaje
        super().__init__(mensaje)


class MaterialNoEncontradoError(Exception):
    """No existe un material con el id indicado."""


def normalizar_codigo(codigo):
    """Normaliza el código de inventario para que la unicidad no dependa de mayúsculas."""
    return codigo.strip().upper()


def parametros_reputacion_por_defecto():
    """Devuelve los valores por defecto de los parámetros de reputación (HU04 criterio 3).

    Son los configurados en `settings.MATERIALES_REPUTACION_DEFAULTS`; se
    devuelve una copia para que quien la reciba pueda modificarla sin alterar
    la configuración global.
    """
    return dict(settings.MATERIALES_REPUTACION_DEFAULTS)


def obtener_material(material_id):
    """Devuelve un material por su id o lanza `MaterialNoEncontradoError`."""
    try:
        return Material.objects.get(pk=material_id)
    except (Material.DoesNotExist, ValueError, TypeError) as exc:
        raise MaterialNoEncontradoError(f"No existe un material con id={material_id}") from exc


def listar_materiales():
    """Devuelve todos los materiales del inventario ordenados por nombre."""
    return Material.objects.all()


def resolver_tier_usuario(usuario):
    """Determina el tier aplicable de un usuario para filtros de consulta (RN03).

    Administradores y gestores tienen acceso irrestricto al inventario,
    por lo que no se restringen por reputación. Para prestatarios,
    devuelve su `reputacion_tier`.
    """
    if not usuario:
        return None

    rol = getattr(usuario, "rol", None)
    rol_nombre = ""
    if isinstance(rol, str):
        rol_nombre = rol.lower()
    elif hasattr(rol, "nombre"):
        rol_nombre = getattr(rol, "nombre", "").lower()

    if rol_nombre in ("gestor", "administrador"):
        return None

    tier = getattr(usuario, "reputacion_tier", None)
    if isinstance(tier, str):
        return tier.strip().lower()

    return None


def buscar_materiales(
    q=None,
    *,
    categoria=None,
    tipo=None,
    estado=None,
    tier_usuario=None,
    usuario=None,
):
    """Busca y filtra materiales del inventario según criterios de consulta (HU05, T05.01, T05.02).

    - `q`: Búsqueda parcial e insensible a mayúsculas sobre el nombre del material (criterio 1).
    - `categoria` (o `tipo`): Filtra por tipo/categoría de material ('equipo', 'libro', 'objeto') (criterio 2).
    - `estado`: Filtra por estado ('disponible', 'prestado', 'reservado', 'en_mantenimiento') (criterio 3).
    - `tier_usuario`: Tier específico para filtrar acceso según reputación (RN03, criterio 6).
    - `usuario`: Instancia de usuario autenticado; si no se especifica `tier_usuario`, se resuelve
      automáticamente según su rol y `reputacion_tier` (RN03).

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

    if tier_usuario is None and usuario is not None:
        tier_usuario = resolver_tier_usuario(usuario)

    if tier_usuario:
        tier_limpio = tier_usuario.strip().lower()
        if tier_limpio in TIERS_ACCESIBLES:
            queryset = queryset.filter(tier_minimo_requerido__in=TIERS_ACCESIBLES[tier_limpio])
        else:
            queryset = queryset.none()

    return queryset


@transaction.atomic
def registrar_material(
    *,
    nombre,
    codigo_inventario,
    tipo,
    descripcion="",
    stock=1,
    es_alto_valor=False,
    marca="",
    modelo="",
    numero_serie="",
    color="",
    estado_fisico="",
    foto=None,
    tier_minimo_requerido=None,
    bonificacion_tiempo=None,
    deduccion_tardanza=None,
    deduccion_dano_parcial=None,
    deduccion_dano_total=None,
    costo_reparacion=None,
    costo_reposicion=None,
):
    """Registra un material en el inventario.

    Reglas de negocio (HU04):
    - El código de inventario es único en el sistema (criterio 4) y se
      normaliza a mayúsculas para que "inv-01" y "INV-01" sean el mismo
      material.
    - El estado inicial siempre es "Disponible" (criterio 6): no se acepta
      como parámetro.
    - Se pueden registrar varias unidades del mismo material (criterio 5).
    - Los parámetros de reputación no informados se completan con los valores
      por defecto configurables (criterio 3, T04.04).
    - La foto es opcional y se valida antes de guardar: hasta 5 MB y en JPG,
      PNG o WEBP (criterio 1).

    Eleva `InventarioError` si el código ya está registrado o `ValidationError`
    si la foto no cumple las restricciones.
    """
    codigo = normalizar_codigo(codigo_inventario)
    _verificar_codigo_disponible(codigo)

    nombre = nombre.strip()
    if not nombre:
        raise InventarioError("nombre", "El nombre del material es obligatorio.")
    if stock < 1:
        raise InventarioError("stock", "El stock debe ser al menos 1 unidad.")
    if foto is not None:
        validar_foto(foto)

    campos = {
        "nombre": nombre,
        "descripcion": descripcion.strip(),
        "codigo_inventario": codigo,
        "tipo": tipo,
        "stock": stock,
        "es_alto_valor": es_alto_valor,
        "marca": marca.strip(),
        "modelo": modelo.strip(),
        "numero_serie": numero_serie.strip(),
        "color": color.strip(),
        "estado_fisico": estado_fisico.strip(),
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
    # Los parámetros no informados quedan con el valor por defecto configurable
    # (criterio 3): lo que sí llega, gana.
    defaults = parametros_reputacion_por_defecto()
    defaults.update({campo: valor for campo, valor in reputacion.items() if valor is not None})
    campos.update(defaults)

    try:
        material = Material.objects.create(**campos)
    except IntegrityError as exc:
        # Carrera entre dos altas con el mismo código: la restricción del
        # modelo es la última línea de defensa.
        if "codigo_inventario" in str(exc):
            raise InventarioError("codigo_inventario", CODIGO_DUPLICADO_MENSAJE) from exc
        raise

    # HU04 / Instancias de material: crear ejemplares físicos iniciales
    instancias = []
    for i in range(1, stock + 1):
        codigo_ejemplar = f"{codigo}-{i:02d}"
        num_serie = material.numero_serie
        if num_serie and stock > 1:
            num_serie = f"{num_serie}-{i:02d}"
        instancias.append(
            InstanciaMaterial(
                material=material,
                codigo_ejemplar=codigo_ejemplar,
                numero_serie=num_serie or "",
                estado="disponible",
                estado_fisico=material.estado_fisico or "Operativo",
                observaciones="",
                ubicacion="",
            )
        )
    InstanciaMaterial.objects.bulk_create(instancias)

    return material


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

    no_permitidos = set(campos) - CAMPOS_EDITABLES
    if no_permitidos:
        raise InventarioError(
            "material",
            f"Campos no editables: {', '.join(sorted(no_permitidos))}.",
        )

    if "codigo_inventario" in campos:
        codigo = normalizar_codigo(campos["codigo_inventario"])
        _verificar_codigo_disponible(codigo, material.id)
        campos["codigo_inventario"] = codigo

    if "estado" in campos:
        _verificar_estado(campos["estado"])

    if "nombre" in campos:
        campos["nombre"] = campos["nombre"].strip()
        if not campos["nombre"]:
            raise InventarioError("nombre", "El nombre del material es obligatorio.")

    if "stock" in campos and campos["stock"] < 1:
        raise InventarioError("stock", "El stock debe ser al menos 1 unidad.")

    if "stock" in campos and campos["stock"] > material.stock:
        conteo_actual = material.instancias.count()
        diferencia = campos["stock"] - conteo_actual
        if diferencia > 0:
            nuevas = []
            base = conteo_actual
            for i in range(1, diferencia + 1):
                idx = base + i
                cod_ej = f"{material.codigo_inventario}-{idx:02d}"
                while InstanciaMaterial.objects.filter(codigo_ejemplar=cod_ej).exists():
                    idx += 1
                    cod_ej = f"{material.codigo_inventario}-{idx:02d}"
                nuevas.append(
                    InstanciaMaterial(
                        material=material,
                        codigo_ejemplar=cod_ej,
                        numero_serie="",
                        estado="disponible",
                        estado_fisico=material.estado_fisico or "Operativo",
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

    material.save(update_fields=[*campos, "updated_at"])

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
    materiales = Material.objects.filter(codigo_inventario__iexact=codigo)
    if material_id_actual is not None:
        materiales = materiales.exclude(pk=material_id_actual)
    if materiales.exists():
        raise InventarioError("codigo_inventario", CODIGO_DUPLICADO_MENSAJE)


def _verificar_estado(estado):
    """Lanza `InventarioError` si el estado no pertenece a la taxonomía."""
    estados_validos = {clave for clave, _ in ESTADOS_MATERIAL}
    if estado not in estados_validos:
        raise InventarioError("estado", "El estado del material no es válido.")


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


def listar_instancias_material(material_id):
    """Devuelve todas las instancias físicas de un material ordenadas por código."""
    material = obtener_material(material_id)
    return material.instancias.all().order_by("codigo_ejemplar")


def crear_instancia_material(
    material_id,
    *,
    codigo_ejemplar,
    numero_serie="",
    estado="disponible",
    estado_fisico="Operativo",
    observaciones="",
    ubicacion="",
):
    """Crea una nueva instancia física para un material existente."""
    material = obtener_material(material_id)
    codigo = normalizar_codigo(codigo_ejemplar)
    if InstanciaMaterial.objects.filter(codigo_ejemplar__iexact=codigo).exists():
        raise InventarioError("codigo_ejemplar", "El código de ejemplar ya está registrado.")

    estados_validos = {clave for clave, _ in ESTADOS_INSTANCIA}
    if estado not in estados_validos:
        raise InventarioError("estado", "El estado de la instancia no es válido.")

    instancia = InstanciaMaterial.objects.create(
        material=material,
        codigo_ejemplar=codigo,
        numero_serie=numero_serie.strip() if numero_serie else "",
        estado=estado,
        estado_fisico=estado_fisico.strip() if estado_fisico else "Operativo",
        observaciones=observaciones.strip() if observaciones else "",
        ubicacion=ubicacion.strip() if ubicacion else "",
    )

    total = material.instancias.count()
    if total > material.stock:
        material.stock = total
        material.save(update_fields=["stock", "updated_at"])

    return instancia


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
        instancia.estado = estado

    for campo in ("numero_serie", "estado_fisico", "observaciones", "ubicacion"):
        if campo in campos and isinstance(campos[campo], str):
            setattr(instancia, campo, campos[campo].strip())

    instancia.save()
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
    instancia.delete()

    total = material.instancias.count()
    if total > 0 and total < material.stock:
        material.stock = total
        material.save(update_fields=["stock", "updated_at"])
