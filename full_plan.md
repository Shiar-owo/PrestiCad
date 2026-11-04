# Full Implementation Plan for Presticad Enhancements

## Overview
The goal is to deliver a set of backend and frontend improvements across the **Presticad** system, covering loan duration constraints, UI text updates, filter removal, duplicated panels, and the academic‑exception reservation workflow.

### High‑level objectives
1. **Loan duration** – Enforce a **minimum** of **1 h (60 min)** for all loans and a **maximum** of **8 h (480 min)** for materials with `tier_minimo_requerido = "avanzado"`.
2. **PDF upload help text** – Update the tooltip on the *Registrar Préstamo* page.
3. **Catalog page** – Remove the **"estado"** filter.
4. **Gestionar Prestamos** – Delete duplicated option panels.
5. **Academic‑exception reservation** – Apply the same exception flow to users with tier **estándar** as well as **restringido** when trying to reserve a material that requires tier **avanzado**.
6. **Testing** – Add/adjust unit tests for all new validations and UI changes.
7. **Version control** – Perform all work on a new branch `feature/loan-duration-and-ui-fixes` with meaningful atomic commits.

---

## 1. Repository setup
```bash
# From the project root
git checkout -b feature/loan-duration-and-ui-fixes development
```
All subsequent changes will be committed on this branch.

---

## 2. Backend changes
### 2.1 Loan duration validation (prestamos)
File: `backend/apps/prestamos/serializers.py`
- Set `tiempo_prestamo_minutos.min_value = 60` (instead of the previous 15).
- Update `error_messages` to reflect the new minimum text:
  ```python
  "min_value": "El tiempo mínimo de préstamo es de 1 h (60 min).",
  ```
- Add a `validate` method that:
  1. Retrieves the material by `material_id`.
  2. If the material's `tier_minimo_requerido == 'avanzado'` **and** the requested minutes **> 480**, raise a `ValidationError` with the message:
     > "El tiempo máximo de préstamo para materiales de tier avanzado es 8 h (480 min)."
- Keep existing validations for `tiempo_prestamo_dias`.

### 2.2 Academic‑exception reservation logic
File: `backend/apps/reservas/services.py` – inside `crear_reserva`.
```python
material = _obtener_material_bloqueado(material_id)
# Existing tier check …
if material.tier_minimo_requerido not in tiers_permitidos:
    # Old behaviour only for "restringido"
    if usuario_bloqueado.reputacion_tier == "restringido":
        raise ReservaError(...)
    raise ReservaError(...)

# NEW: apply exception rule to "estandar" as well
if material.tier_minimo_requerido == "avanzado" and \
   usuario_bloqueado.reputacion_tier in ("restringido", "estandar"):
    raise ReservaError(
        "es_excepcion",
        "Tu cuenta se encuentra en Tier Restringido y este material exige Tier Avanzado. "
        "Puedes registrar una solicitud excepcional adjuntando obligatoriamente tu documento de "
        "identidad y el compromiso de responsabilidad firmado en PDF (máximo 4 MB en total). "
        "La solicitud quedará en estado En espera hasta que el Gestor de Almacén verifique la garantía "
        "y la apruebe manualmente.",
        status_code=403,
    )
```
- The raised error uses the existing `ReservaError` class, with field `es_excepcion` to flag the reservation as exceptional.
- The UI will read this field to display the warning and enforce mandatory PDF uploads.

### 2.3 Constants adjustment (optional)
If needed, add a new entry to `backend/apps/reservas/constants.py`:
```python
"excepcion_solo_restringido_estandar": (
    "La solicitud excepcional también se aplica a usuarios con Tier Estándar "
    "cuando el material requiere Tier Avanzado."
),
```
(Used only for i18n – not required for functionality.)

---

## 3. Front‑end changes
### 3.1 PDF help text
File: `frontend/src/components/prestamos/RegistrarPrestamo.jsx`
- Locate the string **"Solo se acepta application/pdf..."** and replace it with:
  ```text
  Solo se aceptan archivos PDF (.pdf)...
  ```
- Verify that the component still shows the validation error when a non‑PDF is uploaded.

### 3.2 Remove "estado" filter from catalog
Files involved:
- `frontend/src/pages/CatalogoMateriales.jsx`
- `frontend/src/components/BarraBusqueda.jsx`
Steps:
1. Delete the `estado` entry from the component state (`useState`).
2. Remove the UI dropdown/button that renders the estado filter.
3. Update the `buscarMateriales` request builder to **omit** the `estado` query parameter.
4. Adjust any TypeScript/PropTypes definitions that referenced `estado`.

### 3.3 Delete duplicated panels in Gestionar Prestamos
File: `frontend/src/pages/GestionarPrestamos.jsx`
- The constant `OPCIONES_GESTION_PRESTAMOS` generates two identical panels. Remove the duplicate block (lines that render the second set of options) and delete the import if unused.

### 3.4 Display academic‑exception warning
File(s) handling reservation UI (e.g., a modal component under `src/components/prestamos/ReservaModal.jsx` or similar).
- When the reservation API response contains `es_excepcion: true`, render a modal with the full warning text supplied above.
- Ensure the form forces the user to upload **both** required PDFs before enabling the "Confirmar" button.

---

## 4. Tests
### 4.1 Backend
- **Serializers**: Add tests in `backend/apps/prestamos/tests.py` for:
  * `tiempo_prestamo_minutos < 60` → `400` with new min‑value message.
  * `tiempo_prestamo_minutos > 480` for a material with tier `avanzado` → error.
- **Reserva service**: In `backend/apps/reservas/tests.py`:
  * Attempt reservation of an `avanzado` material with a user of tier `estandar` → expect `ReservaError` with `es_excepcion` flag.
  * Same for tier `restringido` (existing behaviour) → ensure unchanged.

### 4.2 Front‑end (Jest / Vitest)
- **RegistrarPrestamo**: Verify the tooltip text now contains *"Solo se aceptan archivos PDF (.pdf)..."*.
- **CatalogoMateriales**: Ensure the request payload does **not** contain the `estado` parameter; UI no longer shows the dropdown.
- **GestionarPrestamos**: Snapshot test confirms that duplicated panels are absent.
- **Reserva flow**: Mock API response with `es_excepcion:true` and check that the warning modal appears and disables continuation until required PDFs are provided.

---

## 5. Commit strategy
| Commit SHA (example) | Message | Scope |
|----------------------|---------|-------|
| `a1b2c3d` | Backend – enforce 1 h minimum and 8 h max for tier avanzado | `backend` |
| `b2c3d4e` | Backend – add academic‑exception rule for tier estándar | `backend` |
| `c3d4e5f` | Frontend – update PDF help text | `frontend` |
| `d4e5f6g` | Frontend – remove estado filter from catalog page | `frontend` |
| `e5f6g7h` | Frontend – delete duplicated panels in Gestionar Prestamos | `frontend` |
| `f6g7h8i` | Tests – cover new validations and UI changes | `tests` |
| `g7h8i9j` | Refactor – small clean‑ups and docs update | `misc` |

All commits are **atomic**, each touching a single logical concern.

---

## 6. Verification steps
1. Run backend tests:
   ```bash
   docker compose run --rm backend python manage.py test apps.prestamos apps.reservas
   ```
2. Run frontend tests:
   ```bash
   cd frontend && npm test
   ```
3. Manual sanity checks:
   - Attempt to register a loan of **30 min** → UI error, API rejection.
   - Register a loan of **1 h** → success.
   - Create material with `tier_minimo_requerido='avanzado'` and request a loan of **9 h** → error.
   - As a user with tier `estandar`, try to reserve an `avanzado` material → reservation exception modal appears, PDF uploads enforced.
   - Verify catalog page has no "estado" dropdown and the request URL lacks `?estado=`.
   - Confirm *Gestionar Prestamos* page shows only one set of option panels.

---

## 7. Deliverables
- Updated source code (backend & frontend) on branch `feature/loan-duration-and-ui-fixes`.
- Full test suite passing.
- This markdown (`full_plan.md`) summarizing the implementation plan for hand‑off to another AI or reviewer.

---

**End of plan**

## Additional requirements (new)
- **Historial de préstamos:** Cuando el estado es *devuelto*, debe mostrarse la checklist final del préstamo, indicando si hubo daño o no, y permitir al usuario descargar o redirigir al reporte asociado.
- **Formulario de registro de material:** El campo `estado` ya no debe incluir la opción "En Mantenimiento"; sólo se permite el estado inicial **"disponible"**.
- **Formulario de registro de material:** El selector de `tier` debe eliminar la opción "Sin especificar"; los tiers válidos son *restringido*, *estandar* y *avanzado*.
