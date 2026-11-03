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
| T05.02 | Verificar que el catálogo muestre materiales de todos los Tiers | Backend |
| T05.03 | Crear endpoint `GET /api/materiales/buscar?q=&categoria=&estado=` | Backend |
| T05.04 | Crear componente de barra de búsqueda con filtros | Frontend |
| T05.05 | Crear vista de resultados con tarjetas de material (nombre, categoría, estado, disponibilidad) | Frontend |
| T05.06 | Integrar búsqueda con endpoint | Integración |

---

## ÉPICA 3: RESERVAS

---

### HU06 — Reservar material o solicitar espera

| # | Tarea | Tipo |
|---|-------|------|
| T06.01 | Definir modelo de entidad `Reserva` (usuario, material, prioridad, justificación, estado, timestamp, fecha límite de recojo y de espera, es_excepcion, motivo de rechazo, instancia asignada) | Backend |
| T06.02 | Crear migración/DDL de la tabla `reservas` | Backend |
| T06.03 | Implementar servicio de reserva con validación de Tier, disponibilidad real y auto-confirmación atómica | Backend |
| T06.04 | Implementar registro en lista de espera cuando no hay instancia disponible, sin consumir stock | Backend |
| T06.05 | Implementar solicitud de reserva excepcional con garantía y estado pendiente de aprobación del Gestor | Backend |
| T06.06 | Crear endpoints `POST /api/reservas` y `GET /api/reservas/mis-reservas` | Backend |
| T06.07 | Crear formulario de reserva (prioridad, justificación) | Frontend |
| T06.08 | Crear flujo UI de excepción académica y carga de documentos | Frontend |
| T06.09 | Crear vista "Mis reservas" con estados Reservada, En Espera, Expirada, Rechazada y Cancelada | Frontend |
| T06.10 | Integrar formulario y flujos con endpoints | Integración |

---

### HU07 — Expiración de reservas y solicitudes en espera

| # | Tarea | Tipo |
|---|-------|------|
| T07.01 | Implementar proceso periódico (cron/scheduler) de verificación de reservas confirmadas y solicitudes en espera | Backend |
| T07.02 | Implementar expiración de reservas confirmadas a las 24h con penalización y liberación de instancia | Backend |
| T07.03 | Implementar expiración de solicitudes en espera a las 72h sin penalización | Backend |
| T07.04 | Implementar cancelación manual por Gestor | Backend |
| T07.05 | Crear endpoint `POST /api/reservas/{id}/cancelar` | Backend |
| T07.06 | Implementar disparo de autopromoción al liberar una instancia por vencimiento o cancelación | Backend |

---

### HU08 — Gestionar cola de reservas y excepciones

| # | Tarea | Tipo |
|---|-------|------|
| T08.01 | Implementar servicio de cola de reservas por material | Backend |
| T08.02 | Implementar ordenamiento por prioridad, fecha de solicitud y Tier | Backend |
| T08.03 | Implementar autopromoción atómica y selección de una instancia real disponible (RN08, RN11) | Backend |
| T08.04 | Implementar disparadores de autopromoción y revisión periódica de respaldo | Backend |
| T08.05 | Crear endpoints `GET /api/reservas/cola/{materialId}`, `POST /api/reservas/{id}/aprobar-excepcion` y `POST /api/reservas/{id}/rechazar` | Backend |
| T08.06 | Crear vista de cola de reservas para Gestor | Frontend |
| T08.07 | Implementar acciones de aprobar/rechazar excepción, rechazar espera y cancelar reserva | Frontend |
| T08.08 | Integrar vista con endpoints | Integración |

---

## ÉPICA 4: PRÉSTAMOS

---

### HU09 — Registrar préstamo y convertir reserva

| # | Tarea | Tipo |
|---|-------|------|
| T09.01 | Definir modelo de entidad `Prestamo` (usuario, material, fechaEntrega, fechaLimite, tiempoPrestamo, estado, garantía, checklistInicial) | Backend |
| T09.02 | Crear migración/DDL de la tabla `prestamos` | Backend |
| T09.03 | Implementar servicio de préstamo con verificación de elegibilidad, uso de instancia reservada y conversión de reserva (RN01, RN11) | Backend |
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
| T11.11 | Generar y persistir el reporte PDF de daños con reportlab (RN10) | Backend |
| T11.12 | Crear endpoint de descarga del reporte `GET /api/prestamos/devoluciones/{id}/reporte/` | Backend |
| T11.13 | Mostrar descarga del reporte en la confirmación de devolución | Frontend |
| T11.14 | Crear endpoint `GET /api/prestamos/devoluciones/reportes/` con filtros (daño, rango de fechas) | Backend |
| T11.15 | Crear vista de listado de reportes de daños con filtros y descarga | Frontend |

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

### HU13 — Reserva y préstamo excepcional por necesidad académica

| # | Tarea | Tipo |
|---|-------|------|
| T13.01 | Implementar flujo de excepción académica en servicios de reserva y préstamo | Backend |
| T13.02 | Implementar registro de garantía especial (doc. identidad + compromiso firmado) con validación de 4 MB | Backend |
| T13.03 | Implementar aprobación/rechazo de excepciones por Gestor y bloqueo de autopromoción | Backend |
| T13.04 | Implementar conversión de reserva excepcional a préstamo reutilizando la garantía | Backend |
| T13.05 | Implementar penalización doble solo en puntos de daño para préstamos por excepción | Backend |
| T13.06 | Crear endpoints `POST /api/reservas/excepcion`, `POST /api/prestamos/excepcion` y `PUT /api/reservas/{id}/aprobar-excepcion` | Backend |
| T13.07 | Crear flujo UI de solicitud excepcional y carga de documentos | Frontend |
| T13.08 | Crear vista y acciones de revisión de excepciones para Gestor | Frontend |
| T13.09 | Integrar flujos de excepción con endpoints | Integración |

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
| 1. Usuarios | 23 | 14 | 6 | 3 |
| 2. Inventario | 14 | 8 | 4 | 2 |
| 3. Reservas | 24 | 17 | 5 | 2 |
| 4. Préstamos | 16 | 9 | 5 | 2 |
| 5. Devoluciones | 36 | 25 | 9 | 2 |
| 6. Prórrogas | 8 | 5 | 2 | 1 |
| 7. Perfil/Historial | 13 | 5 | 6 | 2 |
| 8. Reportes | 9 | 6 | 2 | 1 |
| **Total** | **143** | **89** | **39** | **15** |
