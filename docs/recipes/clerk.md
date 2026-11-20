# Clerk

[Clerk](https://clerk.com) tells you who is signed in, and which organization is active. RBAC Evolution needs that as
a subject, `{ type: 'user', id }`, and optionally a team. No extra package: every integration takes a `getSubject`,
and Clerk's `auth()` / `getAuth()` give you the ids.

::: info Clerk's own roles
Clerk organizations have one role per member (`org:admin`, `org:member`) and permissions per role. RBAC Evolution
adds several roles per user, direct permissions, wildcards, guards and expiry, in your own database. Keep using
Clerk for sign-in and organizations, and check permissions with RBAC Evolution.
:::

## Next.js

```ts
// lib/rbac.ts
import { auth } from '@clerk/nextjs/server'
import { createRbac } from '@anievo-id/rbac-evolution'
import { createNextRbac } from '@anievo-id/rbac-evolution-next'
import { PrismaAdapter } from '@anievo-id/rbac-evolution-prisma'
import { prisma } from '@/lib/prisma'

export const rbac = createRbac({ adapter: new PrismaAdapter(prisma), teams: true })

export const { getSnapshot, requirePermission, withPermission } = createNextRbac({
  rbac,
  getSubject: async () => {
    const { userId } = await auth()
    return userId ? { type: 'user', id: userId } : null // null = guest
  },
  // The active Clerk organization is the rbac team; none = global roles.
  team: async () => (await auth()).orgId ?? null,
  loginUrl: '/sign-in',
})
```

`auth()` works in server components, server actions and route handlers, so every helper works there too. Without
organizations, leave out `teams: true` and `team`.

## Express

```ts
import express from 'express'
import { clerkMiddleware, getAuth } from '@clerk/express'
import { rbacMiddleware, requirePermission } from '@anievo-id/rbac-evolution-express'
import { rbac } from './rbac'

const app = express()
app.use(clerkMiddleware())
app.use(
  rbacMiddleware({
    rbac,
    getSubject: (req) => {
      const { userId } = getAuth(req)
      return userId ? { type: 'user', id: userId } : null
    },
    team: (req) => getAuth(req).orgId ?? null,
  }),
)

app.delete('/articles/:id', requirePermission('articles.delete'), (req, res) => {
  // ...
})
```

The other integrations work the same way: read `userId` (and `orgId`) from Clerk's helper for that framework.

## Give new users a role

Clerk creates users on its side, so assign the default role from a `user.created` webhook, verified with
`verifyWebhook` from `@clerk/nextjs/webhooks` (or your framework's package):

```ts
// app/api/webhooks/clerk/route.ts
import { verifyWebhook } from '@clerk/nextjs/webhooks'
import { rbac } from '@/lib/rbac'

export async function POST(request: Request) {
  const event = await verifyWebhook(request)
  if (event.type === 'user.created') {
    await rbac.for({ type: 'user', id: event.data.id }).assignRole('member')
  }
  if (event.type === 'user.deleted' && event.data.id) {
    await rbac.for({ type: 'user', id: event.data.id }).revokeAll({ allTeams: true })
  }
  return new Response(null, { status: 204 })
}
```

The `member` role must exist; create it in your [seed](/advanced/seeding). `assignRole` does nothing when the user
already has the role, so a retried webhook is safe.

## Notes

- **Ids.** Clerk user ids (`user_...`) and organization ids (`org_...`) are strings; use them as they are.
- **Snapshot for the UI.** Pass `await getSnapshot()` to `<RbacProvider>` in the root layout, as in
  [Next.js](/frameworks/nextjs). It holds the roles of the active organization.
- **Don't trust client claims.** Check permissions on the server with the ids from `auth()` / `getAuth()`, never
  from data the browser sends.
