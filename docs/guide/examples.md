# Example apps

Two complete apps live in the [`examples/`](https://github.com/AniEvo-ID/rbac-evolution/tree/main/examples) folder of
the repository. Both use a SQLite file, so they run without any database server, and both use a fake login: you pick a
demo user and it is stored in a cookie. Swap that part for your real authentication.

Each app seeds the same roles and users:

| User | Role | Permissions |
| --- | --- | --- |
| #1 Alice Admin | `admin` | everything, including `manage users` and `delete articles` |
| #2 Eddie Editor | `editor` | `view articles`, `create articles`, `edit articles`, `publish articles` |
| #3 Vera Viewer | `viewer` | `view articles` |
| #4 Nora Nobody | — | nothing |

Because the session is just a `demo_user=<id>` cookie, you can call the APIs as any user with curl:

```bash
curl -i -b demo_user=3 http://localhost:3000/api/articles   # 200
curl -i -b demo_user=4 http://localhost:3000/api/articles   # 403 FORBIDDEN
```

## Next.js + Prisma

[`examples/next-prisma`](https://github.com/AniEvo-ID/rbac-evolution/tree/main/examples/next-prisma) — Next.js 15 App
Router, Prisma on SQLite, [`@anievo-id/rbac-evolution-next`](/frameworks/nextjs) and
[`@anievo-id/rbac-evolution-react`](/frameworks/react).

- `app/layout.tsx` passes `await getSnapshot()` to `<RbacProvider>`; the articles page hides buttons with `<Can>` and
  `<Cannot>`.
- Server actions are wrapped in `withPermission()` and `withRole()`. A "Bypass the UI" button calls an action directly,
  so you can see the server refuse it.
- `/admin` is protected by `middleware.ts` (`createRbacMiddleware` with the `rbac` instance on the Node.js runtime) and
  again by `requireRole('admin')` in the page.
- `app/api/articles` route handlers use `withRbac()` and answer `401` / `403` JSON.
- `rbac.config.ts` lets you run the [CLI](/basic-usage/cli), e.g. `rbac-evolution show`.
- Storage: the [Prisma adapter](/adapters/prisma), with the rbac models copied into `prisma/schema.prisma`.

```bash
pnpm install
pnpm turbo run build --filter=rbac-evolution-example-next-prisma^...
pnpm --filter rbac-evolution-example-next-prisma db:setup
pnpm --filter rbac-evolution-example-next-prisma dev   # http://localhost:3000
```

## Vue 3 + Express

[`examples/vue-express`](https://github.com/AniEvo-ID/rbac-evolution/tree/main/examples/vue-express) — an Express 5 API
with [`@anievo-id/rbac-evolution-express`](/frameworks/express) and Drizzle on SQLite (libsql), plus a Vite + Vue 3 SPA
with [`@anievo-id/rbac-evolution-vue`](/frameworks/vue).

- The API attaches `req.rbac` with `rbacMiddleware()` and guards routes with `requirePermission()` and `requireRole()`.
- Storage: the [Drizzle adapter](/adapters/drizzle) (`sqliteRbacSchema()` + `drizzleSqliteAdapter(db)`). The tables are
  created from the SQL file shipped with the package.
- The SPA loads `{ user, snapshot }` from `GET /api/me` and calls `rbac.setSnapshot(snapshot)`. Templates use
  `v-can`, `v-can.not`, `v-role` and `<Can>` with a `#fallback` slot.
- Routes declare `meta: { permission }` or `meta: { role }`, checked in `router.beforeEach`.
- The `fetch` wrapper sends you to `/login` on `401` and shows the server's message on `403`.

```bash
pnpm install
pnpm turbo run build --filter=rbac-evolution-example-vue-express^...
pnpm --filter rbac-evolution-example-vue-express db:setup
pnpm --filter rbac-evolution-example-vue-express dev   # SPA on http://localhost:5173, API on :4000
```

::: warning UI checks are not security
In both apps, `<Can>`, `v-can` and the router guards only decide what the UI shows. Every action is checked again on
the server — that is what the "Bypass the UI" buttons demonstrate.
:::
