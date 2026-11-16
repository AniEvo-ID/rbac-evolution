// Stub: a copy of the `src/rbac.ts` block of docs/use-cases/internal-tools.md.
import { createRbac } from '@anievo-id/rbac-evolution'
import { createGuards } from '@anievo-id/rbac-evolution-fastify'
import { adapter } from './db' // created with { expiry: true }, see Temporary access

export type ToolsRbac = {
  permissions:
    | 'panel.access'
    | 'customers.view'
    | 'customers.edit'
    | 'customers.impersonate'
    | 'orders.view'
    | 'orders.refund'
    | 'jobs.view'
    | 'jobs.retry'
    | 'flags.manage'
    | 'audit-log.view'
    | 'audit-log.delete'
    | 'access.grant'
  roles: 'support-agent' | 'support-lead' | 'engineer' | 'super-admin'
}

/** Shared with the React app, so the UI agrees with the server. */
export const SUPER_ADMIN_ROLES = ['super-admin'] as const

export const rbac = createRbac<ToolsRbac>({
  adapter,
  superAdminRoles: SUPER_ADMIN_ROLES,
  // Runs before the super-admin check: false here denies even super-admins.
  before: ({ permission }) => (permission === 'audit-log.delete' ? false : undefined),
})

export const { requirePermission } = createGuards<ToolsRbac>()
