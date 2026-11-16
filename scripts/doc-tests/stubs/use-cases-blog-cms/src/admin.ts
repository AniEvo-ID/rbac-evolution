// Stub: a copy of the `src/admin.ts` block of docs/use-cases/blog-cms.md.
import express from 'express'
import { isRoleName } from '@anievo-id/rbac-evolution'
import { asyncHandler } from '@anievo-id/rbac-evolution-express'
import { rbac, requirePermission } from './rbac'

export const admin = express.Router()
admin.use(requirePermission('users.manage'))

// PUT /admin/users/42/roles  { "roles": ["editor", "moderator"] }
admin.put(
  '/users/:id/roles',
  asyncHandler(async (req, res) => {
    const roles: unknown[] = Array.isArray(req.body.roles) ? req.body.roles : []
    if (!roles.every((name) => isRoleName(rbac, name))) {
      res.status(422).json({ error: 'Unknown role' })
      return
    }
    await rbac.for({ type: 'user', id: Number(req.params.id) }).syncRoles(roles)
    res.json({ roles })
  }),
)
