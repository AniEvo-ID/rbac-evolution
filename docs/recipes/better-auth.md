# Better Auth

[Better Auth](https://www.better-auth.com) tells you who is signed in. `@anievo-id/rbac-evolution-better-auth`
connects it to RBAC Evolution: the signed-in user becomes the subject `{ type: 'user', id }`, the client can fetch
the user's roles and permissions, new users can get default roles, and a deleted user loses their roles.

::: info Better Auth's own access control
Better Auth's `admin` and `organization` plugins store one role name on the user or member. RBAC Evolution adds what
spatie/laravel-permission has on top: several roles per user, permissions attached to roles and to users, wildcards,
teams, guards and expiry. Use either, or both: this plugin doesn't read or change Better Auth's `role` field.
:::

## Install

::: code-group

```bash [npm]
npm i @anievo-id/rbac-evolution @anievo-id/rbac-evolution-better-auth
```

```bash [pnpm]
pnpm add @anievo-id/rbac-evolution @anievo-id/rbac-evolution-better-auth
```

```bash [yarn]
yarn add @anievo-id/rbac-evolution @anievo-id/rbac-evolution-better-auth
```

:::

`better-auth` 1.4+ is a peer dependency. Store the roles with any [adapter](/adapters/overview): the rbac tables live
next to Better Auth's, and the plugin adds no columns to them.

## 1. Add the server plugin

```ts
// src/auth.ts
import { betterAuth } from 'better-auth'
import { rbacPlugin } from '@anievo-id/rbac-evolution-better-auth'
import { rbac } from './rbac'

export const auth = betterAuth({
  database,
  emailAndPassword: { enabled: true },
  plugins: [rbacPlugin({ rbac, defaultRoles: ['member'] })],
})
```

| Option | Default | Description |
| --- | --- | --- |
| `rbac` | | The engine from `createRbac()`. |
| `defaultRoles` | `[]` | Roles every new user gets when Better Auth creates them: sign-up, first social sign-in, or the admin plugin. |
| `revokeOnDelete` | `true` | After Better Auth deletes a user, remove their roles and direct permissions in every team. |
| `subjectType` | `'user'` | The subject type of a Better Auth user. |
| `guard` | the engine's `defaultGuard` | The guard of the snapshot and of `defaultRoles`. |

The roles in `defaultRoles` must exist; create them in your [seed](/advanced/seeding).

## 2. Check permissions on the server

`subjectFromSession(auth, headers)` turns a request's session into a subject, or `null` for a guest. Use it as the
`getSubject` of your framework's integration:

```ts
// src/rbac-server.ts (TanStack Start)
import { createRbacServer } from '@anievo-id/rbac-evolution-tanstack-start'
import { subjectFromSession } from '@anievo-id/rbac-evolution-better-auth'
import { auth } from './auth'
import { rbac } from './rbac'

export const rbacServer = createRbacServer({
  rbac,
  getSubject: (request) => subjectFromSession(auth, request.headers),
})
```

```ts
// Express
import { fromNodeHeaders } from 'better-auth/node'
import { rbacMiddleware } from '@anievo-id/rbac-evolution-express'
import { subjectFromSession } from '@anievo-id/rbac-evolution-better-auth'

app.use(rbacMiddleware({ rbac, getSubject: (req) => subjectFromSession(auth, fromNodeHeaders(req.headers)) }))
```

The same function works for Hono (`c.req.raw.headers`), Next.js (`await headers()`), SvelteKit (`event.request.headers`),
Astro (`context.request.headers`) and the others.

## 3. Show and hide UI

Add the client plugin. `authClient.rbac.snapshot()` fetches the signed-in user's snapshot from
`GET /api/auth/rbac/snapshot` (401 for guests):

```ts
// src/auth-client.ts
import { createAuthClient } from 'better-auth/react'
import { rbacClient } from '@anievo-id/rbac-evolution-better-auth/client'

export const authClient = createAuthClient({ plugins: [rbacClient()] })
```

<!-- doc-test: skip -->
```tsx
// React
import { RbacProvider } from '@anievo-id/rbac-evolution-react'

const { data: snapshot, isPending } = useQuery({
  queryKey: ['rbac'],
  queryFn: async () => (await authClient.rbac.snapshot()).data ?? null,
})

<RbacProvider snapshot={snapshot} loading={isPending}>
  <App />
</RbacProvider>
```

Refetch the snapshot after a role change, or after signing in and out. It works the same with the
[Vue](/frameworks/vue), [Solid](/frameworks/solid) and [SvelteKit](/frameworks/sveltekit) providers.

## Notes

- **Ids.** Better Auth user ids are strings, and so are the subject ids: `{ type: 'user', id: session.user.id }`.
- **Default roles and transactions.** `defaultRoles` are assigned right after Better Auth creates the user, in a
  separate step. If the role assignment fails, the user still exists without the role.
- **Teams.** With `createRbac({ teams: true })`, pass the team to the checks, for example the active organization of
  Better Auth's organization plugin: `rbac.for(subject, { team: session.session.activeOrganizationId })`.
