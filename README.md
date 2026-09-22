# PrestiCad

Sistema de Préstamos Académicos — gestión integral de préstamos de materiales (equipos, libros y objetos) dentro de una institución educativa: registro de usuarios, inventario, reservas, préstamos, devoluciones, sanciones y reportes.

Documento base del proyecto: `docs/scrum/` (requisitos, backlog, sprint backlog, historias de usuario y tareas) y `docs/Requerimientos.md`.

---

## Arquitectura: Monolito Modular

PrestiCad es un **monolito modular**: un único backend desplegable (un proceso Django) organizado internamente en **módulos independientes**, alineados a los Bounded Contexts del modelo DDD (`docs/diagrams/`), NO en capas técnicas.

Cada módulo es autocontenido:

- Sus propios modelos, migraciones, servicios y endpoints.
- Comunicación con otros módulos únicamente a través de interfaces internas (servicios/contractos), nunca accediendo a tablas de otro módulo.
- Puede evolucionar (o extraerse a un microservicio) sin romper al resto.

**Beneficio:** simplicidad operativa de un monolito (deploy único, transacciones ACID locales) + límites de responsabilidad claros de una arquitectura modular.

### Módulos del dominio

| Módulo | Bounded Context | Responsabilidad |
|--------|-----------------|-----------------|
| `usuarios` | Identidad y Acceso | Registro, roles, autenticación, perfil |
| `inventario` | Bienes y Conservación | Catálogo de materiales y su estado |
| `prestamos` | Ciclo de Préstamo | Reservas, préstamos y garantías |
| `reputacion` | Reputación y Confianza | Puntaje, Tiers y sanciones |

> Los módulos se incorporan como "Django apps" dentro de `backend/apps/` cuando su primera historia entra al sprint. Hoy solo existe `usuarios`.

---

## Stack Tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Backend | Python + Django + Django REST Framework | Python 3.14 · Django + DRF (Django REST Framework) (versiones gestionadas en `backend/requirements.txt`) |
| Base de datos | PostgreSQL | 16 (Docker) |
| Frontend | React + Vite | Node 22 |
| Contenedores | Docker + Docker Compose | — |
| Autenticación | Sesiones Django / passwords hasheados (bcrypt) | — |

---

## Estructura del monorepo

```
Presticad/
├── docs/                # Documentación (requisitos, scrum, DDD)
├── backend/             # Django + DRF (Django REST Framework) - (monolito modular)
│   ├── config/          # Settings, urls, orquestación (sin lógica de negocio)
│   └── apps/            # Módulos del dominio
│       └── usuarios/
├── frontend/            # React + Vite SPA
│   ├── Dockerfile       # Build multi-stage → Nginx (deploy)
│   └── Dockerfile.dev   # Servidor de desarrollo
├── docker-compose.yml   # Stack de desarrollo
└── .env                 # Variables de entorno (no versionar)
```

---

## Setup del equipo

Requisitos: Docker y Docker Compose.

```bash
docker compose up --build
```

Servicios:

- **db** — PostgreSQL en `localhost:5432`.
- **backend** — API en `http://localhost:8000`; ejecuta las migraciones al arrancar.
- **frontend** — SPA en `http://localhost:5173`; proxy `/api` → backend.

Tests:

```bash
docker compose exec backend python manage.py test
```

---

## Convenciones de desarrollo

- **Módulos:** crear una nueva app con `python manage.py startapp <modulo> apps/<modulo>` y registrarla en `INSTALLED_APPS` como `apps.<modulo>`.
- **Configuración:** variables de entorno en `.env` (referencias en `.env.example`).
- **Migraciones:** siempre vía `migrate` (arranque automático en Docker); nunca editar la BD a mano.
- **API:** REST con DRF (Django REST Framework), respuestas JSON, errores descriptivos en español.
- **Estilo:** seguir las convenciones de Django (naming `snake_case`, apps con `models/serializers/services/views` separados).