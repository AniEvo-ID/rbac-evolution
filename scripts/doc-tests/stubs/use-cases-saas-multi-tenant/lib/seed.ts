// Stub: a copy of the `lib/seed.ts` block of docs/use-cases/saas-multi-tenant.md.
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
