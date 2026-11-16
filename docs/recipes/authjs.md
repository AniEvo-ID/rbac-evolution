# Auth.js in Next.js

[Auth.js](https://authjs.dev) tells you who is signed in. RBAC Evolution needs that as a subject,
`{ type: 'user', id }`. This recipe connects the two in a Next.js App Router app.

::: info Assumptions
- Auth.js v5 (`next-auth@5`), with an `auth.ts` at the project root that exports `auth` from `NextAuth(...)`.
- JWT sessions, the default when Auth.js has no database adapter. With JWT sessions, `token.sub` holds the user id.
- Roles and permissions are stored with one of the [adapters](/adapters/overview). The examples use Prisma.

Check the Auth.js docs for your version if anything differs.
:::

## 1. Put the user id on the session

By default the session does not expose the user id. Copy it from the token:

```ts
// auth.ts
import NextAuth from 'next-auth'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [/* ... */],
  callbacks: {
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub
      return session
    },
  },
})
```

If TypeScript complains about `session.user.id`, extend the `Session` type as the Auth.js TypeScript guide shows.

## 2. Turn the session into a subject

Do it in one place, with `createNextRbac`:

```ts
// lib/rbac.ts
import { createRbac } from '@anievo-id/rbac-evolution'
import { createNextRbac } from '@anievo-id/rbac-evolution-next'
import { PrismaAdapter } from '@anievo-id/rbac-evolution-prisma'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

export const rbac = createRbac({ adapter: new PrismaAdapter(prisma) })

export const { getSnapshot, requirePermission, withPermission, withRbac } = createNextRbac({
  rbac,
  getSubject: async () => {
    const session = await auth()
    return session?.user?.id ? { type: 'user', id: session.user.id } : null // null = guest
  },
  loginUrl: '/api/auth/signin',
})
```

`auth()` reads the session cookie, so every helper works in server components, server actions and route handlers.

## 3. Check access

```tsx
// app/billing/page.tsx
import { requirePermission } from '@/lib/rbac'

export default async function BillingPage() {
  await requirePermission('billing.view') // guests go to loginUrl, others get notFound()
  return <h1>Billing</h1>
}
```

```ts
// app/billing/actions.ts
'use server'
import { withPermission } from '@/lib/rbac'

export const cancelPlan = withPermission('billing.manage', async () => {
  // ...
})
```

For `<Can>` in client components, pass `await getSnapshot()` to `<RbacProvider>` in the root layout. See
[Next.js](/frameworks/nextjs).

## 4. Give new users a role

Assign a default role when a user signs in. The `signIn` callback runs on every sign-in, and `assignRole` does
nothing when the user already has the role. The `member` role must exist, so create it in your
[seed](/advanced/seeding):

<!-- doc-test: skip -->
```ts
// auth.ts, inside NextAuth({ ... })
callbacks: {
  async signIn({ user }) {
    if (user.id) await rbac.for({ type: 'user', id: user.id }).assignRole('member')
    return true
  },
  // session() as above
},
```

`lib/rbac.ts` already imports `auth`, so importing `rbac` back into `auth.ts` creates a circular import. It works,
because each side only uses the other inside a function, but it is cleaner to move `createRbac(...)` into its own
file (for example `lib/rbac-engine.ts`) and import it from both.

An error thrown here makes the sign-in fail, which is the safe direction. Check that `user.id` here is the same id
you put on the session (with JWT sessions, Auth.js fills `token.sub` from it by default). With a database adapter
for Auth.js, `events.createUser` is another place for this.

## Middleware and stale sessions

The server-side guards above read the engine, so a removed role stops working on the next request. With several
processes, the others follow once their [cache](/advanced/cache#multiple-processes) is cleared or expires. If you also copy a snapshot into the JWT for Edge middleware, that copy is as
old as the token. See [Next.js: where the roles come from](/frameworks/nextjs#where-the-roles-come-from) and
[Security: snapshots in tokens](/best-practices/security#snapshots-in-tokens).
