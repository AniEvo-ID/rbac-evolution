# Introduction

RBAC Evolution adds roles and permissions to JavaScript and TypeScript apps. You define permissions, group them into roles, assign roles (or individual permissions) to your users, and then ask a simple question anywhere in your code:

```ts
await rbac.for(user).can('edit articles') // true / false
```

It is a port of [spatie/laravel-permission](https://github.com/spatie/laravel-permission) to the JS ecosystem. If you have used that package in Laravel, the concepts and most method names will feel familiar. Huge thanks to [Spatie](https://spatie.be) for the original design.

::: warning Status
RBAC Evolution is at version **0.2.0** and in early development. The API may still change before 1.0.
:::

## Why

Laravel developers have a de-facto standard for roles and permissions. In JavaScript, authorization is usually rebuilt per project, or tied to one ORM or one framework.

RBAC Evolution keeps the logic in one framework-agnostic core and moves the rest into small packages:

- an **adapter** decides where roles and permissions are stored (Prisma, Drizzle, memory, or your own),
- an **integration** connects the engine to your framework (Next.js, Express, React, Vue).

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
- UI helpers for React and Vue, and route protection for Next.js and Express

## Packages

| Package | What it does |
| --- | --- |
| `@anievo-id/rbac-evolution` | The core engine. Includes the in-memory adapter. |
| `@anievo-id/rbac-evolution-prisma` | Storage adapter for Prisma |
| `@anievo-id/rbac-evolution-drizzle` | Storage adapter for Drizzle (PostgreSQL and SQLite) |
| `@anievo-id/rbac-evolution-next` | Next.js server helpers, server action / route handler guards and middleware |
| `@anievo-id/rbac-evolution-react` | `<RbacProvider>`, `<Can>`, `<Cannot>`, `<HasRole>`, `useCan()` and other hooks |
| `@anievo-id/rbac-evolution-vue` | `v-can` / `v-role` directives, `<Can>` / `<HasRole>` components and composables |
| `@anievo-id/rbac-evolution-express` | Express middleware: `requirePermission`, `requireRole`, `requireRoleOrPermission` |
| `@anievo-id/rbac-evolution-cli` | Command-line tool to create roles, assign them and inspect the setup |

::: tip
The React and Vue packages only decide what the UI shows. Always enforce permissions on the server as well.
:::

## Next steps

- [Install the packages](/guide/installation)
- [Follow the quick start](/guide/quick-start)
- [Coming from Laravel?](/guide/coming-from-laravel) See how spatie's API maps to RBAC Evolution.
- [How it works](/guide/how-it-works): diagrams of the packages, the checks, the tables and the cache.
