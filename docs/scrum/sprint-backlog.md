# Sprint Backlog — Sistema de Préstamos Académicos

> Estructura: **MVP (4 sprints)** + **Full Product (5 sprints)** = 9 sprints, 90 SP, 18 historias, 133 tareas.

---

## Modelo de dominio

```
Credencial                      Usuario
├── id                          ├── id
├── usuario_id (FK)             ├── credencial_id (FK)
├── email (para login)          ├── email (para contacto)
├── password_hash               ├── nombre, apellido
├── failed_attempts             ├── dni, telefono
└── locked_until                ├── tipo, rol, estado
                                ├── reputacion_puntaje (-500 a 500)
                                ├── reputacion_tier (Avanzado/Estándar/Restringido)
                                └── created_at, updated_at

Material                        Prestamo
├── id                          ├── id
├── nombre, descripcion         ├── usuario_id (FK)
├── categoria                   ├── material_id (FK)
├── estado                      ├── fecha_entrega, fecha_limite
├── codigo_unico                ├── tiempo_prestamo_dias
├── tier_minimo_requerido       ├── estado (Activo/Devuelto/Vencido)
├── bonificacion_tiempo         ├── garantia (nullable)
├── deduccion_tardanza          ├── checklist_inicial (JSON)
├── deduccion_dano_parcial      ├── checklist_devolucion (JSON)
└── deduccion_dano_total        └── tipo (Normal/Excepción)

Reserva
├── id
├── usuario_id (FK)
├── material_id (FK)
├── prioridad (Alta/Media/Baja)
├── justificacion
├── estado (Reservada/Cancelada/Completada)
├── fecha_solicitud
└── fecha_limite_recojo
```

---

# FASE 1: MVP

> Objetivo: Un usuario puede registrarse, autenticarse, ver materiales, pedir prestado y devolver. **El sistema ya sirve.**

---

## M1 — Usuarios + Auth + Roles + Perfil

**Objetivo:** Los usuarios pueden registrarse, autenticarse, el admin asigna roles y el usuario ve su perfil.

**Historias:** HU01, HU03, HU02, HU16

| ID | Historia | SP | Tareas |
|----|----------|-----|--------|
| HU01 | Registrar usuario | 3 | 8 |
| HU03 | Iniciar sesión | 5 | 8 |
| HU02 | Gestionar roles y permisos | 3 | 7 |
| HU16 | Consultar y actualizar perfil | 3 | 7 |
| | **Total** | **14 SP** | **30 tareas** |

### Tareas detalladas

**HU01 — Registrar usuario (8 tareas)**

| # | Tarea | Tipo |
|---|-------|------|
| T01.01 | Definir modelo de entidad Usuario (nombre, apellido, email, DNI, teléfono, tipo, rol, estado, reputación) | Backend |
| T01.02 | Crear migración/DDL de la tabla usuarios | Backend |
| T01.03 | Implementar servicio de registro con validación de email y DNI duplicados | Backend |
| T01.04 | Asignar Tier inicial Neutral (0 pts) al crear usuario | Backend |
| T01.05 | Crear endpoint POST /api/usuarios | Backend |
| T01.06 | Crear formulario de registro de usuario (Admin) | Frontend |
| T01.07 | Implementar validación de formulario y mensajes de error | Frontend |
| T01.08 | Integrar formulario con endpoint de registro | Integración |

**HU03 — Iniciar sesión (8 tareas)**

| # | Tarea | Tipo |
|---|-------|------|
| T03.01 | Definir modelo de entidad Credencial (email, password_hash, failed_attempts, locked_until) | Backend |
| T03.02 | Implementar servicio de autenticación (bcrypt) con entidad Credencial | Backend |
| T03.03 | Implementar bloqueo de cuenta tras 5 intentos fallidos | Backend |
| T03.04 | Implementar expiración de sesión por inactividad | Backend |
| T03.05 | Crear endpoints POST /api/auth/login y logout | Backend |
| T03.06 | Crear pantalla de login | Frontend |
| T03.07 | Implementar redirección según rol post-login | Frontend |
| T03.08 | Integrar login con endpoints | Integración |

**HU02 — Gestionar roles y permisos (7 tareas)**

| # | Tarea | Tipo |
|---|-------|------|
| T02.01 | Definir modelo de entidad Rol y relación con Usuario | Backend |
| T02.02 | Implementar servicio de cambio de rol con validación | Backend |
| T02.03 | Crear middleware de autorización por roles | Backend |
| T02.04 | Crear endpoints GET /api/usuarios y PUT /api/usuarios/{id}/rol | Backend |
| T02.05 | Crear vista de lista de usuarios con columna de rol editable | Frontend |
| T02.06 | Implementar selector de rol con opciones | Frontend |
| T02.07 | Integrar vista con endpoints | Integración |

**HU16 — Consultar y actualizar perfil (7 tareas)**

| # | Tarea | Tipo |
|---|-------|------|
| T16.01 | Implementar servicio de consulta de perfil con datos del usuario | Backend |
| T16.02 | Implementar servicio de actualización de perfil (solo nombre y teléfono) | Backend |
| T16.03 | Crear endpoints GET /api/usuarios/perfil y PUT /api/usuarios/perfil | Backend |
| T16.04 | Crear vista de perfil con datos personales | Frontend |
| T16.05 | Crear formulario de edición de perfil (campos restringidos readonly) | Frontend |
| T16.06 | Implementar validación de campos editables vs readonly | Frontend |
| T16.07 | Integrar vista con endpoints | Integración |

---

## M2 — Inventario + Búsqueda

**Objetivo:** El administrador registra materiales y los usuarios pueden buscar y filtrar.

**Historias:** HU04, HU05

| ID | Historia | SP | Tareas |
|----|----------|-----|--------|
| HU04 | Registrar material en inventario | 5 | 8 |
| HU05 | Buscar y consultar materiales | 3 | 6 |
| | **Total** | **8 SP** | **14 tareas** |

### Tareas detalladas

**HU04 — Registrar material en inventario (8 tareas)**

| # | Tarea | Tipo |
|---|-------|------|
| T04.01 | Definir modelo de entidad Material (nombre, descripción, categoría, estado, código único, parámetros de reputación) | Backend |
| T04.02 | Crear migración/DDL de la tabla materiales | Backend |
| T04.03 | Implementar servicio CRUD de materiales con validación de código único | Backend |
| T04.04 | Implementar valores por defecto para parámetros de reputación | Backend |
| T04.05 | Crear endpoints POST/GET/PUT /api/materiales | Backend |
| T04.06 | Crear formulario de registro/edición de material | Frontend |
| T04.07 | Crear vista de listado de materiales | Frontend |
| T04.08 | Integrar formularios con endpoints | Integración |

**HU05 — Buscar y consultar materiales (6 tareas)**

| # | Tarea | Tipo |
|---|-------|------|
| T05.01 | Implementar servicio de búsqueda con filtros | Backend |
| T05.02 | Implementar filtrado por Tier del usuario | Backend |
| T05.03 | Crear endpoint GET /api/materiales/buscar | Backend |
| T05.04 | Crear componente de barra de búsqueda con filtros | Frontend |
| T05.05 | Crear vista de resultados con tarjetas de material | Frontend |
| T05.06 | Integrar búsqueda con endpoint | Integración |

---

## M3 — Préstamos

**Objetivo:** El gestor puede registrar préstamos con checklist digital y garantía.

**Historias:** HU09

| ID | Historia | SP | Tareas |
|----|----------|-----|--------|
| HU09 | Registrar préstamo (entrega de material) | 8 | 10 |
| | **Total** | **8 SP** | **10 tareas** |

### Tareas detalladas

**HU09 — Registrar préstamo (10 tareas)**

| # | Tarea | Tipo |
|---|-------|------|
| T09.01 | Definir modelo de entidad Prestamo (usuario, material, fechas, estado, garantía, checklist) | Backend |
| T09.02 | Crear migración/DDL de la tabla prestamos | Backend |
| T09.03 | Implementar servicio de préstamo con verificación de elegibilidad (Tier, impedimentos) | Backend |
| T09.04 | Implementar checklist digital de estado inicial | Backend |
| T09.05 | Implementar registro de garantía para equipos de alto valor | Backend |
| T09.06 | Implementar cálculo automático de fecha límite de devolución | Backend |
| T09.07 | Crear endpoint POST /api/prestamos | Backend |
| T09.08 | Crear formulario de registro de préstamo con checklist | Frontend |
| T09.09 | Implementar validación de garantía obligatoria antes de confirmar | Frontend |
| T09.10 | Integrar formulario con endpoint | Integración |

---

## M4 — Devoluciones + Ver mis préstamos

**Objetivo:** Las devoluciones calculan sanciones/bonificaciones automáticamente; el usuario ve sus préstamos.

**Historias:** HU11, HU10

| ID | Historia | SP | Tareas |
|----|----------|-----|--------|
| HU11 | Registrar devolución con cálculo de sanciones | 8 | 10 |
| HU10 | Consultar estado de mis préstamos | 3 | 6 |
| | **Total** | **11 SP** | **16 tareas** |

### Tareas detalladas

**HU11 — Registrar devolución con cálculo de sanciones (10 tareas)**

| # | Tarea | Tipo |
|---|-------|------|
| T11.01 | Implementar servicio de devolución con comparación de checklists | Backend |
| T11.02 | Implementar lógica de cálculo de sanciones parametrizada por objeto | Backend |
| T11.03 | Implementar bonificación por entrega a tiempo | Backend |
| T11.04 | Implementar descuento de puntos por tardanza proporcional | Backend |
| T11.05 | Implementar penalización + cobro por daño parcial/total | Backend |
| T11.06 | Implementar actualización de reputación y estados | Backend |
| T11.07 | Crear endpoint POST /api/prestamos/{id}/devolucion | Backend |
| T11.08 | Crear formulario de devolución con checklist de comparación | Frontend |
| T11.09 | Mostrar resumen de sanciones/bonificaciones antes de confirmar | Frontend |
| T11.10 | Integrar formulario con endpoint | Integración |

**HU10 — Consultar estado de mis préstamos (6 tareas)**

| # | Tarea | Tipo |
|---|-------|------|
| T10.01 | Implementar servicio de consulta de préstamos por usuario con estados | Backend |
| T10.02 | Crear endpoint GET /api/prestamos/mis-prestamos | Backend |
| T10.03 | Crear vista de lista de préstamos con código de color por estado | Frontend |
| T10.04 | Implementar filtro por estado | Frontend |
| T10.05 | Crear vista de detalles del préstamo al seleccionar | Frontend |
| T10.06 | Integrar vista con endpoint | Integración |

---

> **Fin del MVP.** El sistema permite: registrar usuarios, autenticarse, gestionar roles, ver perfil, buscar materiales, registrar préstamos, devolver y ver mis préstamos.

---

# FASE 2: FULL PRODUCT

> Objetivo: Agregar reputación, reservas, prórrogas, excepciones, historial y reportes.

---

## S5 — Reputación + Tiers

**Objetivo:** El sistema calcula reputación y Tiers de acceso basado en el comportamiento del usuario.

**Historias:** HU12

| ID | Historia | SP | Tareas |
|----|----------|-----|--------|
| HU12 | Gestionar reputación y Tiers de acceso | 8 | 5 |
| | **Total** | **8 SP** | **5 tareas** |

### Tareas detalladas

**HU12 — Gestionar reputación y Tiers de acceso (5 tareas)**

| # | Tarea | Tipo |
|---|-------|------|
| T12.01 | Implementar servicio de reputación con rango [-500, 500] sobre campos de Usuario | Backend |
| T12.02 | Implementar cálculo automático de Tier según puntaje | Backend |
| T12.03 | Implementar clamping de puntos (no salir del rango) | Backend |
| T12.04 | Crear endpoint GET /api/usuarios/{id}/reputacion | Backend |
| T12.05 | Mostrar puntaje y Tier en perfil de usuario | Frontend |

---

## S6 — Reservas + Cancelación

**Objetivo:** Los usuarios pueden reservar materiales y el sistema cancela automáticamente las vencidas.

**Historias:** HU06, HU07

| ID | Historia | SP | Tareas |
|----|----------|-----|--------|
| HU06 | Reservar material | 5 | 8 |
| HU07 | Cancelación automática de reservas vencidas | 5 | 6 |
| | **Total** | **10 SP** | **14 tareas** |

### Tareas detalladas

**HU06 — Reservar material (8 tareas)**

| # | Tarea | Tipo |
|---|-------|------|
| T06.01 | Definir modelo de entidad Reserva (usuario, material, prioridad, justificación, estado, timestamps) | Backend |
| T06.02 | Crear migración/DDL de la tabla reservas | Backend |
| T06.03 | Implementar servicio de reserva con validación de Tier y disponibilidad | Backend |
| T06.04 | Implementar cambio de estado del material a Reservado | Backend |
| T06.05 | Crear endpoint POST /api/reservas | Backend |
| T06.06 | Crear formulario de reserva (prioridad, justificación) | Frontend |
| T06.07 | Crear vista Mis reservas | Frontend |
| T06.08 | Integrar formulario con endpoint | Integración |

**HU07 — Cancelación automática de reservas vencidas (6 tareas)**

| # | Tarea | Tipo |
|---|-------|------|
| T07.01 | Implementar proceso periódico (cron/scheduler) de verificación de reservas | Backend |
| T07.02 | Implementar lógica de cancelación por vencimiento (24h) | Backend |
| T07.03 | Implementar penalización de reputación por inasistencia | Backend |
| T07.04 | Implementar cancelación manual por Gestor | Backend |
| T07.05 | Crear endpoint POST /api/reservas/{id}/cancelar | Backend |
| T07.06 | Agregar notificación de cancelación al usuario | Integración |

---

## S7 — Cola de Reservas + Suspensiones

**Objetivo:** El gestor gestiona la cola de prioridades de reservas y las suspensiones por bajo puntaje.

**Historias:** HU08, HU14

| ID | Historia | SP | Tareas |
|----|----------|-----|--------|
| HU08 | Evaluar y priorizar reservas simultáneas | 5 | 7 |
| HU14 | Gestionar suspensiones por bajo puntaje | 5 | 7 |
| | **Total** | **10 SP** | **14 tareas** |

### Tareas detalladas

**HU08 — Evaluar y priorizar reservas simultáneas (7 tareas)**

| # | Tarea | Tipo |
|---|-------|------|
| T08.01 | Implementar servicio de cola de reservas por material | Backend |
| T08.02 | Implementar ordenamiento por prioridad, Tier y fecha | Backend |
| T08.03 | Implementar transacciones atómicas para evitar race conditions | Backend |
| T08.04 | Crear endpoints GET /api/reservas/cola/{id} y POST /api/reservas/{id}/aprobar | Backend |
| T08.05 | Crear vista de cola de reservas para Gestor | Frontend |
| T08.06 | Implementar botones de aprobar/rechazar individual | Frontend |
| T08.07 | Integrar vista con endpoints | Integración |

**HU14 — Gestionar suspensiones por bajo puntaje (7 tareas)**

| # | Tarea | Tipo |
|---|-------|------|
| T14.01 | Implementar servicio de suspensión temporal | Backend |
| T14.02 | Implementar duración configurable de suspensión | Backend |
| T14.03 | Implementar restauración automática al cumplir el período | Backend |
| T14.04 | Implementar levantamiento manual de suspensión por Admin | Backend |
| T14.05 | Crear endpoints suspender y levantar-suspension | Backend |
| T14.06 | Mostrar estado de suspensión y fecha de fin en perfil | Frontend |
| T14.07 | Bloquear botones de reserva/préstamo si está suspendido | Frontend |

---

## S8 — Prórrogas + Excepciones

**Objetivo:** Los usuarios pueden solicitar prórroga y excepciones académicas.

**Historias:** HU15, HU13

| ID | Historia | SP | Tareas |
|----|----------|-----|--------|
| HU15 | Solicitar prórroga de préstamo | 5 | 8 |
| HU13 | Préstamo excepcional por necesidad académica | 5 | 7 |
| | **Total** | **10 SP** | **15 tareas** |

### Tareas detalladas

**HU15 — Solicitar prórroga de préstamo (8 tareas)**

| # | Tarea | Tipo |
|---|-------|------|
| T15.01 | Implementar servicio de prórroga con verificación de disponibilidad y Tier | Backend |
| T15.02 | Implementar aprobación automática para Tier Avanzado | Backend |
| T15.03 | Implementar flujo de aprobación manual para Tier Estándar | Backend |
| T15.04 | Bloquear solicitud para Tier Restringido | Backend |
| T15.05 | Crear endpoints POST /api/prestamos/{id}/prorroga y PUT .../aprobar | Backend |
| T15.06 | Crear botón Solicitar Prórroga en vista de préstamo activo | Frontend |
| T15.07 | Crear vista de solicitudes de prórroga pendientes para Gestor | Frontend |
| T15.08 | Integrar flujo con endpoints | Integración |

**HU13 — Préstamo excepcional por necesidad académica (7 tareas)**

| # | Tarea | Tipo |
|---|-------|------|
| T13.01 | Implementar flujo de excepción académica en servicio de préstamo | Backend |
| T13.02 | Implementar registro de garantía especial (doc. identidad + compromiso) | Backend |
| T13.03 | Implementar penalización doble en devolución para excepciones | Backend |
| T13.04 | Crear endpoint POST /api/prestamos/excepcion | Backend |
| T13.05 | Crear flujo UI de Solicitar Excepción Académica | Frontend |
| T13.06 | Implementar upload de documentos de garantía | Frontend |
| T13.07 | Integrar flujo de excepción con endpoints | Integración |

---

## S9 — Historial + Reportes

**Objetivo:** El gestor ve historial por material; la Dirección ve reportes consolidados.

**Historias:** HU17, HU18

| ID | Historia | SP | Tareas |
|----|----------|-----|--------|
| HU17 | Consultar historial de préstamos por material | 3 | 6 |
| HU18 | Dashboard de reportes para Dirección | 8 | 9 |
| | **Total** | **11 SP** | **15 tareas** |

### Tareas detalladas

**HU17 — Consultar historial de préstamos por material (6 tareas)**

| # | Tarea | Tipo |
|---|-------|------|
| T17.01 | Implementar servicio de historial de préstamos por material con filtros | Backend |
| T17.02 | Crear endpoint GET /api/materiales/{id}/historial | Backend |
| T17.03 | Crear vista de historial de material (usuario, fechas, resultado) | Frontend |
| T17.04 | Implementar filtros por período | Frontend |
| T17.05 | Mostrar estadísticas (conteo total, % a tiempo vs tardío) | Frontend |
| T17.06 | Integrar vista con endpoint | Integración |

**HU18 — Dashboard de reportes para Dirección (9 tareas)**

| # | Tarea | Tipo |
|---|-------|------|
| T18.01 | Implementar servicio de métricas consolidadas | Backend |
| T18.02 | Implementar indicadores por período (semana, mes, semestre) | Backend |
| T18.03 | Implementar ranking de materiales más prestados | Backend |
| T18.04 | Implementar tasa de devoluciones a tiempo vs tardías | Backend |
| T18.05 | Implementar distribución de usuarios por Tier | Backend |
| T18.06 | Crear endpoints GET /api/reportes/dashboard y /metricas | Backend |
| T18.07 | Crear dashboard con gráficos y métricas | Frontend |
| T18.08 | Implementar exportación a PDF/CSV | Frontend |
| T18.09 | Integrar dashboard con endpoints | Integración |

---

# Vista general

```
FASE 1: MVP
M1  ██████████████░░░░  14 SP   30 tareas  (Usuarios + Auth + Roles + Perfil)
M2  ████████░░░░░░░░░░   8 SP   14 tareas  (Inventario + Búsqueda)
M3  ████████░░░░░░░░░░   8 SP   10 tareas  (Préstamos)
M4  ███████████░░░░░░░  11 SP   16 tareas  (Devoluciones + Ver préstamos)
    ─────────────────────────────────────────
    MVP TOTAL:          41 SP   70 tareas

FASE 2: FULL PRODUCT
S5  ████████░░░░░░░░░░   8 SP    5 tareas  (Reputación + Tiers)
S6  ██████████░░░░░░░░  10 SP   14 tareas  (Reservas + Cancelación)
S7  ██████████░░░░░░░░  10 SP   14 tareas  (Cola + Suspensiones)
S8  ██████████░░░░░░░░  10 SP   15 tareas  (Prórrogas + Excepciones)
S9  ███████████░░░░░░░  11 SP   15 tareas  (Historial + Reportes)
    ─────────────────────────────────────────
    FULL TOTAL:         49 SP   63 tareas

    ═══════════════════════════════════════════
    GRAND TOTAL:        90 SP  133 tareas  |  9 sprints  |  18 HU
```

## Resumen por tipo de tarea

| Sprint | Backend | Frontend | Integración | Total |
|--------|---------|----------|-------------|-------|
| M1 | 17 | 9 | 4 | 30 |
| M2 | 8 | 4 | 2 | 14 |
| M3 | 7 | 2 | 1 | 10 |
| M4 | 9 | 5 | 2 | 16 |
| S5 | 4 | 1 | 0 | 5 |
| S6 | 10 | 2 | 2 | 14 |
| S7 | 9 | 4 | 1 | 14 |
| S8 | 9 | 4 | 2 | 15 |
| S9 | 8 | 5 | 2 | 15 |
| **Total** | **81** | **36** | **16** | **133** |

## Flujo de desarrollo

```
M1: Crear Usuarios → Auth → Roles → Perfil
M2: Registrar Materiales → Buscar
M3: Registrar Préstamos
M4: Registrar Devoluciones → Ver mis préstamos
    ════════════════════════════════════
    ← Aquí el sistema ya FUNCIONA →
    ════════════════════════════════════
S5: Calcular Reputación y Tiers
S6: Reservar materiales → Cancelar vencidas
S7: Gestionar cola de reservas → Suspensiones
S8: Prórrogas → Excepciones Académicas
S9: Historial por material → Reportes para Dirección
```

## Notas

- Los SP son estimaciones relativas iniciales; deben refinarse con el equipo en Sprint Planning.
- El orden de desarrollo respeta las dependencias del dominio.
- Los requisitos no funcionales (RNF01-RNF05) se implementan transversalmente.
- Cada tarea se crea como Subtask en Jira, vinculada a su Historia de Usuario.
- Modelo de dominio: 2 entidades principales (Credencial, Usuario) + entidades de negocio (Material, Prestamo, Reserva).
