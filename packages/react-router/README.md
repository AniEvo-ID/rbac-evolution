# @anievo-id/rbac-evolution-react-router

[React Router](https://reactrouter.com) 7 and 8 (framework mode) and Remix 2 guards for
[RBAC Evolution](https://github.com/AniEvo-ID/rbac-evolution): permission and role checks in loaders and actions, and
a snapshot for `<RbacProvider>` of `@anievo-id/rbac-evolution-react`.

## Install

```bash
npm i @anievo-id/rbac-evolution @anievo-id/rbac-evolution-react-router @anievo-id/rbac-evolution-react
```

## Usage

```ts
// app/rbac.server.ts
import { createRbac } from '@anievo-id/rbac-evolution'
import { createRbacServer } from '@anievo-id/rbac-evolution-react-router'

export const rbac = createRbac({ adapter })
export const rbacServer = createRbacServer({
  rbac,
  getSubject: async ({ request }) => {
    const user = await getUser(request) // your session
    return user ? { type: 'user', id: user.id } : null
  },
  unauthenticatedRedirect: '/login',
})

// app/routes/admin.tsx
export async function loader(args: Route.LoaderArgs) {
  await rbacServer.requireRole(args, 'admin') // throws a 401/403 Response or a redirect
  return { stats: await getStats() }
}

// app/root.tsx
export async function loader(args: Route.LoaderArgs) {
  return { rbac: await rbacServer.getSnapshot(args) } // for <RbacProvider snapshot>
}
```

- A failed guard throws a standard `Response`: 401 / 403 with the same JSON body as the other integrations (the
  route's `ErrorBoundary` gets it), or a 302 with `unauthenticatedRedirect` / `forbiddenRedirect`.
- No runtime import of React Router, so any React Router 7+ or Remix 2 app works.
- A typed engine (`createRbac<AppRbac>()`) types the names of every guard.

## Documentation

https://creation.anievo.id/rbac-evolution/frameworks/react-router

## License

MIT
