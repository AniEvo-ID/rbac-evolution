// Stub: a copy of the `lib/rbac.ts` block of docs/use-cases/saas-multi-tenant.md.
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
