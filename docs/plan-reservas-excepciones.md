# Plan de implementación — Reservas, lista de espera y excepciones académicas

## Metadatos

- **Fecha:** 2026-11-02
- **Estado:** Aprobado para implementación
- **Historias cubiertas:** HU06, HU07, HU08 y HU13
- **Ramas:** `feature/prestamo-excepcional` y `feature/reservas-lista-espera`
- **Base:** `development`
- **Documentos relacionados:** `docs/Requerimientos.md`, `docs/scrum/historias-usuario.md`, `docs/scrum/tareas.md`, `docs/scrum/product-backlog.md`, `docs/diagrams/ddd_detailed/05-reservas.puml`

Este documento complementa los requisitos y el DDD. No reemplaza los criterios de aceptación de las historias de usuario.

---

## 1. Objetivo

Implementar reservas de materiales con lista de espera, autopromoción, vencimientos y excepción académica, integrando el flujo con inventario y préstamos.

Al finalizar las dos ramas, deben quedar cubiertas:

- **HU06:** reservar material o solicitar espera.
- **HU07:** expiración de reservas y solicitudes en espera.
- **HU08:** gestión de cola de reservas y excepciones.
- **HU13:** reserva y préstamo excepcional por necesidad académica.

### Dentro del alcance

- Modelo `Reserva` y migraciones.
- Servicios transaccionales de reserva, cola, autopromoción y expiración.
- Garantía reutilizable para reservas excepcionales y préstamos.
- Integración de instancias físicas en estados `disponible`, `reservado` y `prestado`.
- Conversión de reserva confirmada a préstamo.
- Endpoints, permisos y validaciones.
- Vistas de “Mis reservas”, formulario de reserva, cola del gestor y revisión de excepciones.
- Préstamo excepcional directo y badge “Activo - Excepción”.
- Cron de respaldo mediante management command.
- Pruebas backend y frontend.

### Fuera del alcance

- Notificaciones in-app.
- Implementación completa de HU09 fuera de la conversión de reservas.
- Implementación de HU14 o cambios nuevos en el sistema de suspensiones.
- Prórrogas de préstamos.
- Nuevas dependencias de infraestructura como Celery o Redis.

---

## 2. Decisiones confirmadas

| Decisión | Valor |
|---|---|
| Garantía | Reutilizar `Garantia`, agregando `reserva` cuando exista el módulo de reservas |
| Penalización por inasistencia | 20 puntos, configurable con `RESERVA_PENALIZACION_PUNTOS` |
| Máximo de solicitudes activas | 3, configurable con `MAXIMO_RESERVAS_ACTIVAS` |
| Alcance | HU06, HU07, HU08 y HU13 completas |
| Notificaciones | Fuera de alcance; solo estados visibles en “Mis reservas” |
| Estrategia de ramas | Dos ramas secuenciales |
| Orden de implementación | Préstamo excepcional directo → reservas normales → reserva excepcional y conversión |

La excepción académica se divide en dos flujos:

1. **Préstamo excepcional directo:** independiente del modelo `Reserva`.
2. **Reserva excepcional:** depende de `Reserva`, cola, aprobación y conversión.

---

## 3. Estado actual y hallazgos

- No existe una app `reservas`; actualmente solo existen `usuarios`, `inventario` y `prestamos`.
- `Garantia` es 1:1 con `Prestamo`; no contempla reservas.
- `registrar_prestamo` rechaza materiales en estado `reservado` en `backend/apps/prestamos/services.py`.
- `marcar_instancia_prestada` solo acepta instancias `disponible` en `backend/apps/inventario/services.py`.
- `_sincronizar_estado_material_desde_instancias` ya existe en `backend/apps/inventario/services.py`; debe reutilizarse.
- La disponibilidad del serializer considera instancias reales, mientras `contar_unidades_disponibles` usa `stock - préstamos`. Las reservas deben basarse en instancias reales.
- No hay Celery ni scheduler; el proyecto usa management commands y cron externo.
- `Prestamo` ya tiene el estado `reservado`, pero no se usa. No debe reutilizarse como estado de reserva.
- `RegistrarPrestamo` solo carga materiales `disponible` con unidades libres. La conversión de una reserva debe usar un selector independiente de reservas confirmadas.
- El frontend ya tiene patrones reutilizables para rutas privadas, roles, formularios multipart, PDFs y badges.

---

## 4. Estrategia de ramas

### Rama 1 — `feature/prestamo-excepcional`

Base: `development` actualizado.

Objetivo: integrar la excepción académica directamente en el módulo de préstamos, sin depender de reservas.

Al finalizar y validar, se integra en `development`.

### Rama 2 — `feature/reservas-lista-espera`

Base: `development` actualizado después de integrar la rama 1.

Objetivo: implementar reservas normales, cola, expiración, reserva excepcional y conversión.

Se divide internamente en:

- **B1:** reservas normales, cola, expiración y cron.
- **B2:** reserva excepcional, garantía reutilizable y conversión.

### Motivo del orden

- El préstamo excepcional directo no necesita `Reserva`.
- La reserva excepcional necesita el modelo, la cola y la aprobación.
- La conversión reutiliza el flujo de préstamo excepcional ya estable.
- Se reducen conflictos y se puede probar la excepción en préstamos antes de construir reservas.

---

## 5. Rama 1 — Préstamo excepcional directo

### 5.1 Modelo y migración

Agregar a `Prestamo`:

```python
es_excepcion = models.BooleanField(default=False)
```

- Generar la siguiente migración de `prestamos`, esperada como `0008_prestamo_es_excepcion.py`.
- No crear un estado nuevo de préstamo.
- `Prestamo` sigue usando los estados existentes: `activo`, `devuelto`, `vencido`.
- El badge visible será “Activo - Excepción” cuando `es_excepcion=True` y el estado visible sea `activo`.

### 5.2 Servicios

Modificar `backend/apps/prestamos/services.py`:

- Agregar el parámetro `es_excepcion=False` a `registrar_prestamo`.
- Crear una validación explícita de excepción:
  - Solo aplica a usuarios con Tier `restringido`.
  - Solo aplica si el material requiere un Tier superior al del usuario.
  - Si el usuario no es Restringido, rechazar la excepción.
  - Si el material es accesible sin excepción, rechazar la solicitud excepcional.
- Mantener el bloqueo normal de Tier cuando `es_excepcion=False`.
- Considerar la garantía obligatoria si `es_excepcion=True`, aunque el material no sea de alto valor.
- Guardar `Prestamo.es_excepcion` al crear el préstamo.
- Ajustar `Prestamo.garantia_completa` para que una excepción siempre requiera garantía completa.
- Mantener el uso de `_crear_garantia_registrada` para documento de identidad y compromiso.
- En `_calcular_resultado`:
  - Calcular la deducción base por daño.
  - Si `prestamo.es_excepcion=True`, duplicar únicamente la deducción por daño.
  - No duplicar `cobro_economico`.
  - Reflejar la deducción aplicada en el resumen de devolución y estimación.
- `estimar_devolucion` debe usar la misma regla para mostrar el resultado correcto antes de confirmar.

### 5.3 API

Agregar endpoint:

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| POST | `/api/prestamos/excepcion/` | Gestor | Registra un préstamo excepcional directo |

Reglas:

- El endpoint fuerza `es_excepcion=True` en el servidor; no se confía en un flag enviado por el cliente.
- Reutiliza `RegistrarPrestamoSerializer` y `registrar_prestamo`.
- Solo el gestor puede registrar la excepción; su acción de registro equivale a la aprobación.
- Exponer `es_excepcion` en:
  - `PrestamoRegistroSerializer`
  - `PrestamoConsultaSerializer`
  - `PrestamoHistorialSerializer`
  - Serializer de detalle de historial y devolución cuando corresponda.

### 5.4 Frontend

Modificar `frontend/src/pages/RegistrarPrestamo.jsx`:

- Detectar usuario Restringido y material con Tier superior.
- Mostrar opción “Excepción académica”.
- Permitir el registro excepcional solo al gestor.
- Exigir documento de identidad y compromiso de responsabilidad.
- Enviar la solicitud al endpoint de excepción.
- Mostrar el resultado como préstamo activo con indicador de excepción.

Modificar la presentación de estados:

- `frontend/src/prestamos/estadoPrestamo.js`: agregar helper para componer “Activo - Excepción” sin crear un estado nuevo.
- `frontend/src/components/prestamos/ListaPrestamos.jsx`
- `frontend/src/components/prestamos/DetallePrestamo.jsx`
- `frontend/src/prestamos/MisPrestamos.jsx`
- `frontend/src/prestamos/HistorialPrestamos.jsx`

El indicador debe ser visible para el gestor y para el prestatario.

### 5.5 Pruebas de la rama 1

Backend:

- Préstamo normal con Tier insuficiente sigue rechazado.
- Excepción permitida a usuario Restringido con material de Tier superior.
- Excepción rechazada para usuario no Restringido.
- Excepción rechazada si el material es accesible sin excepción.
- Sin PDFs no se registra el préstamo excepcional.
- La garantía se guarda correctamente.
- Daño parcial duplica solo puntos de daño.
- Daño total duplica solo puntos de daño.
- El cobro económico no se duplica.
- `estimar_devolucion` refleja la duplicación.
- El endpoint exige rol gestor.
- Los serializers exponen `es_excepcion`.

Frontend:

- El formulario muestra la opción solo cuando corresponde.
- El formulario exige los PDFs.
- El badge “Activo - Excepción” se presenta correctamente.

### 5.6 Cierre de la rama 1

- Ejecutar pruebas backend y frontend.
- Integrar en `development`.
- No continuar con la rama 2 hasta tener esta base integrada.

---

## 6. Rama 2 — Reservas normales y reserva excepcional

### 6.1 Modelo `Reserva`

Crear `backend/apps/reservas/` con la estructura del proyecto:

```text
backend/apps/reservas/
├── __init__.py
├── apps.py
├── constants.py
├── models.py
├── permissions.py
├── serializers.py
├── services.py
├── urls.py
├── views.py
├── migrations/
├── management/commands/
└── tests.py
```

Registrar `apps.reservas` en `backend/config/settings/base.py` y montar sus rutas en `backend/config/urls.py`.

Campos de `Reserva`:

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID | Clave primaria |
| `usuario` | FK `Usuario` | `PROTECT`, `related_name="reservas"` |
| `material` | FK `Material` | `PROTECT`, `related_name="reservas"` |
| `instancia` | FK `InstanciaMaterial` | Opcional hasta confirmar, `PROTECT` |
| `prestamo` | OneToOne `Prestamo` | Opcional; se llena al convertir |
| `prioridad` | CharField | `alta`, `media`, `baja` |
| `justificacion` | TextField | Obligatoria |
| `estado` | CharField | Ver taxonomía |
| `es_excepcion` | BooleanField | `False` por defecto |
| `motivo_rechazo` | TextField | Opcional |
| `motivo_cancelacion` | TextField | Opcional |
| `fecha_solicitud` | DateTimeField | `timezone.now` |
| `fecha_limite_espera` | DateTimeField | Creación + 72 h |
| `fecha_confirmacion` | DateTimeField | Opcional |
| `fecha_limite_recojo` | DateTimeField | Confirmación + 24 h |
| `fecha_recojo` | DateTimeField | Se llena al convertir |
| `created_at` | DateTimeField | `auto_now_add` |
| `updated_at` | DateTimeField | `auto_now` |

Estados:

- `en_espera`
- `reservada`
- `expirada`
- `rechazada`
- `cancelada`
- `cancelada_por_vencimiento`
- `convertida_en_prestamo`

Índices recomendados:

- `(material, estado)`
- `(usuario, estado)`
- `(fecha_limite_espera)`
- `(fecha_limite_recojo)`
- `(estado, es_excepcion)`

Migraciones:

- `reservas/0001_initial.py`, dependiente de la última migración de `prestamos` de la rama 1.
- En B2, `prestamos/0009_garantia_reserva.py`, dependiente de `reservas/0001_initial`.
- No editar migraciones ya aplicadas.

### 6.2 Constantes y configuración

En `backend/apps/reservas/constants.py`:

- `ESTADOS_RESERVA`
- `PRIORIDADES_RESERVA`
- `ORDEN_PRIORIDAD`
- `ORDEN_TIER`
- `HORAS_ESPERA = 72`
- `HORAS_RECOJO = 24`
- `ESTADOS_ACTIVOS = ("en_espera", "reservada")`
- Mensajes de error en español.

En `backend/config/settings/base.py`:

```python
MAXIMO_RESERVAS_ACTIVAS = int(os.getenv("MAXIMO_RESERVAS_ACTIVAS", "3"))
RESERVA_PENALIZACION_PUNTOS = int(os.getenv("RESERVA_PENALIZACION_PUNTOS", "20"))
```

Agregar ambas variables a `.env.example`.

### 6.3 Servicios de reservas normales — B1

Implementar en `backend/apps/reservas/services.py`:

#### `crear_reserva(...)`

- Validar usuario autenticado, activo y no suspendido.
- Validar que sea prestatario.
- Validar Tier según `TIERS_ACCESIBLES`.
- Validar máximo de solicitudes activas.
- Validar prioridad y justificación.
- Ejecutarse dentro de `transaction.atomic`.
- Si el usuario es Restringido y el material es de Tier superior, rechazar la solicitud normal e indicar que puede solicitar excepción académica.
- Antes de confirmar una solicitud normal, ejecutar `autopromover_material(material_id)`.
- Si tras la autopromoción hay una instancia real disponible y no queda cola pendiente, confirmar:
  - Asignar `instancia`.
  - Estado `reservada`.
  - `fecha_confirmacion = ahora`.
  - `fecha_limite_recojo = ahora + 24 h`.
  - Marcar instancia como `reservado`.
- Si no hay instancia o queda cola pendiente:
  - Estado `en_espera`.
  - `fecha_limite_espera = ahora + 72 h`.
  - No reservar inventario.
- Devolver la reserva con datos de cola y disponibilidad.

#### `autopromover_material(material_id)`

- Ejecutarse dentro de `transaction.atomic`.
- Bloquear material e instancias candidatas con `select_for_update`.
- Considerar solo reservas `en_espera`, no excepcionales.
- Ordenar por:
  1. prioridad `alta` → `media` → `baja`;
  2. `fecha_solicitud` ascendente;
  3. Tier del usuario `avanzado` → `estándar` → `restringido`;
  4. `id` como desempate determinista.
- Promover mientras existan instancias `disponible`.
- Asignar instancia, cambiar a `reservada`, fijar 24 h y marcar instancia `reservado`.
- Sincronizar estado del material.
- Ser idempotente.

#### `expirar_reservas(ahora=None)`

- Ejecutarse dentro de `transaction.atomic`.
- Reservas `reservada` con `fecha_limite_recojo < ahora`:
  - Estado `cancelada_por_vencimiento`.
  - Liberar instancia.
  - Aplicar penalización `RESERVA_PENALIZACION_PUNTOS`.
  - Registrar motivo.
- Reservas `en_espera` con `fecha_limite_espera < ahora`:
  - Estado `expirada`.
  - Sin penalización.
- Al liberar instancias, ejecutar autopromoción.
- Devolver conteos para el cron.

#### `cancelar_reserva(...)`

- Solo gestor.
- Solo reservas `reservada`.
- Exigir motivo.
- Estado `cancelada`.
- Liberar instancia.
- Sin penalización, salvo regla futura.
- Ejecutar autopromoción.

#### `rechazar_reserva(...)`

- Solo gestor.
- Solo reservas `en_espera`.
- Exigir motivo.
- Estado `rechazada`.
- No libera inventario porque no estaba reservado.
- No aplica penalización.

#### Consultas

- `consultar_mis_reservas(usuario_id)`
- `consultar_cola_material(material_id)`
- `consultar_reservas_confirmadas(dni=None)`
- Serializers con datos de usuario, material, instancia, prioridad, Tier, justificación, fechas, estado, excepción y posición en cola.

### 6.4 Integración con inventario

Modificar `backend/apps/inventario/services.py`:

- Agregar `marcar_instancia_reservada(material_id, instancia_id)`.
  - Solo permite `disponible → reservado`.
  - Bloquea la instancia.
  - Sincroniza estado del material.
- Agregar `liberar_instancia_reservada(instancia_id, estado_final="disponible")`.
  - Solo permite `reservado → disponible` o `en_mantenimiento` si corresponde.
  - Sincroniza estado del material.
- Extender `marcar_instancia_prestada` con un parámetro explícito, por ejemplo `permitir_reservada=False`.
  - Solo la conversión de una reserva válida puede usarlo.
  - Nunca permitir un préstamo directo sobre una instancia reservada.
- Reutilizar `_sincronizar_estado_material_desde_instancias`.
- Disparar autopromoción con importación diferida y `transaction.on_commit` cuando:
  - una devolución deja una instancia `disponible`;
  - una instancia pasa de `en_mantenimiento` a `disponible`;
  - se registra un nuevo ejemplar;
  - se libera una instancia por cancelación o vencimiento.
- Evitar disparos duplicados; `autopromover_material` debe ser idempotente.

Estados esperados:

| Acción | Instancia | Material |
|---|---|---|
| Reserva confirmada | `disponible → reservado` | Sincronizar; `reservado` solo si no queda ninguna disponible |
| Liberación | `reservado → disponible` | Sincronizar |
| Conversión a préstamo | `reservado → prestado` | Sincronizar |
| Devolución | `prestado → disponible` o `en_mantenimiento` | Sincronizar |

### 6.5 API de reservas normales — B1

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| POST | `/api/reservas/` | Prestatario | Crea reserva normal |
| GET | `/api/reservas/mis-reservas/` | Prestatario | Lista reservas propias |
| GET | `/api/reservas/cola/<uuid:material_id>/` | Gestor/Administrador | Cola y disponibilidad del material |
| GET | `/api/reservas/confirmadas/?dni=...` | Gestor | Reservas confirmadas para conversión |
| POST | `/api/reservas/<uuid:id>/cancelar/` | Gestor | Cancela reserva confirmada |
| POST | `/api/reservas/<uuid:id>/rechazar/` | Gestor | Rechaza solicitud en espera |

Reglas:

- Todas las rutas con barra final, siguiendo el estilo del proyecto.
- El prestatario solo puede consultar sus propias reservas.
- El gestor puede consultar cola y reservas confirmadas.
- El administrador puede tener lectura de cola si se mantiene el patrón actual; las acciones sensibles son solo del gestor.
- Errores de validación en español.
- Usar códigos `400`, `403`, `404` y `409` de forma consistente.

### 6.6 Cron — B1

Crear `backend/apps/reservas/management/commands/procesar_reservas.py`.

Comportamiento:

- Ejecutar `expirar_reservas`.
- Ejecutar autopromociones pendientes.
- Imprimir o devolver conteos:
  - reservas vencidas;
  - solicitudes expiradas;
  - instancias liberadas;
  - reservas promovidas.
- Documentar el comando en `README.md`.
- Documentar la ejecución periódica, por ejemplo cada 5 minutos.
- No agregar Celery.

### 6.7 Frontend de reservas normales — B1

Rutas:

- `/panel/reservas` → `MisReservas.jsx`.
- `/panel/reservas/nueva` → `ReservarMaterial.jsx`.
- `/panel/cola-reservas` → `ColaReservas.jsx`, dentro de gestión de préstamos.

Cambios:

- `frontend/src/router/rutas.jsx`: rutas privadas y por rol.
- `frontend/src/pages/PanelInicio.jsx`: accesos “Mis reservas” y “Cola de reservas”.
- `frontend/src/prestamos/navegacionPrestamos.js`: opción de cola para gestor y administrador.
- `frontend/src/components/FichaTecnicaModal.jsx`: botón “Reservar” para prestatarios.
- `frontend/src/pages/CatalogoMateriales.jsx`: abrir formulario de reserva con el material seleccionado.
- `ReservarMaterial.jsx`:
  - mostrar disponibilidad y Tier mínimo;
  - pedir prioridad y justificación;
  - informar si quedará en espera;
  - integrar excepción académica en B2.
- `MisReservas.jsx`:
  - estados, fechas, prioridad, instancia, motivo de rechazo/cancelación;
  - badge de excepción;
  - sin notificaciones.
- `ColaReservas.jsx`:
  - búsqueda o selección de material;
  - solicitudes en espera ordenadas;
  - reservas confirmadas;
  - instancias disponibles;
  - acciones de aprobar, rechazar y cancelar según estado.
- `RegistrarPrestamo.jsx`:
  - selector de reservas confirmadas por DNI;
  - al elegir una, precargar material e instancia;
  - enviar `reserva_id` al registrar el préstamo;
  - no depender del listado de materiales disponibles cuando se convierte una reserva.

### 6.8 Garantía reutilizable y reserva excepcional — B2

Modificar `Garantia` en `backend/apps/prestamos/models.py`:

- `prestamo`: `OneToOneField` nullable.
- `reserva`: `OneToOneField("reservas.Reserva", null=True, blank=True, on_delete=PROTECT, related_name="garantia")`.
- Restricción: al menos uno de `prestamo` o `reserva` debe estar presente.
- Actualizar `__str__` para manejar ambos dueños.
- Mantener `tipo`, `estado`, documentos, storage y fechas actuales.
- Generar `prestamos/0009_garantia_reserva.py`, dependiente de `reservas/0001_initial`.

Servicios compartidos:

- Generalizar la creación de garantía para aceptar `prestamo` o `reserva`.
- Mantener limpieza de archivos si falla la transacción.
- Generalizar la descarga de documentos para reservas.
- Mantener compatibilidad con garantías existentes de préstamos.
- La garantía de una reserva excepcional se registra al solicitar y se reutiliza al convertir.

Reglas de reserva excepcional:

- Solo usuario Restringido.
- Solo material de Tier superior.
- Documento de identidad y compromiso firmado obligatorios.
- Total de adjuntos ≤ 4 MB.
- Estado inicial `en_espera`.
- No participa en autopromoción.
- El gestor puede aprobar o rechazar.
- Para aprobar:
  - ejecutar primero la autopromoción normal para no saltar la cola;
  - exigir garantía completa;
  - exigir instancia real disponible;
  - asignar instancia;
  - estado `reservada`;
  - 24 h de vigencia.
- Para rechazar:
  - exigir motivo;
  - estado `rechazada`;
  - no libera inventario.

### 6.9 Conversión de reserva a préstamo — B2

Modificar `backend/apps/prestamos/services.py` y serializers:

- Aceptar `reserva_id` en el registro de préstamo.
- Validar que la reserva:
  - exista;
  - pertenezca al prestatario;
  - esté `reservada`;
  - tenga instancia asignada;
  - corresponda al material indicado.
- Usar obligatoriamente la instancia reservada.
- Permitir la transición `reservado → prestado` solo en este flujo.
- Reutilizar la garantía de la reserva.
- No exigir volver a subir los PDFs si la garantía ya está completa.
- Crear el préstamo con:
  - `es_excepcion=True` si la reserva es excepcional;
  - vínculo a la reserva;
  - checklist inicial y fotos correspondientes.
- Actualizar la reserva:
  - estado `convertida_en_prestamo`;
  - `fecha_recojo`;
  - `prestamo`.
- Mantener el rechazo de préstamo directo sobre material/instancia reservada fuera de una conversión válida.

### 6.10 API de excepción y conversión — B2

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| POST | `/api/reservas/excepcion/` | Prestatario | Crea reserva excepcional |
| GET | `/api/reservas/<uuid:id>/garantia/<str:tipo>/` | Gestor o titular | Descarga documento de garantía |
| POST/PUT | `/api/reservas/<uuid:id>/aprobar-excepcion/` | Gestor | Aprueba excepción |
| POST | `/api/reservas/<uuid:id>/rechazar/` | Gestor | Rechaza excepción o espera normal |
| POST | `/api/prestamos/` | Gestor | Convierte una reserva con `reserva_id` |

Se aceptan `POST` y `PUT` en aprobar-excepción para cubrir la diferencia entre T08 y T13.

### 6.11 Tests de la rama 2

Backend:

- Creación de reserva normal con instancia disponible.
- Creación de reserva normal sin instancia.
- Reserva en espera sin consumir stock.
- Orden por prioridad, antigüedad y Tier.
- Autopromoción tras devolución.
- Autopromoción tras cancelación.
- Autopromoción tras vencimiento.
- Autopromoción tras mantenimiento a disponible.
- Autopromoción tras alta de ejemplar.
- Expiración de confirmada con penalización.
- Expiración de espera sin penalización.
- Cancelación manual sin penalización.
- Rechazo de espera.
- Máximo de reservas activas.
- Reserva excepcional con garantía.
- Rechazo de excepción sin garantía.
- Aprobación de excepción con instancia disponible.
- Aprobación sin instancia.
- Rechazo de excepción por gestor.
- Excepción no participa en autopromoción.
- Conversión de reserva normal.
- Conversión de reserva excepcional.
- Reutilización de garantía.
- Conversión no permite préstamo directo sobre reservada.
- Doble daño en devolución de préstamo excepcional.
- Concurrencia:
  - dos reservas compitiendo por una instancia;
  - dos autopromociones simultáneas;
  - vencimiento y creación simultáneos.

Frontend:

- Helpers de estado de reserva.
- Orden de cola.
- Construcción de `FormData`.
- Validación de tamaño total ≤ 4 MB.
- Badge de excepción.
- Presentación de motivos y fechas.

### 6.12 Cierre de la rama 2

- Ejecutar migraciones y pruebas.
- Verificar manualmente con datos demo:
  - reserva con y sin disponibilidad;
  - excepción académica;
  - aprobación y rechazo;
  - conversión a préstamo;
  - devolución con daño;
  - vencimiento por cron.

---

## 7. Reglas de negocio resumidas

### Reservas normales

- La reserva confirmada siempre tiene una instancia real `disponible`.
- La espera no consume inventario.
- Antes de confirmar una nueva reserva normal, se intenta autopromover la cola.
- Si después de la autopromoción no hay instancia, la nueva solicitud queda en espera.
- El máximo de solicitudes activas incluye `en_espera` y `reservada`.
- No cuentan para el máximo: `expirada`, `rechazada`, `cancelada`, `cancelada_por_vencimiento` y `convertida_en_prestamo`.

### Cola

- Solo participan reservas normales.
- Orden: prioridad, antigüedad, Tier y `id`.
- La autopromoción es atómica.
- Una instancia nunca se asigna a dos reservas.
- Las excepciones no se autopromueven.

### Vencimientos

- Confirmada: 24 h desde confirmación o aprobación.
- Espera: 72 h desde creación.
- Vencimiento confirmado: penalización configurable y liberación de instancia.
- Vencimiento de espera: sin penalización.
- Cancelación manual del gestor: sin penalización.
- Rechazo: sin penalización.

### Excepción académica

- Solo usuario Restringido.
- Solo material de Tier superior.
- Documentos obligatorios.
- Garantía registrada al solicitar.
- Aprobación exclusiva del gestor.
- No participa en autopromoción.
- La conversión reutiliza la garantía.
- El préstamo se marca con `es_excepcion`.
- La devolución con daño duplica solo puntos de daño.

---

## 8. Trazabilidad de historias de usuario

### HU06 — Reservar material o solicitar espera

| Criterio | Implementación |
|---|---|
| Disponibilidad y Tier visibles | `ReservarMaterial` y ficha del material |
| Prioridad y justificación | Modelo y formulario |
| Confirmación con instancia y 24 h | `crear_reserva` y `autopromover_material` |
| Espera de 72 h sin inventario | `crear_reserva` |
| Autopromoción previa | `crear_reserva` |
| Rechazo por Tier | Validación de elegibilidad |
| Excepción académica | B2 |
| Orden de autopromoción | `autopromover_material` |
| “Mis reservas” y máximo activo | Vista y validación de máximo |

### HU07 — Expiración de reservas

| Criterio | Implementación |
|---|---|
| Proceso periódico | `procesar_reservas` |
| Confirmada vencida con penalización | `expirar_reservas` |
| Espera vencida sin penalización | `expirar_reservas` |
| Autopromoción al liberar | `liberar_instancia_reservada` |
| Cancelación manual del gestor | `cancelar_reserva` |
| Estados en “Mis reservas” | Serializer y vista |

### HU08 — Cola y excepciones

| Criterio | Implementación |
|---|---|
| Cola por material | `ColaReservas` |
| Datos de cada solicitud | Serializer de cola |
| Orden y autopromoción | `autopromover_material` |
| Rechazo y cancelación con motivo | `rechazar_reserva` y `cancelar_reserva` |
| Excepciones solo por gestor | Permisos y servicios |
| Garantía e instancia para aprobar | `aprobar_excepcion` |
| Atomicidad | `transaction.atomic` y `select_for_update` |
| Reflejo en “Mis reservas” | Consulta del prestatario |

### HU13 — Excepción académica

| Criterio | Implementación |
|---|---|
| Detección de Restringido y Tier superior | Rama 1 y B2 |
| Opción para reserva y préstamo | Endpoints de excepción |
| PDFs y límite de 4 MB | Serializers y validadores |
| Garantía asociada a la reserva | `Garantia.reserva` |
| Espera sin autopromoción | `crear_reserva` excepcional |
| Aprobación/rechazo del gestor | `aprobar_excepcion` y `rechazar_reserva` |
| Reserva aprobada con 24 h | `aprobar_excepcion` |
| Préstamo excepcional directo | Rama 1 |
| `es_excepcion` y badge | Modelo y frontend |
| Doble daño sin duplicar cobro | `_calcular_resultado` |
| Indicador para el gestor | Lista, detalle e historial |

---

## 9. Concurrencia y transacciones

- Todas las operaciones de reserva, autopromoción, expiración y conversión deben ejecutarse dentro de `transaction.atomic`.
- Usar `select_for_update` sobre material, instancia y reservas candidatas.
- Evitar asignar la misma instancia a dos reservas.
- No confirmar una reserva sin una instancia real.
- Mantener un orden de bloqueo consistente y documentado en el código.
- Probar con `TransactionTestCase` los escenarios de concurrencia.
- Usar `transaction.on_commit` para autopromociones disparadas desde inventario y devoluciones.
- Evitar importaciones circulares:
  - `inventario` no debe importar `reservas` en el nivel superior;
  - usar importación diferida dentro de las funciones.
- `autopromover_material` debe ser idempotente para tolerar disparos duplicados.

---

## 10. Permisos

- Prestatario:
  - crear reservas normales y excepcionales;
  - consultar sus reservas;
  - consultar sus propias garantías.
- Gestor:
  - consultar cola;
  - consultar reservas confirmadas;
  - aprobar o rechazar excepciones;
  - rechazar solicitudes en espera;
  - cancelar reservas confirmadas;
  - convertir reservas en préstamos;
  - registrar préstamos excepcionales directos.
- Administrador:
  - lectura de cola e historial si se mantiene el patrón actual;
  - sin acciones sensibles de aprobación o cancelación.

---

## 11. Pruebas y verificación

### Comandos

```bash
docker compose exec backend python manage.py makemigrations --check
docker compose exec backend python manage.py test
cd frontend && npm test && npm run build
git diff --check
```

### Pruebas mínimas por tipo

- Unitarias de servicios.
- API con permisos y validaciones.
- Concurrencia con `TransactionTestCase`.
- Integración inventario-reservas-préstamos.
- Frontend con Vitest para helpers y presentación.
- Prueba manual con `cargar_datos_demo`.

---

## 12. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Doble asignación de instancia | `select_for_update`, transacciones y pruebas de concurrencia |
| Deadlocks por bloqueos | Orden de bloqueo consistente y revisión con pruebas |
| Importaciones circulares | FKs por cadena e importaciones diferidas |
| Migración circular por `Garantia.reserva` | Orden: `reservas/0001` → `prestamos/0009` |
| Autopromociones duplicadas | Servicio idempotente y `on_commit` controlado |
| Material `reservado` oculto en registro de préstamo | Selector de reservas confirmadas independiente |
| Garantías huérfanas | Limpieza de archivos ante error de transacción |
| Excepción salta la cola | Autopromover normales antes de aprobar excepción |
| Regresión en préstamos existentes | Pruebas de alto valor, devolución y doble daño |
| Cron no ejecutado en producción | Documentar cron externo y comando manual |

---

## 13. Plan de commits

### Rama 1

1. `feat(prestamos): agregar indicador de prestamo excepcional`
2. `feat(prestamos): permitir registro excepcional con garantia`
3. `feat(prestamos): duplicar solo puntos de dano en excepciones`
4. `feat(api): crear endpoint de prestamo excepcional`
5. `feat(frontend): integrar flujo de prestamo excepcional`
6. `test(prestamos): cubrir excepcion directa y doble dano`

### Rama 2

1. `feat(reservas): crear modelo, constantes y migraciones`
2. `feat(reservas): implementar creacion y lista de espera`
3. `feat(reservas): implementar autopromocion y expiracion`
4. `feat(inventario): agregar transiciones de instancia reservada`
5. `feat(api): crear endpoints de reservas normales`
6. `feat(reservas): agregar cron de procesamiento`
7. `feat(frontend): crear mis reservas y formulario de reserva`
8. `feat(frontend): crear cola de reservas del gestor`
9. `feat(prestamos): integrar conversion de reservas`
10. `feat(reservas): implementar reserva excepcional y garantia reutilizable`
11. `feat(api): agregar aprobacion y rechazo de excepciones`
12. `test(reservas): cubrir servicios, API y concurrencia`
13. `docs(reservas): documentar cron y flujo operativo`

---

## 14. Definición de terminado

- Las cuatro historias cumplen sus criterios de aceptación.
- No hay migraciones pendientes.
- Pasan las pruebas backend y frontend.
- El flujo manual funciona con datos demo.
- La conversión de reserva no permite doble asignación.
- La excepción directa y la excepción de reserva reutilizan la garantía correctamente.
- La devolución de un préstamo excepcional duplica solo puntos de daño.
- “Mis reservas” y la cola reflejan los estados actualizados.
- El cron está documentado y puede ejecutarse manualmente.
- No se agregaron dependencias innecesarias.
- No se afectaron los flujos existentes de préstamos, devoluciones e inventario.
