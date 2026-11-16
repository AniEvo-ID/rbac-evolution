# Multi-tenant SaaS with teams

A SaaS app where every customer is a team, and the same user can be an owner in one team and a plain member in
another. The team comes from the URL (`/teams/:teamId/...`). The examples use Express; the same steps work in any
framework.

## 1. Turn teams on and seed the roles

Roles that every team uses are global: they are created once and assigned per team.

```ts
// rbac.ts
import { createRbac } from '@anievo-id/rbac-evolution'

export const rbac = createRbac({ adapter, teams: true })
```

```ts
// scripts/seed.ts: run once per deploy, see Seeding
import { rbac } from '../rbac'

await rbac.sync({
  permissions: ['projects.view', 'projects.edit', 'members.invite', 'billing.manage'],
  roles: {
    owner: '*',
    admin: ['projects.view', 'projects.edit', 'members.invite'],
    member: ['projects.view'],
  },
})
```

Or put the same definition in `seed` in `rbac.config.ts` and run `npx rbac-evolution sync`. See
[Seeding](/advanced/seeding).

## 2. Give the creator a role in the new team

```ts
app.post('/teams', async (req, res) => {
  if (!req.user) return res.sendStatus(401)
  const team = await db.team.create({ data: { name: req.body.name } })
  await db.membership.create({ data: { teamId: team.id, userId: req.user.id } })
  await rbac.for({ type: 'user', id: req.user.id }, { team: team.id }).assignRole('owner')
  res.status(201).json(team)
})
```

`db` stands for your own database client. The membership table is yours too: RBAC Evolution stores roles, not
who belongs to which team.

## 3. Check membership, then scope to the team

Mount the team routes on their own router. The first middleware checks membership, the second scopes `req.rbac`
to the team from the URL:

```ts
import express from 'express'
import { rbacMiddleware, requirePermission } from '@anievo-id/rbac-evolution-express'

const team = express.Router({ mergeParams: true }) // so req.params.teamId is visible here

team.use(async (req, res, next) => {
  if (!req.user) return res.sendStatus(401)
  const member = await db.membership.findFirst({ where: { teamId: req.params.teamId, userId: req.user.id } })
  if (!member) return res.sendStatus(404) // don't reveal that the team exists
  next()
})

team.use(
  rbacMiddleware({
    rbac,
    getSubject: (req) => (req.user ? { type: 'user', id: req.user.id } : null),
    team: (req) => String(req.params.teamId),
  }),
)

team.get('/projects', requirePermission('projects.view'), listProjects)
team.post('/invites', requirePermission('members.invite'), inviteMember)
team.put('/billing', requirePermission('billing.manage'), updateBilling)

app.use('/teams/:teamId', team)
```

::: warning
Any signed-in user can put another team's id in the URL. RBAC Evolution only answers "what may this user do in
team X", not "is this user in team X". Without the membership check, someone who left a team but still has a role
there keeps their access. Your membership table decides who is in a team; the roles decide what they may do there.
See [Teams](/basic-usage/teams).
:::

## 4. Roles that only one team has

A customer may want a role of their own. Create it in their team. It can't be found or assigned anywhere else:

```ts
await rbac.createRole('auditor', { team: teamId })
await rbac.role('auditor', { team: teamId }).givePermissionTo('projects.view', 'billing.manage')
await rbac.for({ type: 'user', id: userId }, { team: teamId }).assignRole('auditor')
```

If a team role and a global role share a name, the team role wins inside that team.

## 5. Team screens

```ts
await rbac.getRoles({ team: teamId })                     // global roles + this team's roles
await rbac.subjectsWithRole('user', 'admin', { team: teamId }) // ids of the team's admins
await rbac.for({ type: 'user', id: userId }, { team: teamId }).snapshot() // for the UI
```

When a user leaves a team, remove their roles and direct permissions there as well as the membership row:

```ts
await rbac.for({ type: 'user', id: userId }, { team: teamId }).revokeAll()
```

`rbac.for(user).teams()` lists the teams where a user has a role or a direct permission, and
`rbac.deleteTeam(teamId)` removes a whole team. See [Teams](/basic-usage/teams#deleting-a-team).

## In Next.js

Check membership in the page or action, then pass the team to the helpers from `createNextRbac`:

```ts
await requireMembership(user.id, params.teamId) // yours: calls notFound() when not a member
await requirePermission('projects.edit', { team: params.teamId })
```

See [Next.js: guards and teams](/frameworks/nextjs#guards-and-teams).
