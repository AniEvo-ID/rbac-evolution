# @anievo-id/rbac-evolution-tanstack-start

[TanStack Start](https://tanstack.com/start) 1.x (React and Solid) guards for
[RBAC Evolution](https://github.com/AniEvo-ID/rbac-evolution): permission and role checks in server functions,
middleware and server routes, and a snapshot for `<RbacProvider>` of `@anievo-id/rbac-evolution-react`.

## Install

```bash
npm i @anievo-id/rbac-evolution @anievo-id/rbac-evolution-tanstack-start @anievo-id/rbac-evolution-react
```

## Usage

```ts
// src/rbac.ts
import { createRbac } from '@anievo-id/rbac-evolution'
import { createRbacServer } from '@anievo-id/rbac-evolution-tanstack-start'

export const rbac = createRbac({ adapter })
export const rbacServer = createRbacServer({
  rbac,
  getSubject: async (request) => {
    const user = await getUser(request) // your session
    return user ? { type: 'user', id: user.id } : null
  },
})

// src/server/stats.ts
export const getStats = createServerFn().handler(async () => {
  await rbacServer.requireRole(getRequest(), 'admin') // throws a 401/403 Response
  return loadStats()
})
```

- A failed guard throws a standard `Response`: 401 / 403 with the same JSON body as the other integrations, or what
  `onUnauthenticated` / `onForbidden` return, such as TanStack Router's `redirect({ to: '/login' })`.
- The same guards work in `createMiddleware().server()` and in server route handlers.
- No runtime import of TanStack.
- A typed engine (`createRbac<AppRbac>()`) types the names of every guard.

## Documentation

https://creation.anievo.id/rbac-evolution/frameworks/tanstack-start

## License

MIT
