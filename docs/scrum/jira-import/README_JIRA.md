# Importar Historias de Usuario a Jira

Script Python para importar las 18 historias de usuario, 133 tareas y 9 sprints del Sistema de Préstamos Académicos a Jira vía REST API.

## Requisitos

- Python 3.10+
- requests, python-dotenv (`pip install -r requirements.txt`)
- API Token de Jira (https://id.atlassian.com/manage-profile/security/api-tokens)
- Permisos de creación de issues en el proyecto destino
- **Proyecto tipo Scrum** en Jira (para crear sprints)

## Configuración

1. Crear un proyecto en Jira (tipo **Scrum**)
2. Obtener un API Token desde https://id.atlassian.com/manage-profile/security/api-tokens
3. Copiar y editar el archivo de credenciales:

```bash
cp .env-jira .env-jira   # ya existe como plantilla
```

Editar `.env-jira`:

```env
URL_JIRA=https://tu-instancia.atlassian.net
USER_JIRA=tu@email.com
TOKEN_JIRA=TU_API_TOKEN
PROJECT_KEY_JIRA=KEY
```

## Uso

```bash
# Instalar dependencias
pip install -r requirements.txt

# Ejecutar importación (lee credenciales de .env-jira)
python importar_jira.py

# Dry run (solo muestra qué se crearía, sin tocar Jira)
python importar_jira.py --dry-run

# Limpiar proyecto y reimportar desde cero (IDs bajos)
python importar_jira.py --clear

# Override de proyecto específico
python importar_jira.py --project OTRO_PROYECTO
```

## Qué crea

- **8 Épicos**: Una por cada épica del sistema
- **18 Historias de usuario**: Una por cada HU, con narrativa, criterios de aceptación, story points y prioridad
- **133 Tareas (subtasks)**: Desglose de cada historia en tareas Backend/Frontend/Integración
- **9 Sprints**: Distribución de historias en sprints (MVP + Full Product)

### Opción `--clear`

Si necesitas reimportar desde cero (por ejemplo, para obtener IDs secuenciales bajos), usa `--clear`:

```bash
python importar_jira.py --clear
```

Esto eliminará **todos** los issues del proyecto (subtasks, stories, epics) antes de crear los nuevos.

### Estructura de sprints

| Sprint | Fase | Enfoque | HU | SP |
|--------|------|---------|----|----|
| M1 | MVP | Usuarios + Auth + Roles + Perfil | HU01, HU03, HU02, HU16 | 14 |
| M2 | MVP | Inventario + Búsqueda | HU04, HU05 | 8 |
| M3 | MVP | Préstamos | HU09 | 8 |
| M4 | MVP | Devoluciones + Ver mis préstamos | HU11, HU10 | 11 |
| S5 | Full | Reputación + Tiers | HU12 | 8 |
| S6 | Full | Reservas + Cancelación | HU06, HU07 | 10 |
| S7 | Full | Cola + Suspensiones | HU08, HU14 | 10 |
| S8 | Full | Prórrogas + Excepciones | HU15, HU13 | 10 |
| S9 | Full | Historial + Reportes | HU17, HU18 | 11 |

## Auto-detección de campos y boards

El script detecta automáticamente al ejecutarse:

- **Issue types**: Story, Epic, Bug, Task, Subtask (según disponibilidad del proyecto)
- **Campos personalizados**: Story Points, Epic Link / Parent
- **Prioridades**: Mapea Alta→High, Media→Medium, Baja→Low
- **Board Scrum**: Busca el board del proyecto para crear sprints via Agile API. Si no encuentra uno, intenta crear un board automáticamente.

## Archivos

```
jira-import/
├── importar_jira.py      # Script principal
├── requirements.txt      # Dependencias (requests, python-dotenv)
├── .env-jira             # Credenciales (NO commitear al repo)
└── README_JIRA.md        # Este archivo
```

## Notas importantes

- El script incluye rate limiting (maneja HTTP 429)
- Usa la API v2 de Jira + Agile API para sprints
- `.env-jira` está excluido de git via `.gitignore` (patrón `.env*`)
- Si falla un campo, el script lo omite y continúa con los demás
- Los sprints se crean via Agile API; se necesita un board Scrum en el proyecto
