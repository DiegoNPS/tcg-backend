# TCG Backend

API de TCG Hub. Solo expone endpoints; el frontend va en otro repositorio (`tcg-frontend`).

## Stack

- Next.js 16 (App Router, route handlers)
- TypeScript
- Supabase (PostgreSQL, Auth, Storage)
- Zod

## Requisitos

- Node.js 20+
- npm
- Proyecto de Supabase con las migraciones aplicadas

## Instalación

```bash
npm install
```

Copiar `.env.example` a `.env.local` y completar:

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon-key>
SUPABASE_SERVICE_ROLE=<service-role-key>
FRONTEND_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Comandos

```bash
npm run dev        # localhost:3001
npm run build
npm run start
npm run lint
npm run typecheck
npm test           # unitarias, integración y mocks
npm run test:load  # requiere k6 y backend levantado
npm run test:stress
```

El alcance, los casos y los criterios de aprobación están en
[`docs/PLAN_DE_PRUEBAS.md`](docs/PLAN_DE_PRUEBAS.md). Los últimos resultados
verificados se registran en [`docs/REPORTE_DE_EJECUCION.md`](docs/REPORTE_DE_EJECUCION.md).

## Endpoints

- `GET    /api/auth/me`, `PUT /api/auth/me`
- `POST   /api/auth/login`, `/api/auth/register`, `/api/auth/logout`
- `POST   /api/auth/password-change`, `/api/auth/password-reset`, `/api/auth/password-reset/confirm`
- `GET    /api/torneos`, `/api/torneos/:id`
- `POST   /api/torneos/crear`, `PUT /api/torneos/:id/editar`
- `POST   /api/tiendas`
- `GET    /api/tiendas/me`, `/api/tiendas/me/torneos`, `/api/tiendas/me/torneos/:id`
- `POST   /api/inscripciones`, `PATCH /api/inscripciones`, `GET /api/inscripciones/me`
- `GET    /api/lookups/juegos`, `/api/lookups/categorias`, `/api/lookups/ciudades`
- `GET    /api/admin/dashboard`
- `POST   /api/admin/roles`, `/api/admin/users`, `/api/admin/juegos`

## CORS

El backend solo acepta requests del origen `FRONTEND_URL`.

## Base de datos

Migraciones en `supabase/migrations/`. Tablas: `profiles`, `tiendas`, `torneos`, `tournament_entries`, `equipos`, `equipo_miembros`, `juegos`, `categorias_torneo`, `ciudades`.
