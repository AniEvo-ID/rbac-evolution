# Example: Vue 3 + Express

An Express 5 API using `@anievo-id/rbac-evolution-express` and Drizzle on a SQLite file (libsql), plus a Vite + Vue 3
SPA using `@anievo-id/rbac-evolution-vue`. No external services and no real auth provider: you "log in" by picking a
demo user, which the API stores in a cookie.

It shows:

- **Express**: `rbacMiddleware()` attaches `req.rbac`; routes are guarded with `requirePermission()` /
  `requireRole()` and answer `401 UNAUTHENTICATED` / `403 FORBIDDEN` JSON (`server/app.ts`).
- **Drizzle**: `sqliteRbacSchema()` tables and `drizzleSqliteAdapter(db)`; the tables are created from the SQL file
  shipped with `@anievo-id/rbac-evolution-drizzle` (`server/seed.ts`).
- **Vue**: the snapshot comes from `GET /api/me` and is passed to `createRbacPlugin().setSnapshot()`
  (`src/session.ts`); the UI uses `v-can`, `v-can.not`, `v-role` and `<Can>` with a `#fallback` slot.
- **Guarded routes**: `meta: { permission }` / `meta: { role }` checked in `router.beforeEach` (`src/router.ts`).
- **401/403 handling**: `src/api.ts` sends you to `/login` on 401 and surfaces the server's 403 message. A
  "Bypass the UI" button calls `DELETE /api/articles/:id` directly so you can see the API refuse it.

## Run it

From the repository root:

```bash
pnpm install
pnpm turbo run build --filter=rbac-evolution-example-vue-express^...   # build the rbac-evolution packages it uses
pnpm --filter rbac-evolution-example-vue-express db:setup              # create data/app.db + seed data
pnpm --filter rbac-evolution-example-vue-express dev                   # SPA on http://localhost:5173, API on :4000
```

`db:setup` is safe to re-run; delete `data/app.db` to start over. The API port can be changed with `API_PORT=4100`
(Vite's proxy follows it).

Production build — one Express server serving the API and the built SPA:

```bash
pnpm --filter rbac-evolution-example-vue-express build
pnpm --filter rbac-evolution-example-vue-express start   # http://localhost:4000
```

## Demo users

| User | Role | Permissions |
| --- | --- | --- |
| #1 Alice Admin | `admin` | everything, including `manage users` and `delete articles` |
| #2 Eddie Editor | `editor` | `view`, `create`, `edit`, `publish articles` |
| #3 Vera Viewer | `viewer` | `view articles` |
| #4 Nora Nobody | — | nothing |

## Try the API

The session cookie is `demo_user=<id>`, so curl can act as any demo user:

```bash
curl -i http://localhost:4000/api/articles                               # 401 UNAUTHENTICATED
curl -i -b demo_user=4 http://localhost:4000/api/articles                # 403 FORBIDDEN (no permission)
curl -i -b demo_user=3 http://localhost:4000/api/articles                # 200
curl -i -b demo_user=3 -H 'content-type: application/json' -d '{"title":"Hi"}' http://localhost:4000/api/articles  # 403
curl -i -b demo_user=2 -H 'content-type: application/json' -d '{"title":"Hi"}' http://localhost:4000/api/articles  # 201
curl -i -b demo_user=2 http://localhost:4000/api/admin/users             # 403 (reason: role)
curl -b demo_user=2 http://localhost:4000/api/me                         # { user, snapshot }
```

## Files

| File | What it does |
| --- | --- |
| `server/schema.ts` | `users`, `articles` + `sqliteRbacSchema()` |
| `server/rbac.ts` | `createRbac({ adapter: drizzleSqliteAdapter(db) })`, role and permission names |
| `server/app.ts` | demo-cookie auth, `rbacMiddleware()`, guarded routes, serves `dist/client` after a build |
| `server/seed.ts` | creates the tables and seeds users, roles, permissions and articles |
| `src/session.ts` | `createRbacPlugin()` + `refreshSession()` (GET `/api/me` → `setSnapshot`) |
| `src/router.ts` | `beforeEach` guard using `rbac.can()` / `rbac.hasRole()` |
| `src/api.ts` | `fetch` wrapper with 401/403 handling |
| `src/views/*` | `v-can`, `v-role`, `<Can>` in templates |
