# @anievo-id/rbac-evolution-react

React bindings for [RBAC Evolution](https://github.com/AniEvo-ID/rbac-evolution): `<RbacProvider>`, `<Can>`,
`<HasRole>`, `useCan()` and friends, the counterpart of spatie's `@can` and `@role` Blade directives.

> **UI only.** These helpers show and hide elements based on a snapshot sent to the browser. Anyone can edit
> client-side state, so they are not a security boundary. Always check permissions on the server too.

## Install

```bash
npm i @anievo-id/rbac-evolution @anievo-id/rbac-evolution-react react
```

Works with React 18+ and the Next.js App Router (the bundle starts with `'use client'`).

## Usage

```tsx
import { Can, HasRole, RbacProvider, useCan } from '@anievo-id/rbac-evolution-react'

// snapshot = await rbac.for(user).snapshot() on the server, or null for guests
<RbacProvider snapshot={snapshot} wildcard>
  <Toolbar />
</RbacProvider>

function Toolbar() {
  const canPublish = useCan('articles.publish')
  return (
    <>
      <Can permission="articles.edit" fallback={<span>Read only</span>}><button>Edit</button></Can>
      <HasRole role="admin"><a href="/admin">Admin</a></HasRole>
      <button disabled={!canPublish}>Publish</button>
    </>
  )
}
```

- Take the snapshot with the same guard and team you check on the server.
- A snapshot is a copy. After changing a user's roles, render with a fresh one (`router.refresh()` in Next.js).

## Documentation

https://creation.anievo.id/rbac-evolution/frameworks/react

## License

MIT
