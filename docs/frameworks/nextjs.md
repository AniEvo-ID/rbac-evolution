# Next.js

`@anievo-id/rbac-evolution-next` brings RBAC Evolution to the Next.js App Router. It gives you:

- **Guards** for server components, server actions and route handlers (`requirePermission`, `withPermission`,
  `withRbac`, …).
- **`getSnapshot()`** to feed [`<RbacProvider>`](/frameworks/react) for client-side `<Can>` / `useCan()`.
- **Route protection in `middleware.ts`**, from a separate `/middleware` entry point.

These are the counterparts of spatie/laravel-permission's `permission`, `role` and `role_or_permission`
middleware.

## Installation

::: code-group

```bash [npm]
npm i @anievo-id/rbac-evolution @anievo-id/rbac-evolution-next
# optional, for <Can> / useCan() in client components
npm i @anievo-id/rbac-evolution-react
```

```bash [pnpm]
pnpm add @anievo-id/rbac-evolution @anievo-id/rbac-evolution-next
pnpm add @anievo-id/rbac-evolution-react
```

```bash [yarn]
yarn add @anievo-id/rbac-evolution @anievo-id/rbac-evolution-next
yarn add @anievo-id/rbac-evolution-react
```

:::

`next` (14 or newer) and `react` are peer dependencies. The package is server-only and does not re-export the
React bindings — install `@anievo-id/rbac-evolution-react` separately if you need them.

## Setup

RBAC Evolution does not handle authentication. You tell it who the current user is with `getSubject`, using
whatever session library you already have (Auth.js, Clerk, Lucia, iron-session, …). Create one module that builds
the engine and the Next.js helpers:

```ts
// lib/rbac.ts
import { createRbac } from '@anievo-id/rbac-evolution'
import { createNextRbac } from '@anievo-id/rbac-evolution-next'
import { PrismaAdapter } from '@anievo-id/rbac-evolution-prisma'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth' // Auth.js v5

export const rbac = createRbac({ adapter: new PrismaAdapter(prisma), wildcard: true })

export const {
  getSnapshot,
  can,
  canAny,
  canAll,
  hasRole,
  hasAllRoles,
  authorize,
  requirePermission,
  requireRole,
  requireRoleOrPermission,
  withPermission,
  withRole,
  withRbac,
} = createNextRbac({
  rbac,
  // Return null for guests.
  getSubject: async () => {
    const session = await auth()
    return session?.user?.id ? { type: 'user', id: session.user.id } : null
  },
  loginUrl: '/login', // optional: where require*() sends guests
})
```

### `createNextRbac` options

| Option              | Type                                          | Description                                                                   |
| ------------------- | --------------------------------------------- | ----------------------------------------------------------------------------- |
| `rbac`              | `Rbac`                                        | Your `createRbac(...)` instance. **Required.**                                |
| `getSubject`        | `() => Subject \| null \| Promise<…>`         | Resolves the current user. **Required.**                                      |
| `guard`             | `string`                                      | Default guard for every check. Defaults to the engine's `defaultGuard`.       |
| `team`              | `TeamId \| () => TeamId \| undefined \| Promise<…>` | Default team. A function is called on every check (per request).        |
| `loginUrl`          | `string`                                      | `require*()` redirects guests here. Without it, guests get `notFound()`.      |
| `onUnauthenticated` | `() => never`                                 | Replaces the guest handling of `require*()`. Must throw (e.g. `redirect()`).  |
| `onUnauthorized`    | `() => never`                                 | Replaces the default `notFound()` of `require*()`. Must throw.                |

## Server components → `RbacProvider`

`getSnapshot()` returns `{ roles, permissions }` for the current user (guests get empty arrays). Render the React
provider from your root layout so every client component can use `<Can>` and the hooks:

```tsx
// app/layout.tsx — server component
import { RbacProvider } from '@anievo-id/rbac-evolution-react'
import { getSnapshot, rbac } from '@/lib/rbac'

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <RbacProvider snapshot={await getSnapshot()} wildcard={rbac.wildcard}>
          {children}
        </RbacProvider>
      </body>
    </html>
  )
}
```

`<Can>` only hides UI. The pages, actions and API routes behind it must be protected on the server with the
helpers below. See [React](/frameworks/react) for the client-side API.

## Protecting pages

Call a `require*()` helper at the top of a server component (page or layout). It returns the subject when access
is allowed and throws a Next.js navigation error otherwise.

```tsx
// app/admin/page.tsx
import { requireRole } from '@/lib/rbac'

export default async function AdminPage() {
  const subject = await requireRole('admin')
  return <h1>Admin — signed in as {String(subject.id)}</h1>
}
```

| Helper                                      | Passes when the user has…                          |
| ------------------------------------------- | -------------------------------------------------- |
| `requirePermission(permission \| list, opts?)` | the permission, or **any** permission in the list |
| `requireRole(role \| list, opts?)`          | the role, or **any** role in the list              |
| `requireRoleOrPermission(list, opts?)`      | **any** of the names, as a role or a permission    |

What happens when the check fails:

| Case                              | Default                                                         | Override            |
| --------------------------------- | --------------------------------------------------------------- | ------------------- |
| Guest (`getSubject()` → `null`)   | `redirect(loginUrl)` if `loginUrl` is set, otherwise `notFound()` | `onUnauthenticated` |
| Signed in, missing role/permission | `notFound()` — the page's existence is not revealed            | `onUnauthorized`    |

Overrides can be set once in `createNextRbac` or per call. Per-call options also accept `loginUrl`, `guard` and
`team`:

```ts
import { redirect } from 'next/navigation'

await requirePermission('billing.view', {
  onUnauthorized: () => redirect('/403'),
})
```

::: tip `forbidden()` in Next.js 15.1+
With `experimental.authInterrupts` enabled you can use `onUnauthorized: () => forbidden()` (from
`next/navigation`) to render your `forbidden.tsx` with a real 403 status.
:::

### Boolean checks

For conditional rendering on the server, use the non-throwing helpers. Guests always get `false`.

```tsx
import { can, hasRole } from '@/lib/rbac'

export default async function ArticlePage() {
  const canEdit = await can('articles.edit')
  const isStaff = await hasRole(['admin', 'editor']) // any of
  return (
    <article>
      {canEdit && <a href="./edit">Edit</a>}
      {isStaff && <StaffNotes />}
    </article>
  )
}
```

Available: `can`, `canAny`, `canAll`, `hasRole` (role or any of a list), `hasAllRoles`. Each takes an optional
`{ guard, team }` as the last argument.

`authorize(requirement, scope?)` returns a result object instead of throwing:

```ts
const result = await authorize({ permission: 'reports.view' })
if (!result.ok) {
  // result.reason: 'unauthenticated' | 'unauthorized'
}
```

## Server actions

Server actions are public HTTP endpoints, so guard them even when the button that calls them is hidden.
`withPermission(permission, action, scope?)` and `withRole(role, action, scope?)` wrap an action and check access
before running it.

```ts
// app/articles/actions.ts
'use server'

import { withPermission } from '@/lib/rbac'
import { db } from '@/lib/db'

export const deleteArticle = withPermission('articles.delete', async (id: string) => {
  await db.article.delete({ where: { id } })
})
```

On denial the wrapper throws `RbacUnauthorizedError` with `reason` (`'unauthenticated' | 'unauthorized'`) and
`status` (`401 | 403`).

::: tip Showing the error in the UI
In production, Next.js replaces error messages thrown by server actions with a generic one. If the client needs to
react to a denial, check access inside the action and **return** a value instead:

```ts
'use server'

import { authorize } from '@/lib/rbac'

export async function publishArticle(id: string) {
  const result = await authorize({ permission: 'articles.publish' })
  if (!result.ok) return { error: 'You cannot publish articles.' }
  // ...
  return { ok: true }
}
```

:::

## Route handlers

`withRbac(handler, options)` wraps a route handler and answers with JSON when access is denied. Pass exactly one of
`permission`, `role` or `roleOrPermission` (each a name, a `'a|b'` string or a list meaning "any of"), plus optional
`all`, `guard` and `team`. With `all: true`, every listed permission or role is required (spatie v8.5 `canAll()`); a
`'a|b'` entry still means "a or b" within that entry.

```ts
// app/api/articles/[id]/route.ts
import { withRbac } from '@/lib/rbac'

export const DELETE = withRbac(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params
    // ...delete the article
    return Response.json({ deleted: id })
  },
  { permission: 'articles.delete' },
)

export const PATCH = withRbac(
  async (req: Request) => Response.json({ ok: true }),
  { roleOrPermission: ['admin', 'articles.edit'] },
)
```

| Case               | Status | Body                                                                          |
| ------------------ | ------ | ----------------------------------------------------------------------------- |
| Guest              | `401`  | `{ "error": "UNAUTHENTICATED", "message": "User is not logged in." }` |
| Missing access     | `403`  | `{ "error": "FORBIDDEN", "reason": "permission", "message": "User does not have the right permissions." }` |

`reason` is `permission`, `role` or `role_or_permission`. The bodies are the same as the
[Express](/frameworks/express) package's, and the middleware uses them too.

The 403 message names the *kind* of requirement (permissions, roles, or either) but never the actual role or
permission names.

## Guards and teams

Every helper accepts `{ guard, team }`, which is passed through to `rbac.for(subject, { guard, team })`. Missing
values fall back to the `guard` / `team` options of `createNextRbac`. Because `team` may be a function, you can
resolve the current tenant per request:

```ts
// lib/rbac.ts
import { cookies } from 'next/headers'

export const { can, requirePermission, getSnapshot } = createNextRbac({
  rbac, // created with createRbac({ ..., teams: true })
  getSubject,
  guard: 'web',
  team: async () => (await cookies()).get('team')?.value,
})
```

```ts
// an explicit team wins over the default
await can('invoices.view', { team: params.teamId })
```

Remember that `getSnapshot()` is scoped too: the client sees the snapshot of the default (or given) guard and team.
See [Teams](/basic-usage/teams) and [Multiple guards](/basic-usage/multiple-guards).

## Middleware

Import `createRbacMiddleware` from the **`/middleware`** entry point. It does not import `next/navigation`, so it
is safe to use in `middleware.ts`.

```ts
// middleware.ts
import type { NextRequest } from 'next/server'
import { createRbacMiddleware } from '@anievo-id/rbac-evolution-next/middleware'

export default createRbacMiddleware<NextRequest>({
  rules: [
    { matcher: '/admin/:path*', role: 'admin' },
    { matcher: '/articles/:id/edit', permission: 'articles.edit' },
    { matcher: '/reports/:path*', roleOrPermission: ['manager', 'reports.view'] },
    { matcher: '/dashboard/:path*' }, // signed-in users only
  ],
  getSnapshot: async (req) => readSnapshotFromSession(req), // RbacSnapshot | null
  wildcard: true,
  loginUrl: (req) => `/login?callbackUrl=${encodeURIComponent(req.nextUrl.pathname)}`,
})

export const config = {
  matcher: ['/admin/:path*', '/articles/:path*', '/reports/:path*', '/dashboard/:path*'],
}
```

**Rules**

- `matcher` accepts `/exact`, `:param` (one segment), `:path*` (zero or more), `:path+` (one or more), `:param?`
  (optional), a `RegExp`, or an array of these. Trailing slashes are ignored.
- A rule may set `permission`, `role` and/or `roleOrPermission`; each accepts a name, a `'a|b'` string or a list
  ("any of"). Add `all: true` to require every listed permission or role instead. If a rule sets several, all of
  them must hold. A rule with none only requires a signed-in user.
- Paths are matched both as received and percent-decoded, so `/%61dmin` is covered by a rule for `/admin`.
- Every matching rule must pass. Requests that match no rule pass through untouched.

**Responses**

| Case            | Default                                                       | Override                     |
| --------------- | ------------------------------------------------------------- | ---------------------------- |
| Guest           | `307` redirect to `loginUrl`, or `401` JSON without `loginUrl` | `onUnauthenticated(req, rule)` |
| Missing access  | `403` JSON                                                    | `onUnauthorized(req, rule)`  |

Overrides return a `Response`:

```ts
import { NextResponse } from 'next/server'

createRbacMiddleware<NextRequest>({
  // ...
  onUnauthorized: (req) => NextResponse.rewrite(new URL('/403', req.url)),
})
```

The middleware function returns `undefined` when the request may continue, so it composes with other logic:

```ts
const rbacMiddleware = createRbacMiddleware<NextRequest>({ /* ... */ })

export default async function middleware(req: NextRequest) {
  const denied = await rbacMiddleware(req)
  if (denied) return denied
  // ...other middleware logic
}
```

### Where the roles come from

Middleware runs on every matched request, and database adapters such as Prisma and Drizzle do not run in the Edge
runtime. You have two options:

::: code-group

```ts [Snapshot in the JWT (Edge)]
// auth.ts — store the snapshot when the user signs in
import NextAuth from 'next-auth'
import { rbac } from '@/lib/rbac'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [/* ... */],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.rbac = await rbac.for({ type: 'user', id: user.id }).snapshot()
      return token
    },
  },
})

// middleware.ts — read it back, no database involved
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import type { RbacSnapshot } from '@anievo-id/rbac-evolution'
import { createRbacMiddleware } from '@anievo-id/rbac-evolution-next/middleware'

export default createRbacMiddleware<NextRequest>({
  rules: [{ matcher: '/admin/:path*', role: 'admin' }],
  getSnapshot: async (req) => {
    const token = await getToken({ req, secret: process.env.AUTH_SECRET })
    return (token?.rbac as RbacSnapshot | undefined) ?? null
  },
  wildcard: true,
  superAdminRoles: ['super-admin'],
})

export const config = { matcher: ['/admin/:path*'] }
```

```ts [Live lookup (Node.js runtime)]
// middleware.ts — Next.js 15.5+ (Node.js middleware runtime)
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
  // guard: 'web',
  // team: (req) => req.cookies.get('team')?.value,
})

export const config = { runtime: 'nodejs', matcher: ['/admin/:path*'] }
```

:::

| Option             | Snapshot mode                         | `rbac` mode                         |
| ------------------ | ------------------------------------- | ----------------------------------- |
| Source of truth    | `getSnapshot(req)`                    | `rbac` + `getSubject(req)`          |
| Runtime            | Edge or Node.js                       | Node.js only (with a DB adapter)    |
| Freshness          | As old as the token                   | Live (subject to the engine cache)  |
| Extra options      | `wildcard`, `superAdminRoles`         | `guard`, `team`                     |

::: warning Stale tokens
A snapshot stored in a JWT does not change when you change the user's roles. Refresh the token after role changes
(or keep its lifetime short). The server-side guards above always read live data, so they still enforce the
current state.
:::

::: tip Next.js 16
Next.js 16 renames `middleware.ts` to `proxy.ts` (with a `proxy` export) and runs it on the Node.js runtime. The
function returned by `createRbacMiddleware` works the same way there; check the Next.js upgrade guide for details.
:::

Middleware is a convenient first filter for page navigation, not your only line of defence: keep the guards in
pages, actions and route handlers. See [Security](/best-practices/security).

## Complete example

A small App Router app with Auth.js, Prisma, a protected admin area, an article page with client-side buttons, a
guarded server action and a guarded API route.

::: code-group

```ts [lib/rbac.ts]
import { createRbac } from '@anievo-id/rbac-evolution'
import { createNextRbac } from '@anievo-id/rbac-evolution-next'
import { PrismaAdapter } from '@anievo-id/rbac-evolution-prisma'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

export const rbac = createRbac({ adapter: new PrismaAdapter(prisma), wildcard: true })

export const { getSnapshot, can, requireRole, requirePermission, withPermission, withRbac } =
  createNextRbac({
    rbac,
    getSubject: async () => {
      const session = await auth()
      return session?.user?.id ? { type: 'user', id: session.user.id } : null
    },
    loginUrl: '/login',
  })
```

```tsx [app/layout.tsx]
import { RbacProvider } from '@anievo-id/rbac-evolution-react'
import { getSnapshot, rbac } from '@/lib/rbac'

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <RbacProvider snapshot={await getSnapshot()} wildcard={rbac.wildcard}>
          {children}
        </RbacProvider>
      </body>
    </html>
  )
}
```

```tsx [app/admin/layout.tsx]
import { requireRole } from '@/lib/rbac'

// Every page under /admin requires the admin role.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole('admin')
  return <section>{children}</section>
}
```

```tsx [app/articles/[id]/page.tsx]
import { requirePermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { ArticleActions } from './article-actions'

export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('articles.view')
  const { id } = await params
  const article = await prisma.article.findUniqueOrThrow({ where: { id } })

  return (
    <article>
      <h1>{article.title}</h1>
      <ArticleActions id={article.id} />
    </article>
  )
}
```

```tsx [app/articles/[id]/article-actions.tsx]
'use client'

import { Can } from '@anievo-id/rbac-evolution-react'
import { deleteArticle } from '../actions'

export function ArticleActions({ id }: { id: string }) {
  return (
    <Can permission="articles.delete" fallback={<p>Read only</p>}>
      <button onClick={() => deleteArticle(id)}>Delete</button>
    </Can>
  )
}
```

```ts [app/articles/actions.ts]
'use server'

import { revalidatePath } from 'next/cache'
import { withPermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'

export const deleteArticle = withPermission('articles.delete', async (id: string) => {
  await prisma.article.delete({ where: { id } })
  revalidatePath('/articles')
})
```

```ts [app/api/articles/[id]/route.ts]
import { withRbac } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'

export const DELETE = withRbac(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params
    await prisma.article.delete({ where: { id } })
    return Response.json({ deleted: id })
  },
  { permission: 'articles.delete' },
)
```

```ts [middleware.ts]
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
  loginUrl: '/login',
})

export const config = { runtime: 'nodejs', matcher: ['/admin/:path*'] }
```

:::

The admin area is protected twice (middleware and layout); the delete operation is protected in both the server
action and the API route, and the button is merely hidden for users who cannot use it.

::: tip Super-admins in middleware
In `rbac` mode the middleware checks through the engine (`canAny()` / `hasAnyRole()`), so `superAdminRoles` and the
`before` hook apply exactly like in `requirePermission()` and friends. In snapshot mode, pass `superAdminRoles` to the
middleware itself.
:::
