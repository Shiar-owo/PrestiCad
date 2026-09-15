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

* RF03: El sistema debe permitir registrar y administrar el inventario de materiales (equipos, libros, objetos), incluyendo su estado, disponibilidad y la parametrización en la ficha de cada objeto de sus atributos de reputación (Tier mínimo requerido, bonificación por devolución a tiempo, y deducciones por tardanza, daño parcial o daño total).

* RF04: El sistema debe permitir a los usuarios reservar un material disponible para un préstamo futuro.

* RF05: El sistema debe permitir registrar un préstamo, asociando el material, el usuario, la fecha de entrega y el tiempo de préstamo establecido.

* RF06: El sistema debe permitir registrar la devolución de un material y actualizar el estado del préstamo.

* RF07: El sistema debe mostrar el estado de cada préstamo (reservado, activo, devuelto, vencido).

* RF08: El sistema debe gestionar el puntaje de reputación del usuario en el rango de \-500 a 500, aplicar descuentos de puntos y suspensiones temporales por tardanza, y registrar cobros económicos de reparación/reposición exclusivamente ante daños físicos en el material.

* RF09: El sistema debe registrar la garantía dejada por el usuario al solicitar un préstamo, cuando corresponda.

* RF10: El sistema debe permitir consultar el historial de préstamos de cada usuario.

* RF11: El sistema debe permitir al usuario consultar y actualizar su perfil.

* RF12: El sistema debe permitir a los usuarios solicitar una prórroga de sus préstamos activos, evaluando automáticamente su elegibilidad según su Tier de reputación y la disponibilidad del bien.

## 6.2 Requisitos no funcionales

* RNF01: El tiempo de respuesta del sistema para búsquedas en el inventario y consultas de estado no debe superar los 2 segundos bajo una carga normal de operación.

* RNF02: El sistema debe garantizar una disponibilidad del 99.5% durante el horario de atención institucional (07:00 a 22:00 hrs).

* RNF03: El sistema debe proteger los datos personales de los usuarios y restringir el acceso según el tipo de usuario (alumno, docente, administrativo, administrador).

* RNF04: Un usuario nuevo debe ser capaz de completar la reserva de un material en menos de 3 minutos sin entrenamiento previo.

* RNF05: El sistema debe permitir su escalabilidad para incorporar nuevos tipos de materiales o usuarios en el futuro.

## 6.3 Reglas de negocio

* RN01: Disponibilidad de Materiales: Un material solo puede prestarse si su estado en el inventario es "Disponible". Si su estado es "En Mantenimiento", "Reservado" o "Prestado", la solicitud será rechazada automáticamente.

* RN03: Sistema de Reputación y Tiers de Acceso: El acceso a préstamos se rige por una escala de reputación en el rango de \[-500, 500\], iniciando cada usuario nuevo con 0 puntos (Neutral). Se establecen tres Tiers de acceso: 1\) Tier Avanzado (201 a 500 pts): Acceso total a todo el inventario (incluyendo equipos de alto valor), prioridad en reservas y prórrogas automáticas/extendidas. 2\) Tier Estándar (-50 a 200 pts): Acceso a libros y equipos estándar, incluyendo un margen de tolerancia en rango negativo (hasta \-50 pts) para imprevistos o retrasos menores sin degradar al usuario al nivel restringido. 3\) Tier Restringido (-500 a \-51 pts): Acceso limitado únicamente a materiales básicos/libros de bajo valor, sin derecho a préstamos de equipos ni prórrogas. Excepción Académica: Un usuario en Tier Restringido que requiera un bien de Tier Superior por necesidad académica urgente podrá acceder al préstamo de manera excepcional si presenta un documento de identidad y un compromiso de responsabilidad firmado como garantía.

* RN04: Vigencia de Reservas: Las reservas tienen una vigencia máxima de 24 horas desde la hora pactada de recojo. Cumplido este plazo sin que el material sea retirado, la reserva pasará automáticamente al estado "Cancelada por Vencimiento" y el recurso retornará a "Disponible".

* RN05: Registro de Garantías y Excepciones: Para préstamos de equipos de alto valor (laptops, proyectores, cámaras) o para la activación de préstamos por excepción académica a usuarios en Tier Restringido, se requiere el registro y entrega obligatoria de un documento de identidad y un compromiso de responsabilidad firmado como garantía antes de cambiar el estado del préstamo a "Activo".

* RN06: Cálculo de Sanciones e Impacto en Reputación por Objeto: Al momento de la devolución, el sistema realiza un cálculo dinámico utilizando los parámetros configurados en la ficha del objeto devuelto: otorga puntos de bonificación por entrega a tiempo, aplica un descuento de puntos proporcional al tiempo excedido en caso de tardanza, y aplica una penalización severa de puntos junto con cobro económico de reparación/reposición únicamente en caso de daño parcial o total.

* RN07: Prórrogas de Préstamos: La solicitud de extensión o prórroga de un préstamo activo está condicionada a la disponibilidad del bien (sin reservas pendientes) y al Tier de reputación del usuario, siendo otorgada de forma prioritaria a los usuarios del Tier Avanzado.

* RN08: Control de Concurrencia en Reservas: El procesamiento de reservas simultáneas para un mismo objeto se realiza mediante transacciones atómicas a nivel de base de datos para prevenir situaciones de condición de carrera (race conditions) sobre la última unidad disponible.

* RN09: Inspección y Checklist de Estado Inicial: En el registro de entrega de un préstamo (CU03) es obligatorio completar un checklist digital del estado inicial del bien, el cual se contrasta durante la devolución (CU04) para garantizar que las sanciones por daño apliquen únicamente a desperfectos nuevos.

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

### CU02 – Reservar material

**Actor:** Prestatario (Alumno, Docente, Administrativo)

**Descripción:** Permite a un usuario reservar un material disponible para un préstamo futuro, especificando el nivel de prioridad (Alta, Media, Baja) y adjuntando una descripción/justificación de uso que servirá como criterio para la evaluación y priorización por parte del Gestor de Almacén.

**Precondiciones:** El usuario ha iniciado sesión y cumple con el Tier de reputación mínimo requerido para el objeto solicitado.

**Flujo principal:**

5. El usuario busca el material que desea reservar.

6. El sistema muestra la disponibilidad del material.

7. El usuario selecciona el material, ingresa el nivel de prioridad (Alta, Media, Baja), redacta la descripción/justificación del recurso y confirma la reserva.

8. El sistema registra la reserva con su prioridad y justificación, quedando a disposición del Gestor de Almacén para evaluar y priorizar la asignación si existen múltiples solicitudes o alta demanda, y actualiza el estado del material.

**Flujos alternativos:**

* Si el usuario pertenece al Tier Restringido o no alcanza el Tier requerido por el objeto, el sistema rechaza la reserva e informa la restricción de su nivel de reputación.

**Postcondiciones:** El material queda reservado a nombre del usuario durante el tiempo límite establecido.

### CU03 – Registrar préstamo

**Actor:** Gestor de Almacén

**Descripción:** Permite registrar la entrega de un material a un usuario, iniciando formalmente el préstamo.

**Precondiciones:** Existe una reserva vigente o el material está disponible; el usuario no tiene impedimentos.

**Flujo principal:**

9. El Gestor de Almacén verifica la identidad y elegibilidad del usuario en el sistema.

10. El Gestor de Almacén registra la entrega del material asociado al préstamo.

11. El Gestor de Almacén completa el checklist digital de estado inicial del bien y registra el tiempo de préstamo y la garantía dejada (si corresponde).

12. El sistema actualiza el estado del material a "prestado".

**Flujos alternativos:**

* Si el material requiere garantía y esta no se entrega, el sistema no permite completar el préstamo.

**Postcondiciones:** El préstamo queda activo con su fecha límite de devolución registrada.

### CU04 – Registrar devolución

**Actor:** Gestor de Almacén

**Descripción:** Permite registrar la devolución de un material previamente prestado y determinar si corresponde una sanción.

**Precondiciones:** Existe un préstamo activo asociado al material.

**Flujo principal:**

13. El Gestor de Almacén busca el préstamo activo correspondiente.

14. El Gestor de Almacén inspecciona el objeto y completa el checklist digital de devolución, contrastándolo con el estado inicial registrado.

15. El sistema compara la fecha de devolución con la fecha límite establecida.

16. El sistema calcula el impacto en la reputación usando los parámetros del objeto (bonificación o descuento) y actualiza el puntaje del usuario, el estado del préstamo a "devuelto" y del material a "disponible".

**Flujos alternativos:**

* Si se identifican desperfectos nuevos respecto al checklist inicial o si hay retraso, el sistema recalcula el puntaje de reputación aplicando los descuentos parametrizados y genera la sanción/cobro por daño correspondiente.

**Postcondiciones:** El préstamo queda cerrado y se actualiza el historial del usuario y del material.

### CU05 – Cancelar reservas vencidas

**Actor:** Sistema (proceso automático) / Gestor de Almacén

**Descripción:** Cancela automáticamente las reservas que superaron el plazo de 24 horas sin ser recogidas y libera el material en el inventario.

**Precondiciones:** Existen reservas en estado "Reservado" cuya fecha/hora programada sobrepasa la tolerancia de 24 horas.

**Flujo principal:**

17. El sistema ejecuta la verificación periódica de vigencia de reservas.

18. El sistema identifica las reservas que excedieron las 24 horas límite.

19. El sistema actualiza el estado de la reserva a "Cancelada por Vencimiento".

20. El sistema actualiza el estado del material a "Disponible" y aplica una penalización por inasistencia al puntaje de reputación del usuario.

**Flujos alternativos:**

* El Gestor de Almacén puede ejecutar manualmente la cancelación si se confirma antes el rechazo de la solicitud.

**Postcondiciones:** La reserva queda inactiva y los materiales quedan disponibles inmediatamente para nuevos préstamos o reservas.

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
| RF04 | Reservar material disponible ingresando prioridad (Alta, Media, Baja) y descripción/justificación | Funcional | Alta |
| RF05 | Registrar préstamo por parte del Gestor de Almacén | Funcional | Alta |
| RF06 | Registrar devolución por parte del Gestor de Almacén | Funcional | Alta |
| RF07 | Consultar estado del préstamo | Funcional | Media |
| RF08 | Gestionar puntaje de reputación (-500 a 500), suspensiones y cobros solo por daño | Funcional | Alta |
| RF09 | Registrar garantía recibida antes de activar préstamo de alto valor o por excepción académica | Funcional | Media |
| RF10 | Consultar historial de préstamos | Funcional | Media |
| RF11 | Consultar y actualizar perfil de usuario | Funcional | Media |
| RF12 | Solicitar prórroga/extensión de préstamo activo según reputación y disponibilidad | Funcional | Media |
| RNF01 | Tiempo de respuesta inferior a 2 segundos en consultas | No funcional | Media |
| RNF02 | Disponibilidad del 99.5% en horario de 07:00 a 22:00 hrs | No funcional | Media |
| RNF03 | Protección de datos y control de acceso por roles | No funcional | Alta |
| RNF04 | Completar reserva en menos de 3 minutos sin capacitación | No funcional | Media |
| RNF05 | Escalabilidad para incorporación de nuevos materiales y usuarios | No funcional | Baja |
| RN01 | Disponibilidad obligatoria del material (estado "Disponible") | Regla de negocio | Alta |
| RN03 | Sistema de reputación (-500 a 500), Tiers de Acceso y cláusula de Excepción Académica  | Regla de negocio | Alta |
| RN04 | Vigencia máxima de reserva de 24 horas | Regla de negocio | Alta |
| RN05 | Registro previo obligatorio de garantía para equipos de alto valor o préstamos por excepción académica | Regla de negocio | Alta |
| RN06 | Cálculo de sanciones e impacto en reputación parametrizado por objeto | Regla de negocio | Alta |
| RN07 | Prórrogas y priorización de reservas evaluadas por el Gestor según prioridad, justificación y Tier de reputación | Regla de negocio | Alta |
| RN08 | Control de concurrencia atómico en reservas y evaluación del Gestor por prioridad y justificación en solicitudes simultáneas | Regla de negocio | Alta |
| RN09 | Inspección y checklist digital de estado inicial y de devolución | Regla de negocio | Alta |

