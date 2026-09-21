# Historias de Usuario — Sistema de Préstamos Académicos

---

## ÉPICA 1: GESTIÓN DE USUARIOS

---

### HU01 — Registrar usuario

**Como** Administrador del Sistema, **quiero** registrar usuarios con su tipo (Alumno, Docente, Administrativo) y asignarles un rol, **para que** puedan acceder y utilizar el sistema de préstamos.

**Requisitos asociados:** RF01

| # | Criterio de aceptación |
|---|------------------------|
| 1 | El formulario de registro permite ingresar: nombre, apellido, email (institucional), DNI, teléfono, tipo de usuario (Alumno/Docente/Administrativo) |
| 2 | El sistema valida que el email no esté duplicado antes de crear el registro |
| 3 | El sistema valida que el DNI no esté duplicado |
| 4 | Al confirmar, el usuario queda registrado con estado "Activo" y Tier inicial Neutral (0 pts) |
| 5 | Si los datos son inválidos o el email/DNI ya existe, el sistema muestra un mensaje de error descriptivo y no crea el registro |
| 6 | El nuevo usuario puede iniciar sesión inmediatamente después del registro |

**Reglas de negocio:** RN03 (Tier inicial Neutral)

---

### HU02 — Gestionar roles y permisos

**Como** Administrador del Sistema, **quiero** asignar roles (Prestatario, Gestor de Almacén, Administrador) a los usuarios registrados, **para que** el sistema controle el acceso según las funciones de cada uno.

**Requisitos asociados:** RF01, RNF03

| # | Criterio de aceptación |
|---|------------------------|
| 1 | El administrador puede ver la lista de usuarios con su rol actual |
| 2 | El administrador puede cambiar el rol de un usuario |
| 3 | Un usuario puede tener solo un tipo (Alumno/Docente/Administrativo) y opcionalmente un rol de sistema (Prestatario/Gestor/Administrador) |
| 4 | Los cambios de rol surten efecto inmediato en los permisos del usuario |
| 5 | No se permite eliminar un usuario que tenga préstamos activos |

**Reglas de negocio:** RNF03 (Control de acceso por roles)

---

### HU03 — Iniciar sesión

**Como** Usuario, **quiero** iniciar sesión con mi email y contraseña, **para que** acceda de forma segura a mi perfil y funcionalidades del sistema.

**Requisitos asociados:** RF02, RNF03

| # | Criterio de aceptación |
|---|------------------------|
| 1 | El usuario ingresa email y contraseña para autenticarse |
| 2 | Si las credenciales son correctas, el sistema redirige al dashboard correspondiente según su rol |
| 3 | Si las credenciales son incorrectas, el sistema muestra "Email o contraseña incorrectos" (sin especificar cuál falla) |
| 4 | La sesión expira tras un período de inactividad configurable (ej. 30 min) |
| 5 | El sistema registra el intento fallido y bloquea la cuenta tras 5 intentos consecutivos |
| 6 | La contraseña se almacena hasheada (bcrypt o similar), nunca en texto plano |

**Reglas de negocio:** RNF03 (Protección de datos)

---

## ÉPICA 2: INVENTARIO DE MATERIALES

---

### HU04 — Registrar material en inventario

**Como** Administrador/Gestor de Almacén, **quiero** registrar materiales (equipos, libros, objetos) con sus atributos y parámetros de reputación, **para que** el inventario esté actualizado y el sistema pueda calcular sanciones automáticamente.

**Requisitos asociados:** RF03

| # | Criterio de aceptación |
|---|------------------------|
| 1 | El formulario permite registrar: nombre, descripción, categoría (Equipo/Libro/Objeto), estado inicial (Disponible), código/identificador único |
| 2 | Se pueden parametrizar por objeto: Tier mínimo requerido, bonificación por devolución a tiempo, deducción por tardanza, deducción por daño parcial, deducción por daño total |
| 3 | Si no se parametrizan los valores de reputación, el sistema aplica valores por defecto configurables |
| 4 | El código/identificador del material es único en el sistema |
| 5 | Se puede registrar múltiples unidades del mismo material (stock) |
| 6 | El estado inicial del material es "Disponible" |
| 7 | Se pueden editar los datos y parámetros de un material existente |
| 8 | El Gestor de Almacén puede cambiar el estado de un material a "En Mantenimiento" cuando sea necesario |

**Reglas de negocio:** RN06 (Parámetros por objeto), RN01 (Estados del material)

---

### HU05 — Buscar y consultar materiales

**Como** Prestatario, **quiero** buscar materiales por nombre, categoría o estado, **para que** encuentre lo que necesito rápidamente.

**Requisitos asociados:** RF03, RNF01, RNF04

| # | Criterio de aceptación |
|---|------------------------|
| 1 | Se puede buscar por nombre (búsqueda parcial, case-insensitive) |
| 2 | Se puede filtrar por categoría (Equipo/Libro/Objeto) |
| 3 | Se puede filtrar por estado (Disponible/Prestado/Reservado/En Mantenimiento) |
| 4 | Los resultados muestran: nombre, categoría, estado, disponibilidad |
| 5 | La búsqueda responde en menos de 2 segundos |
| 6 | Un usuario en Tier Restringido solo ve materiales de Tier básico/libros |
| 7 | Un usuario nuevo puede completar una reserva en menos de 3 minutos sin capacitación |

**Reglas de negocio:** RN01 (Disponibilidad), RN03 (Filtrado por Tier)

---

## ÉPICA 3: RESERVAS

---

### HU06 — Reservar material

**Como** Prestatario, **quiero** reservar un material disponible indicando prioridad y justificación, **para que** tenga garantizada su disponibilidad para un préstamo futuro.

**Requisitos asociados:** RF04, RN01, RN03, RN04

| # | Criterio de aceptación |
|---|------------------------|
| 1 | El usuario selecciona un material en estado "Disponible" |
| 2 | El formulario solicita: nivel de prioridad (Alta/Media/Baja), descripción/justificación del uso |
| 3 | El sistema verifica que el Tier del usuario cumple con el Tier mínimo requerido del material |
| 4 | Si el Tier no es suficiente, el sistema rechaza la reserva mostrando la restricción |
| 5 | Al confirmar, la reserva queda en estado "Reservada" con timestamp |
| 6 | El material cambia a estado "Reservado" |
| 7 | La reserva tiene vigencia de 24 horas desde la hora pactada de recojo |
| 8 | La reserva se asocia al usuario (se puede ver en "Mis reservas") |
| 9 | Un usuario puede tener un máximo configurable de reservas activas simultáneas |

**Reglas de negocio:** RN01, RN03, RN04

---

### HU07 — Cancelación automática de reservas vencidas

**Como** Sistema, **quiero** cancelar automáticamente las reservas no recogidas en 24 horas, **para que** los materiales vuelvan a estar disponibles para otros usuarios.

**Requisitos asociados:** RN04

| # | Criterio de aceptación |
|---|------------------------|
| 1 | Un proceso periódico (cron job) verifica reservas en estado "Reservada" |
| 2 | Si la reserva superó las 24 horas sin retiro, cambia a estado "Cancelada por Vencimiento" |
| 3 | El material vuelve a estado "Disponible" |
| 4 | Se aplica una penalización al puntaje de reputación del usuario (configurable) |
| 5 | El usuario recibe una notificación de cancelación |
| 6 | El Gestor de Almacén puede ejecutar la cancelación manualmente antes del vencimiento |

**Reglas de negocio:** RN04

---

### HU08 — Evaluar y priorizar reservas simultáneas

**Como** Gestor de Almacén, **quiero** ver las reservas pendientes para un mismo material y priorizar según justificación y Tier, **para que** la asignación sea justa y eficiente.

**Requisitos asociados:** RN08

| # | Criterio de aceptación |
|---|------------------------|
| 1 | Se muestra una cola de reservas pendientes por material |
| 2 | Cada reserva muestra: usuario, prioridad (Alta/Media/Baja), justificación, Tier de reputación, fecha de solicitud |
| 3 | El gestor puede ordenar por prioridad, Tier o fecha |
| 4 | El gestor puede aprobar o rechazar cada reserva individualmente |
| 5 | Al aprobar, se notifica al usuario y se inicia el proceso de préstamo |
| 6 | Las transacciones de reserva son atómicas (no se produce race condition) |

**Reglas de negocio:** RN08

---

## ÉPICA 4: PRÉSTAMOS

---

### HU09 — Registrar préstamo (entrega de material)

**Como** Gestor de Almacén, **quiero** registrar la entrega de un material a un usuario con checklist digital de estado inicial y garantía (si aplica), **para que** quede un registro formal y trazable del préstamo.

**Requisitos asociados:** RF05, RF09, RN05, RN09

| # | Criterio de aceptación |
|---|------------------------|
| 1 | El gestor busca el préstamo/reserva activa del usuario |
| 2 | El sistema verifica la identidad y elegibilidad del usuario (Tier, sin impedimentos) |
| 3 | El gestor completa un checklist digital del estado inicial del bien (descripción de condiciones, fotos si aplica) |
| 4 | Para equipos de alto valor o préstamos por excepción académica, se registra la garantía (documento de identidad + compromiso firmado) |
| 5 | Si la garantía es requerida y no se entrega, el sistema no permite completar el préstamo |
| 6 | El gestor indica el tiempo de préstamo (días) |
| 7 | El sistema calcula y muestra la fecha límite de devolución |
| 8 | El estado del préstamo cambia a "Activo" |
| 9 | El estado del material cambia a "Prestado" |

**Reglas de negocio:** RN05, RN09

---

### HU10 — Consultar estado de mis préstamos

**Como** Prestatario, **quiero** ver el estado de todos mis préstamos (reservado, activo, devuelto, vencido), **para que** sepa la situación de cada material que solicité.

**Requisitos asociados:** RF07

| # | Criterio de aceptación |
|---|------------------------|
| 1 | Se muestra una lista de préstamos con: material, fecha de préstamo, fecha límite, estado actual |
| 2 | El estado se muestra con código de color (verde=Activo, amarillo=Reservado, rojo=Vencido, gris=Devuelto) |
| 3 | Se puede filtrar por estado |
| 4 | Al seleccionar un préstamo, se ven los detalles completos |
| 5 | Los préstamos vencidos se muestran destacados/arriba |

**Reglas de negocio:** RF07

---

## ÉPICA 5: DEVOLUCIONES Y SANCIONES

---

### HU11 — Registrar devolución con cálculo de sanciones

**Como** Gestor de Almacén, **quiero** registrar la devolución de un material comparando con el checklist inicial, **para que** el sistema calcule automáticamente bonificaciones o sanciones.

**Requisitos asociados:** RF06, RF08, RN06, RN09

| # | Criterio de aceptación |
|---|------------------------|
| 1 | El gestor busca el préstamo activo del material |
| 2 | El sistema muestra el checklist de estado inicial registrado al momento de la entrega |
| 3 | El gestor completa un checklist de devolución (nuevo checklist) |
| 4 | El sistema compara ambos checklist y resalta las diferencias (daños nuevos) |
| 5 | El sistema compara la fecha de devolución con la fecha límite |
| 6 | Si devolvió a tiempo: aplica bonificación de puntos (parámetro del objeto) |
| 7 | Si devolvió con retraso: aplica descuento de puntos proporcional al tiempo excedido |
| 8 | Si hay daño nuevo: aplica penalización de puntos + genera cobro de reparación/reposición |
| 9 | Se actualiza el puntaje de reputación del usuario |
| 10 | El estado del préstamo cambia a "Devuelto" |
| 11 | El estado del material cambia a "Disponible" |
| 12 | Se registra el historial completo de la operación |

**Reglas de negocio:** RN06, RN09

---

### HU12 — Gestionar reputación y Tiers de acceso

**Como** Sistema, **quiero** mantener el puntaje de reputación de cada usuario en el rango [-500, 500] y calcular su Tier de acceso, **para que** se controlen automáticamente los privilegios de préstamo.

**Requisitos asociados:** RF08, RN03

| # | Criterio de aceptación |
|---|------------------------|
| 1 | Cada usuario tiene un puntaje de reputación visible en su perfil |
| 2 | El rango es de -500 a 500 (no se puede salir de este rango) |
| 3 | Tier Avanzado: 201 a 500 pts → acceso total, prioridad en reservas, prórrogas automáticas |
| 4 | Tier Estándar: -50 a 200 pts → acceso a libros y equipos estándar, margen de tolerancia |
| 5 | Tier Restringido: -500 a -51 pts → solo materiales básicos, sin prórrogas |
| 6 | El Tier se recalcula automáticamente al modificar el puntaje |
| 7 | Los cambios de Tier surten efecto inmediato en las funcionalidades disponibles |

**Reglas de negocio:** RN03

---

### HU13 — Préstamo excepcional por necesidad académica

**Como** Prestatario en Tier Restringido, **quiero** acceder excepcionalmente a materiales de mayor Tier presentando garantía firmada, **para que** pueda cubrir una necesidad académica urgente a pesar de mi nivel de reputación.

**Requisitos asociados:** RN03, RN05

| # | Criterio de aceptación |
|---|------------------------|
| 1 | El usuario selecciona un material de Tier superior al suyo |
| 2 | El sistema detecta que está en Tier Restringido y muestra la opción de "Excepción Académica" |
| 3 | El usuario debe subir documento de identidad y compromiso de responsabilidad firmado |
| 4 | El sistema registra la garantía y asocia al préstamo |
| 5 | El préstamo se activa con estado "Activo - Excepción" |
| 6 | Se muestra un indicador especial en el préstamo para que el gestor lo revise |
| 7 | Si la devolución es con daño, la penalización es el doble de la parametrizada |

**Reglas de negocio:** RN03 (Excepción Académica), RN05

---

### HU14 — Gestionar suspensiones por bajo puntaje

**Como** Sistema, **quiero** suspender temporalmente a usuarios cuyo puntaje caiga por debajo de -50, **para que** no puedan realizar nuevos préstamos hasta demostrar responsabilidad.

**Requisitos asociados:** RF08

| # | Criterio de aceptación |
|---|------------------------|
| 1 | Cuando el puntaje cae por debajo de -50 (Tier Restringido), el sistema marca al usuario como "Suspendido temporalmente" |
| 2 | Un usuario suspendido no puede realizar nuevas reservas ni préstamos |
| 3 | La suspensión tiene una duración configurable (ej. 7 días) |
| 4 | Al cumplirse el período, el usuario vuelve a Tier Restringido (acceso limitado) |
| 5 | El administrador puede levantar una suspensión manualmente si es necesario |
| 6 | Se muestra la fecha de fin de suspensión en el perfil del usuario |

**Reglas de negocio:** RN03

---

## ÉPICA 6: PRÓRROGAS

---

### HU15 — Solicitar prórroga de préstamo

**Como** Prestatario, **quiero** solicitar una extensión de mi préstamo activo, **para que** tenga más tiempo si lo necesito y cumplo los requisitos.

**Requisitos asociados:** RF12, RN07

| # | Criterio de aceptación |
|---|------------------------|
| 1 | El usuario puede solicitar prórroga desde "Mis préstamos" para préstamos en estado "Activo" |
| 2 | El sistema verifica que el material no tenga reservas pendientes |
| 3 | El sistema verifica el Tier del usuario |
| 4 | Tier Avanzado: se otorga prórroga automáticamente |
| 5 | Tier Estándar: requiere aprobación del Gestor |
| 6 | Tier Restringido: no puede solicitar prórroga |
| 7 | El usuario indica los días adicionales que necesita |
| 8 | Se actualiza la fecha límite de devolución |
| 9 | Se notifica al usuario del resultado (aprobada/rechazada) |

**Reglas de negocio:** RN07

---

## ÉPICA 7: PERFIL E HISTORIAL

---

### HU16 — Consultar y actualizar perfil

**Como** Prestatario, **quiero** ver y actualizar mi perfil (datos personales, reputación, historial), **para que** mantenga mi información al día y conozca mi nivel de confianza en el sistema.

**Requisitos asociados:** RF10, RF11

| # | Criterio de aceptación |
|---|------------------------|
| 1 | El perfil muestra: nombre, email, DNI, teléfono, tipo (Alumno/Docente/Administrativo) |
| 2 | Se muestra el puntaje de reputación actual con su Tier correspondiente |
| 3 | Se muestra el historial de préstamos (material, fechas, resultado, sanciones aplicadas) |
| 4 | El usuario puede editar: nombre, teléfono (email y DNI son solo lectura) |
| 5 | Los cambios se guardan con validación de campos obligatorios |
| 6 | Se muestra un gráfico o indicador visual del historial de reputación (opcional) |

**Reglas de negocio:** RF10, RF11

---

### HU17 — Consultar historial de préstamos por material

**Como** Gestor de Almacén/Administrador, **quiero** ver el historial de préstamos de cada material específico, **para que** pueda identificar materiales con alto índice de daño o problemas recurrentes.

**Requisitos asociados:** RF10, Alcance del sistema

| # | Criterio de aceptación |
|---|------------------------|
| 1 | Desde el inventario, el gestor puede ver el historial de préstamos de cada material |
| 2 | Se muestra: usuario que prestó, fechas (entrega/devolución), resultado (a tiempo/tardío/dañado) |
| 3 | Se puede filtrar por período |
| 4 | Se muestra el conteo total de préstamos del material |
| 5 | Se muestra el porcentaje de devoluciones a tiempo vs tardías |

**Reglas de negocio:** Ninguna específica

---

## ÉPICA 8: REPORTES

---

### HU18 — Dashboard de reportes para Dirección

**Como** Dirección/Coordinación académica, **quiero** ver métricas consolidadas de uso del sistema, **para que** pueda tomar decisiones informadas sobre política de préstamos y adquisición de materiales.

**Requisitos asociados:** Stakeholder de sección 4 del documento de requerimientos

| # | Criterio de aceptación |
|---|------------------------|
| 1 | La Dirección puede ver métricas consolidadas: total de préstamos activos, reservas pendientes, materiales disponibles vs prestados |
| 2 | Se muestran indicadores de uso por período (semana, mes, semestre) |
| 3 | Se muestra ranking de materiales más prestados |
| 4 | Se muestra tasa de devoluciones a tiempo vs tardías |
| 5 | Se muestra distribución de usuarios por Tier de reputación |
| 6 | Los reportes son de solo lectura (la Dirección no modifica datos) |
| 7 | Se puede exportar los reportes (PDF o CSV) |

**Reglas de negocio:** Ninguna específica

---

## Resumen de cobertura

| Épica | Historias | RF cubiertos |
|-------|-----------|--------------|
| 1. Gestión de Usuarios | HU01, HU02, HU03 | RF01, RF02, RNF03 |
| 2. Inventario | HU04, HU05 | RF03, RNF01, RNF04 |
| 3. Reservas | HU06, HU07, HU08 | RF04, RN01, RN04, RN08 |
| 4. Préstamos | HU09, HU10 | RF05, RF07, RF09, RN05, RN09 |
| 5. Devoluciones/Sanciones | HU11, HU12, HU13, HU14 | RF06, RF08, RN03, RN05, RN06 |
| 6. Prórrogas | HU15 | RF12, RN07 |
| 7. Perfil/Historial | HU16, HU17 | RF10, RF11 |
| 8. Reportes | HU18 | Stakeholder sección 4 |
| **Total** | **18** | **Todos los RF y RN cubiertos** |
