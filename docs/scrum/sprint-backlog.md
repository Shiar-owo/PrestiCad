# Sprint Backlog — Sistema de Préstamos Académicos

> Distribución de las 18 historias de usuario en 6 sprints.
> Cada sprint tiene una capacidad estimada de ~16-18 SP.

---

## Sprint 1 — Fundamentos (Usuarios + Inventario base)

**Objetivo:** Los usuarios pueden registrarse, autenticarse y el administrador puede gestionar el inventario básico.

| ID | Historia | SP |
|----|----------|-----|
| HU01 | Registrar usuario | 3 |
| HU03 | Iniciar sesión | 5 |
| HU04 | Registrar material en inventario | 5 |
| **Total** | | **13 SP** |

**Entregable:** Sistema con auth funcional e inventario registrado.

---

## Sprint 2 — Reservas

**Objetivo:** Los usuarios pueden buscar materiales y hacer reservas; el sistema cancela reservas vencidas automáticamente.

| ID | Historia | SP |
|----|----------|-----|
| HU05 | Buscar y consultar materiales | 3 |
| HU02 | Gestionar roles y permisos | 3 |
| HU06 | Reservar material | 5 |
| HU07 | Cancelación automática de reservas vencidas | 5 |
| **Total** | | **16 SP** |

**Entregable:** Flujo de reservas completo con cancelación automática.

---

## Sprint 3 — Préstamos y Reputación

**Objetivo:** El gestor puede registrar préstamos con checklist; el sistema gestiona la reputación y Tiers.

| ID | Historia | SP |
|----|----------|-----|
| HU12 | Gestionar reputación y Tiers de acceso | 8 |
| HU09 | Registrar préstamo (entrega de material) | 8 |
| **Total** | | **16 SP** |

**Entregable:** Préstamos activos con checklist de estado inicial y sistema de reputación funcionando.

---

## Sprint 4 — Devoluciones y Sanciones

**Objetivo:** Las devoluciones calculan sanciones automáticamente; se gestionan suspensiones.

| ID | Historia | SP |
|----|----------|-----|
| HU11 | Registrar devolución con cálculo de sanciones | 8 |
| HU14 | Gestionar suspensiones por bajo puntaje | 5 |
| HU10 | Consultar estado de mis préstamos | 3 |
| **Total** | | **16 SP** |

**Entregable:** Ciclo completo de préstamo → devolución con cálculo automático de reputación.

---

## Sprint 5 — Prórrogas, Excepciones y Perfil

**Objetivo:** Los usuarios pueden solicitar prórrogas, acceder a excepciones académicas y gestionar su perfil.

| ID | Historia | SP |
|----|----------|-----|
| HU15 | Solicitar prórroga de préstamo | 5 |
| HU13 | Préstamo excepcional por necesidad académica | 5 |
| HU16 | Consultar y actualizar perfil | 3 |
| HU17 | Consultar historial de préstamos por material | 3 |
| **Total** | | **16 SP** |

**Entregable:** Funcionalidades de extensión, excepciones y consultas de perfil/historial.

---

## Sprint 6 — Reportes y Ajustes

**Objetivo:** Dashboard de reportes para Dirección; ajustes finales y pulido del sistema.

| ID | Historia | SP |
|----|----------|-----|
| HU08 | Evaluar y priorizar reservas simultáneas | 5 |
| HU18 | Dashboard de reportes para Dirección | 8 |
| **Total** | | **13 SP** |

**Entregable:** Sistema completo con reportes y gestión de cola de reservas.

---

## Vista general de sprints

```
Sprint 1  ████████████░░░  13 SP  (Users + Inventario)
Sprint 2  ███████████████░  16 SP  (Reservas)
Sprint 3  ████████████████  16 SP  (Préstamos + Reputación)
Sprint 4  ████████████████  16 SP  (Devoluciones + Sanciones)
Sprint 5  ████████████████  16 SP  (Prórrogas + Perfil)
Sprint 6  █████████████░░  13 SP  (Reportes + Ajustes)
─────────────────────────────
Total:     90 SP / 18 historias
```

---

## Notas

- Los SP son estimaciones relativas iniciales; deben refinarse con el equipo en Sprint Planning.
- La capacidad por sprint puede variar según el equipo (se asumió ~16 SP como base).
- El orden de desarrollo respeta las dependencias del Product Backlog.
- Los requisitos no funcionales (RNF01-RNF05) se implementan transversalmente a lo largo de todos los sprints.
