# API reference

Generated from the TypeScript sources of each package with [TypeDoc](https://typedoc.org/), so it always matches
the published types. One section per package; subpath exports (like `@anievo-id/rbac-evolution/testing`) are
listed on their package's page. For how to use them, start with the [guide](/guide/introduction).

## Core

| Package | Entry points |
| ------- | ------------ |
| [`@anievo-id/rbac-evolution`](/api/core/) | `.`, [`/testing`](/api/core/testing/) |
| [`@anievo-id/rbac-evolution-cli`](/api/cli/) | `.` |

## Frameworks

| Package | Entry points |
| ------- | ------------ |
| [`@anievo-id/rbac-evolution-react`](/api/react/) | `.` |
| [`@anievo-id/rbac-evolution-react-router`](/api/react-router/) | `.` |
| [`@anievo-id/rbac-evolution-next`](/api/next/) | `.`, [`/middleware`](/api/next/middleware/) |
| [`@anievo-id/rbac-evolution-vue`](/api/vue/) | `.` |
| [`@anievo-id/rbac-evolution-nuxt`](/api/nuxt/) | `.`, [`/server`](/api/nuxt/server/), [`/rule`](/api/nuxt/rule/) |
| [`@anievo-id/rbac-evolution-sveltekit`](/api/sveltekit/) | `.`, [`/server`](/api/sveltekit/server/) |
| [`@anievo-id/rbac-evolution-express`](/api/express/) | `.` |
| [`@anievo-id/rbac-evolution-hono`](/api/hono/) | `.` |
| [`@anievo-id/rbac-evolution-fastify`](/api/fastify/) | `.` |
| [`@anievo-id/rbac-evolution-nestjs`](/api/nestjs/) | `.` |
| [`@anievo-id/rbac-evolution-trpc`](/api/trpc/) | `.` |

## Adapters

| Package | Entry points |
| ------- | ------------ |
| [`@anievo-id/rbac-evolution-prisma`](/api/prisma/) | `.` |
| [`@anievo-id/rbac-evolution-drizzle`](/api/drizzle/) | `.`, [`/pg`](/api/drizzle/pg/), [`/sqlite`](/api/drizzle/sqlite/), [`/mysql`](/api/drizzle/mysql/) |
| [`@anievo-id/rbac-evolution-kysely`](/api/kysely/) | `.` |
| [`@anievo-id/rbac-evolution-mongoose`](/api/mongoose/) | `.` |

The memory adapter ships with the core package: [`MemoryAdapter`](/api/core/classes/MemoryAdapter).
