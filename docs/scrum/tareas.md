# Tareas por Historia de Usuario — Sistema de Préstamos Académicos

> Cada historia de usuario se descompone en tareas de desarrollo: Modelo, API/Backend, Frontend/UI e Integración.

---

## ÉPICA 1: GESTIÓN DE USUARIOS

---

### HU01 — Registrar usuario

| # | Tarea | Tipo |
|---|-------|------|
| T01.01 | Definir modelo de entidad `Usuario` (nombre, apellido, email, DNI, teléfono, tipo, rol, estado, reputación, Tier) | Backend |
| T01.02 | Crear migración/DDL de la tabla `usuarios` | Backend |
| T01.03 | Implementar servicio de registro con validación de email y DNI duplicados | Backend |
| T01.04 | Asignar Tier inicial Neutral (0 pts) al crear usuario | Backend |
| T01.05 | Crear endpoint `POST /api/usuarios` | Backend |
| T01.06 | Crear formulario de registro de usuario (Admin) | Frontend |
| T01.07 | Implementar validación de formulario y mensajes de error | Frontend |
| T01.08 | Integrar formulario con endpoint de registro | Integración |

---

### HU02 — Gestionar roles y permisos

| # | Tarea | Tipo |
|---|-------|------|
| T02.01 | Definir modelo de entidad `Rol` y relación con `Usuario` | Backend |
| T02.02 | Implementar servicio de cambio de rol con validación (no eliminar usuario con préstamos activos) | Backend |
| T02.03 | Crear middleware de autorización por roles | Backend |
| T02.04 | Crear endpoints `GET /api/usuarios` (listar) y `PUT /api/usuarios/{id}/rol` | Backend |
| T02.05 | Crear vista de lista de usuarios con columna de rol editable | Frontend |
| T02.06 | Implementar selector de rol con opciones (Prestatario, Gestor, Administrador) | Frontend |
| T02.07 | Integrar vista con endpoints | Integración |

---

### HU03 — Iniciar sesión

| # | Tarea | Tipo |
|---|-------|------|
| T03.01 | Implementar servicio de autenticación (email + contraseña hasheada con bcrypt) | Backend |
| T03.02 | Implementar bloqueo de cuenta tras 5 intentos fallidos | Backend |
| T03.03 | Implementar expiración de sesión por inactividad (configurable) | Backend |
| T03.04 | Crear endpoint `POST /api/auth/login` y `POST /api/auth/logout` | Backend |
| T03.05 | Crear middleware de sesión autenticada | Backend |
| T03.06 | Crear pantalla de login | Frontend |
| T03.07 | Implementar redirección según rol post-login | Frontend |
| T03.08 | Integrar login con endpoints | Integración |

---

## ÉPICA 2: INVENTARIO DE MATERIALES

---

### HU04 — Registrar material en inventario

| # | Tarea | Tipo |
|---|-------|------|
| T04.01 | Definir modelo de entidad `Material` (nombre, descripción, categoría, estado, código único, parámetros de reputación) | Backend |
| T04.02 | Crear migración/DDL de la tabla `materiales` | Backend |
| T04.03 | Implementar servicio CRUD de materiales con validación de código único | Backend |
| T04.04 | Implementar valores por defecto para parámetros de reputación | Backend |
| T04.05 | Crear endpoints `POST/GET/PUT /api/materiales` | Backend |
| T04.06 | Crear formulario de registro/edición de material | Frontend |
| T04.07 | Crear vista de listado de materiales | Frontend |
| T04.08 | Integrar formularios con endpoints | Integración |

---

### HU05 — Buscar y consultar materiales

| # | Tarea | Tipo |
|---|-------|------|
| T05.01 | Implementar servicio de búsqueda con filtros (nombre, categoría, estado) | Backend |
| T05.02 | Implementar filtrado por Tier del usuario (Tier Restringido solo ve básicos) | Backend |
| T05.03 | Crear endpoint `GET /api/materiales/buscar?q=&categoria=&estado=` | Backend |
| T05.04 | Crear componente de barra de búsqueda con filtros | Frontend |
| T05.05 | Crear vista de resultados con tarjetas de material (nombre, categoría, estado, disponibilidad) | Frontend |
| T05.06 | Integrar búsqueda con endpoint | Integración |

---

## ÉPICA 3: RESERVAS

---

### HU06 — Reservar material

| # | Tarea | Tipo |
|---|-------|------|
| T06.01 | Definir modelo de entidad `Reserva` (usuario, material, prioridad, justificación, estado, timestamp, fecha límite recojo) | Backend |
| T06.02 | Crear migración/DDL de la tabla `reservas` | Backend |
| T06.03 | Implementar servicio de reserva con validación de Tier y disponibilidad | Backend |
| T06.04 | Implementar cambio de estado del material a "Reservado" al crear reserva | Backend |
| T06.05 | Crear endpoint `POST /api/reservas` | Backend |
| T06.06 | Crear formulario de reserva (prioridad, justificación) | Frontend |
| T06.07 | Crear vista "Mis reservas" | Frontend |
| T06.08 | Integrar formulario con endpoint | Integración |

---

### HU07 — Cancelación automática de reservas vencidas

| # | Tarea | Tipo |
|---|-------|------|
| T07.01 | Implementar proceso periódico (cron/scheduler) de verificación de reservas | Backend |
| T07.02 | Implementar lógica de cancelación por vencimiento (24h) | Backend |
| T07.03 | Implementar penalización de reputación por inasistencia | Backend |
| T07.04 | Implementar cancelación manual por Gestor | Backend |
| T07.05 | Crear endpoint `POST /api/reservas/{id}/cancelar` | Backend |
| T07.06 | Agregar notificación de cancelación al usuario | Integración |

---

### HU08 — Evaluar y priorizar reservas simultáneas

| # | Tarea | Tipo |
|---|-------|------|
| T08.01 | Implementar servicio de cola de reservas por material | Backend |
| T08.02 | Implementar ordenamiento por prioridad, Tier y fecha | Backend |
| T08.03 | Implementar transacciones atómicas para evitar race conditions (RN08) | Backend |
| T08.04 | Crear endpoint `GET /api/reservas/cola/{materialId}` y `POST /api/reservas/{id}/aprobar` | Backend |
| T08.05 | Crear vista de cola de reservas para Gestor | Frontend |
| T08.06 | Implementar botones de aprobar/rechazar individual | Frontend |
| T08.07 | Integrar vista con endpoints | Integración |

---

## ÉPICA 4: PRÉSTAMOS

---

### HU09 — Registrar préstamo (entrega de material)

| # | Tarea | Tipo |
|---|-------|------|
| T09.01 | Definir modelo de entidad `Prestamo` (usuario, material, fechaEntrega, fechaLimite, tiempoPrestamo, estado, garantía, checklistInicial) | Backend |
| T09.02 | Crear migración/DDL de la tabla `prestamos` | Backend |
| T09.03 | Implementar servicio de préstamo con verificación de elegibilidad (Tier, impedimentos) | Backend |
| T09.04 | Implementar checklist digital de estado inicial (RN09) | Backend |
| T09.05 | Implementar registro de garantía para equipos de alto valor (RN05) | Backend |
| T09.06 | Implementar cálculo automático de fecha límite de devolución | Backend |
| T09.07 | Crear endpoint `POST /api/prestamos` | Backend |
| T09.08 | Crear formulario de registro de préstamo con checklist | Frontend |
| T09.09 | Implementar validación de garantía obligatoria antes de confirmar | Frontend |
| T09.10 | Integrar formulario con endpoint | Integración |

---

### HU10 — Consultar estado de mis préstamos

| # | Tarea | Tipo |
|---|-------|------|
| T10.01 | Implementar servicio de consulta de préstamos por usuario con estados | Backend |
| T10.02 | Crear endpoint `GET /api/prestamos/mis-prestamos` | Backend |
| T10.03 | Crear vista de lista de préstamos con código de color por estado | Frontend |
| T10.04 | Implementar filtro por estado | Frontend |
| T10.05 | Crear vista de detalles del préstamo al seleccionar | Frontend |
| T10.06 | Integrar vista con endpoint | Integración |

---

## ÉPICA 5: DEVOLUCIONES Y SANCIONES

---

### HU11 — Registrar devolución con cálculo de sanciones

| # | Tarea | Tipo |
|---|-------|------|
| T11.01 | Implementar servicio de devolución con comparación de checklists (RN09) | Backend |
| T11.02 | Implementar lógica de cálculo de sanciones parametrizada por objeto (RN06) | Backend |
| T11.03 | Implementar bonificación por entrega a tiempo | Backend |
| T11.04 | Implementar descuento de puntos por tardanza proporcional | Backend |
| T11.05 | Implementar penalización + cobro por daño parcial/total | Backend |
| T11.06 | Implementar actualización de reputación y estados (préstamo→Devuelto, material→Disponible) | Backend |
| T11.07 | Crear endpoint `POST /api/prestamos/{id}/devolucion` | Backend |
| T11.08 | Crear formulario de devolución con checklist de comparación | Frontend |
| T11.09 | Mostrar resumen de sanciones/bonificaciones antes de confirmar | Frontend |
| T11.10 | Integrar formulario con endpoint | Integración |

---

### HU12 — Gestionar reputación y Tiers de acceso

| # | Tarea | Tipo |
|---|-------|------|
| T12.01 | Implementar servicio de reputación con rango [-500, 500] | Backend |
| T12.02 | Implementar cálculo automático de Tier según puntaje (Avanzado/Estándar/Restringido) | Backend |
| T12.03 | Implementar clamping de puntos (no salir del rango) | Backend |
| T12.04 | Crear endpoint `GET /api/usuarios/{id}/reputacion` | Backend |
| T12.05 | Mostrar puntaje y Tier en perfil de usuario | Frontend |

---

### HU13 — Préstamo excepcional por necesidad académica

| # | Tarea | Tipo |
|---|-------|------|
| T13.01 | Implementar flujo de excepción académica en servicio de préstamo | Backend |
| T13.02 | Implementar registro de garantía especial (doc. identidad + compromiso firmado) | Backend |
| T13.03 | Implementar penalización doble en devolución para préstamos por excepción | Backend |
| T13.04 | Crear endpoint `POST /api/prestamos/excepcion` | Backend |
| T13.05 | Crear flujo UI de "Solicitar Excepción Académica" cuando Tier es Restringido | Frontend |
| T13.06 | Implementar upload de documentos de garantía | Frontend |
| T13.07 | Integrar flujo de excepción con endpoints | Integración |

---

### HU14 — Gestionar suspensiones por bajo puntaje

| # | Tarea | Tipo |
|---|-------|------|
| T14.01 | Implementar servicio de suspensión temporal (activación al caer bajo -50) | Backend |
| T14.02 | Implementar duración configurable de suspensión | Backend |
| T14.03 | Implementar restauración automática al cumplir el período | Backend |
| T14.04 | Implementar levantamiento manual de suspensión por Admin | Backend |
| T14.05 | Crear endpoints `POST /api/usuarios/{id}/suspender` y `POST /api/usuarios/{id}/levantar-suspension` | Backend |
| T14.06 | Mostrar estado de suspensión y fecha de fin en perfil | Frontend |
| T14.07 | Bloquear botones de reserva/préstamo si está suspendido | Frontend |

---

## ÉPICA 6: PRÓRROGAS

---

### HU15 — Solicitar prórroga de préstamo

| # | Tarea | Tipo |
|---|-------|------|
| T15.01 | Implementar servicio de prórroga con verificación de disponibilidad y Tier | Backend |
| T15.02 | Implementar aprobación automática para Tier Avanzado | Backend |
| T15.03 | Implementar flujo de aprobación manual para Tier Estándar | Backend |
| T15.04 | Bloquear solicitud para Tier Restringido | Backend |
| T15.05 | Crear endpoints `POST /api/prestamos/{id}/prorroga` y `PUT /api/prestamos/{id}/prorroga/aprobar` | Backend |
| T15.06 | Crear botón "Solicitar Prórroga" en vista de préstamo activo | Frontend |
| T15.07 | Crear vista de solicitudes de prórroga pendientes para Gestor | Frontend |
| T15.08 | Integrar flujo con endpoints | Integración |

---

## ÉPICA 7: PERFIL E HISTORIAL

---

### HU16 — Consultar y actualizar perfil

| # | Tarea | Tipo |
|---|-------|------|
| T16.01 | Implementar servicio de consulta de perfil con reputación e historial | Backend |
| T16.02 | Implementar servicio de actualización de perfil (solo nombre y teléfono editables) | Backend |
| T16.03 | Crear endpoints `GET /api/usuarios/perfil` y `PUT /api/usuarios/perfil` | Backend |
| T16.04 | Crear vista de perfil con datos personales, reputación y Tier | Frontend |
| T16.05 | Crear formulario de edición de perfil (campos restringidos readonly) | Frontend |
| T16.06 | Mostrar historial de préstamos en perfil | Frontend |
| T16.07 | Integrar vista con endpoints | Integración |

---

### HU17 — Consultar historial de préstamos por material

| # | Tarea | Tipo |
|---|-------|------|
| T17.01 | Implementar servicio de historial de préstamos por material con filtros | Backend |
| T17.02 | Crear endpoint `GET /api/materiales/{id}/historial?desde=&hasta=` | Backend |
| T17.03 | Crear vista de historial de material (usuario, fechas, resultado) | Frontend |
| T17.04 | Implementar filtros por período | Frontend |
| T17.05 | Mostrar estadísticas (conteo total, % a tiempo vs tardío) | Frontend |
| T17.06 | Integrar vista con endpoint | Integración |

---

## ÉPICA 8: REPORTES

---

### HU18 — Dashboard de reportes para Dirección

| # | Tarea | Tipo |
|---|-------|------|
| T18.01 | Implementar servicio de métricas consolidadas (préstamos activos, reservas, disponibilidad) | Backend |
| T18.02 | Implementar indicadores por período (semana, mes, semestre) | Backend |
| T18.03 | Implementar ranking de materiales más prestados | Backend |
| T18.04 | Implementar tasa de devoluciones a tiempo vs tardías | Backend |
| T18.05 | Implementar distribución de usuarios por Tier | Backend |
| T18.06 | Crear endpoints `GET /api/reportes/dashboard`, `GET /api/reportes/metricas` | Backend |
| T18.07 | Crear dashboard con gráficos y métricas | Frontend |
| T18.08 | Implementar exportación a PDF/CSV | Frontend |
| T18.09 | Integrar dashboard con endpoints | Integración |

---

## Resumen de tareas

| Épica | Tareas | Backend | Frontend | Integración |
|-------|--------|---------|----------|-------------|
| 1. Usuarios | 23 | 12 | 7 | 3 |
| 2. Inventario | 14 | 7 | 4 | 2 |
| 3. Reservas | 21 | 11 | 5 | 3 |
| 4. Préstamos | 16 | 9 | 4 | 2 |
| 5. Devoluciones | 31 | 17 | 6 | 3 |
| 6. Prórrogas | 8 | 5 | 2 | 1 |
| 7. Perfil/Historial | 13 | 5 | 5 | 2 |
| 8. Reportes | 9 | 6 | 2 | 1 |
| **Total** | **135** | **72** | **35** | **17** |
