# rbac-evolution

> Role & permission management (RBAC) for the JavaScript / TypeScript ecosystem.
> Inspired by [spatie/laravel-permission](https://github.com/spatie/laravel-permission), built for JS.

**Status: 🚧 early development — not ready for production yet.**

## Why

Laravel developers have `spatie/laravel-permission`: assign roles, give permissions, check `can()`, done.
The JS ecosystem has no equivalent that works the same way across ORMs and frameworks.
`rbac-evolution` aims to fill that gap — one framework-agnostic core, with adapters for your database
and integrations for your framework.

## Packages

| Package | Description | Status |
| --- | --- | --- |
| [`@anievo-id/rbac-evolution`](./packages/core) | Framework-agnostic RBAC engine | 🚧 in progress |
| `@anievo-id/rbac-evolution-prisma` | Prisma storage adapter | 📋 planned |
| `@anievo-id/rbac-evolution-drizzle` | Drizzle storage adapter | 📋 planned |
| `@anievo-id/rbac-evolution-next` | Next.js middleware, server helpers & action guards | 📋 planned |
| `@anievo-id/rbac-evolution-react` | `<Can>`, `useCan()`, `useRole()` | 📋 planned |
| `@anievo-id/rbac-evolution-vue` | `v-can` directive & composables | 📋 planned |
| `@anievo-id/rbac-evolution-express` | Express / Node HTTP middleware | 📋 planned |

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
- [ ] Prisma & Drizzle adapters
- [ ] Next.js, React, Vue, Express integrations
- [ ] Documentation site

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) and our
[Code of Conduct](./CODE_OF_CONDUCT.md) first.

## License

[MIT](./LICENSE) © AniEvo-ID
