// Stub: a copy of the `src/seed.ts` block of docs/use-cases/internal-tools.md.
import type { SyncDefinition } from '@anievo-id/rbac-evolution'
import type { ToolsRbac } from './rbac'

export const toolsSeed = {
  permissions: ['customers.impersonate', 'audit-log.delete', 'access.grant'], // only granted, never in a role
  roles: {
    'support-agent': ['panel.access', 'customers.view', 'orders.view'],
    'support-lead': ['panel.access', 'customers.view', 'orders.view', 'customers.edit', 'orders.refund', 'audit-log.view'],
    engineer: ['panel.access', 'customers.view', 'jobs.view', 'jobs.retry', 'flags.manage', 'audit-log.view'],
    'super-admin': [],
  },
} satisfies SyncDefinition<ToolsRbac>
