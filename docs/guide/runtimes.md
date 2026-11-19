# Runtimes

RBAC Evolution ships plain JavaScript (ESM and CommonJS) with no runtime-specific code outside the CLI, so it runs anywhere modern JavaScript does.

| Runtime | Status | Tested in CI |
| --- | --- | --- |
| **Node.js** 20, 22+ | ✅ Supported | Every package, plus real PostgreSQL, MySQL and MongoDB |
| **Bun** (latest) | ✅ Supported | Core + adapter conformance suite, Drizzle on `bun:sqlite`, Hono on `Bun.serve`, Elysia, CLI |
| Edge / Workers | ✅ Core, React, Vue and Hono | Hono only uses Web APIs |

## Bun

Install with Bun's package manager — nothing else changes:

::: code-group

```bash [bun]
bun add @anievo-id/rbac-evolution
```

:::

### Bun's built-in SQLite

The Drizzle adapter works with `bun:sqlite` through `drizzle-orm/bun-sqlite`. Create the tables with the shipped SQL (or drizzle-kit, see [Drizzle](/adapters/drizzle)):

```ts
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { createRbac } from '@anievo-id/rbac-evolution'
import { drizzleSqliteAdapter } from '@anievo-id/rbac-evolution-drizzle/sqlite'

const db = drizzle(new Database('app.db'))
export const rbac = createRbac({ adapter: drizzleSqliteAdapter(db) })
```

### Hono on `Bun.serve`

```ts
import { Hono } from 'hono'
import { rbacMiddleware, requirePermission } from '@anievo-id/rbac-evolution-hono'

const app = new Hono()
app.use(rbacMiddleware({ rbac, getSubject: (c) => (c.var.user ? { type: 'user', id: c.var.user.id } : null) }))
app.post('/articles', requirePermission('edit articles'), (c) => c.json({ ok: true }))

Bun.serve({ fetch: app.fetch })
```

See [Hono](/frameworks/hono) for the full guard API. Express, Fastify and NestJS also run on Bun because the frameworks themselves do; Prisma, Kysely and Mongoose support Bun as well.

### CLI

```bash
bunx rbac-evolution show
bunx rbac-evolution sync --dry-run
```

`rbac.config.ts` is loaded the same way as on Node. See [CLI](/basic-usage/cli).

## Request context (who made a change)

[Events](/advanced/events#who-made-the-change-actor) can carry the `actor` that made a change. The core doesn't
import `AsyncLocalStorage` or any other runtime module: you pass `actor` on the write calls, or give
`createRbac({ getActor })` a function that reads your own request context. `AsyncLocalStorage` from
`node:async_hooks` works on Node.js and Bun, and on Cloudflare Workers with the `nodejs_compat` flag. Where your
runtime has none, pass `actor` per call (`rbac.for(user, { actor })`).

## What is tested where

- The regular `ci (20)` / `ci (22)` jobs run every package's test suite on Node.js.
- The `databases` job runs the adapters against real PostgreSQL, MySQL and MongoDB servers.
- The `bun` job builds the packages and runs them under Bun: the core flow, the same [adapter conformance suite](/advanced/testing) every adapter must pass (on the in-memory adapter and on Drizzle + `bun:sqlite`), Hono on a real `Bun.serve` server, and the CLI executed by `bun`.

::: tip Developing the library
Contributors still use Node.js + pnpm in this repository (pnpm workspaces, turbo, vitest, tsup). Bun support is about **using** the packages, not building them.
:::
