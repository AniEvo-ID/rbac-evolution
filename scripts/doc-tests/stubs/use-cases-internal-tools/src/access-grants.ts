// Stub: a copy of the `src/access-grants.ts` block of docs/use-cases/internal-tools.md.
import type { PermissionName, Rbac } from '@anievo-id/rbac-evolution'
import type { ToolsRbac } from './rbac'

/** What can be granted for a while. Keep the list short. */
export type TemporaryPermission = Extract<PermissionName<ToolsRbac>, 'customers.impersonate' | 'orders.refund'>

export interface AccessGrant {
  id: number
  staffId: number
  permission: TemporaryPermission
  reason: string
  grantedBy: number
  expiresAt: Date
  revokedAt: Date | null
}

/** Your table of grants (any database). */
export interface GrantStore {
  create(grant: Omit<AccessGrant, 'id' | 'revokedAt'>): Promise<AccessGrant>
  /** Grants with `expiresAt <= now` that are not revoked yet. */
  findExpired(now: Date): Promise<AccessGrant[]>
  /** Whether the staff member has another grant of this permission that is still running. */
  hasActive(staffId: number, permission: TemporaryPermission, now: Date): Promise<boolean>
  markRevoked(id: number, at: Date): Promise<void>
}

export async function grantTemporaryAccess(
  rbac: Rbac<ToolsRbac>,
  grants: GrantStore,
  input: { staffId: number; permission: TemporaryPermission; hours: number; reason: string; grantedBy: number },
  now = new Date(),
): Promise<AccessGrant> {
  const { hours, ...rest } = input
  const grant = await grants.create({ ...rest, expiresAt: new Date(now.getTime() + hours * 3_600_000) })
  await rbac.for({ type: 'staff', id: input.staffId }).givePermissionTo(input.permission)
  return grant
}

/** Run every minute. Takes back what has expired. */
export async function revokeExpiredGrants(rbac: Rbac<ToolsRbac>, grants: GrantStore, now = new Date()) {
  for (const grant of await grants.findExpired(now)) {
    await grants.markRevoked(grant.id, now)
    // a second, longer grant of the same permission keeps it
    if (await grants.hasActive(grant.staffId, grant.permission, now)) continue
    await rbac.for({ type: 'staff', id: grant.staffId }).revokePermissionTo(grant.permission)
  }
}
