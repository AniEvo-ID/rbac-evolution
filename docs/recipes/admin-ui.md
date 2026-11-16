# Admin UI for roles

The API behind an admin screen: list roles and permissions, change what a role grants, and assign roles to users.
Every endpoint is guarded by one permission, `roles.manage`. The examples use Express 5 (async errors reach the error
handler on their own) and only engine methods, so they work with every adapter.

## The router

```ts
// admin.ts
import express from 'express'
import { RbacError } from '@anievo-id/rbac-evolution'
import { requirePermission } from '@anievo-id/rbac-evolution-express'
import { rbac } from './rbac'

export const admin = express.Router()
admin.use(express.json(), requirePermission('roles.manage'))

const user = (id: string) => rbac.for({ type: 'user', id })
```

Mount it after `rbacMiddleware`: `app.use('/admin', admin)`.

## Roles and permissions

```ts
// GET /admin/permissions → ['billing.manage', 'projects.edit', ...]
admin.get('/permissions', async (req, res) => {
  res.json((await rbac.getPermissions()).map((p) => p.name))
})

// GET /admin/roles → [{ name: 'editor', permissions: ['projects.edit', ...] }, ...]
admin.get('/roles', async (req, res) => {
  const roles = await rbac.getRoles()
  res.json(
    await Promise.all(roles.map(async (role) => ({ name: role.name, permissions: await rbac.role(role).getPermissionNames() }))),
  )
})

// PUT /admin/roles/editor/permissions  { "permissions": ["projects.view", "projects.edit"] }
admin.put('/roles/:role/permissions', async (req, res) => {
  await rbac.role(req.params.role).syncPermissions(stringList(req.body.permissions))
  res.status(204).end()
})

// GET /admin/roles/editor/users → [4, 9]
admin.get('/roles/:role/users', async (req, res) => {
  res.json(await rbac.subjectsWithRole('user', req.params.role))
})
```

`syncPermissions` replaces the role's permissions with exactly the list. It attaches what is new and detaches what
is missing, so the UI can send the whole list of checked boxes.

## A user's roles

```ts
// GET /admin/users/1 → { roles: ['editor'], direct: [], permissions: ['projects.edit', ...] }
admin.get('/users/:id', async (req, res) => {
  const u = user(req.params.id)
  res.json({
    roles: await u.getRoleNames(),
    direct: (await u.getDirectPermissions()).map((p) => p.name),
    permissions: await u.getPermissionNames(),
  })
})

// POST /admin/users/1/roles  { "role": "editor" }
admin.post('/users/:id/roles', async (req, res) => {
  const role = String(req.body.role)
  if (PROTECTED_ROLES.has(role) && !(await req.rbac!.hasRole('super-admin'))) return res.sendStatus(403)
  await user(req.params.id).assignRole(role)
  res.status(204).end()
})

// DELETE /admin/users/1/roles/editor
admin.delete('/users/:id/roles/:role', async (req, res) => {
  await user(req.params.id).removeRole(req.params.role)
  res.status(204).end()
})
```

## Validation and errors

```ts
const PROTECTED_ROLES = new Set(['super-admin'])

function stringList(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every((v) => typeof v === 'string')) throw new TypeError('Expected a list of names.')
  return value
}

admin.use((error: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (error instanceof RbacError) return res.status(422).json({ code: error.code, message: error.message })
  if (error instanceof TypeError) return res.status(400).json({ message: error.message })
  next(error)
})
```

Unknown role or permission names throw `RoleDoesNotExist` / `PermissionDoesNotExist`, which become a 422 here.
Admins typed the name themselves, so the message is safe to show to them. See [Errors](/advanced/errors).

## Things to get right

- **No privilege escalation.** Anyone with `roles.manage` can give themselves any role. Keep powerful roles such
  as `super-admin` behind a second check, as above, and keep `roles.manage` itself for a few people.
- **Audit every change.** The endpoints call the engine, so the [events](/advanced/events) fire. Log them, see the
  [audit log recipe](/recipes/audit-log).
- **Other processes.** Each change clears the cache of this process only. With several instances, use a shared
  cache store, see [Production](/best-practices/production#share-the-cache-between-processes).
- **The user's browser.** A user whose roles changed keeps their old snapshot until the page fetches a new one.
  The server-side checks use the new roles straight away.
- **Typed names.** With `createRbac<AppRbac>()`, request input is a plain `string`. Check it against your list of
  names before you pass it on, or cast it after the check.
- **Teams.** With `teams: true`, read the team from the route and pass `{ team }` to `rbac.for()`, `rbac.role()`,
  `getRoles()` and `subjectsWithRole()`. See the [multi-tenant recipe](/recipes/multi-tenant).
