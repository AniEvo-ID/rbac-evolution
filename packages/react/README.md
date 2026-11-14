# @anievo-id/rbac-evolution-react

📖 **[Documentation](https://app.anievo.id/rbac-evolution/frameworks/react)**

React bindings for [rbac-evolution](https://github.com/AniEvo-ID/rbac-evolution): `<RbacProvider>`, `useCan()`, `<Can>`, `<HasRole>`, ... — the React
counterpart of spatie/laravel-permission's Blade directives (`@can`, `@cannot`, `@role`, `@hasanyrole`, ...).

> **UI only.** These helpers show and hide elements based on a snapshot sent to the browser. Anyone can edit
> client-side state, so they are **not** a security boundary. Always enforce authorization on the server
> (route handlers, server actions, API) — e.g. with `@anievo-id/rbac-evolution-next` or the core `rbac.for(user).can()`.

```bash
npm i @anievo-id/rbac-evolution @anievo-id/rbac-evolution-react
```

Works with React 18+ and the Next.js App Router (the bundle starts with `'use client'`).

## How it works

1. On the server, take a snapshot of the user's access: `await rbac.for(user).snapshot()` → `{ roles, permissions }`.
2. Pass it to `<RbacProvider snapshot={...}>`.
3. Check synchronously anywhere below it — no requests, no loading states.

## Next.js App Router

```tsx
// app/layout.tsx — server component
import { RbacProvider } from '@anievo-id/rbac-evolution-react'
import { rbac } from '@/lib/rbac'
import { auth } from '@/auth'

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  const snapshot = session?.user
    ? await rbac.for({ type: 'user', id: session.user.id }).snapshot()
    : null // guest

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

(With `@anievo-id/rbac-evolution-next` this is just `snapshot={await getSnapshot()}`.)

```tsx
// app/articles/article-actions.tsx — client component
'use client'

import { Can, Cannot, HasRole, useCan } from '@anievo-id/rbac-evolution-react'

export function ArticleActions() {
  const canPublish = useCan('articles.publish')

  return (
    <div>
      <Can permission="articles.edit">
        <button>Edit</button>
      </Can>

      <Can anyOf={['articles.delete', 'articles.archive']} fallback={<span>Read only</span>}>
        <button>Remove</button>
      </Can>

      <Cannot permission="articles.edit">
        <p>Ask an editor to make changes.</p>
      </Cannot>

      <HasRole role="admin">
        <a href="/admin">Admin panel</a>
      </HasRole>

      <button disabled={!canPublish}>Publish</button>
    </div>
  )
}
```

## Other React apps

Fetch the snapshot from your API (e.g. `GET /api/me/permissions` returning `rbac.for(user).snapshot()`) and pass it in:

```tsx
<RbacProvider snapshot={data ?? null}>
  <App />
</RbacProvider>
```

## API

### `<RbacProvider>`

| Prop              | Type                           | Description                                                                    |
| ----------------- | ------------------------------ | ------------------------------------------------------------------------------ |
| `snapshot`        | `RbacSnapshot \| null`         | `{ roles, permissions }` of the current user. `null`/`undefined` = guest.      |
| `wildcard`        | `boolean`                      | Match `articles.*`-style permissions. Use the same value as `createRbac`.      |
| `superAdminRoles` | `string[]`                     | Users with one of these roles pass every `can` check (not role checks).        |

Providers can be nested; the nearest one wins.

### Hooks

| Hook                           | Returns `true` when                                      |
| ------------------------------ | -------------------------------------------------------- |
| `useCan(permission)`           | the user has the permission                               |
| `useCannot(permission)`        | the user does not have the permission                     |
| `useCanAny(...permissions)`    | the user has ANY of them (arrays or varargs)              |
| `useCanAll(...permissions)`    | the user has ALL of them                                  |
| `useHasRole(role \| roles[])`  | the user has the role / ANY of the roles                  |
| `useHasAnyRole(...roles)`      | the user has ANY of the roles                             |
| `useHasAllRoles(...roles)`     | the user has ALL of the roles                             |
| `useRbac()`                    | returns the checker (`can`, `canAny`, `hasRole`, `roles`, `permissions`, ...) |

Hooks throw when used outside `<RbacProvider>`.

### Components

```tsx
<Can permission="a">…</Can>              // @can('a')
<Can anyOf={['a', 'b']}>…</Can>          // @canany(['a', 'b'])
<Can allOf={['a', 'b']}>…</Can>          // all of them
<Cannot permission="a">…</Cannot>        // @cannot('a')
<HasRole role="admin">…</HasRole>        // @role('admin')
<HasRole anyOf={['a', 'b']}>…</HasRole>  // @hasanyrole
<HasRole allOf={['a', 'b']}>…</HasRole>  // @hasallroles
```

All accept `fallback` (rendered when the check fails). TypeScript enforces exactly one condition; at runtime a
component with no condition renders the fallback (deny by default).

### `createRbacChecker(snapshot, { wildcard?, superAdminRoles? })`

The pure checker behind the provider, usable outside React.

## Notes

- Name matching is exact (after trimming), like the core. With `wildcard`, matching uses the core's `wildcardImplies`.
- Snapshots are per guard/team: take the snapshot with the same `guard`/`team` you check on the server.
- A snapshot is a point-in-time copy. After changing a user's roles, re-render with a fresh snapshot
  (e.g. `router.refresh()` in Next.js).

## License

MIT
