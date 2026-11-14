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
| [`@rbac-evolution/core`](./packages/core) | Framework-agnostic RBAC engine | 🚧 in progress |
| `@rbac-evolution/prisma` | Prisma storage adapter | 📋 planned |
| `@rbac-evolution/drizzle` | Drizzle storage adapter | 📋 planned |
| `@rbac-evolution/next` | Next.js middleware, server helpers & action guards | 📋 planned |
| `@rbac-evolution/react` | `<Can>`, `useCan()`, `useRole()` | 📋 planned |
| `@rbac-evolution/vue` | `v-can` directive & composables | 📋 planned |
| `@rbac-evolution/express` | Express / Node HTTP middleware | 📋 planned |

Install only what you need — e.g. for a Next.js + Prisma app:

```bash
npm i @rbac-evolution/core @rbac-evolution/prisma @rbac-evolution/next @rbac-evolution/react
```

## Planned API (preview)

```ts
await user.assignRole('writer')
await role.givePermissionTo('edit articles')

await user.hasRole('writer')               // true
await user.hasPermissionTo('edit articles') // true
await user.can('articles.*')                // wildcard support
```

> ⚠️ Client-side checks (React/Vue) are for UI only. Always enforce permissions on the server.

## Roadmap

- [ ] Core: roles, permissions, direct user permissions
- [ ] Guards (`web`, `api`, …)
- [ ] Wildcard permissions
- [ ] Caching layer
- [ ] Teams / multi-tenancy
- [ ] Prisma & Drizzle adapters
- [ ] Next.js, React, Vue, Express integrations
- [ ] Documentation site

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) and our
[Code of Conduct](./CODE_OF_CONDUCT.md) first.

## License

[MIT](./LICENSE) © AniEvo-ID
