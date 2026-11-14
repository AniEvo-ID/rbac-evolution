# React

`@anievo-id/rbac-evolution-react` lets React components ask "can the current user do this?" without a network
request. The server sends a small snapshot of the user's roles and permissions; a provider puts it in context;
hooks and components read it synchronously.

::: warning UI only
Everything in this package runs in the browser. It decides what the UI **shows**, not what the user is
**allowed** to do: anyone can change client-side state. Always enforce authorization on the server too — with
[`@anievo-id/rbac-evolution-next`](/frameworks/nextjs), [`@anievo-id/rbac-evolution-express`](/frameworks/express)
or the core `rbac.for(user).can()`. See [Security](/best-practices/security).
:::

## Installation

::: code-group

```bash [npm]
npm i @anievo-id/rbac-evolution @anievo-id/rbac-evolution-react
```

```bash [pnpm]
pnpm add @anievo-id/rbac-evolution @anievo-id/rbac-evolution-react
```

```bash [yarn]
yarn add @anievo-id/rbac-evolution @anievo-id/rbac-evolution-react
```

:::

Requires React 18 or newer.

## How it works

1. **Server:** build a snapshot for the signed-in user with `await rbac.for(user).snapshot()`. It is a plain,
   serializable object:

   ```ts
   interface RbacSnapshot {
     roles: string[]
     permissions: string[] // direct + via roles
   }
   ```

2. **Client:** pass it to `<RbacProvider snapshot={...}>` near the root of your tree.
3. **Anywhere below:** call `useCan()`, render `<Can>`, and so on. Checks are synchronous — no loading states.

## Setting up the provider

Any React app can fetch the snapshot from an endpoint of yours and hand it to the provider. `null` (or
`undefined`) means "guest": every check fails.

```ts
// server: e.g. an Express route
app.get('/api/me/permissions', async (req, res) => {
  res.json(req.rbac ? await req.rbac.snapshot() : null)
})
```

```tsx
// client
import { useEffect, useState } from 'react'
import { RbacProvider } from '@anievo-id/rbac-evolution-react'
import type { RbacSnapshot } from '@anievo-id/rbac-evolution'

export function Root() {
  const [snapshot, setSnapshot] = useState<RbacSnapshot | null>(null)

  useEffect(() => {
    fetch('/api/me/permissions')
      .then((r) => r.json())
      .then(setSnapshot)
  }, [])

  return (
    <RbacProvider snapshot={snapshot} wildcard>
      <App />
    </RbacProvider>
  )
}
```

### Provider props

| Prop              | Type                          | Description                                                                             |
| ----------------- | ----------------------------- | --------------------------------------------------------------------------------------- |
| `snapshot`        | `RbacSnapshot \| null \| undefined` | Roles & permissions of the current user. `null` / `undefined` = guest.            |
| `wildcard`        | `boolean`                     | Treat granted permissions as wildcard patterns (`articles.*`). Default `false`.         |
| `superAdminRoles` | `string[]`                    | Users with any of these roles pass every **permission** check.                          |
| `children`        | `ReactNode`                   |                                                                                         |

Providers can be nested; components use the nearest one.

## Hooks

All hooks read from the nearest `<RbacProvider>` and **throw** if there is none.

| Hook                          | Returns `true` when the user…                          |
| ----------------------------- | ------------------------------------------------------ |
| `useCan(permission)`          | has the permission                                     |
| `useCannot(permission)`       | does not have the permission                           |
| `useCanAny(...permissions)`   | has **any** of the permissions                         |
| `useCanAll(...permissions)`   | has **all** of the permissions                         |
| `useHasRole(role \| roles[])` | has the role — or **any** of the roles for an array    |
| `useHasAnyRole(...roles)`     | has **any** of the roles                               |
| `useHasAllRoles(...roles)`    | has **all** of the roles                               |
| `useRbac()`                   | — returns the underlying checker object                |

The list hooks accept varargs, arrays, or a mix: `useCanAny('a', 'b')` and `useCanAny(['a', 'b'])` are the same.

```tsx
import { useCan, useCanAny, useHasRole } from '@anievo-id/rbac-evolution-react'

export function ArticleToolbar() {
  const canPublish = useCan('articles.publish')
  const canModerate = useCanAny('articles.delete', 'articles.archive')
  const isEditor = useHasRole(['editor', 'admin'])

  return (
    <div>
      <button disabled={!canPublish}>Publish</button>
      {canModerate && <button>Moderate</button>}
      {isEditor && <span className="badge">Editor</span>}
    </div>
  )
}
```

`useRbac()` returns the full checker: `can`, `cannot`, `canAny`, `canAll`, `hasRole`, `hasAnyRole`, `hasAllRoles`,
plus `roles`, `permissions` and `isSuperAdmin`. It is handy when you need several checks in a loop:

```tsx
const rbac = useRbac()
const visibleItems = menu.filter((item) => !item.permission || rbac.can(item.permission))
```

## Components

`<Can>`, `<Cannot>` and `<HasRole>` render their children when the check passes and an optional `fallback`
when it does not.

```tsx
import { Can, Cannot, HasRole } from '@anievo-id/rbac-evolution-react'

export function ArticleActions() {
  return (
    <>
      <Can permission="articles.edit">
        <button>Edit</button>
      </Can>

      <Can anyOf={['articles.delete', 'articles.archive']} fallback={<span>Read only</span>}>
        <button>Remove</button>
      </Can>

      <Can allOf={['articles.edit', 'articles.publish']}>
        <button>Edit &amp; publish</button>
      </Can>

      <Cannot permission="articles.edit">
        <p>Ask an editor to make changes.</p>
      </Cannot>

      <HasRole role="admin">
        <a href="/admin">Admin panel</a>
      </HasRole>

      <HasRole anyOf={['admin', 'editor']}>…</HasRole>
      <HasRole allOf={['writer', 'reviewer']}>…</HasRole>
    </>
  )
}
```

| Component   | Condition props (pick one)                    | Renders `children` when…               |
| ----------- | --------------------------------------------- | -------------------------------------- |
| `<Can>`     | `permission`, `anyOf`, `allOf`                | the permission check passes            |
| `<Cannot>`  | `permission`, `anyOf`, `allOf`                | the same check **fails**               |
| `<HasRole>` | `role`, `anyOf`, `allOf`                      | the role check passes                  |

All three accept `fallback`. TypeScript only allows exactly one condition prop. If a component ends up with no
condition at all (for example from untyped JavaScript), it is treated as denied: `<Can>` and `<HasRole>` render
the fallback.

::: tip Spatie users
`<Can>` maps to `@can` / `@canany`, `<Cannot>` to `@cannot`, and `<HasRole>` to `@role` / `@hasanyrole` /
`@hasallroles`.
:::

## Wildcards and super-admins

The client does not know your server configuration, so mirror it with props.

### `wildcard`

If the engine was created with `createRbac({ wildcard: true })`, pass `wildcard` to the provider so a granted
`articles.*` also satisfies `useCan('articles.edit')`. The `Rbac` instance exposes the setting, so on the server you
can forward it directly: `wildcard={rbac.wildcard}`.

```tsx
<RbacProvider snapshot={snapshot} wildcard={rbac.wildcard}>
```

Matching uses the same `wildcardImplies()` as the core. See [Wildcard permissions](/basic-usage/wildcard-permissions).

### `superAdminRoles`

The snapshot contains only names, so a server-side `superAdminRoles` setting is not visible to the browser. Pass
the same list to the provider; users with one of these roles then pass every permission check (`can`, `canAny`,
`canAll`, `<Can>`). Role checks are unaffected — a super-admin without the `editor` role still fails
`<HasRole role="editor">`.

```ts
// lib/rbac-config.ts — share one constant between server and client
export const SUPER_ADMIN_ROLES = ['super-admin']
```

```tsx
<RbacProvider snapshot={snapshot} superAdminRoles={SUPER_ADMIN_ROLES}>
```

::: warning
A `before` hook configured on the server is **not** replayed on the client. If your server grants access through
custom logic in `before`, the UI cannot know about it; expose the outcome through the snapshot or a separate flag.
See [Super-admin](/basic-usage/super-admin).
:::

## Next.js App Router

The package's bundle begins with a `'use client'` directive, so you can render `<RbacProvider>` directly from a
server component (for example your root layout) and pass it a snapshot built on the server.

```tsx
// app/layout.tsx — server component
import { RbacProvider } from '@anievo-id/rbac-evolution-react'
import { rbac } from '@/lib/rbac'
import { auth } from '@/auth'

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  const snapshot = session?.user?.id
    ? await rbac.for({ type: 'user', id: session.user.id }).snapshot()
    : null

  return (
    <html lang="en">
      <body>
        <RbacProvider snapshot={snapshot} wildcard={rbac.wildcard}>
          {children}
        </RbacProvider>
      </body>
    </html>
  )
}
```

Components that **use** the hooks or `<Can>` must be client components, so they need `'use client'` at the top of
their own file:

```tsx
// app/articles/article-actions.tsx
'use client'

import { Can, useCan } from '@anievo-id/rbac-evolution-react'

export function ArticleActions() {
  const canPublish = useCan('articles.publish')
  return (
    <>
      <Can permission="articles.edit">
        <button>Edit</button>
      </Can>
      <button disabled={!canPublish}>Publish</button>
    </>
  )
}
```

With [`@anievo-id/rbac-evolution-next`](/frameworks/nextjs) the snapshot line becomes
`snapshot={await getSnapshot()}`, which also handles guests, guards and teams for you.

## Using the checker outside React

`createRbacChecker(snapshot, { wildcard?, superAdminRoles? })` is the pure function behind the provider. Use it in
tests, utilities or non-React code:

```ts
import { createRbacChecker } from '@anievo-id/rbac-evolution-react'

const checker = createRbacChecker(
  { roles: ['editor'], permissions: ['articles.*'] },
  { wildcard: true },
)

checker.can('articles.edit') // true
checker.hasRole('admin') // false
```

## Notes

- **Exact names.** Matching is exact after trimming whitespace, like the core. Without `wildcard`, `articles.*` is
  just a literal name.
- **Guards and teams.** A snapshot belongs to one guard and one team. Build it with the same `{ guard, team }` you
  use for server-side checks: `rbac.for(user, { guard: 'web', team: teamId }).snapshot()`.
- **Freshness.** A snapshot is a copy taken at one moment. After changing a user's roles, give the provider a new
  snapshot (refetch, or `router.refresh()` in Next.js).
- **Empty lists never pass.** `useCanAny()`, `useCanAll()` and `useHasAllRoles()` return `false` for an empty list,
  and `<Can allOf={[]}>` renders its fallback — the same deny-by-default rule as the Vue package.
