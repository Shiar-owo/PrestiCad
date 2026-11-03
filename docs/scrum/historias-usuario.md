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
| 1 | El formulario permite registrar: nombre, descripción, categoría (Equipo/Libro/Objeto), estado inicial del material (Disponible por defecto; también puede registrarse En Mantenimiento), código/identificador único |
| 2 | Se pueden parametrizar por objeto: Tier mínimo requerido, bonificación por devolución a tiempo, deducción por tardanza, deducción por daño parcial, deducción por daño total |
| 3 | Si no se parametrizan los valores de reputación, el sistema aplica valores por defecto configurables |
| 4 | El código/identificador del material es único en el sistema |
| 5 | Se puede registrar múltiples unidades del mismo material (stock); el sistema genera automáticamente las instancias físicas individuales (`InstanciaMaterial`) con códigos de ejemplar únicos |
| 6 | El estado inicial de cada instancia física generada es "Disponible" |
| 7 | Se pueden editar los datos y parámetros de un material existente |
| 8 | El Gestor de Almacén puede gestionar individualmente las instancias físicas (editar serie, estado físico, ubicación) y cambiar su estado a "En Mantenimiento" o "De Baja" |

**Reglas de negocio:** RN06 (Parámetros por objeto), RN01 (Disponibilidad por instancias)

---

### HU05 — Buscar y consultar materiales

**Como** Prestatario, **quiero** buscar materiales por nombre, categoría o estado, **para que** encuentre lo que necesito rápidamente.

**Requisitos asociados:** RF03, RNF01, RNF04

| # | Criterio de aceptación |
|---|------------------------|
| 1 | Se puede buscar por nombre (búsqueda parcial, case-insensitive) |
| 2 | Se puede filtrar por categoría (Equipo/Libro/Objeto) |
| 3 | Se puede filtrar por estado y disponibilidad |
| 4 | Los resultados muestran: nombre, categoría, desglose de disponibilidad consolidada (ej. unidades disponibles de stock total) |
| 5 | La búsqueda responde en menos de 2 segundos |
| 6 | Usuarios de cualquier Tier pueden consultar materiales de todo el catálogo; la elegibilidad para recibir un préstamo se valida según RN03 |
| 7 | Un usuario nuevo puede completar una reserva en menos de 3 minutos sin capacitación |
| 8 | Al abrir la ficha técnica o detalle de un material, se muestra el listado de ejemplares/instancias físicas individuales con su código, número de serie, estado actual y observaciones |

**Reglas de negocio:** RN01 (Disponibilidad), RN03 (Elegibilidad para préstamos según Tier)

---

## ÉPICA 3: RESERVAS

---

### HU06 — Reservar material o solicitar espera

**Como** Prestatario, **quiero** reservar un material indicando prioridad y justificación, o quedar en lista de espera si no hay disponibilidad, **para que** pueda acceder a él cuando se libere una instancia.

**Requisitos asociados:** RF04, RN01, RN03, RN04, RN08, RN11, RNF06

| # | Criterio de aceptación |
|---|------------------------|
| 1 | El usuario selecciona un material y el sistema muestra su disponibilidad y Tier mínimo requerido |
| 2 | El formulario solicita nivel de prioridad (Alta/Media/Baja) y descripción/justificación del uso |
| 3 | Si el Tier es suficiente y existe una instancia física disponible, el sistema asigna la instancia y confirma la reserva en estado "Reservada" con vigencia de 24 horas |
| 4 | Si no existe una instancia disponible, la solicitud queda en estado "En Espera" con vigencia de 72 horas, sin consumir inventario |
| 5 | Antes de confirmar una nueva solicitud normal, el sistema intenta autopromover la cola existente; si la cola sigue pendiente, la nueva solicitud entra en espera |
| 6 | Si el Tier no es suficiente y el usuario no pertenece al Tier Restringido, el sistema rechaza la solicitud mostrando la restricción |
| 7 | Si el usuario es del Tier Restringido y el material es de Tier superior, puede solicitar una excepción académica adjuntando documento de identidad y compromiso firmado; la solicitud queda en espera para aprobación del Gestor y no se autopromueve |
| 8 | La autopromoción respeta el orden: prioridad (Alta/Media/Baja), luego fecha de solicitud más antigua, luego Tier (Avanzado/Estándar/Restringido) |
| 9 | La reserva o solicitud se asocia al usuario y se puede ver en "Mis reservas"; el máximo configurable de solicitudes activas incluye reservas confirmadas y en espera |

**Reglas de negocio:** RN01, RN03, RN04, RN08, RN11

---

### HU07 — Expiración de reservas y solicitudes en espera

**Como** Sistema, **quiero** cancelar las reservas confirmadas no recogidas en 24 horas y expirar las solicitudes en espera a las 72 horas, **para que** las instancias se liberen y la cola no acumule solicitudes obsoletas.

**Requisitos asociados:** RN04, RN11

| # | Criterio de aceptación |
|---|------------------------|
| 1 | Un proceso periódico (cron job) verifica reservas en estado "Reservada" y solicitudes en estado "En Espera" |
| 2 | Si una reserva confirmada superó las 24 horas sin retiro, cambia a "Cancelada por Vencimiento", libera la instancia y aplica la penalización configurable por inasistencia |
| 3 | Si una solicitud en espera superó las 72 horas, cambia a "Expirada" sin aplicar penalización |
| 4 | Al liberarse una instancia, el sistema dispara la autopromoción de la cola de espera respetando prioridad, antigüedad y Tier |
| 5 | El Gestor de Almacén puede cancelar manualmente una reserva confirmada antes del vencimiento, liberando la instancia y disparando la autopromoción |
| 6 | El estado actualizado de cada reserva o solicitud se refleja en "Mis reservas"; las notificaciones in-app quedan fuera del alcance de esta iteración |

**Reglas de negocio:** RN04, RN11

---

### HU08 — Gestionar cola de reservas y excepciones

**Como** Gestor de Almacén, **quiero** supervisar la cola de reservas, aprobar o rechazar excepciones y cancelar reservas, **para que** la asignación sea justa y las solicitudes normales se autopromuevan sin intervención manual.

**Requisitos asociados:** RN03, RN05, RN08, RN11

| # | Criterio de aceptación |
|---|------------------------|
| 1 | Se muestra una cola por material con solicitudes en espera, reservas confirmadas e instancias disponibles |
| 2 | Cada solicitud muestra usuario, prioridad (Alta/Media/Baja), justificación, Tier, fecha de solicitud y si es por excepción académica |
| 3 | El sistema ordena las solicitudes normales por prioridad, fecha de solicitud y Tier, y autopromueve la primera cuando hay una instancia disponible |
| 4 | El Gestor de Almacén puede rechazar solicitudes en espera y cancelar reservas confirmadas indicando el motivo; ambas acciones actualizan la cola |
| 5 | Las solicitudes por excepción académica solo pueden ser aprobadas o rechazadas por el Gestor; no se autopromueven |
| 6 | Para aprobar una excepción se requiere la garantía completa y una instancia real disponible |
| 7 | La auto-confirmación y la autopromoción son atómicas, sin asignar una misma instancia dos veces ni saltarse el orden de la cola |
| 8 | Los cambios de estado se reflejan en "Mis reservas"; las notificaciones in-app quedan fuera del alcance de esta iteración |

**Reglas de negocio:** RN03, RN05, RN08, RN11

---

## ÉPICA 4: PRÉSTAMOS

---

### HU09 — Registrar préstamo y convertir reserva

**Como** Gestor de Almacén, **quiero** registrar la entrega de un material a un usuario con checklist digital de estado inicial y garantía (si aplica) y convertir la reserva de origen, **para que** quede un registro formal y trazable del préstamo.

**Requisitos asociados:** RF05, RF09, RN01, RN05, RN09, RN11

| # | Criterio de aceptación |
|---|------------------------|
| 1 | El gestor busca la reserva confirmada, la excepción aprobada o el préstamo activo del usuario |
| 2 | El sistema verifica la identidad y elegibilidad del usuario (Tier, sin impedimentos) |
| 3 | Si el préstamo proviene de una reserva confirmada, el sistema utiliza la instancia asignada y vincula la reserva al préstamo |
| 4 | Si no proviene de una reserva, el gestor selecciona la instancia física/ejemplar específico a entregar y completa un checklist del estado inicial con cada elemento, una foto obligatoria y una observación opcional |
| 5 | Para equipos de alto valor o préstamos por excepción académica, se valida la garantía registrada mediante documento de identidad y compromiso de responsabilidad firmado |
| 6 | Si la garantía es requerida y falta cualquiera de los dos PDF, el sistema no permite que el préstamo pase a "Activo" |
| 7 | El gestor indica la duración del préstamo entre 1 y 30 días |
| 8 | El sistema calcula y muestra la fecha límite de devolución |
| 9 | El estado del préstamo cambia a "Activo" |
| 10 | El estado de la instancia física seleccionada cambia a "Prestado", reduciendo en 1 el stock disponible del material, y la reserva de origen cambia a "Convertida en Préstamo" si corresponde |

**Reglas de negocio:** RN01, RN05, RN09, RN11

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

**Requisitos asociados:** RF06, RF08, RN06, RN09, RN10

| # | Criterio de aceptación |
|---|------------------------|
| 1 | El gestor busca el préstamo activo del material |
| 2 | El sistema muestra el checklist de estado inicial registrado al momento de la entrega del ejemplar |
| 3 | El checklist de devolución conserva exactamente los elementos y el orden del checklist inicial; no se pueden agregar ni quitar elementos |
| 4 | Para cada elemento, el gestor registra el estado y puede agregar una observación; si indica daño parcial o total, la observación y una foto del daño son obligatorias. Sin cambios, la foto es opcional |
| 5 | El sistema compara el checklist de devolución con el inicial y resalta las diferencias (daños nuevos), mostrando las observaciones y fotos disponibles de ambas etapas |
| 6 | Al revisar la devolución, si faltan fotos obligatorias, el sistema muestra en un aviso todos los elementos afectados, no envía la devolución y dirige el foco al primer elemento pendiente |
| 7 | El sistema compara la fecha de devolución con la fecha límite |
| 8 | Si devolvió a tiempo: aplica bonificación de puntos (parámetro del objeto) |
| 9 | Si devolvió con retraso: aplica descuento de puntos proporcional al tiempo excedido |
| 10 | Si hay daño nuevo: aplica penalización de puntos y genera el cobro de reparación/reposición |
| 11 | Se actualiza el puntaje de reputación del usuario |
| 12 | El estado del préstamo cambia a "Devuelto" |
| 13 | El estado de la instancia física devuelta cambia a "Disponible" (o a "En Mantenimiento" si presentó daños según el checklist), recalculando la disponibilidad del material |
| 14 | Se registra el historial completo de la operación |
| 15 | Ante daño parcial o total se genera un reporte en PDF con los datos del préstamo, el prestatario, el gestor, los elementos dañados, sus observaciones, las fotos iniciales y finales disponibles, y la sanción aplicada |
| 16 | El gestor y el administrador pueden consultar el listado de reportes de daños con filtros (tipo de daño y rango de fechas) y descargar cada PDF |

**Reglas de negocio:** RN06, RN09, RN10

---

### HU12 — Gestionar reputación y Tiers de acceso

**Como** Sistema, **quiero** mantener el puntaje de reputación de cada usuario en el rango [-500, 500] y calcular su Tier de acceso, **para que** se controlen automáticamente los privilegios de préstamo.

**Requisitos asociados:** RF08, RN03

| # | Criterio de aceptación |
|---|------------------------|
| 1 | Cada usuario tiene un puntaje de reputación visible en su perfil |
| 2 | El rango es de -500 a 500 (no se puede salir de este rango) |
| 3 | Tier Avanzado: 201 a 500 pts → acceso total, desempate en la cola de reservas y prórrogas automáticas |
| 4 | Tier Estándar: -50 a 200 pts → acceso a libros y equipos estándar, margen de tolerancia |
| 5 | Tier Restringido: -500 a -51 pts → solo materiales básicos, sin prórrogas |
| 6 | El Tier se recalcula automáticamente al modificar el puntaje |
| 7 | Los cambios de Tier surten efecto inmediato en las funcionalidades disponibles |

**Reglas de negocio:** RN03

---

### HU13 — Reserva y préstamo excepcional por necesidad académica

**Como** Prestatario en Tier Restringido, **quiero** solicitar excepcionalmente una reserva o préstamo de materiales de mayor Tier presentando garantía firmada, **para que** pueda cubrir una necesidad académica urgente a pesar de mi nivel de reputación.

**Requisitos asociados:** RN03, RN05, RN11, RNF06

| # | Criterio de aceptación |
|---|------------------------|
| 1 | El usuario selecciona un material de Tier superior y el sistema detecta que pertenece al Tier Restringido |
| 2 | El sistema muestra la opción de "Excepción Académica" tanto para reserva como para préstamo |
| 3 | El usuario debe subir documento de identidad y compromiso de responsabilidad firmado; el total de adjuntos no debe superar 4 MB |
| 4 | El sistema registra la garantía al solicitar la reserva excepcional y la asocia a la solicitud |
| 5 | La reserva excepcional queda en estado "En Espera" para revisión del Gestor de Almacén y no participa en la autopromoción |
| 6 | El Gestor de Almacén aprueba o rechaza la solicitud después de validar la garantía; la aprobación requiere una instancia real disponible |
| 7 | Al aprobar una reserva excepcional, esta queda "Reservada" con vigencia de 24 horas; el préstamo excepcional directo también requiere aprobación del Gestor |
| 8 | El préstamo se activa con el indicador `es_excepcion` y se muestra como "Activo - Excepción", sin crear un estado de préstamo distinto |
| 9 | Si la devolución es con daño, se duplican únicamente los puntos de daño; el cobro económico de reparación/reposición no se duplica |
| 10 | Se muestra un indicador especial en el préstamo para que el gestor lo identifique y revise |

**Reglas de negocio:** RN03 (Excepción Académica), RN05, RN11

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
| 2 | El sistema verifica que el material no tenga reservas confirmadas ni solicitudes en espera |
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
| 3. Reservas | HU06, HU07, HU08 | RF04, RN01, RN03, RN04, RN05, RN08, RN11, RNF06 |
| 4. Préstamos | HU09, HU10 | RF05, RF07, RF09, RN01, RN05, RN09, RN11 |
| 5. Devoluciones/Sanciones | HU11, HU12, HU13, HU14 | RF06, RF08, RN03, RN05, RN06, RN11, RNF06 |
| 6. Prórrogas | HU15 | RF12, RN07 |
| 7. Perfil/Historial | HU16, HU17 | RF10, RF11 |
| 8. Reportes | HU18 | Stakeholder sección 4 |
| **Total** | **18** | **Todos los RF y RN cubiertos** |
