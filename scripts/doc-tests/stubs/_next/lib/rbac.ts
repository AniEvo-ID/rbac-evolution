// `@/lib/rbac`, as the Next.js guide's "Setup" creates it.
import { createRbac } from '@anievo-id/rbac-evolution'
import { createNextRbac } from '@anievo-id/rbac-evolution-next'
import { PrismaAdapter } from '@anievo-id/rbac-evolution-prisma'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

export const rbac = createRbac({ adapter: new PrismaAdapter(prisma), wildcard: true })

export const {
  getSnapshot,
  can,
  canAny,
  canAll,
  hasRole,
  hasAllRoles,
  authorize,
  requirePermission,
  requireRole,
  requireRoleOrPermission,
  withPermission,
  withRole,
  withRbac,
} = createNextRbac({
  rbac,
  getSubject: async () => {
    const session = await auth()
    return session?.user?.id ? { type: 'user', id: session.user.id } : null
  },
  loginUrl: '/login',
})
