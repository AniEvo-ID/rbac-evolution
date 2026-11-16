// Stub: a copy of the `src/rbac.ts` block of docs/use-cases/blog-cms.md.
import { createRbac } from '@anievo-id/rbac-evolution'
import { createGuards } from '@anievo-id/rbac-evolution-express'
import { adapter } from './db' // e.g. new PrismaAdapter(prisma), see Adapters

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
  roles: 'writer' | 'editor' | 'moderator' | 'admin'
}

export const rbac = createRbac<BlogRbac>({ adapter })

export const { requirePermission, requireRole } = createGuards<BlogRbac>()
