# Introduction

RBAC Evolution adds roles and permissions to JavaScript and TypeScript apps. You define permissions, group them into roles, assign roles (or individual permissions) to your users, and then ask a simple question anywhere in your code:

```ts
await rbac.for(user).can('edit articles') // true / false
```

It is a port of [spatie/laravel-permission](https://github.com/spatie/laravel-permission) to the JS ecosystem. If you have used that package in Laravel, the concepts and most method names will feel familiar. Huge thanks to [Spatie](https://spatie.be) for the original design.

::: tip Status
RBAC Evolution is stable (1.x). Breaking changes only happen in a new major version. See [Versioning](/guide/versioning).
:::

## Why

Laravel developers have a de-facto standard for roles and permissions. In JavaScript, authorization is usually rebuilt per project, or tied to one ORM or one framework.

RBAC Evolution keeps the logic in one framework-agnostic core and moves the rest into small packages:

- an **adapter** decides where roles and permissions are stored (Prisma, Drizzle, Kysely, Mongoose, memory, or your own),
- an **integration** connects the engine to your framework (Express, Fastify, Hono, NestJS, Next.js, Nuxt, React, Vue).

You install only the pieces you use.

## Features

- Roles and permissions, assigned to any kind of subject (users, API clients, service accounts, ...)
- Permissions granted directly to a subject or inherited through its roles
- [Guards](/basic-usage/multiple-guards) for separate sets of roles and permissions, such as `web` and `api`
- [Teams](/basic-usage/teams) for multi-tenant apps
- [Wildcard permissions](/basic-usage/wildcard-permissions) like `articles.*`
- [Super-admin](/basic-usage/super-admin) roles and a `before` hook, like Laravel's `Gate::before`
- [Typed names](/basic-usage/typed-names): restrict role and permission names with a union type or a TS enum
- Built-in caching with pluggable stores (Redis, KV, ...)
- Events when roles or permissions are created, deleted, attached or detached
- A [CLI](/basic-usage/cli) similar to `php artisan permission:*`
- UI helpers for React and Vue, and route protection for Express, Fastify, Hono, NestJS, Next.js and Nuxt

## Packages

| Package | What it does |
| --- | --- |
| `@anievo-id/rbac-evolution` | The core engine. Includes the in-memory adapter. |
| `@anievo-id/rbac-evolution-prisma` | Storage adapter for Prisma |
| `@anievo-id/rbac-evolution-drizzle` | Storage adapter for Drizzle (PostgreSQL, MySQL and SQLite) |
| `@anievo-id/rbac-evolution-kysely` | Storage adapter for Kysely (PostgreSQL, MySQL, SQLite and SQL Server) |
| `@anievo-id/rbac-evolution-mongoose` | Storage adapter for Mongoose (MongoDB) |
| `@anievo-id/rbac-evolution-next` | Next.js server helpers, server action / route handler guards and middleware |
| `@anievo-id/rbac-evolution-nuxt` | Nuxt module: SSR-hydrated permissions, auto-imported composables, route middleware and Nitro helpers |
| `@anievo-id/rbac-evolution-react` | `<RbacProvider>`, `<Can>`, `<Cannot>`, `<HasRole>`, `useCan()` and other hooks |
| `@anievo-id/rbac-evolution-vue` | `v-can` / `v-role` directives, `<Can>` / `<HasRole>` components and composables |
| `@anievo-id/rbac-evolution-express` | Express middleware: `requirePermission`, `requireRole`, `requireRoleOrPermission` |
| `@anievo-id/rbac-evolution-fastify` | Fastify plugin and `preHandler` guards |
| `@anievo-id/rbac-evolution-hono` | Hono middleware (Node, Bun, Cloudflare Workers and other edge runtimes) |
| `@anievo-id/rbac-evolution-nestjs` | NestJS module, guard and decorators |
| `@anievo-id/rbac-evolution-cli` | Command-line tool to create roles, assign them and inspect the setup |

::: tip
The React and Vue packages only decide what the UI shows. Always enforce permissions on the server as well.
:::

## Next steps

- [Install the packages](/guide/installation)
- [Follow the quick start](/guide/quick-start)
- [Coming from Laravel?](/guide/coming-from-laravel) See how spatie's API maps to RBAC Evolution.
- [How it works](/guide/how-it-works): diagrams of the packages, the checks, the tables and the cache.
- [Use cases](/use-cases/): complete setups for a blog, a multi-tenant SaaS, a shop back office, a public API
  and an internal admin panel.
