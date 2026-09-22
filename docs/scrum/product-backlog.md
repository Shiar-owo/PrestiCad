# Product Backlog — Sistema de Préstamos Académicos

> Ordenado por prioridad (Alta → Media → Baja) y dependencias de implementación.

---

## Leyenda

- **SP**: Story Points (estimación relativa: 1, 2, 3, 5, 8, 13)
- **Prioridad**: Alta / Media / Baja
- **Dep**: ID de historias de las que depende

---

## Backlog Priorizado

| # | ID | Historia | Épica | Prioridad | SP | Dep | RF |
|---|-----|----------|-------|-----------|-----|-----|-----|
| 1 | HU01 | Registrar usuario | Usuarios | Alta | 3 | — | RF01 |
| 2 | HU03 | Iniciar sesión | Usuarios | Alta | 5 | HU01 | RF02 |
| 3 | HU04 | Registrar material en inventario | Inventario | Alta | 5 | — | RF03 |
| 4 | HU02 | Gestionar roles y permisos | Usuarios | Alta | 3 | HU01 | RF01, RNF03 |
| 5 | HU05 | Buscar y consultar materiales | Inventario | Media | 3 | HU04 | RF03, RNF01 |
| 6 | HU12 | Gestionar reputación y Tiers | Devoluciones | Alta | 8 | HU01 | RF08, RN03 |
| 7 | HU06 | Reservar material | Reservas | Alta | 5 | HU04, HU05, HU12 | RF04, RN01, RN03, RN04 |
| 8 | HU07 | Cancelación automática reservas | Reservas | Alta | 5 | HU06 | RN04 |
| 9 | HU08 | Evaluar reservas simultáneas | Reservas | Media | 5 | HU06 | RN08 |
| 10 | HU09 | Registrar préstamo (entrega) | Préstamos | Alta | 8 | HU06, HU09 | RF05, RF09, RN05, RN09 |
| 11 | HU10 | Consultar estado de préstamos | Préstamos | Media | 3 | HU09 | RF07 |
| 12 | HU11 | Registrar devolución con sanciones | Devoluciones | Alta | 8 | HU09, HU12 | RF06, RF08, RN06, RN09 |
| 13 | HU14 | Gestionar suspensiones | Devoluciones | Media | 5 | HU12 | RF08 |
| 14 | HU13 | Préstamo excepcional académico | Devoluciones | Media | 5 | HU09, HU12 | RN03, RN05 |
| 15 | HU15 | Solicitar prórroga | Prórrogas | Media | 5 | HU09, HU12 | RF12, RN07 |
| 16 | HU16 | Consultar y actualizar perfil | Perfil | Media | 3 | HU01, HU12 | RF10, RF11 |
| 17 | HU17 | Historial por material | Perfil | Media | 3 | HU09 | RF10 |
| 18 | HU18 | Dashboard reportes Dirección | Reportes | Baja | 8 | HU09, HU11, HU12 | — |

---

## Resumen por prioridad

| Prioridad | Historias | SP Total |
|-----------|-----------|----------|
| **Alta** | HU01, HU02, HU03, HU04, HU06, HU07, HU09, HU11, HU12 | 55 |
| **Media** | HU05, HU08, HU10, HU13, HU14, HU15, HU16, HU17 | 32 |
| **Baja** | HU18 | 8 |
| **Total** | **18 historias** | **95 SP** |

---

## Resumen por épica

| Épica | SP Total | # HU |
|-------|----------|------|
| 1. Gestión de Usuarios | 11 | 3 |
| 2. Inventario | 8 | 2 |
| 3. Reservas | 15 | 3 |
| 4. Préstamos | 16 | 2 |
| 5. Devoluciones/Sanciones | 26 | 4 |
| 6. Prórrogas | 5 | 1 |
| 7. Perfil/Historial | 6 | 2 |
| 8. Reportes | 8 | 1 |
