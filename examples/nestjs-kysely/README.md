# Example: NestJS + Kysely

A NestJS 12 API using `@anievo-id/rbac-evolution-nestjs` and the Kysely adapter on a SQLite file (libsql). API only, no
UI and no real auth provider: the session is a `demo_user=<id>` cookie, set by `POST /api/login`.

It shows:

- **NestJS**: `RbacModule.forRoot({ rbac, getSubject, globalGuard: true })` registers `RbacGuard` on every route
  (`src/app.module.ts`). Routes without a decorator stay public. Guests get `401 UNAUTHENTICATED`, users without access
  `403 FORBIDDEN` with a `reason` (`src/articles.controller.ts`, `src/users.controller.ts`):
  - `@RequirePermissions('view articles')` on a handler
  - `@RequireRoleOrPermission('admin|publish articles')`: a role OR a permission
  - `@RequireRoles('admin')` on a whole controller
  - `@CurrentRbac()` to check more in the handler (viewers only see published articles)
- **Typed names**: the decorators come from `createRbacDecorators<AppRbac>()` (`src/rbac.ts`), so a misspelt role or
  permission is a compile error.
- **Kysely**: one `Kysely` instance for the app tables and for `kyselyAdapter(db)`; the rbac tables are created with
  `createRbacTables(db)` (`src/seed.ts`).
- **No `emitDecoratorMetadata`**: the app builds with tsup (esbuild) and runs with tsx.

## Run it

From the repository root:

```bash
pnpm install
pnpm turbo run build --filter=rbac-evolution-example-nestjs-kysely^...   # build the rbac-evolution packages it uses
pnpm --filter rbac-evolution-example-nestjs-kysely db:setup              # create data/app.db + seed data
pnpm --filter rbac-evolution-example-nestjs-kysely dev                   # http://localhost:4200
```

`db:setup` is safe to re-run; delete `data/app.db` to start over (or set `DB_FILE`). `PORT` changes the port.

Production build:

```bash
pnpm --filter rbac-evolution-example-nestjs-kysely build
pnpm --filter rbac-evolution-example-nestjs-kysely start
```

## Demo users

| User | Role | Permissions |
| --- | --- | --- |
| #1 Alice Admin | `admin` | everything, including `manage users` and `delete articles` |
| #2 Eddie Editor | `editor` | `view articles`, `create articles`, `edit articles`, `publish articles` |
| #3 Vera Viewer | `viewer` | `view articles` |
| #4 Nora Nobody | — | nothing |

```bash
curl -i http://localhost:4200/api/articles                                   # 401 UNAUTHENTICATED
curl -i -b demo_user=4 http://localhost:4200/api/articles                    # 403 FORBIDDEN, reason: permission
curl -i -b demo_user=3 http://localhost:4200/api/articles                    # 200, published articles only
curl -i -b demo_user=3 -X POST http://localhost:4200/api/articles/3/publish  # 403, reason: role_or_permission
curl -i -b demo_user=2 -X POST http://localhost:4200/api/articles/3/publish  # 200
curl -i -b demo_user=2 http://localhost:4200/api/admin/users                 # 403, reason: role
```

| Route | Guard |
| --- | --- |
| `GET /api/users`, `POST /api/login`, `POST /api/logout`, `GET /api/me` | public |
| `GET /api/articles` | `view articles` |
| `POST /api/articles` | `create articles` |
| `POST /api/articles/:id/publish` | role `admin` or permission `publish articles` |
| `DELETE /api/articles/:id` | `delete articles` |
| `GET /api/admin/users`, `PUT /api/admin/users/:id/role` | role `admin` |

The [E2E tests](../../tests/e2e/specs/nestjs-kysely.spec.ts) run against the production build.
