// Stub: a copy of the `src/rbac.ts` block of docs/use-cases/blog-cms.md.
import { createRbac } from '@anievo-id/rbac-evolution'
import { createGuards } from '@anievo-id/rbac-evolution-express'
import { adapter } from './db' // e.g. new PrismaAdapter(prisma), see Adapters

const roles = ['writer', 'editor', 'moderator', 'admin'] as const

export type BlogRbac = {
  permissions:
    | 'posts.create'
    | 'posts.edit.own'
    | 'posts.edit'
    | 'posts.publish'
    | 'posts.delete.own'
    | 'posts.delete'
    | 'comments.moderate'
    | 'users.ban'
    | 'users.manage'
    | 'settings.manage'
  roles: (typeof roles)[number]
}

export const rbac = createRbac<BlogRbac>({ adapter, names: { roles } })

export const { requirePermission, requireRole } = createGuards<BlogRbac>()

// Types `req.rbac` with the same names in every handler (see Express, "Typed req.rbac")
declare module '@anievo-id/rbac-evolution-express' {
  interface RbacRegister {
    rbac: typeof rbac
  }
}
