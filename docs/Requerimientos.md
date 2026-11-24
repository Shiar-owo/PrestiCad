**UNIVERSIDAD NACIONAL SAN AGUSTÍN DE AREQUIPA**  
**FACULTAD DE INGENIERÍA  DE PRODUCCIÓN Y SERVICIOS**  
**ESCUELA PROFESIONAL DE  CIENCIA DE LA COMPUTACIÓN**  
**Análisis de Requisitos**

**Docente	:**	Yari Ramos, Yessenia Deysi  
**Curso 	:**	Trabajo Interdisciplinar II  
**Grupo	:**	6  
**Alumnos	:**        Ccaso Idme, Moises Robert   
Rivera Olivera, Omar Joaquín  
Sucari Ccansaya, Edú André  
Torres Chávez, Jhair Alejandro

**Arequipa \- Perú**  
**2026**  
**Documento de Análisis de Requisitos**  
*Sistema de Préstamos Académicos*

**[LINK GOOGLE DOCS](https://docs.google.com/document/d/1XE7dGWWqA4Pc0tOqJZG6PJ733xt0i_t6zfkJ3markw8/edit?usp=sharing)**

# 1\. Introducción

**Nombre del proyecto:** Sistema de Préstamos Académicos

**Descripción breve:** Sistema de información orientado a gestionar el préstamo de materiales dentro de una institución educativa, incluyendo equipos, libros y otros objetos, permitiendo su reserva, entrega, devolución y control del estado de cada préstamo.

**Objetivo del documento:** Especificar los requisitos funcionales, no funcionales y reglas de negocio del Sistema de Préstamos Académicos, de manera que sirvan de base para el diseño del modelo de dominio y el desarrollo posterior del sistema.

# 2\. Descripción del problema

**Problema actual:** La gestión de préstamos de equipos, libros y otros objetos dentro de la institución se realiza de forma manual o dispersa, sin un registro centralizado que permita conocer en todo momento la disponibilidad del material ni el estado de los préstamos activos.

**Personas afectadas:** Alumnos, docentes y personal administrativo que requieren solicitar, prestar o supervisar el uso de materiales institucionales.

**Situación actual:** No existe un sistema de inventario unificado ni un mecanismo de reservas, por lo que los registros de préstamos, devoluciones y sanciones se llevan de manera informal, generalmente en cuadernos, hojas de cálculo o de forma verbal.

**Dificultades:** Pérdida de historial de préstamos, dificultad para saber qué material está disponible, ausencia de control sobre devoluciones tardías y sanciones, y falta de un perfil consolidado por usuario que muestre su actividad de préstamos.

**Justificación del sistema:** Un sistema centralizado permitirá controlar el inventario en tiempo real, gestionar reservas y préstamos de forma ordenada, aplicar sanciones cuando corresponda y mantener un historial confiable, mejorando la trazabilidad y la experiencia de alumnos, docentes y administrativos.

# 3\. Objetivos

## Objetivo general

Desarrollar un sistema de información que permita gestionar de manera integral el préstamo de materiales académicos (equipos, libros y objetos), controlando el registro de usuarios, el inventario, las reservas, el estado de los préstamos y las sanciones asociadas.

## Objetivos específicos

* Permitir el registro y la gestión de usuarios según su tipo: alumno, docente o administrativo.

* Gestionar el inventario de materiales disponibles para préstamo (equipos, libros, objetos), incluyendo su estado y disponibilidad.

* Implementar un sistema de reservas y solicitud de préstamos que respete los tiempos de préstamo establecidos.

* Controlar el estado de los préstamos (reservado, activo, devuelto, vencido) y aplicar sanciones ante incumplimientos.

* Mantener un historial de préstamos y un perfil por usuario, incluyendo el registro de garantías asociadas a cada préstamo.

# 4\. Stakeholders y actores

Se identifican a continuación los stakeholders y actores que interactúan directa o indirectamente con el sistema, clasificados bajo la taxonomía de Prestatarios y Gestores de Almacén / Administradores del Sistema.

| Stakeholder / Actor | Rol o interés |
| :---- | :---- |
| Prestatario (Alumno, Docente, Administrativo) | Solicita, reserva y recibe préstamos de equipos, libros u objetos; consulta su historial y mantiene al día su perfil. |
| Gestor de Almacén | Administra el inventario de materiales, registra la entrega y devolución de recursos y  verifica garantías. |
| Administrador del Sistema | Gestiona el registro de usuarios, roles, parámetros del sistema, reglas de negocio e inventario general. |
| Dirección / Coordinación académica | Consulta reportes, métricas consolidadas e indicadores de uso del sistema de préstamos e inventario. |

# 5\. Alcance

## Dentro del sistema:

* Registro y autenticación de usuarios (alumnos, docentes, administrativos).

* Gestión del perfil de cada usuario.

* Gestión del inventario de materiales: equipos, libros y objetos.

* Sistema de reservas de materiales.

* Registro y control del ciclo de vida de los préstamos (solicitud, entrega, devolución).

* Control del tiempo de préstamo y de las devoluciones.

* Registro de garantías asociadas a los préstamos.

* Aplicación de sanciones por incumplimiento (retraso o daño del material).

* Historial de préstamos por usuario y por material.

## Fuera del sistema:

* Procesos de compra o adquisición de nuevos materiales.

* Pagos en línea de sanciones o garantías (se gestionan de forma manual/presencial).

* Integración con sistemas externos ajenos a la institución (bibliotecas externas, proveedores, etc.).

* Mantenimiento técnico o reparación física de los equipos.

# 6\. Requisitos

## 6.1 Requisitos funcionales

* RF01: El sistema debe permitir registrar usuarios, indicando su rol dentro del esquema (Prestatarios: Alumno, Docente, Administrativo; o Gestores/Administradores).

* RF02: El sistema debe permitir a los usuarios iniciar sesión y acceder a su perfil.

* RF03: El sistema debe permitir registrar y administrar el inventario de materiales (equipos, libros, objetos), controlando tanto el catálogo general como sus ejemplares o instancias físicas individuales (código de ejemplar, número de serie, estado individual, estado físico y ubicación), incluyendo el cálculo de disponibilidad en tiempo real y la parametrización en la ficha de cada objeto de sus atributos de reputación (Tier mínimo requerido, bonificación por devolución a tiempo, y deducciones por tardanza, daño parcial o daño total).

* RF04: El sistema debe permitir a los usuarios reservar un material para un préstamo futuro, indicando prioridad y justificación. Si existe al menos una instancia física disponible y el Tier del usuario es suficiente, la reserva se confirma automáticamente y se asigna una instancia; si no hay disponibilidad, la solicitud queda en lista de espera y se autopromueve cuando se libere una instancia. Las reservas por excepción académica requieren aprobación del Gestor de Almacén.

* RF05: El sistema debe permitir registrar un préstamo, asociando el material, el usuario, la fecha de entrega y el tiempo de préstamo establecido. Si el préstamo proviene de una reserva confirmada, se reutiliza la instancia física asignada y se vincula la reserva al préstamo.

* RF06: El sistema debe permitir registrar la devolución de un material, actualizar el estado del préstamo y generar un reporte en PDF cuando la devolución detecte daño parcial o total; además, debe permitir consultar y descargar posteriormente el listado de reportes de daños (Gestor de Almacén y Administrador).

* RF07: El sistema debe mostrar el estado de cada préstamo (reservado, activo, devuelto, vencido).

* RF08: El sistema debe gestionar el puntaje de reputación del usuario en el rango de \-500 a 500, aplicar descuentos de puntos y suspensiones temporales por tardanza, y registrar cobros económicos de reparación/reposición exclusivamente ante daños físicos en el material.

* RF09: El sistema debe registrar la garantía dejada por el usuario al solicitar una reserva o un préstamo, cuando corresponda. En las solicitudes por excepción académica, la garantía se registra al solicitar la reserva y se reutiliza al convertirla en préstamo.

* RF10: El sistema debe permitir consultar el historial de préstamos de cada usuario.

* RF11: El sistema debe permitir al usuario consultar y actualizar su perfil.

* RF12: El sistema debe permitir a los usuarios solicitar una prórroga de sus préstamos activos, evaluando automáticamente su elegibilidad según su Tier de reputación y la disponibilidad del bien.

## 6.2 Requisitos no funcionales

* RNF01: El tiempo de respuesta del sistema para búsquedas en el inventario y consultas de estado no debe superar los 2 segundos bajo una carga normal de operación.

* RNF02: El sistema debe garantizar una disponibilidad del 99.5% durante el horario de atención institucional (07:00 a 22:00 hrs).

* RNF03: El sistema debe proteger los datos personales de los usuarios y restringir el acceso según el tipo de usuario (alumno, docente, administrativo, administrador).

* RNF04: Un usuario nuevo debe ser capaz de completar la reserva de un material en menos de 3 minutos sin entrenamiento previo.

* RNF05: El sistema debe permitir su escalabilidad para incorporar nuevos tipos de materiales o usuarios en el futuro.

* RNF06: Toda solicitud que incluya archivos adjuntos, como fotos de checklist o documentos PDF de garantía, no debe superar los 4 MB en total.

## 6.3 Reglas de negocio

* RN01: Disponibilidad de Materiales: Una reserva confirmada o un préstamo requiere una instancia física (ejemplar) concreta en estado "Disponible". Si todas las instancias están en estado "En Mantenimiento", "Reservado", "Prestado" o "De Baja", la solicitud no se rechaza por falta de disponibilidad: queda en estado "En Espera" sin consumir stock ni garantizar la asignación. La reserva solo se confirma cuando el sistema asigna una instancia física real. Cada préstamo se asocia a una instancia física concreta.

* RN03: Sistema de Reputación y Tiers de Acceso: La elegibilidad para recibir préstamos se rige por una escala de reputación en el rango de \[-500, 500\], iniciando cada usuario nuevo con 0 puntos (Neutral). Las restricciones de Tier se aplican al préstamo del material y no limitan la visualización del catálogo: todos los usuarios pueden consultar materiales de cualquier Tier. Se establecen tres Tiers de acceso: 1\) Tier Avanzado (201 a 500 pts): Elegible para recibir préstamos de todo el inventario, incluidos equipos de alto valor, con prioridad en prórrogas automáticas/extendidas. 2\) Tier Estándar (-50 a 200 pts): Elegible para recibir préstamos de libros y equipos estándar, incluyendo un margen de tolerancia en rango negativo (hasta \-50 pts) para imprevistos o retrasos menores sin degradar al usuario al nivel restringido. 3\) Tier Restringido (-500 a \-51 pts): Elegible para recibir préstamos únicamente de materiales básicos/libros de bajo valor, sin derecho a préstamos de equipos ni prórrogas. En la cola de reservas, el Tier actúa como criterio de desempate después de la prioridad y la antigüedad de la solicitud. Excepción Académica: Un usuario en Tier Restringido que requiera un bien de Tier Superior por necesidad académica urgente podrá solicitar una reserva o un préstamo de manera excepcional si presenta un documento de identidad y un compromiso de responsabilidad firmado como garantía. La solicitud de reserva excepcional requiere aprobación del Gestor de Almacén y no participa en la autopromoción.

* RN04: Vigencia de Reservas: Una reserva confirmada tiene una vigencia máxima de 24 horas desde su confirmación o aprobación. Cumplido este plazo sin que el material sea retirado, la reserva pasa automáticamente al estado "Cancelada por Vencimiento", la instancia retorna a "Disponible" y se aplica la penalización configurable por inasistencia. Una solicitud en lista de espera tiene una vigencia máxima de 72 horas desde su creación; al vencer pasa a "Expirada" sin penalización. El plazo de 24 horas solo comienza cuando la solicitud es confirmada.

* RN05: Registro de Garantías y Excepciones: Para préstamos de equipos de alto valor (laptops, proyectores, cámaras) o para reservas y préstamos por excepción académica a usuarios en Tier Restringido, se requiere el registro y entrega obligatoria de un documento de identidad y un compromiso de responsabilidad firmado como garantía. En una reserva excepcional, la garantía se registra al solicitar la reserva y el Gestor de Almacén la valida antes de aprobarla; la misma garantía se reutiliza al convertir la reserva en préstamo. En un préstamo excepcional directo, la garantía se valida antes de cambiar el estado del préstamo a "Activo". Los documentos se almacenan como PDF y el conjunto de adjuntos de la solicitud no debe superar los 4 MB en total.

* RN06: Cálculo de Sanciones e Impacto en Reputación por Objeto: Al momento de la devolución, el sistema realiza un cálculo dinámico utilizando los parámetros configurados en la ficha del objeto devuelto: otorga puntos de bonificación por entrega a tiempo, aplica un descuento de puntos proporcional al tiempo excedido en caso de tardanza, y aplica una penalización severa de puntos junto con cobro económico de reparación/reposición únicamente en caso de daño parcial o total.

* RN07: Prórrogas de Préstamos: La solicitud de extensión o prórroga de un préstamo activo está condicionada a la disponibilidad del bien (sin reservas confirmadas ni solicitudes en espera) y al Tier de reputación del usuario, siendo otorgada de forma prioritaria a los usuarios del Tier Avanzado.

* RN08: Control de Concurrencia en Reservas: La auto-confirmación, el registro en lista de espera y la autopromoción de reservas para un mismo objeto se realizan mediante transacciones atómicas a nivel de base de datos para prevenir condiciones de carrera sobre la disponibilidad de ejemplares físicos. El sistema no debe asignar una misma instancia a dos reservas ni confirmar una reserva sin una instancia real disponible. Antes de confirmar una nueva solicitud normal, el sistema intenta autopromover la cola existente; si la cola sigue pendiente, la nueva solicitud entra en espera para no saltarse el orden.

* RN09: Inspección y Checklist de Estado Inicial y de Devolución: Cada elemento del checklist inicial de entrega (CU03) debe incluir una foto obligatoria y puede incluir una observación. Al registrar la devolución (CU04), el checklist debe conservar exactamente los elementos y el orden iniciales, sin permitir agregar ni quitar elementos. Cada elemento registra su estado y puede incluir una observación; cuando se reporta daño parcial o total, la observación y al menos una foto son obligatorias. Si no hay cambios, la foto es opcional. La devolución se contrasta con el registro inicial para identificar desperfectos nuevos.

* RN10: Reporte Obligatorio de Daños: Toda devolución que detecte daño parcial o total genera obligatoriamente un reporte en PDF con los datos del préstamo, el prestatario, el gestor que registró la devolución, el tipo de daño (parcial o total), el detalle de los elementos dañados, sus observaciones, las fotos iniciales y finales disponibles, y la sanción aplicada. El reporte se almacena de forma permanente para su consulta y descarga posterior.

* RN11: Cola de Espera y Autopromoción: Cuando no existe una instancia física disponible, la solicitud queda en estado "En Espera" sin reservar inventario. Al liberarse una instancia, el sistema autopromueve la solicitud normal de mayor prioridad (Alta, Media, Baja); a igual prioridad, la solicitud más antigua; a igual fecha, el Tier de mayor nivel (Avanzado, Estándar, Restringido). La autopromoción se ejecuta al registrar una devolución que libera la instancia, al cancelar o vencer una reserva, al pasar una instancia de mantenimiento a disponible, al registrar un nuevo ejemplar y mediante una revisión periódica de respaldo. La autopromoción solo confirma la reserva si existe una instancia real disponible; en caso contrario, la solicitud permanece en espera. Las reservas por excepción académica no participan en la autopromoción y solo pueden ser aprobadas o rechazadas por el Gestor de Almacén. El Gestor de Almacén puede rechazar solicitudes en espera y cancelar reservas confirmadas, lo que también dispara la autopromoción de la cola.

# 7\. Casos de uso

A continuación se detallan los casos de uso principales identificados para el sistema. El diagrama de casos de uso correspondiente se incluirá como parte del modelado del sistema (sección 8).

### CU01 – Registrar usuario

**Actor:** Administrador del Sistema

**Descripción:** Permite registrar en el sistema a un nuevo usuario (alumno, docente o administrativo) para que pueda utilizar el sistema de préstamos.

**Precondiciones:** El administrador ha iniciado sesión en el sistema.

**Flujo principal:**

1. El administrador accede a la opción "Registrar usuario".

2. El sistema solicita los datos del usuario y su tipo (alumno, docente, administrativo).

3. El administrador ingresa los datos y confirma el registro.

4. El sistema valida la información y crea el usuario.

**Flujos alternativos:**

* Si los datos son inválidos o el usuario ya existe, el sistema muestra un mensaje de error y solicita corrección.

**Postcondiciones:** El nuevo usuario queda registrado y puede iniciar sesión en el sistema.

### CU02 – Reservar material o solicitar espera

**Actor:** Prestatario (Alumno, Docente, Administrativo)

**Descripción:** Permite a un usuario reservar un material para un préstamo futuro, especificando el nivel de prioridad (Alta, Media, Baja) y una descripción/justificación de uso. Si hay una instancia disponible y el Tier es suficiente, la reserva se confirma automáticamente; si no hay disponibilidad, la solicitud queda en lista de espera. Un usuario en Tier Restringido puede solicitar una reserva por excepción académica para un material de Tier superior.

**Precondiciones:** El usuario ha iniciado sesión. Para una reserva normal, cumple con el Tier de reputación mínimo requerido. Para una reserva por excepción, pertenece al Tier Restringido y presenta los documentos de garantía exigidos.

**Flujo principal:**

1. El usuario busca el material que desea reservar.

2. El sistema muestra la disponibilidad del material y el Tier requerido.

3. El usuario selecciona el material, ingresa el nivel de prioridad (Alta, Media, Baja), redacta la justificación y confirma la solicitud.

4. Si el Tier es suficiente y existe al menos una instancia disponible, el sistema asigna una instancia física y confirma la reserva de forma atómica, dejándola en estado "Reservada" con vigencia de 24 horas.

5. Si el Tier es suficiente pero no existe una instancia disponible, el sistema registra la solicitud en estado "En Espera", sin consumir inventario, con vigencia de 72 horas.

6. Si el usuario pertenece al Tier Restringido y el material es de Tier superior, el sistema le ofrece la opción de excepción académica. El usuario adjunta su documento de identidad y el compromiso de responsabilidad firmado, y el sistema registra la garantía.

7. La solicitud de excepción queda en estado "En Espera" para revisión del Gestor de Almacén y no participa en la autopromoción automática.

**Flujos alternativos:**

* Si el usuario no alcanza el Tier requerido y no pertenece al Tier Restringido, el sistema rechaza la solicitud e informa la restricción.

* Si la solicitud de excepción no incluye ambos documentos o supera el límite de 4 MB en total, el sistema no permite enviarla.

* Si existen solicitudes normales en espera para el material, el sistema intenta autopromoverlas antes de confirmar una nueva solicitud; si la cola continúa pendiente, la nueva solicitud entra en espera.

**Postcondiciones:** La solicitud queda confirmada como "Reservada" con una instancia asignada, o queda "En Espera" para autopromoción o revisión del Gestor de Almacén. La lista de espera no garantiza disponibilidad inmediata.

### CU03 – Registrar préstamo

**Actor:** Gestor de Almacén

**Descripción:** Permite registrar la entrega de un material a un usuario, iniciando formalmente el préstamo. Si el préstamo proviene de una reserva confirmada, se utiliza la instancia asignada y se vincula la reserva al préstamo.

**Precondiciones:** Existe una reserva confirmada, una excepción aprobada o el material está disponible; el usuario no tiene impedimentos. Si la reserva es por excepción académica, la garantía ya fue validada por el Gestor de Almacén.

**Flujo principal:**

1. El Gestor de Almacén verifica la identidad y elegibilidad del usuario en el sistema.

2. El Gestor de Almacén selecciona la reserva confirmada o la instancia física / ejemplar específico del material a entregar. Si proviene de una reserva, el sistema muestra la instancia asignada.

3. El Gestor de Almacén completa el checklist digital de estado inicial de la instancia seleccionada. Cada elemento debe incluir una foto y puede incluir una observación; luego registra la duración del préstamo (de 1 a 30 días) y la garantía dejada, si corresponde.

4. El sistema actualiza el estado de la instancia física a "Prestado", recalcula la disponibilidad del material, asocia la entrega al préstamo activo y marca la reserva como "Convertida en Préstamo".

**Flujos alternativos:**

* Si el material requiere garantía y esta no se entrega o no fue validada, el sistema no permite completar el préstamo.

* Si la reserva confirmada ya venció o fue cancelada, el Gestor de Almacén no puede usarla para registrar el préstamo.

**Postcondiciones:** El préstamo queda activo con su fecha límite de devolución registrada y, si corresponde, vinculado a la reserva de origen.

### CU04 – Registrar devolución

**Actor:** Gestor de Almacén

**Descripción:** Permite registrar la devolución de un material previamente prestado y determinar si corresponde una sanción.

**Precondiciones:** Existe un préstamo activo asociado al material.

**Flujo principal:**

1. El Gestor de Almacén busca el préstamo activo correspondiente.

2. El Gestor de Almacén inspecciona la instancia física devuelta y completa el checklist digital de devolución, contrastándolo con el estado inicial registrado.

3. El sistema compara la fecha de devolución con la fecha límite establecida.

4. El sistema calcula el impacto en la reputación usando los parámetros del objeto (bonificación o descuento) y actualiza el puntaje del usuario, el estado del préstamo a "Devuelto" y el estado de la instancia física a "Disponible" (o "En Mantenimiento" ante daños), recalculando la disponibilidad del material. Si la instancia queda disponible, el sistema dispara la autopromoción de la cola de espera del material.

**Flujos alternativos:**

* Si se identifican desperfectos nuevos respecto al checklist inicial o si hay retraso, el sistema recalcula el puntaje de reputación aplicando los descuentos parametrizados y genera la sanción/cobro por daño correspondiente.

**Postcondiciones:** El préstamo queda cerrado y se actualiza el historial del usuario y del material.

### CU05 – Expirar reservas y solicitudes en espera

**Actor:** Sistema (proceso automático) / Gestor de Almacén

**Descripción:** Cancela automáticamente las reservas confirmadas que superaron las 24 horas sin ser recogidas, expira las solicitudes en espera que superaron las 72 horas y libera las instancias cuando corresponde.

**Precondiciones:** Existen reservas en estado "Reservada" con más de 24 horas desde su confirmación, o solicitudes en estado "En Espera" con más de 72 horas desde su creación.

**Flujo principal:**

1. El sistema ejecuta la verificación periódica de vigencia de reservas y solicitudes en espera.

2. Para cada reserva confirmada que superó las 24 horas, el sistema actualiza su estado a "Cancelada por Vencimiento", libera la instancia a "Disponible" y aplica una penalización por inasistencia al puntaje de reputación del usuario.

3. Para cada solicitud en espera que superó las 72 horas, el sistema actualiza su estado a "Expirada" sin aplicar penalización.

4. Después de liberar una instancia, el sistema dispara la autopromoción de la cola de espera del material, respetando el orden de prioridad, antigüedad y Tier.

**Flujos alternativos:**

* El Gestor de Almacén puede cancelar manualmente una reserva confirmada antes del vencimiento, liberando la instancia y disparando la autopromoción.

* Si no existe una instancia real disponible al intentar autopromover, la solicitud permanece en espera.

**Postcondiciones:** La reserva o solicitud queda inactiva, la instancia se libera cuando corresponde y la cola se actualiza para futuras asignaciones.

### CU06 – Gestionar cola de reservas y excepciones

**Actor:** Gestor de Almacén

**Descripción:** Permite al Gestor de Almacén consultar la cola de solicitudes de un material, supervisar las reservas confirmadas, rechazar solicitudes en espera, aprobar o rechazar reservas por excepción académica y cancelar reservas confirmadas.

**Precondiciones:** El Gestor de Almacén ha iniciado sesión y tiene permisos de gestión de reservas.

**Flujo principal:**

1. El Gestor de Almacén accede a la cola de reservas del material.

2. El sistema muestra las solicitudes en espera, las reservas confirmadas y las instancias disponibles, indicando usuario, prioridad, justificación, Tier, fecha de solicitud y si la solicitud es por excepción académica.

3. El sistema ordena las solicitudes normales por prioridad, antigüedad y Tier, y autopromueve la primera solicitud cuando hay una instancia disponible.

4. El Gestor de Almacén revisa las solicitudes por excepción académica y verifica la garantía registrada.

5. El Gestor de Almacén aprueba o rechaza cada solicitud por excepción. La aprobación requiere una instancia real disponible y no se ejecuta mediante autopromoción.

6. El Gestor de Almacén puede rechazar solicitudes en espera o cancelar reservas confirmadas, indicando el motivo.

**Flujos alternativos:**

* Si la garantía de una solicitud por excepción está incompleta o es inválida, el Gestor de Almacén no puede aprobarla.

* Si no hay instancias disponibles, las solicitudes normales permanecen en espera y las excepciones no pueden aprobarse hasta que se libere una instancia.

**Postcondiciones:** La cola queda actualizada, las solicitudes rechazadas o canceladas quedan inactivas y las instancias liberadas disparan la autopromoción de las solicitudes normales.

# 8\. Modelado del sistema

Los siguientes diagramas se desarrollarán como parte del modelado del sistema, en conjunto con el Modelo de Dominio (DDD) del proyecto:

* Diagrama de contexto.

* Diagrama de casos de uso (basado en los casos de uso descritos en la sección 7).

* Modelo conceptual / de dominio: entidades como Usuario, Material, Préstamo, Reserva, Sanción y Garantía, y sus relaciones.

* Diagrama de clases.

* Otros diagramas complementarios que resulten necesarios (por ejemplo, diagrama de estados del préstamo).

# 9\. Matriz de requisitos

| ID | Requisito / Regla | Tipo | Prioridad |
| :---- | :---- | :---- | :---- |
| RF01 | Registrar usuario con roles según taxonomía (Prestatario / Gestor / Administrador) | Funcional | Alta |
| RF02 | Iniciar sesión y acceder al perfil | Funcional | Alta |
| RF03 | Gestionar inventario y parametrización de atributos de reputación por objeto | Funcional | Alta |
| RF04 | Reservar material con prioridad y justificación; confirmar automáticamente con instancia disponible o registrar en lista de espera | Funcional | Alta |
| RF05 | Registrar préstamo por parte del Gestor de Almacén | Funcional | Alta |
| RF06 | Registrar devolución, generar y consultar/descargar reportes de daños en PDF (Gestor y Administrador) | Funcional | Alta |
| RF07 | Consultar estado del préstamo | Funcional | Media |
| RF08 | Gestionar puntaje de reputación (-500 a 500), suspensiones y cobros solo por daño | Funcional | Alta |
| RF09 | Registrar garantía para préstamo de alto valor o reserva/préstamo por excepción académica, reutilizándola al convertir la reserva | Funcional | Media |
| RF10 | Consultar historial de préstamos | Funcional | Media |
| RF11 | Consultar y actualizar perfil de usuario | Funcional | Media |
| RF12 | Solicitar prórroga/extensión de préstamo activo según reputación y disponibilidad | Funcional | Media |
| RNF01 | Tiempo de respuesta inferior a 2 segundos en consultas | No funcional | Media |
| RNF02 | Disponibilidad del 99.5% en horario de 07:00 a 22:00 hrs | No funcional | Media |
| RNF03 | Protección de datos y control de acceso por roles | No funcional | Alta |
| RNF04 | Completar reserva en menos de 3 minutos sin capacitación | No funcional | Media |
| RNF05 | Escalabilidad para incorporación de nuevos materiales y usuarios | No funcional | Baja |
| RNF06 | Los adjuntos de una solicitud no deben superar 4 MB en total | No funcional | Media |
| RN01 | Disponibilidad obligatoria de una instancia real para reserva confirmada o préstamo; sin instancia se pasa a lista de espera | Regla de negocio | Alta |
| RN03 | Sistema de reputación (-500 a 500), Tiers de Acceso, desempate por Tier y Excepción Académica para reservas y préstamos | Regla de negocio | Alta |
| RN04 | Vigencia de 24 horas para reservas confirmadas y 72 horas para solicitudes en espera | Regla de negocio | Alta |
| RN05 | Registro previo obligatorio de garantía para equipos de alto valor o reservas/préstamos por excepción académica | Regla de negocio | Alta |
| RN06 | Cálculo de sanciones e impacto en reputación parametrizado por objeto | Regla de negocio | Alta |
| RN07 | Prórrogas de préstamos condicionadas a disponibilidad, ausencia de reservas confirmadas o en espera y Tier | Regla de negocio | Alta |
| RN08 | Control de concurrencia atómico en auto-confirmación y autopromoción de reservas, sin saltos de cola ni sobreasignación | Regla de negocio | Alta |
| RN09 | Inspección y checklist digital de estado inicial y de devolución | Regla de negocio | Alta |
| RN10 | Reporte obligatorio en PDF ante devolución con daño parcial o total | Regla de negocio | Alta |
| RN11 | Cola de espera y autopromoción por prioridad, antigüedad y Tier; excepciones solo por aprobación del Gestor | Regla de negocio | Alta |

