#!/usr/bin/env python3
"""
Importar Historias de Usuario del Sistema de Préstamos Académicos a Jira.

Uso:
    pip install -r requirements.txt
    python importar_jira.py

Requisitos:
    - Jira Cloud o Jira Server/Data Center con REST API habilitada
    - API Token de Jira (https://id.atlassian.com/manage-profile/security/api-tokens)
    - Permisos de creación de issues en el proyecto destino
    - Archivo .env-jira con las credenciales
"""

import argparse
import os
import sys
import time
from typing import Any

import requests
from dotenv import load_dotenv


# ─────────────────────────────────────────────
# CONFIGURACIÓN: Credenciales desde .env-jira
# ─────────────────────────────────────────────

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env-jira"))

URL_JIRA = os.getenv("URL_JIRA", "").rstrip("/")
USER_JIRA = os.getenv("USER_JIRA", "")
TOKEN_JIRA = os.getenv("TOKEN_JIRA", "")
PROJECT_KEY_JIRA = os.getenv("PROJECT_KEY_JIRA", "")


# ─────────────────────────────────────────────
# DATA: Épicas e Historias de Usuario
# ─────────────────────────────────────────────

EPICAS = [
    {"key": "EPICUsuarios", "name": "Gestión de Usuarios", "description": "Registro, autenticación y gestión de roles de usuarios del sistema."},
    {"key": "EPICInventario", "name": "Inventario de Materiales", "description": "Gestión del inventario de equipos, libros y objetos disponibles para préstamo."},
    {"key": "EPICReservas", "name": "Reservas", "description": "Sistema de reservas de materiales con priorización y cancelación automática."},
    {"key": "EPICPrestamos", "name": "Préstamos", "description": "Registro y control del ciclo de vida de los préstamos de materiales."},
    {"key": "EPICDevoluciones", "name": "Devoluciones y Sanciones", "description": "Registro de devoluciones, cálculo de sanciones, reputación y Tiers de acceso."},
    {"key": "EPICProrrogas", "name": "Prórrogas", "description": "Solicitudes de extensión de préstamos activos."},
    {"key": "EPICPerfil", "name": "Perfil e Historial", "description": "Consulta y gestión del perfil de usuario e historial de préstamos."},
    {"key": "EPICReportes", "name": "Reportes", "description": "Dashboard de métricas y reportes para Dirección/Coordinación."},
]

HISTORIAS = [
    {"id": "HU01", "summary": "Registrar usuario", "epic": "EPICUsuarios", "priority": "Alta", "story_points": 3,
     "description": "**Como** Administrador del Sistema, **quiero** registrar usuarios con su tipo (Alumno, Docente, Administrativo) y asignarles un rol, **para que** puedan acceder y utilizar el sistema de préstamos.\n\n**Requisitos asociados:** RF01\n\n**Criterios de aceptación:**\n1. El formulario de registro permite ingresar: nombre, apellido, email (institucional), DNI, teléfono, tipo de usuario (Alumno/Docente/Administrativo)\n2. El sistema valida que el email no esté duplicado antes de crear el registro\n3. El sistema valida que el DNI no esté duplicado\n4. Al confirmar, el usuario queda registrado con estado \"Activo\" y Tier inicial Neutral (0 pts)\n5. Si los datos son inválidos o el email/DNI ya existe, el sistema muestra un mensaje de error descriptivo y no crea el registro\n6. El nuevo usuario puede iniciar sesión inmediatamente después del registro\n\n**Reglas de negocio:** RN03 (Tier inicial Neutral)"},
    {"id": "HU02", "summary": "Gestionar roles y permisos", "epic": "EPICUsuarios", "priority": "Alta", "story_points": 3,
     "description": "**Como** Administrador del Sistema, **quiero** asignar roles (Prestatario, Gestor de Almacén, Administrador) a los usuarios registrados, **para que** el sistema controle el acceso según las funciones de cada uno.\n\n**Requisitos asociados:** RF01, RNF03\n\n**Criterios de aceptación:**\n1. El administrador puede ver la lista de usuarios con su rol actual\n2. El administrador puede cambiar el rol de un usuario\n3. Un usuario puede tener solo un tipo (Alumno/Docente/Administrativo) y opcionalmente un rol de sistema\n4. Los cambios de rol surten efecto inmediato en los permisos del usuario\n5. No se permite eliminar un usuario que tenga préstamos activos"},
    {"id": "HU03", "summary": "Iniciar sesión", "epic": "EPICUsuarios", "priority": "Alta", "story_points": 5,
     "description": "**Como** Usuario, **quiero** iniciar sesión con mi email y contraseña, **para que** acceda de forma segura a mi perfil y funcionalidades del sistema.\n\n**Requisitos asociados:** RF02, RNF03\n\n**Criterios de aceptación:**\n1. El usuario ingresa email y contraseña para autenticarse\n2. Si las credenciales son correctas, el sistema redirige al dashboard correspondiente según su rol\n3. Si las credenciales son incorrectas, el sistema muestra \"Email o contraseña incorrectos\"\n4. La sesión expira tras un período de inactividad configurable (ej. 30 min)\n5. El sistema registra el intento fallido y bloquea la cuenta tras 5 intentos consecutivos\n6. La contraseña se almacena hasheada (bcrypt o similar), nunca en texto plano"},
    {"id": "HU04", "summary": "Registrar material en inventario", "epic": "EPICInventario", "priority": "Alta", "story_points": 5,
     "description": "**Como** Administrador/Gestor de Almacén, **quiero** registrar materiales (equipos, libros, objetos) con sus atributos y parámetros de reputación, **para que** el inventario esté actualizado y el sistema pueda calcular sanciones automáticamente.\n\n**Requisitos asociados:** RF03\n\n**Criterios de aceptación:**\n1. El formulario permite registrar: nombre, descripción, categoría (Equipo/Libro/Objeto), estado inicial (Disponible), código/identificador único\n2. Se pueden parametrizar por objeto: Tier mínimo requerido, bonificación por devolución a tiempo, deducción por tardanza, deducción por daño parcial, deducción por daño total\n3. Si no se parametrizan los valores de reputación, el sistema aplica valores por defecto configurables\n4. El código/identificador del material es único en el sistema\n5. Se puede registrar múltiples unidades del mismo material (stock)\n6. El estado inicial del material es \"Disponible\"\n7. Se pueden editar los datos y parámetros de un material existente\n8. El Gestor de Almacén puede cambiar el estado de un material a \"En Mantenimiento\" cuando sea necesario"},
    {"id": "HU05", "summary": "Buscar y consultar materiales", "epic": "EPICInventario", "priority": "Media", "story_points": 3,
     "description": "**Como** Prestatario, **quiero** buscar materiales por nombre, categoría o estado, **para que** encuentre lo que necesito rápidamente.\n\n**Requisitos asociados:** RF03, RNF01, RNF04\n\n**Criterios de aceptación:**\n1. Se puede buscar por nombre (búsqueda parcial, case-insensitive)\n2. Se puede filtrar por categoría (Equipo/Libro/Objeto)\n3. Se puede filtrar por estado (Disponible/Prestado/Reservado/En Mantenimiento)\n4. Los resultados muestran: nombre, categoría, estado, disponibilidad\n5. La búsqueda responde en menos de 2 segundos\n6. Un usuario en Tier Restringido solo ve materiales de Tier básico/libros\n7. Un usuario nuevo puede completar una reserva en menos de 3 minutos sin capacitación"},
    {"id": "HU06", "summary": "Reservar material", "epic": "EPICReservas", "priority": "Alta", "story_points": 5,
     "description": "**Como** Prestatario, **quiero** reservar un material disponible indicando prioridad y justificación, **para que** tenga garantizada su disponibilidad para un préstamo futuro.\n\n**Requisitos asociados:** RF04, RN01, RN03, RN04\n\n**Criterios de aceptación:**\n1. El usuario selecciona un material en estado \"Disponible\"\n2. El formulario solicita: nivel de prioridad (Alta/Media/Baja), descripción/justificación del uso\n3. El sistema verifica que el Tier del usuario cumple con el Tier mínimo requerido del material\n4. Si el Tier no es suficiente, el sistema rechaza la reserva mostrando la restricción\n5. Al confirmar, la reserva queda en estado \"Reservada\" con timestamp\n6. El material cambia a estado \"Reservado\"\n7. La reserva tiene vigencia de 24 horas desde la hora pactada de recojo\n8. La reserva se asocia al usuario (se puede ver en \"Mis reservas\")\n9. Un usuario puede tener un máximo configurable de reservas activas simultáneas"},
    {"id": "HU07", "summary": "Cancelación automática de reservas vencidas", "epic": "EPICReservas", "priority": "Alta", "story_points": 5,
     "description": "**Como** Sistema, **quiero** cancelar automáticamente las reservas no recogidas en 24 horas, **para que** los materiales vuelvan a estar disponibles para otros usuarios.\n\n**Requisitos asociados:** RN04\n\n**Criterios de aceptación:**\n1. Un proceso periódico (cron job) verifica reservas en estado \"Reservada\"\n2. Si la reserva superó las 24 horas sin retiro, cambia a estado \"Cancelada por Vencimiento\"\n3. El material vuelve a estado \"Disponible\"\n4. Se aplica una penalización al puntaje de reputación del usuario (configurable)\n5. El usuario recibe una notificación de cancelación\n6. El Gestor de Almacén puede ejecutar la cancelación manualmente antes del vencimiento"},
    {"id": "HU08", "summary": "Evaluar y priorizar reservas simultáneas", "epic": "EPICReservas", "priority": "Media", "story_points": 5,
     "description": "**Como** Gestor de Almacén, **quiero** ver las reservas pendientes para un mismo material y priorizar según justificación y Tier, **para que** la asignación sea justa y eficiente.\n\n**Requisitos asociados:** RN08\n\n**Criterios de aceptación:**\n1. Se muestra una cola de reservas pendientes por material\n2. Cada reserva muestra: usuario, prioridad (Alta/Media/Baja), justificación, Tier de reputación, fecha de solicitud\n3. El gestor puede ordenar por prioridad, Tier o fecha\n4. El gestor puede aprobar o rechazar cada reserva individualmente\n5. Al aprobar, se notifica al usuario y se inicia el proceso de préstamo\n6. Las transacciones de reserva son atómicas (no se produce race condition)"},
    {"id": "HU09", "summary": "Registrar préstamo (entrega de material)", "epic": "EPICPrestamos", "priority": "Alta", "story_points": 8,
     "description": "**Como** Gestor de Almacén, **quiero** registrar la entrega de un material a un usuario con checklist digital de estado inicial y garantía (si aplica), **para que** quede un registro formal y trazable del préstamo.\n\n**Requisitos asociados:** RF05, RF09, RN05, RN09\n\n**Criterios de aceptación:**\n1. El gestor busca el préstamo/reserva activa del usuario\n2. El sistema verifica la identidad y elegibilidad del usuario (Tier, sin impedimentos)\n3. El gestor completa un checklist digital del estado inicial del bien (descripción de condiciones, fotos si aplica)\n4. Para equipos de alto valor o préstamos por excepción académica, se registra la garantía (documento de identidad + compromiso firmado)\n5. Si la garantía es requerida y no se entrega, el sistema no permite completar el préstamo\n6. El gestor indica el tiempo de préstamo (días)\n7. El sistema calcula y muestra la fecha límite de devolución\n8. El estado del préstamo cambia a \"Activo\"\n9. El estado del material cambia a \"Prestado\""},
    {"id": "HU10", "summary": "Consultar estado de mis préstamos", "epic": "EPICPrestamos", "priority": "Media", "story_points": 3,
     "description": "**Como** Prestatario, **quiero** ver el estado de todos mis préstamos (reservado, activo, devuelto, vencido), **para que** sepa la situación de cada material que solicité.\n\n**Requisitos asociados:** RF07\n\n**Criterios de aceptación:**\n1. Se muestra una lista de préstamos con: material, fecha de préstamo, fecha límite, estado actual\n2. El estado se muestra con código de color (verde=Activo, amarillo=Reservado, rojo=Vencido, gris=Devuelto)\n3. Se puede filtrar por estado\n4. Al seleccionar un préstamo, se ven los detalles completos\n5. Los préstamos vencidos se muestran destacados/arriba"},
    {"id": "HU11", "summary": "Registrar devolución con cálculo de sanciones", "epic": "EPICDevoluciones", "priority": "Alta", "story_points": 8,
     "description": "**Como** Gestor de Almacén, **quiero** registrar la devolución de un material comparando con el checklist inicial, **para que** el sistema calcule automáticamente bonificaciones o sanciones.\n\n**Requisitos asociados:** RF06, RF08, RN06, RN09\n\n**Criterios de aceptación:**\n1. El gestor busca el préstamo activo del material\n2. El sistema muestra el checklist de estado inicial registrado al momento de la entrega\n3. El gestor completa un checklist de devolución (nuevo checklist)\n4. El sistema compara ambos checklist y resalta las diferencias (daños nuevos)\n5. El sistema compara la fecha de devolución con la fecha límite\n6. Si devolvió a tiempo: aplica bonificación de puntos (parámetro del objeto)\n7. Si devolvió con retraso: aplica descuento de puntos proporcional al tiempo excedido\n8. Si hay daño nuevo: aplica penalización de puntos + genera cobro de reparación/reposición\n9. Se actualiza el puntaje de reputación del usuario\n10. El estado del préstamo cambia a \"Devuelto\"\n11. El estado del material cambia a \"Disponible\"\n12. Se registra el historial completo de la operación"},
    {"id": "HU12", "summary": "Gestionar reputación y Tiers de acceso", "epic": "EPICDevoluciones", "priority": "Alta", "story_points": 8,
     "description": "**Como** Sistema, **quiero** mantener el puntaje de reputación de cada usuario en el rango [-500, 500] y calcular su Tier de acceso, **para que** se controlen automáticamente los privilegios de préstamo.\n\n**Requisitos asociados:** RF08, RN03\n\n**Criterios de aceptación:**\n1. Cada usuario tiene un puntaje de reputación visible en su perfil\n2. El rango es de -500 a 500 (no se puede salir de este rango)\n3. Tier Avanzado: 201 a 500 pts → acceso total, prioridad en reservas, prórrogas automáticas\n4. Tier Estándar: -50 a 200 pts → acceso a libros y equipos estándar, margen de tolerancia\n5. Tier Restringido: -500 a -51 pts → solo materiales básicos, sin prórrogas\n6. El Tier se recalcula automáticamente al modificar el puntaje\n7. Los cambios de Tier surten efecto inmediato en las funcionalidades disponibles"},
    {"id": "HU13", "summary": "Préstamo excepcional por necesidad académica", "epic": "EPICDevoluciones", "priority": "Media", "story_points": 5,
     "description": "**Como** Prestatario en Tier Restringido, **quiero** acceder excepcionalmente a materiales de mayor Tier presentando garantía firmada, **para que** pueda cubrir una necesidad académica urgente a pesar de mi nivel de reputación.\n\n**Requisitos asociados:** RN03, RN05\n\n**Criterios de aceptación:**\n1. El usuario selecciona un material de Tier superior al suyo\n2. El sistema detecta que está en Tier Restringido y muestra la opción de \"Excepción Académica\"\n3. El usuario debe subir documento de identidad y compromiso de responsabilidad firmado\n4. El sistema registra la garantía y asocia al préstamo\n5. El préstamo se activa con estado \"Activo - Excepción\"\n6. Se muestra un indicador especial en el préstamo para que el gestor lo revise\n7. Si la devolución es con daño, la penalización es el doble de la parametrizada"},
    {"id": "HU14", "summary": "Gestionar suspensiones por bajo puntaje", "epic": "EPICDevoluciones", "priority": "Media", "story_points": 5,
     "description": "**Como** Sistema, **quiero** suspender temporalmente a usuarios cuyo puntaje caiga por debajo de -50, **para que** no puedan realizar nuevos préstamos hasta demostrar responsabilidad.\n\n**Requisitos asociados:** RF08\n\n**Criterios de aceptación:**\n1. Cuando el puntaje cae por debajo de -50 (Tier Restringido), el sistema marca al usuario como \"Suspendido temporalmente\"\n2. Un usuario suspendido no puede realizar nuevas reservas ni préstamos\n3. La suspensión tiene una duración configurable (ej. 7 días)\n4. Al cumplirse el período, el usuario vuelve a Tier Restringido (acceso limitado)\n5. El administrador puede levantar una suspensión manualmente si es necesario\n6. Se muestra la fecha de fin de suspensión en el perfil del usuario"},
    {"id": "HU15", "summary": "Solicitar prórroga de préstamo", "epic": "EPICProrrogas", "priority": "Media", "story_points": 5,
     "description": "**Como** Prestatario, **quiero** solicitar una extensión de mi préstamo activo, **para que** tenga más tiempo si lo necesito y cumplo los requisitos.\n\n**Requisitos asociados:** RF12, RN07\n\n**Criterios de aceptación:**\n1. El usuario puede solicitar prórroga desde \"Mis préstamos\" para préstamos en estado \"Activo\"\n2. El sistema verifica que el material no tenga reservas pendientes\n3. El sistema verifica el Tier del usuario\n4. Tier Avanzado: se otorga prórroga automáticamente\n5. Tier Estándar: requiere aprobación del Gestor\n6. Tier Restringido: no puede solicitar prórroga\n7. El usuario indica los días adicionales que necesita\n8. Se actualiza la fecha límite de devolución\n9. Se notifica al usuario del resultado (aprobada/rechazada)"},
    {"id": "HU16", "summary": "Consultar y actualizar perfil", "epic": "EPICPerfil", "priority": "Media", "story_points": 3,
     "description": "**Como** Prestatario, **quiero** ver y actualizar mi perfil (datos personales, reputación, historial), **para que** mantenga mi información al día y conozca mi nivel de confianza en el sistema.\n\n**Requisitos asociados:** RF10, RF11\n\n**Criterios de aceptación:**\n1. El perfil muestra: nombre, email, DNI, teléfono, tipo (Alumno/Docente/Administrativo)\n2. Se muestra el puntaje de reputación actual con su Tier correspondiente\n3. Se muestra el historial de préstamos (material, fechas, resultado, sanciones aplicadas)\n4. El usuario puede editar: nombre, teléfono (email y DNI son solo lectura)\n5. Los cambios se guardan con validación de campos obligatorios\n6. Se muestra un gráfico o indicador visual del historial de reputación (opcional)"},
    {"id": "HU17", "summary": "Consultar historial de préstamos por material", "epic": "EPICPerfil", "priority": "Media", "story_points": 3,
     "description": "**Como** Gestor de Almacén/Administrador, **quiero** ver el historial de préstamos de cada material específico, **para que** pueda identificar materiales con alto índice de daño o problemas recurrentes.\n\n**Requisitos asociados:** RF10, Alcance del sistema\n\n**Criterios de aceptación:**\n1. Desde el inventario, el gestor puede ver el historial de préstamos de cada material\n2. Se muestra: usuario que prestó, fechas (entrega/devolución), resultado (a tiempo/tardío/dañado)\n3. Se puede filtrar por período\n4. Se muestra el conteo total de préstamos del material\n5. Se muestra el porcentaje de devoluciones a tiempo vs tardías"},
    {"id": "HU18", "summary": "Dashboard de reportes para Dirección", "epic": "EPICReportes", "priority": "Baja", "story_points": 8,
     "description": "**Como** Dirección/Coordinación académica, **quiero** ver métricas consolidadas de uso del sistema, **para que** pueda tomar decisiones informadas sobre política de préstamos y adquisición de materiales.\n\n**Requisitos asociados:** Stakeholder de sección 4 del documento de requerimientos\n\n**Criterios de aceptación:**\n1. La Dirección puede ver métricas consolidadas: total de préstamos activos, reservas pendientes, materiales disponibles vs prestados\n2. Se muestran indicadores de uso por período (semana, mes, semestre)\n3. Se muestra ranking de materiales más prestados\n4. Se muestra tasa de devoluciones a tiempo vs tardías\n5. Se muestra distribución de usuarios por Tier de reputación\n6. Los reportes son de solo lectura (la Dirección no modifica datos)\n7. Se puede exportar los reportes (PDF o CSV)"},
]


# ─────────────────────────────────────────────
# DATA: Tareas por Historia de Usuario
# ─────────────────────────────────────────────

TASKS = {
    "HU01": [
        {"summary": "Definir modelo de entidad Usuario", "type": "Backend"},
        {"summary": "Crear migración/DDL de la tabla usuarios", "type": "Backend"},
        {"summary": "Implementar servicio de registro con validación de email y DNI duplicados", "type": "Backend"},
        {"summary": "Asignar Tier inicial Neutral (0 pts) al crear usuario", "type": "Backend"},
        {"summary": "Crear endpoint POST /api/usuarios", "type": "Backend"},
        {"summary": "Crear formulario de registro de usuario (Admin)", "type": "Frontend"},
        {"summary": "Implementar validación de formulario y mensajes de error", "type": "Frontend"},
        {"summary": "Integrar formulario con endpoint de registro", "type": "Integración"},
    ],
    "HU02": [
        {"summary": "Definir modelo de entidad Rol y relación con Usuario", "type": "Backend"},
        {"summary": "Implementar servicio de cambio de rol con validación", "type": "Backend"},
        {"summary": "Crear middleware de autorización por roles", "type": "Backend"},
        {"summary": "Crear endpoints GET /api/usuarios y PUT /api/usuarios/{id}/rol", "type": "Backend"},
        {"summary": "Crear vista de lista de usuarios con columna de rol editable", "type": "Frontend"},
        {"summary": "Implementar selector de rol con opciones", "type": "Frontend"},
        {"summary": "Integrar vista con endpoints", "type": "Integración"},
    ],
    "HU03": [
        {"summary": "Implementar servicio de autenticación (bcrypt)", "type": "Backend"},
        {"summary": "Implementar bloqueo de cuenta tras 5 intentos fallidos", "type": "Backend"},
        {"summary": "Implementar expiración de sesión por inactividad", "type": "Backend"},
        {"summary": "Crear endpoints POST /api/auth/login y logout", "type": "Backend"},
        {"summary": "Crear middleware de sesión autenticada", "type": "Backend"},
        {"summary": "Crear pantalla de login", "type": "Frontend"},
        {"summary": "Implementar redirección según rol post-login", "type": "Frontend"},
        {"summary": "Integrar login con endpoints", "type": "Integración"},
    ],
    "HU04": [
        {"summary": "Definir modelo de entidad Material", "type": "Backend"},
        {"summary": "Crear migración/DDL de la tabla materiales", "type": "Backend"},
        {"summary": "Implementar servicio CRUD de materiales con validación de código único", "type": "Backend"},
        {"summary": "Implementar valores por defecto para parámetros de reputación", "type": "Backend"},
        {"summary": "Crear endpoints POST/GET/PUT /api/materiales", "type": "Backend"},
        {"summary": "Crear formulario de registro/edición de material", "type": "Frontend"},
        {"summary": "Crear vista de listado de materiales", "type": "Frontend"},
        {"summary": "Integrar formularios con endpoints", "type": "Integración"},
    ],
    "HU05": [
        {"summary": "Implementar servicio de búsqueda con filtros", "type": "Backend"},
        {"summary": "Implementar filtrado por Tier del usuario", "type": "Backend"},
        {"summary": "Crear endpoint GET /api/materiales/buscar", "type": "Backend"},
        {"summary": "Crear componente de barra de búsqueda con filtros", "type": "Frontend"},
        {"summary": "Crear vista de resultados con tarjetas de material", "type": "Frontend"},
        {"summary": "Integrar búsqueda con endpoint", "type": "Integración"},
    ],
    "HU06": [
        {"summary": "Definir modelo de entidad Reserva", "type": "Backend"},
        {"summary": "Crear migración/DDL de la tabla reservas", "type": "Backend"},
        {"summary": "Implementar servicio de reserva con validación de Tier y disponibilidad", "type": "Backend"},
        {"summary": "Implementar cambio de estado del material a Reservado", "type": "Backend"},
        {"summary": "Crear endpoint POST /api/reservas", "type": "Backend"},
        {"summary": "Crear formulario de reserva (prioridad, justificación)", "type": "Frontend"},
        {"summary": "Crear vista Mis reservas", "type": "Frontend"},
        {"summary": "Integrar formulario con endpoint", "type": "Integración"},
    ],
    "HU07": [
        {"summary": "Implementar proceso periódico (cron/scheduler) de verificación de reservas", "type": "Backend"},
        {"summary": "Implementar lógica de cancelación por vencimiento (24h)", "type": "Backend"},
        {"summary": "Implementar penalización de reputación por inasistencia", "type": "Backend"},
        {"summary": "Implementar cancelación manual por Gestor", "type": "Backend"},
        {"summary": "Crear endpoint POST /api/reservas/{id}/cancelar", "type": "Backend"},
        {"summary": "Agregar notificación de cancelación al usuario", "type": "Integración"},
    ],
    "HU08": [
        {"summary": "Implementar servicio de cola de reservas por material", "type": "Backend"},
        {"summary": "Implementar ordenamiento por prioridad, Tier y fecha", "type": "Backend"},
        {"summary": "Implementar transacciones atómicas para evitar race conditions", "type": "Backend"},
        {"summary": "Crear endpoints GET /api/reservas/cola/{id} y POST /api/reservas/{id}/aprobar", "type": "Backend"},
        {"summary": "Crear vista de cola de reservas para Gestor", "type": "Frontend"},
        {"summary": "Implementar botones de aprobar/rechazar individual", "type": "Frontend"},
        {"summary": "Integrar vista con endpoints", "type": "Integración"},
    ],
    "HU09": [
        {"summary": "Definir modelo de entidad Prestamo", "type": "Backend"},
        {"summary": "Crear migración/DDL de la tabla prestamos", "type": "Backend"},
        {"summary": "Implementar servicio de préstamo con verificación de elegibilidad", "type": "Backend"},
        {"summary": "Implementar checklist digital de estado inicial", "type": "Backend"},
        {"summary": "Implementar registro de garantía para equipos de alto valor", "type": "Backend"},
        {"summary": "Implementar cálculo automático de fecha límite de devolución", "type": "Backend"},
        {"summary": "Crear endpoint POST /api/prestamos", "type": "Backend"},
        {"summary": "Crear formulario de registro de préstamo con checklist", "type": "Frontend"},
        {"summary": "Implementar validación de garantía obligatoria antes de confirmar", "type": "Frontend"},
        {"summary": "Integrar formulario con endpoint", "type": "Integración"},
    ],
    "HU10": [
        {"summary": "Implementar servicio de consulta de préstamos por usuario con estados", "type": "Backend"},
        {"summary": "Crear endpoint GET /api/prestamos/mis-prestamos", "type": "Backend"},
        {"summary": "Crear vista de lista de préstamos con código de color por estado", "type": "Frontend"},
        {"summary": "Implementar filtro por estado", "type": "Frontend"},
        {"summary": "Crear vista de detalles del préstamo al seleccionar", "type": "Frontend"},
        {"summary": "Integrar vista con endpoint", "type": "Integración"},
    ],
    "HU11": [
        {"summary": "Implementar servicio de devolución con comparación de checklists", "type": "Backend"},
        {"summary": "Implementar lógica de cálculo de sanciones parametrizada por objeto", "type": "Backend"},
        {"summary": "Implementar bonificación por entrega a tiempo", "type": "Backend"},
        {"summary": "Implementar descuento de puntos por tardanza proporcional", "type": "Backend"},
        {"summary": "Implementar penalización + cobro por daño parcial/total", "type": "Backend"},
        {"summary": "Implementar actualización de reputación y estados", "type": "Backend"},
        {"summary": "Crear endpoint POST /api/prestamos/{id}/devolucion", "type": "Backend"},
        {"summary": "Crear formulario de devolución con checklist de comparación", "type": "Frontend"},
        {"summary": "Mostrar resumen de sanciones/bonificaciones antes de confirmar", "type": "Frontend"},
        {"summary": "Integrar formulario con endpoint", "type": "Integración"},
    ],
    "HU12": [
        {"summary": "Implementar servicio de reputación con rango [-500, 500]", "type": "Backend"},
        {"summary": "Implementar cálculo automático de Tier según puntaje", "type": "Backend"},
        {"summary": "Implementar clamping de puntos (no salir del rango)", "type": "Backend"},
        {"summary": "Crear endpoint GET /api/usuarios/{id}/reputacion", "type": "Backend"},
        {"summary": "Mostrar puntaje y Tier en perfil de usuario", "type": "Frontend"},
    ],
    "HU13": [
        {"summary": "Implementar flujo de excepción académica en servicio de préstamo", "type": "Backend"},
        {"summary": "Implementar registro de garantía especial (doc. identidad + compromiso)", "type": "Backend"},
        {"summary": "Implementar penalización doble en devolución para excepciones", "type": "Backend"},
        {"summary": "Crear endpoint POST /api/prestamos/excepcion", "type": "Backend"},
        {"summary": "Crear flujo UI de Solicitar Excepción Académica", "type": "Frontend"},
        {"summary": "Implementar upload de documentos de garantía", "type": "Frontend"},
        {"summary": "Integrar flujo de excepción con endpoints", "type": "Integración"},
    ],
    "HU14": [
        {"summary": "Implementar servicio de suspensión temporal", "type": "Backend"},
        {"summary": "Implementar duración configurable de suspensión", "type": "Backend"},
        {"summary": "Implementar restauración automática al cumplir el período", "type": "Backend"},
        {"summary": "Implementar levantamiento manual de suspensión por Admin", "type": "Backend"},
        {"summary": "Crear endpoints suspender y levantar-suspension", "type": "Backend"},
        {"summary": "Mostrar estado de suspensión y fecha de fin en perfil", "type": "Frontend"},
        {"summary": "Bloquear botones de reserva/préstamo si está suspendido", "type": "Frontend"},
    ],
    "HU15": [
        {"summary": "Implementar servicio de prórroga con verificación de disponibilidad y Tier", "type": "Backend"},
        {"summary": "Implementar aprobación automática para Tier Avanzado", "type": "Backend"},
        {"summary": "Implementar flujo de aprobación manual para Tier Estándar", "type": "Backend"},
        {"summary": "Bloquear solicitud para Tier Restringido", "type": "Backend"},
        {"summary": "Crear endpoints POST /api/prestamos/{id}/prorroga y PUT .../aprobar", "type": "Backend"},
        {"summary": "Crear botón Solicitar Prórroga en vista de préstamo activo", "type": "Frontend"},
        {"summary": "Crear vista de solicitudes de prórroga pendientes para Gestor", "type": "Frontend"},
        {"summary": "Integrar flujo con endpoints", "type": "Integración"},
    ],
    "HU16": [
        {"summary": "Implementar servicio de consulta de perfil con reputación e historial", "type": "Backend"},
        {"summary": "Implementar servicio de actualización de perfil (solo nombre y teléfono)", "type": "Backend"},
        {"summary": "Crear endpoints GET /api/usuarios/perfil y PUT /api/usuarios/perfil", "type": "Backend"},
        {"summary": "Crear vista de perfil con datos personales, reputación y Tier", "type": "Frontend"},
        {"summary": "Crear formulario de edición de perfil (campos restringidos readonly)", "type": "Frontend"},
        {"summary": "Mostrar historial de préstamos en perfil", "type": "Frontend"},
        {"summary": "Integrar vista con endpoints", "type": "Integración"},
    ],
    "HU17": [
        {"summary": "Implementar servicio de historial de préstamos por material con filtros", "type": "Backend"},
        {"summary": "Crear endpoint GET /api/materiales/{id}/historial", "type": "Backend"},
        {"summary": "Crear vista de historial de material (usuario, fechas, resultado)", "type": "Frontend"},
        {"summary": "Implementar filtros por período", "type": "Frontend"},
        {"summary": "Mostrar estadísticas (conteo total, % a tiempo vs tardío)", "type": "Frontend"},
        {"summary": "Integrar vista con endpoint", "type": "Integración"},
    ],
    "HU18": [
        {"summary": "Implementar servicio de métricas consolidadas", "type": "Backend"},
        {"summary": "Implementar indicadores por período (semana, mes, semestre)", "type": "Backend"},
        {"summary": "Implementar ranking de materiales más prestados", "type": "Backend"},
        {"summary": "Implementar tasa de devoluciones a tiempo vs tardías", "type": "Backend"},
        {"summary": "Implementar distribución de usuarios por Tier", "type": "Backend"},
        {"summary": "Crear endpoints GET /api/reportes/dashboard y /metricas", "type": "Backend"},
        {"summary": "Crear dashboard con gráficos y métricas", "type": "Frontend"},
        {"summary": "Implementar exportación a PDF/CSV", "type": "Frontend"},
        {"summary": "Integrar dashboard con endpoints", "type": "Integración"},
    ],
}


# ─────────────────────────────────────────────
# DATA: Sprints (MVP + Full Product) — COMENTADO: crear sprints manualmente en Jira
# ─────────────────────────────────────────────

# SPRINTS = [
#     # ── FASE 1: MVP ──
#     {
#         "name": "M1 — Usuarios + Auth + Roles + Perfil",
#         "goal": "Los usuarios pueden registrarse, autenticarse, el admin asigna roles y el usuario ve su perfil.",
#         "phase": "MVP",
#         "stories": ["HU01", "HU03", "HU02", "HU16"],
#         "story_points": 14,
#     },
#     {
#         "name": "M2 — Inventario + Búsqueda",
#         "goal": "El administrador registra materiales y los usuarios pueden buscar y filtrar.",
#         "phase": "MVP",
#         "stories": ["HU04", "HU05"],
#         "story_points": 8,
#     },
#     {
#         "name": "M3 — Préstamos",
#         "goal": "El gestor puede registrar préstamos con checklist digital y garantía.",
#         "phase": "MVP",
#         "stories": ["HU09"],
#         "story_points": 8,
#     },
#     {
#         "name": "M4 — Devoluciones + Ver mis préstamos",
#         "goal": "Las devoluciones calculan sanciones/bonificaciones automáticamente; el usuario ve sus préstamos.",
#         "phase": "MVP",
#         "stories": ["HU11", "HU10"],
#         "story_points": 11,
#     },
#     # ── FASE 2: FULL PRODUCT ──
#     {
#         "name": "S5 — Reputación + Tiers",
#         "goal": "El sistema calcula reputación y Tiers de acceso basado en el comportamiento del usuario.",
#         "phase": "Full",
#         "stories": ["HU12"],
#         "story_points": 8,
#     },
#     {
#         "name": "S6 — Reservas + Cancelación",
#         "goal": "Los usuarios pueden reservar materiales y el sistema cancela automáticamente las vencidas.",
#         "phase": "Full",
#         "stories": ["HU06", "HU07"],
#         "story_points": 10,
#     },
#     {
#         "name": "S7 — Cola de Reservas + Suspensiones",
#         "goal": "El gestor gestiona la cola de prioridades de reservas y las suspensiones por bajo puntaje.",
#         "phase": "Full",
#         "stories": ["HU08", "HU14"],
#         "story_points": 10,
#     },
#     {
#         "name": "S8 — Prórrogas + Excepciones",
#         "goal": "Los usuarios pueden solicitar prórroga y excepciones académicas.",
#         "phase": "Full",
#         "stories": ["HU15", "HU13"],
#         "story_points": 10,
#     },
#     {
#         "name": "S9 — Historial + Reportes",
#         "goal": "El gestor ve historial por material; la Dirección ve reportes consolidados.",
#         "phase": "Full",
#         "stories": ["HU17", "HU18"],
#         "story_points": 11,
#     },
# ]


# ─────────────────────────────────────────────
# CLIENTE JIRA
# ─────────────────────────────────────────────

class JiraClient:
    """Cliente para Jira REST API v2 con auto-detección de campos."""

    def __init__(self, base_url: str, user: str, token: str):
        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()
        self.session.auth = (user, token)
        self.session.headers.update({"Content-Type": "application/json", "Accept": "application/json"})
        self._field_ids: dict[str, str] = {}
        self._issue_types: dict[str, str] = {}
        self._use_parent_for_epic: bool = False

    def _get_priorities(self) -> dict[str, str]:
        """Obtiene los IDs y nombres de prioridad disponibles."""
        resp = self._request("GET", "priority")
        if not resp.ok:
            return {}
        data = resp.json()
        return {p["name"].lower(): p["name"] for p in data}

    def _request(self, method: str, endpoint: str, data: dict | None = None, params: dict | None = None) -> requests.Response:
        url = f"{self.base_url}/rest/api/2/{endpoint}"
        resp = self.session.request(method, url, json=data, params=params)
        if resp.status_code == 429:
            retry = int(resp.headers.get("Retry-After", 5))
            print(f"  ⏳ Rate limit, esperando {retry}s...")
            time.sleep(retry)
            return self._request(method, endpoint, data, params)
        return resp

    def _get(self, endpoint: str, params: dict | None = None) -> Any:
        resp = self._request("GET", endpoint, params=params)
        resp.raise_for_status()
        return resp.json()

    def _post(self, endpoint: str, data: dict) -> dict:
        resp = self._request("POST", endpoint, data=data)
        if not resp.ok:
            error_msg = resp.text[:500]
            try:
                err_json = resp.json()
                error_msgs = [e.get("message", str(e)) for e in err_json.get("errors", [])]
                if not error_msgs:
                    error_msgs = [err_json.get("errorMessages", ["Unknown error"])]
                error_msg = " | ".join(str(m) for msgs in error_msgs for m in (msgs if isinstance(msgs, list) else [msgs]))
            except Exception:
                pass
            raise Exception(f"{resp.status_code} {resp.reason}: {error_msg}")
        return resp.json()

    # ── Auto-detección de campos ──

    def detect_fields(self, project_key: str):
        """Detecta automáticamente los IDs de campos personalizados y issue types."""
        print("🔍 Detectando campos personalizados...")

        # Obtener todos los campos disponibles
        all_fields = self._get("field")
        field_map = {f["id"]: f["name"] for f in all_fields}

        # Buscar campos comunes por nombre (case-insensitive)
        search_terms = {
            "epic_name": ["epic name", "nombre de épica", "épica nombre"],
            "epic_link": ["epic link", "link to epic", "enlace a épica"],
            "story_points": ["story points", "puntos de historia", "puntos", "story point estimate"],
        }

        for field_key, terms in search_terms.items():
            found = False
            for fid, fname in field_map.items():
                if any(t in fname.lower() for t in terms):
                    self._field_ids[field_key] = fid
                    print(f"   ✅ {field_key}: {fid} ({fname})")
                    found = True
                    break
            if not found:
                print(f"   ⚠️  {field_key}: no encontrado (se omitirá)")

        # En Jira Cloud moderno, Epic Link puede no existir → usar "parent" field
        if "epic_link" not in self._field_ids:
            print("   💡 Jira Cloud: se usará campo 'parent' para vincular stories a épicas")
            self._use_parent_for_epic = True
        else:
            self._use_parent_for_epic = False

        # Obtener issue types del proyecto
        print("\n🔍 Detectando issue types del proyecto...")
        meta = self._get(f"issue/createmeta", {"projectKeys": project_key, "expand": "projects.issuetypes"})
        for proj in meta.get("projects", []):
            for it in proj.get("issuetypes", []):
                # key = nombre en minúsculas, value = nombre original (para usar en API)
                self._issue_types[it["name"].lower()] = it["name"]
                print(f"   ✅ {it['name']}: {it['id']}")

        if not self._issue_types:
            print("   ❌ No se encontraron issue types. Verifica permisos.")
            sys.exit(1)

        # Obtener prioridades disponibles
        print("\n🔍 Detectando prioridades disponibles...")
        self._priorities = self._get_priorities()
        if self._priorities:
            print(f"   ✅ Prioridades: {list(self._priorities.values())}")
        else:
            print("   ⚠️  No se pudieron detectar prioridades")

        # Mapeo de prioridades: español → inglés (fallback si no se detectan)
        self._priority_map = {}
        es_to_en = {"alta": "high", "media": "medium", "baja": "low"}
        if self._priorities:
            for es_name, en_name in es_to_en.items():
                if en_name in self._priorities:
                    self._priority_map[es_name] = self._priorities[en_name]
                elif es_name in self._priorities:
                    self._priority_map[es_name] = self._priorities[es_name]
            # Si no encontró mapeo, usar los nombres detectados tal cual
            if not self._priority_map:
                available = list(self._priorities.values())
                for i, es_name in enumerate(["alta", "media", "baja"]):
                    if i < len(available):
                        self._priority_map[es_name] = available[i]
        print(f"   📋 Mapeo de prioridades: {self._priority_map}")

    def get_projects(self) -> list:
        return self._get("project")

    # ── Creación de issues ──

    def create_epic(self, project_key: str, name: str, description: str) -> dict:
        fields: dict[str, Any] = {
            "project": {"key": project_key},
            "issuetype": {"name": "Epic"},
            "summary": name,
            "description": description,
        }
        # Agregar Epic Name si el campo existe
        if "epic_name" in self._field_ids:
            fields[self._field_ids["epic_name"]] = name
        return self._post("issue", {"fields": fields})

    def create_story(self, project_key: str, summary: str, description: str,
                     epic_key: str | None = None, story_points: int | None = None,
                     priority: str | None = None, labels: list[str] | None = None) -> dict:
        # Determinar issue type - buscar "story" en keys minúsculas
        issue_type_name = "Story"  # fallback
        for type_key, type_name in self._issue_types.items():
            if "story" in type_key and "sub" not in type_key:
                issue_type_name = type_name  # usa el nombre original (ej: "Story")
                break

        fields: dict[str, Any] = {
            "project": {"key": project_key},
            "issuetype": {"name": issue_type_name},
            "summary": summary,
            "description": description,
        }
        # Epic Link (Jira Cloud moderno usa "parent", Jira Server usa customfield)
        if epic_key:
            if getattr(self, '_use_parent_for_epic', False):
                fields["parent"] = {"key": epic_key}
            elif "epic_link" in self._field_ids:
                fields[self._field_ids["epic_link"]] = epic_key
        # Story Points
        if story_points is not None and "story_points" in self._field_ids:
            fields[self._field_ids["story_points"]] = story_points
        # Priority (convertir español → nombre válido de Jira)
        if priority and hasattr(self, '_priority_map'):
            mapped = self._priority_map.get(priority.lower())
            if mapped:
                fields["priority"] = {"name": mapped}
            else:
                print(f"   ⚠️  Prioridad '{priority}' no mapeada, usando sin prioridad")
        elif priority:
            fields["priority"] = {"name": priority}
        # Labels
        if labels:
            fields["labels"] = labels

        return self._post("issue", {"fields": fields})

    def create_subtask(self, project_key: str, summary: str, parent_key: str,
                       description: str = "", labels: list[str] | None = None) -> dict:
        fields: dict[str, Any] = {
            "project": {"key": project_key},
            "issuetype": {"name": "Subtask"},
            "summary": summary,
            "description": description,
            "parent": {"key": parent_key},
        }
        if labels:
            fields["labels"] = labels
        return self._post("issue", {"fields": fields})

    # ── Limpiar proyecto ──

    def _search_issues(self, project_key: str) -> list[str]:
        """Busca todos los issue keys del proyecto. Múltiples intentos."""
        all_keys = []

        # Intento 1: API v2 search con JQL
        print("   🔍 Intento 1: API v2 search...")
        try:
            result = self._get("search", {
                "jql": f"project = {project_key}",
                "maxResults": 100,
                "fields": "key",
            })
            for issue in result.get("issues", []):
                all_keys.append(issue["key"])
            if all_keys:
                print(f"   ✅ API v2: {len(all_keys)} issues encontrados")
                return all_keys
        except Exception as e:
            print(f"   ⚠️  Falló: {e}")

        # Intento 2: API v3 search
        print("   🔍 Intento 2: API v3 search...")
        try:
            url = f"{self.base_url}/rest/api/3/search"
            resp = self.session.get(url, params={
                "jql": f"project = {project_key}",
                "maxResults": 100,
                "fields": "key",
            })
            if resp.ok:
                for issue in resp.json().get("issues", []):
                    all_keys.append(issue["key"])
                if all_keys:
                    print(f"   ✅ API v3: {len(all_keys)} issues encontrados")
                    return all_keys
        except Exception as e:
            print(f"   ⚠️  Falló: {e}")

        # Intento 3: Buscar por issueType (epics primero, luego stories)
        print("   🔍 Intento 3: Búsqueda por issue type...")
        for issuetype in ["Epic", "Story", "Sub-task", "Task"]:
            try:
                result = self._get("search", {
                    "jql": f"project = {project_key} AND issuetype = \"{issuetype}\"",
                    "maxResults": 100,
                    "fields": "key",
                })
                for issue in result.get("issues", []):
                    key = issue["key"]
                    if key not in all_keys:
                        all_keys.append(key)
            except Exception:
                pass

        if all_keys:
            print(f"   ✅ Búsqueda por tipo: {len(all_keys)} issues encontrados")
            return all_keys

        print("   ℹ️  No se encontraron issues con ningún método")
        return all_keys

    def clear_project_issues(self, project_key: str) -> int:
        """Elimina todos los issues del proyecto (subtasks, stories, epics). Retorna cantidad eliminada."""
        print(f"\n🗑️  Buscando issues en {project_key}...")
        all_keys = self._search_issues(project_key)

        if not all_keys:
            print("   ℹ️  No hay issues para eliminar.")
            return 0

        print(f"   📋 Encontrados {len(all_keys)} issues. Eliminando...")

        # Intentar bulk delete (lotes de 1000)
        deleted = 0
        for i in range(0, len(all_keys), 1000):
            batch = all_keys[i:i+1000]
            try:
                resp = self._request("POST", "bulk/issues/delete", data={
                    "selectedIssueIdsOrKeys": batch,
                    "sendBulkNotification": False,
                })
                if resp.ok:
                    deleted += len(batch)
                    print(f"   ✅ Eliminados {deleted}/{len(all_keys)} issues (bulk)")
                else:
                    # Fallback: delete individual
                    print(f"   ⚠️  Bulk delete no disponible ({resp.status_code}), usando delete individual...")
                    for key in batch:
                        try:
                            self._request("DELETE", f"issue/{key}?deleteSubtasks=true")
                            deleted += 1
                            time.sleep(0.1)
                        except Exception:
                            pass
            except Exception as e:
                print(f"   ⚠️  Error en bulk delete: {e}. Usando delete individual...")
                for key in batch:
                    try:
                        self._request("DELETE", f"issue/{key}?deleteSubtasks=true")
                        deleted += 1
                        time.sleep(0.1)
                    except Exception:
                        pass

        print(f"   ✅ Eliminados {deleted}/{len(all_keys)} issues")
        return deleted

    # ── Sprints (Jira Agile API) — COMENTADO: crear sprints manualmente en Jira ──

    # def get_board(self, project_key: str) -> dict | None:
    #     """Obtiene el board asociado al proyecto. Intenta Scrum, luego cualquier board."""
    #     try:
    #         boards = self._get_agile("board", {"projectKeyOrId": project_key, "maxResults": 20})
    #         values = boards.get("values", [])
    #         if values:
    #             print(f"   📋 Boards encontrados para {project_key}: {len(values)}")
    #             for b in values:
    #                 print(f"      - {b['name']} (ID: {b['id']}, tipo: {b.get('type', 'desconocido')})")
    #             for b in values:
    #                 if b.get("type") == "scrum":
    #                     return b
    #             return values[0]
    #         else:
    #             print(f"   ⚠️  No se encontraron boards para el proyecto {project_key}")
    #     except Exception as e:
    #         print(f"   ⚠️  Error buscando boards del proyecto: {e}")
    #     try:
    #         boards = self._get_agile("board", {"maxResults": 50})
    #         values = boards.get("values", [])
    #         if values:
    #             print(f"   📋 Boards globales encontrados: {len(values)}")
    #             for b in values:
    #                 print(f"      - {b['name']} (ID: {b['id']}, tipo: {b.get('type', 'desconocido')})")
    #             for b in values:
    #                 if b.get("type") == "scrum":
    #                     return b
    #             return values[0]
    #     except Exception as e:
    #         print(f"   ⚠️  Error buscando boards globales: {e}")
    #     return None

    # def create_filter(self, project_key: str, name: str = "") -> dict | None:
    #     """Crea un filtro JQL para el proyecto. Si ya existe, lo reutiliza."""
    #     if not name:
    #         name = f"{project_key} Board Filter"
    #     try:
    #         result = self._get("filter/favourite", {})
    #         for f in result if isinstance(result, list) else result.get("values", []):
    #             if f.get("name") == name:
    #                 print(f"   ✅ Filtro ya existe: {name} (ID: {f.get('id')})")
    #                 return f
    #     except Exception:
    #         pass
    #     data = {
    #         "name": name,
    #         "description": f"Filtro automático para el board de {project_key}",
    #         "jql": f"project = {project_key} ORDER BY Rank ASC",
    #         "favourite": False,
    #     }
    #     try:
    #         result = self._post("filter", data)
    #         print(f"   ✅ Filtro creado: {result.get('name')} (ID: {result.get('id')})")
    #         return result
    #     except Exception as e:
    #         if "already exists" in str(e).lower():
    #             print(f"   ℹ️  Filtro '{name}' ya existe, buscándolo...")
    #             try:
    #                 result = self._get("filter/favourite", {})
    #                 for f in result if isinstance(result, list) else result.get("values", []):
    #                     if f.get("name") == name:
    #                         print(f"   ✅ Filtro encontrado: {name} (ID: {f.get('id')})")
    #                         return f
    #             except Exception:
    #                 pass
    #         print(f"   ❌ Error creando filtro: {e}")
    #         return None

    # def create_board(self, project_key: str, name: str = "", board_type: str = "scrum") -> dict | None:
    #     """Crea un board Scrum/Kanban para el proyecto."""
    #     if not name:
    #         name = f"{project_key} Board"
    #     filter_result = self.create_filter(project_key)
    #     if not filter_result:
    #         return None
    #     filter_id = filter_result.get("id")
    #     data = {
    #         "name": name,
    #         "type": board_type,
    #         "filterId": filter_id,
    #     }
    #     try:
    #         result = self._post_agile("board", data)
    #         print(f"   ✅ Board creado: {result.get('name')} (ID: {result.get('id')})")
    #         return result
    #     except Exception as e:
    #         print(f"   ❌ Error creando board: {e}")
    #         return None

    # def create_sprint(self, board_id: int, name: str, goal: str = "") -> dict:
    #     """Crea un sprint via Jira Agile API."""
    #     data = {
    #         "name": name,
    #         "originBoardId": board_id,
    #     }
    #     if goal:
    #         data["goal"] = goal
    #     return self._post_agile("sprint", data)

    # def add_issues_to_sprint(self, sprint_id: int, issue_keys: list[str]) -> dict:
    #     """Agrega issues a un sprint via Jira Agile API."""
    #     data = {"issues": issue_keys}
    #     return self._post_agile(f"sprint/{sprint_id}/issue", data)

    # def _post_agile(self, endpoint: str, data: dict) -> dict:
    #     """POST a la Agile API (/rest/agile/1.0/...)."""
    #     url = f"{self.base_url}/rest/agile/1.0/{endpoint}"
    #     resp = self.session.post(url, json=data)
    #     if resp.status_code == 429:
    #         retry = int(resp.headers.get("Retry-After", 5))
    #         print(f"  ⏳ Rate limit, esperando {retry}s...")
    #         time.sleep(retry)
    #         return self._post_agile(endpoint, data)
    #     if not resp.ok:
    #         error_msg = resp.text[:500]
    #         try:
    #             err_json = resp.json()
    #             error_msgs = [e.get("message", str(e)) for e in err_json.get("errors", [])]
    #             if not error_msgs:
    #                 error_msgs = [err_json.get("errorMessages", ["Unknown error"])]
    #             error_msg = " | ".join(str(m) for msgs in error_msgs for m in (msgs if isinstance(msgs, list) else [msgs]))
    #         except Exception:
    #             pass
    #         raise Exception(f"{resp.status_code} {resp.reason}: {error_msg}")
    #     return resp.json()

    # def _get_agile(self, endpoint: str, params: dict | None = None) -> Any:
    #     """GET a la Agile API (/rest/agile/1.0/...)."""
    #     url = f"{self.base_url}/rest/agile/1.0/{endpoint}"
    #     resp = self.session.get(url, params=params)
    #     if resp.status_code == 429:
    #         retry = int(resp.headers.get("Retry-After", 5))
    #         print(f"  ⏳ Rate limit, esperando {retry}s...")
    #         time.sleep(retry)
    #         return self._get_agile(endpoint, params)
    #     if not resp.ok:
    #         raise Exception(f"{resp.status_code} {resp.reason}: {resp.text[:300]}")
    #     return resp.json()


# ─────────────────────────────────────────────
# IMPORTADOR
# ─────────────────────────────────────────────

def importar_a_jira(base_url: str, user: str, token: str, project_key: str, dry_run: bool = False, clear: bool = False):
    print(f"\n{'='*60}")
    print(f"  Importar Historias de Usuario → Jira")
    print(f"{'='*60}")
    print(f"  Instancia: {base_url}")
    print(f"  Proyecto:  {project_key}")
    print(f"  Modo:      {'DRY RUN (sin cambios)' if dry_run else 'EJECUCIÓN REAL'}")
    if clear:
        print(f"  ⚠️  MODO CLEAR: Se eliminarán todos los issues existentes del proyecto")
    print(f"{'='*60}\n")

    if dry_run:
        print("📁 Épicas a crear:")
        for ep in EPICAS:
            print(f"   - [{ep['key']}] {ep['name']}")
        print(f"\n📝 Historias a crear: {len(HISTORIAS)}")
        for h in HISTORIAS:
            task_count = len(TASKS.get(h["id"], []))
            print(f"   - [{h['id']}] {h['summary']} ({h['priority']}, {h['story_points']} SP, {task_count} tareas) → {h['epic']}")
        total_tasks = sum(len(tasks) for tasks in TASKS.values())
        print(f"\n🔧 Tareas a crear: {total_tasks}")
        # Sprints: crear manualmente en Jira
        # print(f"\n🏃 Sprints a crear: {len(SPRINTS)}")
        # for s in SPRINTS:
        #     print(f"   - {s['name']} ({s['phase']}, {s['story_points']} SP, HU: {', '.join(s['stories'])})")
        if clear:
            print(f"\n🗑️  MODO CLEAR: Se eliminarían todos los issues existentes del proyecto")
        print(f"\n✅ Dry run completado. No se crearon issues en Jira.")
        return

    client = JiraClient(base_url, user, token)

    # Verificar conexión
    try:
        projects = client.get_projects()
        print(f"✅ Conexión exitosa. Proyectos accesibles: {len(projects)}")
    except requests.exceptions.RequestException as e:
        print(f"❌ Error de conexión: {e}")
        sys.exit(1)

    # Verificar que el proyecto existe
    project_keys = [p["key"] for p in projects]
    if project_key not in project_keys:
        print(f"❌ Proyecto '{project_key}' no encontrado. Disponibles: {', '.join(project_keys)}")
        sys.exit(1)

    # Auto-detectar campos
    client.detect_fields(project_key)

    # ── Clear: eliminar issues existentes ──
    if clear:
        client.clear_project_issues(project_key)

    # Verificar que hay un issue type "Story" disponible
    story_type_found = any("story" in t.lower() and "sub" not in t.lower() for t in client._issue_types)
    if not story_type_found:
        print(f"\n⚠️  Issue type 'Story' no disponible. Tipos disponibles: {list(client._issue_types.keys())}")
        print("   Se usará el primer tipo disponible.")
    else:
        story_name = next(v for k, v in client._issue_types.items() if "story" in k and "sub" not in k)
        print(f"\n✅ Issue type '{story_name}' disponible para crear historias.")

    # Crear épicas
    print("\n📁 Creando épicas...")
    epic_keys: dict[str, str | None] = {}
    for ep in EPICAS:
        try:
            result = client.create_epic(project_key, ep["name"], ep["description"])
            jira_key = result["key"]
            epic_keys[ep["key"]] = jira_key
            print(f"   ✅ [{ep['key']}] → {jira_key}: {ep['name']}")
            time.sleep(0.3)
        except Exception as e:
            print(f"   ❌ [{ep['key']}] Error: {e}")
            epic_keys[ep["key"]] = None

    # Crear historias
    print(f"\n📝 Creando historias de usuario ({len(HISTORIAS)})...")
    created_count = 0
    story_keys: dict[str, str] = {}  # hu_id → jira_key
    for h in HISTORIAS:
        epic_jira_key = epic_keys.get(h["epic"])
        labels = [f"SP:{h['story_points']}", f"HU:{h['id']}"]
        try:
            result = client.create_story(
                project_key=project_key,
                summary=f"[{h['id']}] {h['summary']}",
                description=h["description"],
                epic_key=epic_jira_key,
                story_points=h["story_points"],
                priority=h["priority"],
                labels=labels,
            )
            jira_key = result["key"]
            story_keys[h["id"]] = jira_key
            created_count += 1
            print(f"   ✅ [{h['id']}] → {jira_key}: {h['summary']} ({h['story_points']} SP)")
            time.sleep(0.3)
        except Exception as e:
            print(f"   ❌ [{h['id']}] Error: {e}")

    # Crear tareas (subtasks) para cada historia
    total_tasks = sum(len(tasks) for tasks in TASKS.values())
    print(f"\n🔧 Creando tareas por historia ({total_tasks} tareas)...")
    task_count = 0
    for hu_id, tasks in TASKS.items():
        story_key = story_keys.get(hu_id)
        if not story_key:
            print(f"   ⏭️  [{hu_id}] Saltando tareas (historia no creada)")
            continue
        for i, task in enumerate(tasks, 1):
            labels = [f"HU:{hu_id}", f"Tipo:{task['type']}"]
            try:
                result = client.create_subtask(
                    project_key=project_key,
                    summary=f"[{hu_id}] {task['summary']}",
                    parent_key=story_key,
                    description=f"**Historia:** {hu_id}\n**Tipo:** {task['type']}",
                    labels=labels,
                )
                task_count += 1
                print(f"   ✅ [{hu_id}.{i:02d}] → {result['key']}: {task['summary']}")
                time.sleep(0.3)
            except Exception as e:
                print(f"   ❌ [{hu_id}.{i:02d}] Error: {e}")

    # ── Crear sprints y asignar issues — COMENTADO: crear sprints manualmente en Jira ──
    # print(f"\n🏃 Creando sprints ({len(SPRINTS)})...")
    # board = client.get_board(project_key)
    # board_id = None
    # if board:
    #     board_id = board.get("id")
    #     print(f"   📋 Board encontrado: {board['name']} (ID: {board_id})")
    # else:
    #     print("   ⚠️  No se encontró ningún board. Intentando crear uno...")
    #     new_board = client.create_board(project_key)
    #     if new_board:
    #         board_id = new_board.get("id")
    #         print(f"   📋 Board creado: {new_board['name']} (ID: {board_id})")
    #     else:
    #         print("   ❌ No se pudo crear un board. Los sprints se omitirán.")
    #         print("   💡 Crea un Scrum Board manualmente en Jira y vuelve a ejecutar.")

    # sprint_count = 0
    # for sprint_data in SPRINTS:
    #     sprint_name = sprint_data["name"]
    #     sprint_goal = sprint_data["goal"]
    #     sprint_phase = sprint_data["phase"]
    #     sprint_hu_ids = sprint_data["stories"]
    #     sprint_sp = sprint_data["story_points"]
    #     sprint_label = f"Sprint:{sprint_name.split('—')[0].strip()}"
    #     phase_label = f"Fase:{sprint_phase}"
    #     jira_sprint_id = None
    #     if board_id:
    #         try:
    #             result = client.create_sprint(board_id, sprint_name, sprint_goal)
    #             jira_sprint_id = result.get("id")
    #             sprint_count += 1
    #             print(f"   ✅ {sprint_name} ({sprint_sp} SP) → Sprint #{jira_sprint_id}")
    #             time.sleep(0.3)
    #         except Exception as e:
    #             print(f"   ❌ {sprint_name} Error creando sprint: {e}")
    #     else:
    #         print(f"   ⏭️  {sprint_name} ({sprint_sp} SP) — sin board, se omite creación de sprint")
    #     sprint_issue_keys = []
    #     for hu_id in sprint_hu_ids:
    #         if hu_id in story_keys:
    #             sprint_issue_keys.append(story_keys[hu_id])
    #     if jira_sprint_id and sprint_issue_keys:
    #         try:
    #             client.add_issues_to_sprint(jira_sprint_id, sprint_issue_keys)
    #             print(f"      → {len(sprint_issue_keys)} historias asignadas al sprint")
    #             time.sleep(0.3)
    #         except Exception as e:
    #             print(f"      ⚠️  Error asignando issues al sprint: {e}")
    #     elif not jira_sprint_id:
    #         print(f"      → {len(sprint_issue_keys)} historias (sin sprint en Jira)")

    print(f"\n{'='*60}")
    print(f"  ✅ Importación completada:")
    print(f"     📁 Épicas:     {len([v for v in epic_keys.values() if v])}/{len(EPICAS)}")
    print(f"     📝 Historias:  {created_count}/{len(HISTORIAS)}")
    print(f"     🔧 Tareas:     {task_count}/{total_tasks}")
    # print(f"     🏃 Sprints:    {sprint_count}/{len(SPRINTS)}")
    print(f"{'='*60}\n")


# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Importar Historias de Usuario a Jira",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Las credenciales se leen del archivo .env-jira:
  URL_JIRA=https://tu-instancia.atlassian.net
  USER_JIRA=tu@email.com
  TOKEN_JIRA=TU_API_TOKEN
  PROJECT_KEY_JIRA=KEY

Ejemplos:
  python importar_jira.py
  python importar_jira.py --dry-run
  python importar_jira.py --clear
  python importar_jira.py --clear --project OTRO_PROYECTO
        """,
    )
    parser.add_argument("--url", default=None, help="Override: URL de la instancia Jira")
    parser.add_argument("--user", default=None, help="Override: Email de usuario Jira")
    parser.add_argument("--token", default=None, help="Override: API Token de Jira")
    parser.add_argument("--project", default=None, help="Override: Key del proyecto Jira")
    parser.add_argument("--dry-run", action="store_true", help="Solo mostrar qué se crearía, sin hacer cambios")
    parser.add_argument("--clear", action="store_true", help="Eliminar todos los issues existentes del proyecto antes de importar")

    args = parser.parse_args()

    # Usar CLI args como override, si no → .env-jira
    url = args.url or URL_JIRA
    user = args.user or USER_JIRA
    token = args.token or TOKEN_JIRA
    project = args.project or PROJECT_KEY_JIRA

    # Validar que todos estén presentes
    missing = []
    if not url: missing.append("URL_JIRA")
    if not user: missing.append("USER_JIRA")
    if not token: missing.append("TOKEN_JIRA")
    if not project: missing.append("PROJECT_KEY_JIRA")
    if missing:
        print(f"❌ Faltan variables de configuración: {', '.join(missing)}")
        print("   Define en .env-jira o pasa como argumento CLI")
        sys.exit(1)

    importar_a_jira(url, user, token, project, args.dry_run, args.clear)


if __name__ == "__main__":
    main()
