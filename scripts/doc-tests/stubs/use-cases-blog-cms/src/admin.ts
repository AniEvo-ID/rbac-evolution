// Stub: a copy of the `src/admin.ts` block of docs/use-cases/blog-cms.md.
import express from 'express'
import type { RoleName } from '@anievo-id/rbac-evolution'
import { asyncHandler } from '@anievo-id/rbac-evolution-express'
import { rbac, requirePermission, type BlogRbac } from './rbac'

const ROLES: readonly RoleName<BlogRbac>[] = ['writer', 'editor', 'moderator', 'admin']
const isRole = (name: unknown): name is RoleName<BlogRbac> => ROLES.includes(name as RoleName<BlogRbac>)

export const admin = express.Router()
admin.use(requirePermission('users.manage'))

// PUT /admin/users/42/roles  { "roles": ["editor", "moderator"] }
admin.put(
  '/users/:id/roles',
  asyncHandler(async (req, res) => {
    const roles: unknown[] = Array.isArray(req.body.roles) ? req.body.roles : []
    if (!roles.every(isRole)) {
      res.status(422).json({ error: 'Unknown role' })
      return
    }
    await rbac.for({ type: 'user', id: Number(req.params.id) }).syncRoles(roles)
    res.json({ roles })
  }),
)
