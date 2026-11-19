# Installation

RBAC Evolution is split into a core package plus optional adapters and framework integrations. Install the core, then add what your stack needs.

::: info Requirements
Node.js **20 or later**. The core ships both ESM and CommonJS builds with TypeScript types.
:::

## 1. Install the core

::: code-group

```bash [npm]
npm i @anievo-id/rbac-evolution
```

```bash [pnpm]
pnpm add @anievo-id/rbac-evolution
```

```bash [yarn]
yarn add @anievo-id/rbac-evolution
```

```bash [bun]
bun add @anievo-id/rbac-evolution
```

:::

The core already contains `MemoryAdapter`, which is enough for tests, prototypes and the [quick start](/guide/quick-start).

## 2. Pick a storage adapter

For real data, install the adapter for your ORM.

| ORM | Package | Peer dependency |
| --- | --- | --- |
| Prisma | `@anievo-id/rbac-evolution-prisma` | `@prisma/client` 5.12+, 6 or 7 |
| Drizzle | `@anievo-id/rbac-evolution-drizzle` | `drizzle-orm` 0.38+ (PostgreSQL or SQLite) |

::: code-group

```bash [npm]
npm i @anievo-id/rbac-evolution-prisma
# or
npm i @anievo-id/rbac-evolution-drizzle
```

```bash [pnpm]
pnpm add @anievo-id/rbac-evolution-prisma
# or
pnpm add @anievo-id/rbac-evolution-drizzle
```

```bash [yarn]
yarn add @anievo-id/rbac-evolution-prisma
# or
yarn add @anievo-id/rbac-evolution-drizzle
```

```bash [bun]
bun add @anievo-id/rbac-evolution-prisma
# or
bun add @anievo-id/rbac-evolution-drizzle
```

:::

Each adapter needs a few tables. See [Prisma](/adapters/prisma) or [Drizzle](/adapters/drizzle) for the schema, or [write your own adapter](/adapters/custom) for another database.

## 3. Pick framework integrations

All integrations are optional.

| Framework | Package | Peer dependency |
| --- | --- | --- |
| Next.js | `@anievo-id/rbac-evolution-next` | `next` 14+, `react` 18+ |
| React | `@anievo-id/rbac-evolution-react` | `react` 18+ |
| Vue | `@anievo-id/rbac-evolution-vue` | `vue` 3.3+ |
| SvelteKit | `@anievo-id/rbac-evolution-sveltekit` | `@sveltejs/kit` 2+, `svelte` 5+ |
| TanStack Start | `@anievo-id/rbac-evolution-tanstack-start` | `@tanstack/react-start` or `@tanstack/solid-start` 1.x |
| Express | `@anievo-id/rbac-evolution-express` | `express` 4+ |
| Elysia | `@anievo-id/rbac-evolution-elysia` | `elysia` 1.2+ |
| tRPC | `@anievo-id/rbac-evolution-trpc` | `@trpc/server` 11+ |

For example, a Next.js app using Prisma:

::: code-group

```bash [npm]
npm i @anievo-id/rbac-evolution @anievo-id/rbac-evolution-prisma @anievo-id/rbac-evolution-next @anievo-id/rbac-evolution-react
```

```bash [pnpm]
pnpm add @anievo-id/rbac-evolution @anievo-id/rbac-evolution-prisma @anievo-id/rbac-evolution-next @anievo-id/rbac-evolution-react
```

```bash [yarn]
yarn add @anievo-id/rbac-evolution @anievo-id/rbac-evolution-prisma @anievo-id/rbac-evolution-next @anievo-id/rbac-evolution-react
```

```bash [bun]
bun add @anievo-id/rbac-evolution @anievo-id/rbac-evolution-prisma @anievo-id/rbac-evolution-next @anievo-id/rbac-evolution-react
```

:::

## 4. The CLI (optional)

The CLI is a dev tool, so install it as a dev dependency:

::: code-group

```bash [npm]
npm i -D @anievo-id/rbac-evolution-cli
```

```bash [pnpm]
pnpm add -D @anievo-id/rbac-evolution-cli
```

```bash [yarn]
yarn add -D @anievo-id/rbac-evolution-cli
```

```bash [bun]
bun add -d @anievo-id/rbac-evolution-cli
```

:::

See [CLI](/basic-usage/cli) for setup.

## Create one instance

Create the engine once and import it wherever you need it:

```ts
// lib/rbac.ts
import { createRbac } from '@anievo-id/rbac-evolution'
import { PrismaAdapter } from '@anievo-id/rbac-evolution-prisma'
import { prisma } from './prisma'

export const rbac = createRbac({ adapter: new PrismaAdapter(prisma) })
```

`createRbac` accepts these options:

| Option | Default | Description |
| --- | --- | --- |
| `adapter` | required | Where data is stored |
| `defaultGuard` | `'web'` | Guard used when none is given. See [Multiple guards](/basic-usage/multiple-guards). |
| `wildcard` | `false` | Enable [wildcard permissions](/basic-usage/wildcard-permissions) |
| `teams` | `false` | Enable [teams](/basic-usage/teams) |
| `cache` | in-memory | A `CacheStore`, or `false` to disable caching |
| `cacheTtl` | 24 hours | Cache TTL in milliseconds |
| `before` | none | Hook that runs before `can()` checks. See [Super-admin](/basic-usage/super-admin). |
| `superAdminRoles` | `[]` | Roles that pass every `can()` check |
