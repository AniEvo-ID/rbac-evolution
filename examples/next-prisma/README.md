# Example: Next.js + Prisma

A small blog built with the Next.js 15 App Router, Prisma on a SQLite file and rbac-evolution. No external services
and no real auth provider: you "log in" by picking a demo user, which is stored in a cookie.

It shows:

- **`<Can>` / `<Cannot>` / `<HasRole>`** from `@anievo-id/rbac-evolution-react`, fed by a server-side snapshot in
  `app/layout.tsx` — buttons on `/articles` appear or disappear per role.
- **Server actions guarded with `withPermission()` / `withRole()`** (`app/articles/actions.ts`, `app/admin/actions.ts`).
  A "Bypass the UI" button calls an action directly, so you can watch the server refuse it.
- **`/admin` protected twice**: `middleware.ts` (`createRbacMiddleware` on the Node.js runtime, rule
  `{ matcher: '/admin/:path*', role: 'admin' }`) and `requireRole('admin')` in `app/admin/page.tsx`.
- **Route handlers wrapped in `withRbac()`** (`app/api/articles`), answering `401` / `403` JSON.
- **The CLI**: `rbac.config.ts` makes `rbac-evolution show` print the role × permission matrix.

## Run it

From the repository root:

```bash
pnpm install
pnpm turbo run build --filter=rbac-evolution-example-next-prisma^...   # build the rbac-evolution packages it uses
pnpm --filter rbac-evolution-example-next-prisma db:setup              # create prisma/dev.db + seed data
pnpm --filter rbac-evolution-example-next-prisma dev                   # http://localhost:3000
```

`db:setup` runs `prisma db push` and `prisma/seed.ts`. It is safe to re-run; delete `prisma/dev.db` to start over.
Use `PORT=3100 pnpm --filter rbac-evolution-example-next-prisma dev` if port 3000 is taken.

For a production build: `pnpm --filter rbac-evolution-example-next-prisma build` then `... start`.

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
curl -i http://localhost:3000/api/articles                          # 401 UNAUTHENTICATED
curl -i -b demo_user=4 http://localhost:3000/api/articles           # 403 FORBIDDEN (no permission)
curl -i -b demo_user=3 http://localhost:3000/api/articles           # 200
curl -i -b demo_user=2 -X DELETE http://localhost:3000/api/articles/3  # 403 (editors can't delete)
curl -i -b demo_user=1 -X DELETE http://localhost:3000/api/articles/3  # 200
curl -i -b demo_user=2 http://localhost:3000/admin                  # 403 from middleware
curl -b demo_user=2 http://localhost:3000/api/me                    # { user, snapshot }
```

## CLI

```bash
pnpm --filter rbac-evolution-example-next-prisma rbac show
pnpm --filter rbac-evolution-example-next-prisma rbac assign-role editor 4
```

## Files

| File | What it does |
| --- | --- |
| `prisma/schema.prisma` | `User`, `Article` + the five rbac models from `@anievo-id/rbac-evolution-prisma` |
| `lib/rbac-engine.ts` | `createRbac({ adapter: new PrismaAdapter(prisma) })` — no Next.js imports, shared by middleware, seed and CLI |
| `lib/rbac.ts` | `createNextRbac()` with `getSubject()` reading the demo cookie |
| `app/layout.tsx` | `<RbacProvider snapshot={await getSnapshot()}>` |
| `app/articles/*` | `<Can>` in client components, `withPermission()` server actions |
| `app/admin/*` | `requireRole('admin')` page, `withRole('admin')` action to change roles |
| `middleware.ts` | `createRbacMiddleware()` with the `rbac` instance (`runtime: 'nodejs'`) |
| `app/api/*` | `withRbac()` route handlers |
| `rbac.config.ts` | CLI config |

The engine is created with `cache: false`: `middleware.ts` gets its own module instance, so an in-memory cache there
would not notice role changes made from `/admin`. In a real app, use a shared cache store (Redis, KV, ...) instead.
