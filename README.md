# rbac-evolution

> Role & permission management (RBAC) for the JavaScript / TypeScript ecosystem.
> Inspired by [spatie/laravel-permission](https://github.com/spatie/laravel-permission), built for JS.

**Status: 🧪 beta — the API may still change before 1.0.**

## Why

Laravel developers have `spatie/laravel-permission`: assign roles, give permissions, check `can()`, done.
The JS ecosystem has no equivalent that works the same way across ORMs and frameworks.
`rbac-evolution` aims to fill that gap — one framework-agnostic core, with adapters for your database
and integrations for your framework.

## Documentation

📖 **https://anievo-id.github.io/rbac-evolution/**

## Packages

| Package | Description | Status |
| --- | --- | --- |
| [`@anievo-id/rbac-evolution`](./packages/core) | Framework-agnostic RBAC engine | 🧪 beta |
| [`@anievo-id/rbac-evolution-prisma`](./packages/prisma) | Prisma storage adapter | 🧪 beta |
| [`@anievo-id/rbac-evolution-drizzle`](./packages/drizzle) | Drizzle storage adapter | 🧪 beta |
| [`@anievo-id/rbac-evolution-kysely`](./packages/kysely) | Kysely adapter (PostgreSQL, MySQL, SQLite, SQL Server) | 🧪 beta |
| [`@anievo-id/rbac-evolution-mongoose`](./packages/mongoose) | Mongoose adapter (MongoDB) | 🧪 beta |
| [`@anievo-id/rbac-evolution-next`](./packages/next) | Next.js middleware, server helpers & action guards | 🧪 beta |
| [`@anievo-id/rbac-evolution-react`](./packages/react) | `<Can>`, `useCan()`, `useHasRole()` | 🧪 beta |
| [`@anievo-id/rbac-evolution-vue`](./packages/vue) | `v-can` directive & composables | 🧪 beta |
| [`@anievo-id/rbac-evolution-express`](./packages/express) | Express / Node HTTP middleware | 🧪 beta |
| [`@anievo-id/rbac-evolution-hono`](./packages/hono) | Hono middleware (Node, Bun, Workers, Edge) | 🧪 beta |
| [`@anievo-id/rbac-evolution-fastify`](./packages/fastify) | Fastify plugin & preHandler guards | 🧪 beta |
| [`@anievo-id/rbac-evolution-nestjs`](./packages/nestjs) | NestJS module, guard & decorators | 🧪 beta |
| [`@anievo-id/rbac-evolution-nuxt`](./packages/nuxt) | Nuxt module (SSR snapshot, page rules, Nitro helpers) | 🧪 beta |
| [`@anievo-id/rbac-evolution-cli`](./packages/cli) | CLI like `php artisan permission:*` | 🧪 beta |

Install only what you need — e.g. for a Next.js + Prisma app:

```bash
npm i @anievo-id/rbac-evolution @anievo-id/rbac-evolution-prisma @anievo-id/rbac-evolution-next @anievo-id/rbac-evolution-react
```

## Quick start

```ts
import { createRbac, MemoryAdapter } from '@anievo-id/rbac-evolution'

const rbac = createRbac({ adapter: new MemoryAdapter() })

await rbac.createPermission('edit articles')
await rbac.createRole('writer')
await rbac.role('writer').givePermissionTo('edit articles')

const user = rbac.for({ type: 'user', id: 1 })
await user.assignRole('writer')

await user.hasRole('writer')               // true
await user.hasPermissionTo('edit articles') // true
```

See the [core package README](./packages/core#readme) for guards, wildcards, teams and caching.

> ⚠️ Client-side checks (React/Vue) are for UI only. Always enforce permissions on the server.

## Roadmap

- [x] Core: roles, permissions, direct user permissions
- [x] Guards (`web`, `api`, …)
- [x] Wildcard permissions
- [x] Caching layer
- [x] Teams / multi-tenancy
- [x] In-memory adapter
- [x] Prisma & Drizzle adapters
- [x] Super-admin, events, typed names (enums)
- [x] Next.js, React, Vue, Express integrations
- [x] CLI (like `php artisan permission:*`)
- [ ] MySQL support for Drizzle
- [x] Documentation site

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) and our
[Code of Conduct](./CODE_OF_CONDUCT.md) first.

## License

[MIT](./LICENSE) © AniEvo-ID
