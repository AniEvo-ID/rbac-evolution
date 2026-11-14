# @anievo-id/rbac-evolution-next

📖 **[Documentation](https://app.anievo.id/rbac-evolution/frameworks/nextjs)**

Next.js (App Router) helpers for [rbac-evolution](https://github.com/AniEvo-ID/rbac-evolution): guards for server components, server actions and route
handlers, plus route protection in `middleware.ts` — the Next.js counterpart of spatie/laravel-permission's
`permission`, `role` and `role_or_permission` middleware.

```bash
npm i @anievo-id/rbac-evolution @anievo-id/rbac-evolution-next
# for client-side <Can> / useCan():
npm i @anievo-id/rbac-evolution-react
```

`next` (14+) and `react` are peer dependencies. This package is server-only; it does not re-export the React bindings.

## Setup

You resolve the session yourself (Auth.js, Clerk, Lucia, iron-session, ...) and tell rbac-evolution who the
current subject is:

```ts
// lib/rbac.ts
import { createRbac } from '@anievo-id/rbac-evolution'
import { createNextRbac } from '@anievo-id/rbac-evolution-next'
import { PrismaAdapter } from '@anievo-id/rbac-evolution-prisma'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export const rbac = createRbac({ adapter: new PrismaAdapter(prisma), wildcard: true })

export const {
  getSnapshot,
  can,
  hasRole,
  requirePermission,
  requireRole,
  withPermission,
  withRbac,
} = createNextRbac({
  rbac,
  getSubject: async () => {
    const session = await auth()
    return session?.user?.id ? { type: 'user', id: session.user.id } : null
  },
  loginUrl: '/login', // optional: where require*() sends guests
  // guard: 'web',     // optional default guard
  // team: async () => (await cookies()).get('team')?.value, // optional default team
})
```

## Server components → `RbacProvider` → `<Can>`

```tsx
// app/layout.tsx (server component)
import { RbacProvider } from '@anievo-id/rbac-evolution-react'
import { getSnapshot, rbac } from '@/lib/rbac'

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* guests get { roles: [], permissions: [] } */}
        <RbacProvider snapshot={await getSnapshot()} wildcard={rbac.wildcard}>
          {children}
        </RbacProvider>
      </body>
    </html>
  )
}
```

```tsx
// app/articles/[id]/toolbar.tsx (client component)
'use client'

import { Can } from '@anievo-id/rbac-evolution-react'

export function Toolbar() {
  return (
    <Can permission="articles.edit" fallback={<span>Read only</span>}>
      <button>Edit</button>
    </Can>
  )
}
```

`<Can>` only hides UI. The page, actions and APIs below must still be protected on the server:

## Protecting pages

```tsx
// app/admin/page.tsx
import { requireRole } from '@/lib/rbac'

export default async function AdminPage() {
  const user = await requireRole('admin') // returns the subject when allowed
  return <h1>Admin</h1>
}
```

`requirePermission(permission | permissions[], opts?)`, `requireRole(role | roles[], opts?)` and
`requireRoleOrPermission(items, opts?)` — arrays and `'a|b'` strings mean "any of" (like spatie's
`permission:a|b` and `canAny()`). Pass `{ all: true }` to `requirePermission` / `requireRole` (or `all: true` in a
`withRbac` option or middleware rule) to require every entry, like spatie v8.5's `canAll()`.

On failure (both configurable per factory or per call):

| Case                           | Default                                                     | Option              |
| ------------------------------ | ----------------------------------------------------------- | ------------------- |
| Guest (`getSubject()` → null)  | `redirect(loginUrl)` if `loginUrl` is set, else `notFound()` | `onUnauthenticated` |
| Missing role/permission        | `notFound()` (does not reveal the page exists)              | `onUnauthorized`    |

```ts
import { redirect } from 'next/navigation'

await requirePermission('billing.view', {
  onUnauthorized: () => redirect('/403'),
  // or, with `experimental.authInterrupts` (Next 15.1+): onUnauthorized: () => forbidden(),
})
```

Use `can()`, `canAny()`, `canAll()`, `hasRole()`, `hasAllRoles()` for plain boolean checks, and
`authorize(requirement)` for a non-throwing `{ ok, reason, subject }` result.

## Server actions

```ts
// app/articles/actions.ts
'use server'

import { withPermission } from '@/lib/rbac'

export const deleteArticle = withPermission('articles.delete', async (id: string) => {
  await db.article.delete({ where: { id } })
})
```

When access is denied the wrapped action throws `RbacUnauthorizedError` (`reason: 'unauthenticated' | 'unauthorized'`,
`status: 401 | 403`) before running. `withRole(role, action)` works the same. Note that Next.js hides error details
from the client in production; if the UI needs to react, catch it in the action and return a value instead.

## Route handlers

```ts
// app/api/articles/[id]/route.ts
import { withRbac } from '@/lib/rbac'

export const DELETE = withRbac(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params
    // ...
    return Response.json({ deleted: id })
  },
  { permission: 'articles.delete' }, // or { role: 'admin' } or { roleOrPermission: ['admin', 'articles.delete'] }
)
```

Guests get `401 { "error": "UNAUTHENTICATED", "message": … }`, users without access get
`403 { "error": "FORBIDDEN", "reason": "permission" | "role" | "role_or_permission", "message": … }` — the same
bodies as `@anievo-id/rbac-evolution-express`.
`withRbac` also accepts `guard` and `team`.

## Guards & teams

Every helper accepts `{ guard, team }` (passed to `rbac.for(subject, { guard, team })`). Defaults come from the
`guard` / `team` options of `createNextRbac`; `team` may be a function so it can read the current tenant per request.

```ts
await can('invoices.view', { team: params.teamId })
```

## Middleware

```ts
// middleware.ts
import type { NextRequest } from 'next/server'
import { createRbacMiddleware } from '@anievo-id/rbac-evolution-next/middleware'

export default createRbacMiddleware<NextRequest>({
  rules: [
    { matcher: '/admin/:path*', role: 'admin' },
    { matcher: '/articles/:id/edit', permission: 'articles.edit' },
    { matcher: '/reports/:path*', roleOrPermission: ['manager', 'reports.view'] },
    { matcher: '/dashboard/:path*' }, // logged in only
  ],
  // Snapshot stored in the session/JWT (see below) — works in the Edge runtime:
  getSnapshot: async (req) => readSessionSnapshot(req), // RbacSnapshot | null
  wildcard: true,
  loginUrl: (req) => `/login?callbackUrl=${encodeURIComponent(req.nextUrl.pathname)}`,
})

export const config = { matcher: ['/admin/:path*', '/articles/:path*', '/reports/:path*', '/dashboard/:path*'] }
```

- Matchers support `/exact`, `:param` (one segment), `:path*` (zero or more), `:path+` (one or more), `:param?`,
  a `RegExp`, or an array of these. Trailing slashes are ignored.
- Every matching rule must pass; a rule may combine `permission`, `role` and `roleOrPermission` (all must hold).
- Requests matching no rule pass through (the middleware returns `undefined`), so you can compose it:
  `const res = await rbacMiddleware(req); if (res) return res`.
- Defaults: guests → redirect to `loginUrl`, or `401` JSON without it; missing access → `403` JSON.
  Override with `onUnauthenticated(req, rule)` / `onUnauthorized(req, rule)` returning a `Response`
  (e.g. `NextResponse.rewrite(new URL('/403', req.url))`).
- Import from `@anievo-id/rbac-evolution-next/middleware`: this entry does not import `next/navigation`.

### Where the roles come from in middleware

Middleware runs on every matched request, so database lookups there are costly — and **database adapters (Prisma,
Drizzle, ...) do not work in the Edge runtime**, which was the only middleware runtime before Next.js 15.5. Two options:

1. **Snapshot in the session/JWT (recommended).** Store `await rbac.for(user).snapshot()` in the token when the
   user signs in (e.g. Auth.js `jwt` callback) and return it from `getSnapshot(req)`. Remember to refresh the token
   when roles change; the server-side guards above still read live data.
2. **Use the `rbac` instance with the Node.js middleware runtime** (Next.js 15.5+):

   ```ts
   import type { NextRequest } from 'next/server'
   import { createRbacMiddleware } from '@anievo-id/rbac-evolution-next/middleware'
   import { rbac } from '@/lib/rbac'
   import { auth } from '@/auth'

   export default createRbacMiddleware<NextRequest>({
     rbac,
     getSubject: async () => {
       const session = await auth()
       return session?.user?.id ? { type: 'user', id: session.user.id } : null
     },
     rules: [{ matcher: '/admin/:path*', role: 'admin' }],
     // guard: 'web', team: (req) => req.cookies.get('team')?.value,
   })

   export const config = { runtime: 'nodejs', matcher: ['/admin/:path*'] }
   ```

Middleware is a first line of defence for page navigation. Keep the server component / action / route handler
guards — they are what actually protects your data.

## License

MIT
