# Guion de demostración — Módulos Catálogo/Inventario y Usuarios

> Documento de apoyo para la exposición. **No versionado** (borrador local).
> Cubre la arquitectura, los módulos, las clases, los servicios y el flujo de
> datos de punta a punta (frontend ↔ backend ↔ base de datos) de los módulos
> **inventario** (catálogo + inventario) y **usuarios** (identidad/acceso, roles).

---

## 0. Antes de empezar

### 0.1 Levantar el stack

```bash
docker compose up -d            # db (Postgres 16), backend (Django :8000), frontend (Vite :5173)
docker compose exec backend python manage.py migrate    # idempotente
docker compose exec backend python manage.py check      # "System check identified no issues"
docker compose exec backend python manage.py showmigrations inventario usuarios   # todas [X]
```

- **Frontend:** http://localhost:5173
- **Backend:** http://localhost:8000

### 0.2 Cuentas de prueba

Las crea `backend/apps/usuarios/management/commands/crear_usuarios_prueba.py`
(solo con `DEBUG=True`):

| Email | Rol | Contraseña |
|---|---|---|
| `administrador@presticad.test` | administrador | `PresticadDemo2026!` |
| `gestor@presticad.test` | gestor | `PresticadDemo2026!` |
| `prestatario@presticad.test` | prestatario | `PresticadDemo2026!` |

```bash
docker compose exec backend python manage.py crear_usuarios_prueba
```

### 0.3 Orden del recorrido

1. **Catálogo (público)** → buscar y abrir ficha técnica sin sesión.
2. **Login como gestor.**
3. **Inventario (gestor)** → alta con foto + ejemplares, edición, cambio de estado, baja.
4. **Logout → login como administrador.**
5. **Usuarios/Roles (admin)** → listar, cambiar rol, eliminar.
6. **Registro público (opcional)** → alta de usuario y duplicados.

---

## 1. Arquitectura general

### 1.1 Monolito modular (DDD)

PrestiCad es un **monolito modular**: un único proceso Django, pero organizado
en **apps = Bounded Contexts**, no en capas técnicas. Cada app es autocontenida
(modelos, migraciones, servicios, serializers, vistas, urls) y **solo se comunica
con otras a través de sus servicios**, nunca accediendo a tablas ajenas.

```
backend/apps/
├── compartido/     # utilidades transversales (p. ej. RechazarCamposNoPermitidosMixin)
├── usuarios/       # Bounded Context: Identidad y Acceso
│   ├── models.py        Usuario, Rol, Credencial
│   ├── services.py      registro, autenticación, cambio de rol, reputación
│   ├── serializers.py   contratos JSON (entrada/salida)
│   ├── views.py         endpoints DRF
│   ├── permissions.py   EsAdministrador
│   ├── authentication.py AutenticacionSesionUsuario (DRF)
│   ├── middleware.py    sesión autenticada + expiración por inactividad
│   ├── sesiones.py      claves de sesión (usuario_id, ultima_actividad)
│   ├── auth_urls.py     /api/auth/*  (login, logout, me, csrf)
│   ├── urls.py          /api/usuarios/*
│   └── constants.py     ROLES, TIPOS_USUARIO, ESTADOS_USUARIO, TIERS
├── inventario/     # Bounded Context: Bienes y Conservación
│   ├── models.py        Material (aggregate root), InstanciaMaterial (entity)
│   ├── services.py      registrar/actualizar/eliminar material y ejemplares
│   ├── serializers.py   MaterialSerializer, *Registro*, *Actualizacion*, ...
│   ├── views.py         endpoints DRF
│   ├── permissions.py   EsGestorOAdministrador
│   ├── validators.py    validar_foto (tipo/tamaño)
│   ├── constants.py     TIPOS/ESTADOS, MODOS_REGISTRO_MATERIAL, TIERS_ACCESIBLES
│   └── urls.py          /api/materiales/*, /api/instancias/*
└── prestamos/      # Bounded Context: Ciclo de Préstamo (NO se expone aquí, pero interactúa)
```

`backend/config/` orquesta: `urls.py` monta cada app bajo `/api/` y sirve
`MEDIA` en DEBUG; `settings/{base,development,production}.py` separan config.

### 1.2 Reparto de responsabilidades: qué hace el FRONT y qué hace el BACK

En todo el guion se etiqueta cada paso como **[FRONT]** o **[BACK]**. La regla
general es:

| Responsabilidad | [FRONT] React/Vite | [BACK] Django/DRF |
|---|---|---|
| Vista/UI, navegación, estado local | ✅ | ❌ |
| Validaciones "de cortesía"/UX (campos vacíos, formato visible) | ✅ | ❌ |
| Validaciones **autoritativas** (unicidad, reglas de negocio) | ❌ | ✅ |
| Construcción de la petición (JSON vs. `FormData`, params de URL) | ✅ | ❌ |
| Cookie de sesión + `X-CSRFToken` | ✅ (los envía) | ✅ (los valida) |
| Autenticación y control de acceso (roles) | ❌ (solo oculta/redirige) | ✅ (`EsAdministrador`, `EsGestorOAdministrador`) |
| Persistencia, integridad, transacciones | ❌ | ✅ (`transaction.atomic`, `unique`) |
| Generación de mensajes de error de negocio | ❌ (los muestra) | ✅ (los origina) |
| Conversión a/de JSON y forma del contrato | parcial (serializa) | ✅ (serializers) |

> **Importante:** las validaciones del frontend son solo para *feedback rápido*.
> La **verdad** está en el backend: aunque se salte la UI con `curl`, el backend
> rechaza lo inválido igual.

### 1.3 Cadena de una petición

El patrón de **toda** petición es siempre el mismo. Las etiquetas indican en qué
lado corre cada paso:

```
[FRONT]  Usuario interactúa (React)  → estado local + validación de cortesía
[FRONT]  api.js / client.js  → fetch(`${API_URL}/...`, credentials:'include', X-CSRFToken)
   │
   │  HTTP JSON / multipart
   ▼
[FRONT]  Vite dev server  ──proxy /api──►  http://backend:8000
   │
   ▼
[BACK]   URLconf (config/urls.py → apps/<app>/urls.py)   ← enruta
[BACK]   View (DRF)          ← permisos + parsers + elige serializer
[BACK]      1. serializer.is_valid()          → valida FORMA (tipos, requeridos, choices, archivos)
[BACK]      2. services.<regla_de_negocio>()  → valida REGLAS y persiste (transaction.atomic)
[BACK]   Model (ORM)  ──►  PostgreSQL
[BACK]   Serializer de salida → JSON con su código HTTP
   │
   ▼
[FRONT]  client.js recibe → if !ok lanza ErrorApi(status, datos)
[FRONT]  La página pinta datos o traduce el error a un mensaje visible
```

**Qué hacer en cada capa:**
- **[FRONT]** valida *forma visible* y UX, arma la petición, muestra errores; nunca
  decide reglas de negocio.
- **[BACK]** valida *reglas*, autoriza, persiste de forma atómica y produce el
  contrato JSON. Es la **única** fuente de verdad.

Regla clave: **las vistas son delgadas**. No contienen lógica de negocio; la
delegan a `services.py`. Los serializers validan *forma*; los servicios validan
*reglas* (unicidad, estado inicial, defaults, transacciones). Los errores de
negocio viajan como `{ "campo": ["mensaje en español"] }` con su código HTTP.

### 1.4 El cliente API del frontend [FRONT]

`frontend/src/api/client.js` centraliza todas las llamadas (`api.get/post/put/patch/delete`):

- `API_URL = '/api'`; el dev server de Vite proxya `/api` → `http://backend:8000`
  (`frontend/vite.config.js`). Same-origin → sin CORS en dev.
- `credentials: 'include'`: la cookie de sesión viaja siempre.
- `X-CSRFToken` (leído de la cookie `csrftoken`) se añade en POST/PUT/PATCH/DELETE.
- Si el body es `FormData`, **no** se fija `Content-Type` (el navegador pone
  `multipart/form-data` con su `boundary`).
- Los errores se normalizan a `ErrorApi(status, datos)`; las páginas leen
  `error.datos` para mostrar los errores de campo del backend.

### 1.5 Sesión, autenticación y CSRF (transversal a todo)

No hay tokens: **sesiones Django** sobre cookie.

1. **[FRONT]** `Login.jsx` envía `POST /api/auth/login/` con `{email, password}`.
   **[BACK]** `AuthLoginView` → `services.autenticar_usuario`:
   - `check_password(password, credencial.password_hash)`,
   - control de bloqueo (`failed_attempts`, `locked_until`; 5 fallos → 15 min → `423`),
   - en éxito: `request.session.cycle_key()` (evita *session fixation*) y
     `registrar_sesion_activa` guarda `usuario_id` + `ultima_actividad`.
   - **[FRONT]** guarda el usuario devuelto en `SesionContext` y redirige según rol.
2. **[BACK] Cada request** pasa por `SesionAutenticadaMiddleware`, que lee
   `session['usuario_id']` y expone `request.usuario_autenticado`.
   `ExpiracionSesionInactividadMiddleware` cierra la sesión tras
   `SESSION_IDLE_TIMEOUT_MINUTES`.
3. **[BACK] DRF**: `AutenticacionSesionUsuario` (subclase de `SessionAuthentication`)
   devuelve el `Usuario` del dominio (solo `estado="activo"`) y aplica
   `enforce_csrf`.
4. **[FRONT] Al recargar la SPA**: `App.jsx` llama a `GET /api/auth/me/`; si hay
   cookie válida repuebla `SesionContext`, si no `usuario = null`.
5. **[FRONT] Guards del router** (`frontend/src/router/Guards.jsx`) — *ocultan*
   rutas, pero el **control real lo repite el backend** en cada endpoint:
   - `RequerirSesion`: sin sesión → `/login`.
   - `RequerirRol({roles})`: rol no autorizado → `/panel`.
   - `RedirigirAutenticado`: con sesión, `/login` y `/registro` redirigen a `/panel`.

> **Frase para la exposición:** el front *oculta* lo que el usuario no puede
> hacer (UX); el back lo *impide* (seguridad). Nunca se confía solo en el front.

---

## 2. Módulo Inventario (`apps.inventario`)

### 2.1 Modelo de datos (DDD) [BACK]

- **`Material`** — *Aggregate Root* del contexto. Identidad `UUID`. Agrupa:
  - identidad/clasificación: `nombre`, `descripcion`, `codigo_inventario` (único),
    `tipo` (`equipo|libro|objeto`), `estado` (`disponible|prestado|reservado|en_mantenimiento`),
    `es_alto_valor` (RN05: exige garantía);
  - ficha técnica (*value object* `FichaTecnica`): `marca`, `modelo`,
    `numero_serie`, `color`, `estado_fisico`, `foto` (`ImageField`, valida
    tipo/tamaño, `upload_to=ruta_foto`);
  - parámetros de reputación (*value object* `AtributosReputacion`, RN06):
    `tier_minimo_requerido`, `bonificacion_tiempo`, `deduccion_tardanza`,
    `deduccion_dano_parcial`, `deduccion_dano_total`, `costo_reparacion`,
    `costo_reposicion`; los puntos se validan en rango `[0, 500]`;
  - `stock` (unidades registradas).
  - `Meta`: `ordering=["nombre"]`, índices por `estado` y `tipo`.
  - Métodos de dominio: `esta_disponible()` (RN01), `requiere_garantia()` (RN05),
    propiedades `total_instancias` y `resumen_estados` (desglose por estado).
- **`InstanciaMaterial`** — *Entity* (copia física). FK a `Material`
  (`related_name="instancias"`, `on_delete=CASCADE`). `codigo_ejemplar` **único**,
  `numero_serie`, `estado` (`disponible|reservado|prestado|en_mantenimiento|de_baja`),
  `estado_fisico`, `color`, `foto`, `observaciones`, `ubicacion`.
  `Meta`: índices por `(material, estado)` y por `codigo_ejemplar`.

> **Punto expositivo:** *Material* = "modelo comercial", *InstanciaMaterial* =
> "unidad física concreta". Un material con 3 laptops tiene 3 instancias, cada
> una con su código patrimonial. `stock` es el contador del agregado; las
> instancias son la verdad física.

`ruta_foto()` genera `materiales/<año>/<mes>/<token12>.<ext>`: el token aleatorio
evita colisiones de nombre; ordena carpetas por fecha.

### 2.2 Endpoints [BACK]

| Método | Ruta | Permiso | Vista |
|---|---|---|---|
| GET | `/api/materiales/` | público | `MaterialListCreateView` |
| POST | `/api/materiales/` | gestor/admin | `MaterialListCreateView` |
| GET | `/api/materiales/buscar/?q=&categoria=&estado=` | público (`AllowAny`) | `MaterialSearchView` |
| GET/PUT/PATCH/DELETE | `/api/materiales/<uuid>/` | lectura público / escritura gestor-admin | `MaterialDetailView` |
| GET/POST | `/api/materiales/<uuid>/instancias/` | lectura público / escritura gestor-admin | `InstanciaMaterialListCreateView` |
| GET/PUT/PATCH/DELETE | `/api/instancias/<uuid>/` | lectura público / escritura gestor-admin | `InstanciaMaterialDetailView` |

Rutas en `backend/apps/inventario/urls.py`, montadas en `config/urls.py` con
`path("api/", include("apps.inventario.urls"))`.

### 2.3 Permisos (`permissions.py`) [BACK]

`EsGestorOAdministrador`:
- `METODOS_DE_SOLO_LECTURA = ("GET","HEAD","OPTIONS")` → **públicos** (el catálogo
  lo ve cualquiera, sin sesión).
- Escritura: exige `request.usuario_autenticado` con `rol` ∈ `{gestor, administrador}`.
- La denegación se lanza como `PermissionDenied` con mensaje de dominio (no
  `False`) **porque** la autenticación no pasa por los autenticadores estándar de
  DRF; `False` daría el mensaje genérico "credenciales no proveyeron".

### 2.4 Serializers (contratos JSON) [BACK]

`serializers.py` separa lectura y escritura:

- **Salida** `MaterialSerializer` (ModelSerializer) — campos:
  - escalares + `CAMPOS_FICHA_Y_REPUTACION`;
  - `unidades_disponibles` (`SerializerMethodField`): combina instancias
    `disponible` con los préstamos vigentes. Consulta al módulo préstamos vía
    `contar_unidades_prestadas_por_material` (servicio), **nunca** su tabla;
  - `instancias` (`SerializerMethodField`): lista de instancias serializadas;
  - `resumen_instancias`: desglose por estado;
  - `foto` (`FotoMaterial`).
  - `MaterialListSerializer` (ListSerializer) **optimiza en lote**: resuelve el
    conteo de préstamos de todos los materiales en una sola llamada (evita N+1).
- **Entrada alta** `MaterialRegistroSerializer` (`RechazarCamposNoPermitidosMixin`):
  - `estado` **no** está en el contrato (nace `disponible`, criterio 6);
  - la unicidad de `codigo_inventario` **no** se valida aquí → se delega al
    servicio para poder devolver `409` en vez de `400`;
  - `modo` (`unico|lote|detalle`), `ubicacion`, `instancias` (`InstanciasJSONField`),
    `foto` (`ImageField` con `validators=[validar_foto]`, `allow_empty_file=False`).
- **Entrada edición** `MaterialActualizacionSerializer` (mismo mixin).
- **Instancias**: `InstanciaMaterialSerializer` (lectura),
  `InstanciaMaterialModificacionSerializer` (edición),
  `InstanciaMaterialCreacionSerializer` (alta, `codigo_ejemplar` requerido).

Helpers clave:
- `FotoMaterial.to_representation`: antepone `MEDIA_URL_PUBLICA`. Existe porque
  DRF usaría `request.build_absolute_uri()` → en dev el Host del contenedor
  (`backend:8000`), que el navegador no resuelve; sin contexto daría una ruta
  relativa que Vite tampoco proxea. En producción devuelve la URL absoluta de
  Cloudinary tal cual.
- `InstanciasJSONField`: acepta lista JSON o **cadena JSON** (en multipart todo
  viaja como texto).
- `RechazarCamposNoPermitidosMixin` (`apps/compartido`): rechaza campos fuera del
  contrato → `400` (defensa contra mass assignment).

### 2.5 Servicios (`services.py`) — reglas de negocio [BACK]

- `InventarioError(campo, mensaje, status_code=400, indice=None)` y
  `MaterialNoEncontradoError`: excepciones de dominio con campo+mensaje+HTTP.
- `normalizar_codigo`: `strip().upper()` → unicidad insensible a mayúsculas.
- `parametros_reputacion_por_defecto`: copia de `settings.MATERIALES_REPUTACION_DEFAULTS` (T04.04).
- `registrar_material(**datos)` — `@transaction.atomic`:
  1. normaliza y `_verificar_codigo_disponible` (duplicado → `409`);
  2. valida nombre y stock ≥ 1;
  3. resuelve el `modo`:
     - `unico` → 1 ejemplar `CODIGO-01`;
     - `None` → genera `stock` ejemplares `CODIGO-01..N`;
     - `lote`/`detalle` → 2..`MAXIMO_EJEMPLARES_REGISTRO` (50) filas;
  4. valida foto de portada y de cada fila (`validar_foto`);
  5. deduplica `codigo_ejemplar` **en memoria** (`casefold()`) y contra la BD;
  6. aplica defaults de reputación (lo informado gana);
  7. crea `Material` + instancias; en excepción **elimina las fotos ya subidas**
     (rollback de storage) y traduce `IntegrityError` a `409` legible.
- `actualizar_material(id, **campos)` — `@transaction.atomic`: solo persiste
  `CAMPOS_EDITABLES` (identificadores/timestamps son invariantes); recorta
  espacios de `CAMPOS_TEXTO`; código duplicado → `409`.
- `eliminar_material(id)`: **bloquea** si el material o alguna instancia está
  `prestado`/`reservado` (`409`) o si hay historial de préstamos (`ProtectedError`
  → `409`). Si borra, elimina fotos con `transaction.on_commit(...)` (nunca antes
  del commit).
- `buscar_materiales(q, categoria/tipo, estado)`: `nombre__icontains=q`,
  `tipo=<categoria>`, `estado=<estado>`, con `prefetch_related("instancias")`.
- Instancias: `listar_instancias_material`, `crear_instancias_material`
  (lote, valida cada fila), `actualizar_instancia_material`,
  `eliminar_instancia_material`.

`validators.validar_foto`: ≤ 5 MB y `content_type` ∈ {jpeg, png, webp}. El
`ImageField` además abre el archivo con Pillow, así que un archivo falso se
descarta aunque el `content_type` mienta.

### 2.6 Vistas y flujo multipart [BACK]

Todo el bloque siguiente es backend (paths Django/DRF):

- `MaterialListCreateView.create`: si `content_type` empieza por `multipart/`,
  reconstruye el body con una **copia superficial** (`QueryDict.copy()` falla con
  los streams de archivos), parsea `instancias` (JSON string) y **inyecta** cada
  `instancia_foto_<i>` en su fila. Luego `MaterialRegistroSerializer` →
  `services.registrar_material`. `InventarioError` → `{campo:[msg]}` con su
  `status_code`; `DjangoValidationError` (foto) → `400`.
- `MaterialDetailView`: `PUT/PATCH` → `MaterialActualizacionSerializer` →
  `actualizar_material` (código duplicado → `409`, resto → `400`). El **cambio de
  estado es un `PATCH`** con `{estado}` (criterio 8). `DELETE` → `eliminar_material`.
- `MaterialSearchView`: lee `q`, `categoria` (o `tipo`), `estado` de `query_params`.
- `InstanciaMaterialListCreateView.create`: acepta un **lote** de filas o una
  sola instancia; valida cada fila y devuelve errores por índice
  (`{"instancias": [ {...}, {...} ]}` o `{indice, campo, mensaje}`).

### 2.7 Frontend del módulo [FRONT]

Todo el bloque siguiente es frontend (paths React/Vite):

- **Catálogo** `pages/CatalogoMateriales.jsx` (rutas `/catalogo` y `/panel/catalogo`,
  pública): `BarraBusqueda` → `buscarMateriales` construye `URLSearchParams` →
  `api.get('/materiales/buscar/?...')` → `ResultadosMateriales` (tarjetas) →
  `FichaTecnicaModal` (ficha completa). **Solo arma la consulta y pinta**; el
  filtrado real lo hace el backend.
- **Inventario** `pages/Materiales.jsx` (`/panel/inventario`, `RequerirRol(['gestor','administrador'])`):
  listado `GET /materiales/`, alta/edición con `MaterialForm`, ficha,
  eliminación con `ConfirmacionDobleEliminacion`.
- **`components/MaterialForm.jsx`**:
  - `construirCampos()`: recorta strings; costos vacíos → `null` (limpian en
    edición); en alta añade `stock`, `numero_serie`, `estado_fisico`; en edición
    añade `estado`.
  - `construirCuerpo()`: sin foto nueva → JSON; con foto → `FormData` (los `null`
    se convierten en `''` porque DRF los traduce a null en campos nullable).
  - Lógica de ejemplares en `inventario/registroMaterial.js`
    (`construirCuerpoRegistroMaterial`, `validarCodigosDuplicados`,
    `validarFotosEjemplares`, `construirCuerpoConFotos`): arma el multipart con
    `instancias` como **JSON string** y `instancia_foto_<i>` por fila.
  - `mostrarErroresDelBackend`: mapea `{campo:[msg]}` e `{indice,...}` a errores
    de formulario y de fila.
  - Edición con alcance: `EditorInstanciasMaterial` / `AgregarEjemplaresMaterial`
    (editar un ejemplar, aplicar campos a todos, datos generales).

### 2.8 Fotos y MEDIA (verificar en vivo) [BACK, servido al FRONT]

`config/settings/development.py`:
- `MEDIA_URL = "media/"` **(sin barra inicial)**; `MEDIA_ROOT = BASE_DIR / "media"`.
- `MEDIA_URL_PUBLICA = "http://localhost:8000"` → prefijo de las URLs de foto.
- `urls.py`: `static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)` en DEBUG.

> **Riesgo:** si al subir/ver una foto la `<img>` sale rota, es por la barra
> faltante. Corregir a `MEDIA_URL = "/media/"`. **Probar subiendo una foto antes
> de exponer.**

---

## 3. Módulo Usuarios (`apps.usuarios`)

### 3.1 Modelo de datos [BACK]

- **`Rol`** — entidad propia (`nombre` único con choices `ROLES`, `descripcion`).
  Antes era un choice embebido en `Usuario`; se extrajo (PRTCAD-35) para poder
  relacionarlo por FK y, a futuro, darle permisos granulares.
- **`Usuario`** — `email` único, `nombre`, `apellido`, `dni` (8 dígitos, único),
  `telefono`, `tipo` (alumno/docente/administrativo), `facultad`,
  `departamento_carrera`, **`rol` (FK a `Rol`, `on_delete=PROTECT`)** con
  `default=rol_prestatario_por_defecto`, `estado` (activo/inactivo),
  `reputacion_puntaje` (`[-500,500]`), `reputacion_tier`.
  - `is_authenticated` → `True` (para satisfacer a DRF).
  - `rol_prestatario_por_defecto()`: `get_or_create` del rol prestatario.
- **`Credencial`** — 1:1 con `Usuario` (`related_name="credencial"`): `email`
  (login), `password_hash` (bcrypt/`make_password`), `failed_attempts`,
  `locked_until`. Separa **identidad** de **credenciales**.

> **Punto expositivo:** `tipo` (vinculación institucional) y `rol` (permisos) son
> **independientes**: un alumno puede ser gestor sin dejar de ser alumno.

### 3.2 Endpoints [BACK]

| Método | Ruta | Permiso | Vista |
|---|---|---|---|
| POST | `/api/usuarios/` | público (`AllowAny`) | `UsuarioListCreateView` |
| GET | `/api/usuarios/` | admin | `UsuarioListCreateView` |
| PUT | `/api/usuarios/<id>/rol/` | admin | `UsuarioRolView` |
| DELETE | `/api/usuarios/<id>/` | admin | `UsuarioEliminarView` |
| GET | `/api/auth/me/` | sesión | `SesionActualView` |
| POST | `/api/auth/login/` · `/logout/` | — | `AuthLoginView` · `AuthLogoutView` |
| GET | `/api/auth/csrf/` | — | `csrf_token` |
| GET/PUT | `/api/usuarios/perfil/` | sesión | `PerfilUsuarioView` |

`EsAdministrador` (`permissions.py`): sesión con `rol.nombre == "administrador"`.

### 3.3 Servicios (`services.py`) [BACK]

- `autenticar_usuario(email, password)`: busca credencial (`email__iexact`),
  comprueba bloqueo, `check_password`; cada fallo incrementa `failed_attempts`
  (≥ 5 → `locked_until = now + 15min`); éxito → reinicia intentos y devuelve el
  usuario (solo si `estado == "activo"`). Mensajes genéricos ("El email o la
  contraseña son incorrectos") para no filtrar qué falla.
- `registrar_usuario(...)`: normaliza email a minúsculas, comprueba duplicados de
  `email`/`dni`, y en `transaction.atomic` crea `Usuario` + `Credencial`
  (password hasheada). `IntegrityError` (carrera) → mismo mensaje legible.
- `cambiar_rol_usuario(id, nuevo_rol)`: valida que el rol exista
  (`RolInvalidoError`), obtiene el usuario (`UsuarioNoEncontradoError`) y
  persiste `save(update_fields=["rol","updated_at"])`. *(Nota: la validación de
  "préstamos activos" vive en el flujo de eliminación; el cambio de rol aquí no
  la exige.)*
- `usuario_tiene_prestamos_activos(id)`: **contrato entre módulos** — llama a
  `apps.prestamos.services.tiene_prestamos_activos`, sin tocar su tabla.
- Reputación (RN03): `puntaje_reputacion_ajustado` (clamp `[-500,500]`),
  `tier_por_puntaje` (avanzado 201..500, estándar -50..200, restringido -500..-51),
  `actualizar_reputacion` (delta + reclasificación de Tier).

### 3.4 Serializers y flujo de roles [BACK]

- `UsuarioSerializer`: `fields="__all__"` (salida del registro).
- `UsuarioListaSerializer`: lista administrativa; `rol` como **slug de texto**
  (`SlugRelatedField`), más `reputacion_puntaje`, `reputacion_tier`, `estado`.
- `CambioRolSerializer`: **solo `rol` es escribible**; el resto (`tipo`, `email`,
  `dni`, `estado`) se muestran como contexto pero no se pueden modificar desde
  aquí (mantiene independencia tipo ↔ rol, HU02 criterio 3). `rol` se expone como
  código de texto, no como id interno.
- `UsuarioRegistroSerializer` (`RechazarCamposNoPermitidosMixin`): entrada del
  alta pública; valida DNI (8 dígitos) y forma; duplicados → servicio → `409`.
- `LoginSerializer`, `SesionUsuarioSerializer`, `PerfilUsuarioSerializer`,
  `ActualizarPerfilSerializer`, `CredencialSerializer`.

### 3.5 Flujo de la gestión de roles (admin)

1. **[FRONT]** `UsuariosRoles.jsx` monta → `api.get('/usuarios/')`.
   **[BACK]** `UsuarioListCreateView` (GET, `EsAdministrador`) →
   `UsuarioListaSerializer`.
2. **[FRONT]** El selector de rol de cada fila → `api.put('/usuarios/<id>/rol/', {rol})`.
   **[BACK]** `UsuarioRolView.update` → `cambiar_rol_usuario` (valida rol y persiste).
3. **[FRONT]** La UI actualiza solo esa fila con el rol devuelto (sin recargar todo).
4. **[FRONT]** Botón eliminar → `api.delete('/usuarios/<id>/')`.
   **[BACK]** `UsuarioEliminarView` → `usuario_tiene_prestamos_activos`; si tiene
   préstamos activos → `409`, si no → `204`.
5. **[FRONT]** `RegistroUsuario.jsx` → `POST /api/usuarios/`.
   **[BACK]** `registrar_usuario`; duplicados → `409` con `{campo:[mensaje]}`.

---

## 4. Validación previa a la demo

```bash
# Backend: solo estos módulos
docker compose exec backend python manage.py test apps.inventario apps.usuarios

# Frontend: lógica pura + build
docker compose exec frontend sh -c "npm test && npm run build"
```

Checklist manual en el navegador:

- [ ] `/catalogo` busca y abre ficha técnica **sin** sesión.
- [ ] Login gestor → `/panel/inventario` carga el listado.
- [ ] Alta de material con **foto** y **≥2 ejemplares**; la foto se ve (§2.8).
- [ ] Editar material y cambiar de estado (`PATCH {estado}`).
- [ ] Intentar borrar un material prestado → mensaje de bloqueo (`409`).
- [ ] Login admin → `/admin/roles` lista usuarios y cambia un rol.
- [ ] Registrar usuario público y probar email/DNI duplicado → error claro.
- [ ] Logout y verificar que `/panel/inventario` redirige/bloquea.

---

## 5. Preguntas técnicas probables (con respuesta corta)

- **¿Por qué no hay CORS en la demo?** El proxy de Vite hace same-origin `/api`;
  `CORS_ALLOWED_ORIGINS` existe para otros orígenes.
- **¿Cómo se evita doble código de inventario?** Normalización a mayúsculas +
  verificación en el servicio + `unique` en el modelo → `409`.
- **¿Dónde vive la lógica de negocio?** En `services.py` de cada app; vistas
  delgadas, serializers solo validan forma. Comunicación entre módulos por
  servicios, nunca por tablas ajenas.
- **¿Cómo se protege la escritura del inventario?** `EsGestorOAdministrador` sobre
  `request.usuario_autenticado`; lectura pública.
- **¿Cómo se relacionan tipo y rol?** Independientes; el endpoint de rol no toca
  `tipo`.
- **¿Cómo se manejan archivos?** `MultipartParser` solo en las vistas de
  inventario; fotos validadas (tipo/tamaño) y servidas por `MEDIA`; las fotos se
  borran solo tras commit.
- **¿Por qué `Credencial` separada de `Usuario`?** Separa identidad de
  credenciales (hash, intentos, bloqueo) y facilita su ciclo de vida propio.
- **¿Cómo se evita el N+1 al listar?** `MaterialListSerializer` resuelve el conteo
  de préstamos de todos los materiales en una sola llamada.
