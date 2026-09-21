# Importar Historias de Usuario a Jira

Script Python para importar las 18 historias de usuario del Sistema de Préstamos Académicos a Jira vía REST API.

## Requisitos

- Python 3.10+
- requests, python-dotenv (`pip install -r requirements.txt`)
- API Token de Jira (https://id.atlassian.com/manage-profile/security/api-tokens)
- Permisos de creación de issues en el proyecto destino

## Configuración

1. Crear un proyecto en Jira (tipo Scrum o Kanban)
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

# Override de proyecto específico
python importar_jira.py --project OTRO_PROYECTO
```

## Qué crea

- **8 Épicos**: Una por cada épica del sistema
- **18 Historias de usuario**: Una por cada HU, con:
  - ID de la historia en el título
  - Narrativa completa (Como... quiero... para que...)
  - Criterios de aceptación detallados
  - Story Points (campo Story point estimate)
  - Prioridad (High/Medium/Low, mapeada desde Alta/Media/Baja)
  - Asociadas a su épica (via `parent` field en Jira Cloud)

## Auto-detección de campos

El script detecta automáticamente al ejecutarse:

- **Issue types**: Story, Epic, Bug, Task, Subtask (según disponibilidad del proyecto)
- **Campos personalizados**: Story Points, Epic Link / Parent
- **Prioridades**: Mapea Alta→High, Media→Medium, Baja→Low
- **Vinculación stories↔épicas**: Usa `parent` field (Jira Cloud moderno) o `Epic Link` (Server/DC)

## Archivos

```
jira-import/
├── importar_jira.py      # Script principal
├── requirements.txt      # Dependencias (requests, python-dotenv)
├── .env-jira             # Credenciales (NO commitear al repo)
└── README.md             # Este archivo
```

## Notas importantes

- El script incluye rate limiting (maneja HTTP 429)
- Usa la API v2 de Jira (compatible con Cloud y Server)
- `.env-jira` está excluido de git via `.gitignore` (patrón `.env*`)
- Si falla un campo, el script lo omite y continúa con los demás
- Las 8 épicas se crean primero, luego las 18 stories vinculadas a cada una
