# B2B SaaS with organizations

A project management SaaS where every customer is an organization, built with [Next.js](/frameworks/nextjs) and
[React](/frameworks/react). The same person can own one organization and be a plain member of another.

This page is about the product side: the roles a customer sees, invites, switching organizations and leaving.
The [Multi-tenant SaaS recipe](/recipes/multi-tenant) covers the mechanics (membership checks, team-scoped
middleware, per-team custom roles) with Express. Read it too; this page doesn't repeat it.

## The app

Customers sign up, create an organization and invite their colleagues. Each organization has its own projects,
members and billing. A user can belong to several organizations and switches between them in the header.

| User | What they do in an organization |
| --- | --- |
| Owner | Created the organization. Can do everything, including deleting it. |
| Admin | Manages projects and members. Doesn't see billing. |
| Member | Works on projects. |
| Billing | Manages the subscription and invoices. Often someone from finance, who never opens a project. |

## Roles and permissions

| Permission | owner | admin | member | billing |
| --- | :---: | :---: | :---: | :---: |
| `projects.view` | ✔ | ✔ | ✔ | |
| `projects.create` | ✔ | ✔ | ✔ | |
| `projects.delete` | ✔ | ✔ | | |
| `members.view` | ✔ | ✔ | ✔ | ✔ |
| `members.invite` | ✔ | ✔ | | |
| `members.remove` | ✔ | ✔ | | |
| `members.roles` | ✔ | ✔ | | |
| `billing.view` | ✔ | | | ✔ |
| `billing.manage` | ✔ | | | ✔ |
| `org.settings` | ✔ | ✔ | | |
| `org.delete` | ✔ | | | |

Why this split:

- **One set of roles for every organization.** The roles are global and created once by the seed. Only the
  **assignment** is per organization: Alice is `owner` in Acme and `member` in Globex. That is what
  [teams](/basic-usage/teams) do.
- **`billing` is its own role, not part of `admin`.** Finance people need invoices, not projects. Because roles
  stack, a technical co-founder can be `admin` and `billing` at the same time.
- **The code checks permissions.** When you add a "viewer" plan later, you add a role to the seed. The pages and
  actions don't change. See [Roles vs permissions](/best-practices/roles-vs-permissions).

## Seed it

Turn teams on and type the names. The team id is the organization id.

```ts
// lib/rbac.ts
import { createRbac } from '@anievo-id/rbac-evolution'
import { createNextRbac } from '@anievo-id/rbac-evolution-next'
import { PrismaAdapter } from '@anievo-id/rbac-evolution-prisma'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { currentOrgId } from '@/lib/org'

export type SaasRbac = {
  permissions:
    | 'projects.view'
    | 'projects.create'
    | 'projects.delete'
    | 'members.view'
    | 'members.invite'
    | 'members.remove'
    | 'members.roles'
    | 'billing.view'
    | 'billing.manage'
    | 'org.settings'
    | 'org.delete'
  roles: 'owner' | 'admin' | 'member' | 'billing'
}

export const rbac = createRbac<SaasRbac>({ adapter: new PrismaAdapter(prisma), teams: true })

export const { getSnapshot, can, hasRole, requirePermission, withPermission } = createNextRbac({
  rbac,
  getSubject: async () => {
    const session = await auth()
    return session?.user?.id ? { type: 'user', id: session.user.id } : null
  },
  team: () => currentOrgId(), // every check runs in the current organization (a function: lib/org imports this file)
  loginUrl: '/login',
})
```

```ts
// lib/seed.ts
import type { SyncDefinition } from '@anievo-id/rbac-evolution'
import type { SaasRbac } from '@/lib/rbac'

export const saasSeed = {
  roles: {
    owner: '*',
    admin: [
      'projects.view',
      'projects.create',
      'projects.delete',
      'members.view',
      'members.invite',
      'members.remove',
      'members.roles',
      'org.settings',
    ],
    member: ['projects.view', 'projects.create', 'members.view'],
    billing: ['billing.view', 'billing.manage', 'members.view'],
  },
  permissions: ['org.delete'], // only the owner has it, through '*'
} satisfies SyncDefinition<SaasRbac>
```

Run `await rbac.sync(saasSeed)` on deploy, or from the [CLI](/advanced/seeding#from-the-cli). The definition has
no `team`, so the roles are global and can be assigned in any organization.

## Assign roles

### The current organization

The current organization is a cookie. A cookie is user input, so `currentOrgId()` only returns it when the user is
a member. Otherwise it returns `undefined`: the checks then run outside any organization, where the user has no
roles, and everything is denied.

A member is someone with a role in the organization, so [`teams()`](/basic-usage/teams#listing-a-subject-s-teams)
answers the question. No membership table is needed:

```ts
// lib/org.ts
import { cache } from 'react'
import { cookies } from 'next/headers'
import { auth } from '@/auth'
import { rbac } from '@/lib/rbac'

/** The organizations of the signed-in user: the teams where they have a role. */
export const myOrgIds = cache(async (): Promise<string[]> => {
  const session = await auth()
  if (!session?.user?.id) return []
  return (await rbac.for({ type: 'user', id: session.user.id }).teams()).map(String)
})

/** The organization the user works in: the `org` cookie, if the user is a member of it. */
export const currentOrgId = cache(async (): Promise<string | undefined> => {
  const orgId = (await cookies()).get('org')?.value
  return orgId && (await myOrgIds()).includes(orgId) ? orgId : undefined
})
```

`cache()` runs each lookup once per request, even though every check calls it, and the engine caches `teams()`
across requests until the next change. Keep a membership table of your own only for data about the membership
itself, such as when someone joined.

### Creating an organization and switching

```ts
// app/orgs/actions.ts
'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { myOrgIds } from '@/lib/org'
import { prisma } from '@/lib/prisma'
import { rbac } from '@/lib/rbac'

export async function createOrg(name: string) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  const userId = session.user.id

  const org = await prisma.organization.create({ data: { name } })
  await rbac.for({ type: 'user', id: userId }, { team: org.id }).assignRole('owner')

  await switchOrg(org.id)
}

export async function switchOrg(orgId: string) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  if (!(await myOrgIds()).includes(orgId)) redirect('/orgs') // not yours: stay where you are

  ;(await cookies()).set('org', orgId, { httpOnly: true, sameSite: 'lax' })
  redirect('/dashboard')
}
```

The org switcher in the header lists `myOrgIds()` (with the names from your `organization` table) and calls
`switchOrg()`. The redirect
renders the layout again, so the UI gets the snapshot of the new organization.

### Invites

An admin invites a colleague by email and picks a role. The invite stores the organization and the role:

```ts
// app/members/actions.ts
'use server'

import { randomUUID } from 'node:crypto'
import { currentOrgId } from '@/lib/org'
import { prisma } from '@/lib/prisma'
import { hasRole, withPermission, type SaasRbac } from '@/lib/rbac'
import type { RoleName } from '@anievo-id/rbac-evolution'

export const inviteMember = withPermission('members.invite', async (email: string, role: RoleName<SaasRbac>) => {
  // Only an owner may create another owner.
  if (role === 'owner' && !(await hasRole('owner'))) return { error: 'Only owners can invite owners.' }

  const orgId = await currentOrgId()
  await prisma.invite.create({ data: { orgId, email, role, token: randomUUID() } })
  // ...send the email with a link to /invites/<token>
  return { ok: true }
})
```

When the invited person opens the link and signs in, they join the organization with the role from the invite:

```ts
// app/invites/actions.ts
'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { rbac } from '@/lib/rbac'

export async function acceptInvite(token: string) {
  const session = await auth()
  if (!session?.user?.id) redirect(`/login?callbackUrl=/invites/${token}`)
  const userId = session.user.id

  const invite = await prisma.invite.findUnique({ where: { token } })
  if (!invite || invite.email !== session.user.email) redirect('/invites/invalid')

  await rbac.for({ type: 'user', id: userId }, { team: invite.orgId }).assignRole(invite.role) // now a member
  await prisma.invite.delete({ where: { token } })

  ;(await cookies()).set('org', invite.orgId, { httpOnly: true, sameSite: 'lax' })
  redirect('/dashboard')
}
```

### Changing a member's roles

`syncRoles()` replaces the member's roles **in this organization only**. Their roles elsewhere stay as they are.

```ts
// app/members/role-actions.ts
'use server'

import { currentOrgId } from '@/lib/org'
import { isLastOwner } from '@/lib/members'
import { hasRole, rbac, withPermission, type SaasRbac } from '@/lib/rbac'
import type { RoleName } from '@anievo-id/rbac-evolution'

export const setMemberRoles = withPermission(
  'members.roles',
  async (userId: string, roles: RoleName<SaasRbac>[]) => {
    const orgId = await currentOrgId()
    if (!orgId) return { error: 'No organization selected.' }
    if (roles.includes('owner') && !(await hasRole('owner'))) return { error: 'Only owners can make owners.' }
    if (!roles.includes('owner') && (await isLastOwner(rbac, orgId, userId))) {
      return { error: 'An organization needs at least one owner.' }
    }

    await rbac.for({ type: 'user', id: userId }, { team: orgId }).syncRoles(roles)
    return { ok: true }
  },
)
```

## Guard the routes

Pages call a `require*()` helper. It runs in the current organization, because `createNextRbac` got
`team: currentOrgId`:

```tsx
// app/(app)/billing/page.tsx
import { requirePermission } from '@/lib/rbac'
import { BillingForm } from '@/app/(app)/billing/billing-form'

export default async function BillingPage() {
  await requirePermission('billing.view') // notFound() for members and admins
  return (
    <main>
      <h1>Billing</h1>
      <BillingForm />
    </main>
  )
}
```

Server actions check the permission **and** that the record belongs to the current organization. The permission
says "may delete projects in this org". It doesn't say anything about a project id sent by the browser:

```ts
// app/(app)/projects/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { currentOrgId } from '@/lib/org'
import { prisma } from '@/lib/prisma'
import { withPermission } from '@/lib/rbac'

export const deleteProject = withPermission('projects.delete', async (projectId: string) => {
  const orgId = await currentOrgId()
  // orgId in the where clause: a project of another org is simply not found
  await prisma.project.deleteMany({ where: { id: projectId, orgId } })
  revalidatePath('/projects')
})
```

### The React side

The layout gives `<RbacProvider>` the snapshot of the current organization:

```tsx
// app/(app)/layout.tsx
import { RbacProvider } from '@anievo-id/rbac-evolution-react'
import { getSnapshot } from '@/lib/rbac'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  return <RbacProvider snapshot={await getSnapshot()}>{children}</RbacProvider>
}
```

Client components then show or hide buttons with `<Can>`:

```tsx
// app/(app)/members/member-toolbar.tsx
'use client'

import { Can, HasRole } from '@anievo-id/rbac-evolution-react'

export function MemberToolbar({ onInvite }: { onInvite: () => void }) {
  return (
    <div>
      <Can permission="members.invite" fallback={<p>Ask an admin to invite people.</p>}>
        <button onClick={onInvite}>Invite</button>
      </Can>
      <Can permission="billing.view">
        <a href="/billing">Billing</a>
      </Can>
      <HasRole role="owner">
        <span className="badge">Owner</span>
      </HasRole>
    </div>
  )
}
```

`owner` has `'*'` in the seed, so its snapshot lists every permission and `<Can>` needs no `superAdminRoles`.

## Edge cases

### The last owner

Every organization needs an owner. Check before a role change or before an owner leaves:

```ts
// lib/members.ts
import type { Rbac } from '@anievo-id/rbac-evolution'
import type { SaasRbac } from '@/lib/rbac'

export async function isLastOwner(rbac: Rbac<SaasRbac>, orgId: string, userId: string): Promise<boolean> {
  const owners = await rbac.subjectsWithRole('user', 'owner', { team: orgId })
  return owners.length === 1 && String(owners[0]) === userId
}
```

The function takes the engine as a parameter, so the test below can pass an in-memory one.

### Leaving or being removed

Remove the user's roles and direct permissions in that organization. With no role left, they are no longer a
member: `myOrgIds()` stops listing it and `currentOrgId()` ignores the cookie. Check `isLastOwner()` first.

```ts
await rbac.for({ type: 'user', id: userId }, { team: orgId }).revokeAll()
```

When a user deletes their account, remove them from every organization at once with
`revokeAll({ allGuards: true, allTeams: true })`.

### Deleting an organization

`deleteTeam()` removes every member's roles and permissions in the organization, and the roles created only for
it (like the auditor below). Then delete your own rows:

```ts
await rbac.deleteTeam(orgId)
await prisma.project.deleteMany({ where: { orgId } })
await prisma.organization.deleteMany({ where: { id: orgId } })
```

### One organization wants its own role

For example an "auditor" that only Acme has. Create it in Acme's team. See
[the recipe](/recipes/multi-tenant#_4-roles-that-only-one-team-has).

### Your own support staff

Your support team sometimes needs to look into a customer's organization. Don't add them as members. Give them a
role in your [internal tools](/use-cases/internal-tools) instead, under a separate guard or app.

## Test it

The same user, two organizations, different answers:

```ts
// test/orgs.test.ts
import { beforeEach, describe, expect, it } from 'vitest'
import { createRbac, MemoryAdapter, type Rbac } from '@anievo-id/rbac-evolution'
import { isLastOwner } from '@/lib/members'
import type { SaasRbac } from '@/lib/rbac'
import { saasSeed } from '@/lib/seed'

describe('organizations', () => {
  let rbac: Rbac<SaasRbac>
  const alice = { type: 'user', id: 'alice' }
  const bob = { type: 'user', id: 'bob' }

  beforeEach(async () => {
    rbac = createRbac<SaasRbac>({ adapter: new MemoryAdapter(), cache: false, teams: true })
    await rbac.sync(saasSeed)
    await rbac.for(alice, { team: 'acme' }).assignRole('owner')
    await rbac.for(alice, { team: 'globex' }).assignRole('member')
    await rbac.for(bob, { team: 'acme' }).assignRole(['admin', 'billing'])
  })

  it('scopes roles to the organization', async () => {
    expect(await rbac.for(alice, { team: 'acme' }).can('billing.manage')).toBe(true)
    expect(await rbac.for(alice, { team: 'globex' }).can('billing.manage')).toBe(false)
    expect(await rbac.for(alice).can('projects.view')).toBe(false) // no organization: no access
  })

  it('stacks roles', async () => {
    expect(await rbac.for(bob, { team: 'acme' }).canAll('members.invite', 'billing.manage')).toBe(true)
    expect(await rbac.for(bob, { team: 'acme' }).can('org.delete')).toBe(false)
  })

  it('knows the last owner', async () => {
    expect(await isLastOwner(rbac, 'acme', 'alice')).toBe(true)
    await rbac.for(bob, { team: 'acme' }).assignRole('owner')
    expect(await isLastOwner(rbac, 'acme', 'alice')).toBe(false)
  })

  it('lists, leaves and deletes organizations', async () => {
    expect((await rbac.for(alice).teams()).sort()).toEqual(['acme', 'globex'])

    await rbac.for(alice, { team: 'globex' }).revokeAll() // alice leaves Globex
    expect(await rbac.for(alice).teams()).toEqual(['acme'])

    await rbac.deleteTeam('acme')
    expect(await rbac.for(alice).teams()).toEqual([])
    expect(await rbac.for(bob).teams()).toEqual([])
  })
})
```

## Related

- [Multi-tenant SaaS recipe](/recipes/multi-tenant): the Express version, membership middleware, per-team roles
- [Teams](/basic-usage/teams)
- [Next.js](/frameworks/nextjs#guards-and-teams) and [React](/frameworks/react)
- [Querying subjects](/advanced/querying-subjects)
- [Testing](/advanced/testing)
