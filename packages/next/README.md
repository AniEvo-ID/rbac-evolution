# @anievo-id/rbac-evolution-next

Next.js App Router helpers for [RBAC Evolution](https://github.com/AniEvo-ID/rbac-evolution): guards for server
components, server actions and route handlers, plus route rules for `middleware.ts`.

## Install

```bash
npm i @anievo-id/rbac-evolution @anievo-id/rbac-evolution-next next react
npm i @anievo-id/rbac-evolution-react # optional, for <Can> / useCan() in client components
```

## Usage

```ts
// lib/rbac.ts
import { createRbac } from '@anievo-id/rbac-evolution'
import { createNextRbac } from '@anievo-id/rbac-evolution-next'
import { auth } from '@/auth' // your session library (Auth.js, Clerk, Lucia, ...)

export const rbac = createRbac({ adapter })

export const { getSnapshot, requirePermission, withPermission, withRbac } = createNextRbac({
  rbac,
  getSubject: async () => {
    const session = await auth()
    return session?.user?.id ? { type: 'user', id: session.user.id } : null
  },
})
```

Then `await requirePermission('articles.edit')` in a page, `withPermission('articles.delete', action)` around a
server action, and `withRbac(handler, { permission: 'articles.delete' })` around a route handler.

- Pages answer `notFound()` by default, so a page the user can't open looks like one that doesn't exist.
- `createRbacMiddleware` (from `@anievo-id/rbac-evolution-next/middleware`) is a first filter for page navigation.
  Keep the guards in pages, actions and route handlers: they are what protect your data.
- With a typed engine (`createRbac<AppRbac>()`), every helper type-checks the names.

## Documentation

https://creation.anievo.id/rbac-evolution/frameworks/nextjs

## License

MIT
