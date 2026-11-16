// Stub: a copy of the `src/seed.ts` block of docs/use-cases/blog-cms.md.
import type { SyncDefinition } from '@anievo-id/rbac-evolution'
import type { BlogRbac } from './rbac'

export const blogSeed = {
  permissions: ['posts.delete', 'users.manage', 'settings.manage'], // only admin has these
  roles: {
    writer: ['posts.create', 'posts.edit.own', 'posts.delete.own'],
    editor: ['posts.create', 'posts.edit', 'posts.publish', 'posts.delete.own', 'comments.moderate'],
    moderator: ['comments.moderate', 'users.ban'],
    admin: '*',
  },
} satisfies SyncDefinition<BlogRbac>
