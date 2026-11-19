# Solid

`@anievo-id/rbac-evolution-solid` lets [Solid](https://www.solidjs.com) components ask "can the current user do
this?" without a network request. The server sends a small snapshot of the user's roles and permissions; a provider
puts it in context; components and hooks read it. It works on Solid 1.8+ and 2.x, in the browser and in server
rendering (SolidStart, TanStack Start).

::: warning UI only
Everything in this package decides what the UI **shows**, not what the user is **allowed** to do: anyone can change
client-side state. Always enforce authorization on the server too, for example with
[TanStack Start](/frameworks/tanstack-start) guards or the core `rbac.for(user).can()`. See
[Security](/best-practices/security).
:::

## Installation

::: code-group

```bash [npm]
npm i @anievo-id/rbac-evolution @anievo-id/rbac-evolution-solid
```

```bash [pnpm]
pnpm add @anievo-id/rbac-evolution @anievo-id/rbac-evolution-solid
```

```bash [yarn]
yarn add @anievo-id/rbac-evolution @anievo-id/rbac-evolution-solid
```

:::

`solid-js` 1.8+ or 2.x is a peer dependency.

## How it works

1. **Server:** build a snapshot for the signed-in user with `await rbac.for(user).snapshot()`. It is a plain,
   serializable object: `{ roles, permissions, denied? }`.
2. **Client:** pass it to `<RbacProvider snapshot={...}>` near the root.
3. **Anywhere below:** render `<Can>`, or call `useCan()`. Both follow the snapshot: give the provider a new one and
   the UI updates.

## Setting up the provider

Every prop of `RbacProvider` is reactive, so pass a signal, a store field or a resource directly:

<!-- doc-test: skip -->
```tsx
// src/app.tsx
import { createResource } from 'solid-js'
import { RbacProvider } from '@anievo-id/rbac-evolution-solid'

const [snapshot] = createResource(() => fetch('/api/me/permissions').then((res) => res.json()))

export default function App() {
  return (
    <RbacProvider snapshot={snapshot()} loading={snapshot.loading} wildcard superAdminRoles={['admin']}>
      <Routes />
    </RbacProvider>
  )
}
```

`null` (or `undefined`) means a guest: every check fails.

### Provider props

| Prop | Type | Description |
| --- | --- | --- |
| `snapshot` | `RbacSnapshot \| null \| undefined` | The user's roles and permissions. `null` = guest. |
| `wildcard` | `boolean` | Match `articles.*` patterns. Must match the server's `wildcard` setting. Default: `false`. |
| `superAdminRoles` | `string[]` | Roles that pass every permission check. |
| `loading` | `boolean` | The snapshot is still being fetched: the components render nothing, not even `fallback`. |

## Components

<!-- doc-test: skip -->
```tsx
import { Can, Cannot, HasRole, UnlessRole } from '@anievo-id/rbac-evolution-solid'

<Can permission="articles.edit" fallback={<p>Read only</p>}>
  <EditButton />
</Can>

<Can anyOf={['articles.edit', 'articles.publish']}>...</Can>
<Can allOf={['articles.edit', 'articles.publish']}>...</Can>
<Cannot permission="articles.delete">...</Cannot>

<HasRole role="admin">...</HasRole>
<HasRole anyOf={['writer', 'editor']}>...</HasRole>
<UnlessRole role="banned">...</UnlessRole>
```

| Component | Renders `children` when | spatie |
| --- | --- | --- |
| `<Can permission>` / `anyOf` / `allOf` | the user has the permission / any / all | `@can`, `@canany` |
| `<Cannot>` | the user does NOT have it | `@cannot` |
| `<HasRole role>` / `anyOf` / `allOf` | the user has the role / any / all | `@role`, `@hasanyrole`, `@hasallroles` |
| `<UnlessRole>` | the user does NOT have the role (`anyOf`: none of them, `allOf`: not all) | `@unlessrole` |

Each one takes a `fallback`. Like `<Show>`, the branch is only rebuilt when the result changes, not on every new
snapshot.

## Hooks

The hooks return accessors, as Solid does: call them in JSX or in an effect, and they follow the snapshot.

<!-- doc-test: skip -->
```tsx
import { useCan, useHasRole, useRbac } from '@anievo-id/rbac-evolution-solid'

function Toolbar() {
  const canPublish = useCan('articles.publish')
  const isEditor = useHasRole(['editor', 'admin'])
  const rbac = useRbac() // the whole checker, as an accessor

  return (
    <>
      <button disabled={!canPublish()}>Publish</button>
      {isEditor() && <ReviewQueue />}
      <p>Roles: {rbac().roles.join(', ')}</p>
    </>
  )
}
```

| Hook | Returns |
| --- | --- |
| `useCan(p)` / `useCannot(p)` | `Accessor<boolean>` |
| `useCanAny(...p)` / `useCanAll(...p)` | `Accessor<boolean>` (`false` for an empty list) |
| `useHasRole(r \| r[])` / `useHasAnyRole(...r)` / `useHasAllRoles(...r)` | `Accessor<boolean>` |
| `useRbac()` | `Accessor<RbacChecker>`. Throws outside `RbacProvider`. |

## TanStack Start (Solid)

Load the snapshot in the root route with the [TanStack Start](/frameworks/tanstack-start) server function, and pass
it to the provider:

<!-- doc-test: skip -->
```tsx
// src/routes/__root.tsx
import { createRootRoute, Outlet } from '@tanstack/solid-router'
import { RbacProvider } from '@anievo-id/rbac-evolution-solid'
import { getRbacSnapshot } from '../server/rbac-snapshot'

export const Route = createRootRoute({
  loader: () => getRbacSnapshot(),
  component: () => {
    const snapshot = Route.useLoaderData()
    return (
      <RbacProvider snapshot={snapshot()}>
        <Outlet />
      </RbacProvider>
    )
  },
})
```

The snapshot is rendered on the server and serialized with the page, so the right UI shows on the first paint.

## SolidStart

Read the snapshot in a `query` and pass it to the provider in the root layout:

<!-- doc-test: skip -->
```tsx
// src/app.tsx
import { createAsync, query } from '@solidjs/router'
import { RbacProvider } from '@anievo-id/rbac-evolution-solid'
import { getRequestEvent } from 'solid-js/web'
import { rbac } from './lib/rbac'
import { getUser } from './lib/session'

const getSnapshot = query(async () => {
  'use server'
  const user = await getUser(getRequestEvent()!.request)
  return user ? rbac.for({ type: 'user', id: user.id }).snapshot() : null
}, 'rbac-snapshot')

export default function App(props) {
  const snapshot = createAsync(() => getSnapshot())
  return <RbacProvider snapshot={snapshot()}>{props.children}</RbacProvider>
}
```

Check permissions again in your server functions and API routes: the snapshot only decides what the page shows.

## Using the checker outside components

`createRbacChecker(snapshot, { wildcard?, superAdminRoles? })` is the pure function behind the provider, with no
Solid needed:

```ts
import { createRbacChecker } from '@anievo-id/rbac-evolution-solid'

const checker = createRbacChecker({ roles: ['editor'], permissions: ['articles.*'] }, { wildcard: true })

checker.can('articles.edit') // true
checker.hasRole('admin') // false
```

## Notes

- **Same rules as the React package.** Exact names after trimming, the snapshot's `denied` list wins over everything,
  empty lists never pass, and a component without a condition renders its fallback.
- **Guards and teams.** A snapshot belongs to one guard and one team. Build it with the same `{ guard, team }` you use
  for server-side checks.
- **Solid 1.x and 2.x.** The package has no JSX of its own and no build plugin, so the same files run with either
  version's client and server builds.

Full API: [reference](/api/solid/)
