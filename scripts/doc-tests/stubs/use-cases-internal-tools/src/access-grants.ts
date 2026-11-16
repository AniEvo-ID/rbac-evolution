// Stub: a copy of the `src/access-grants.ts` block of docs/use-cases/internal-tools.md.
import type { PermissionName, Rbac } from '@anievo-id/rbac-evolution'
import type { ToolsRbac } from './rbac'

/** What can be granted for a while. Keep the list short. */
export type TemporaryPermission = Extract<PermissionName<ToolsRbac>, 'customers.impersonate' | 'orders.refund'>

/** Grants the permission until `now + hours`. Returns when it ends (`null`: the person has it for good). */
export async function grantTemporaryAccess(
  rbac: Rbac<ToolsRbac>,
  input: { staffId: number; permission: TemporaryPermission; hours: number; grantedBy: number },
  now = new Date(),
): Promise<Date | null> {
  const staff = rbac.for({ type: 'staff', id: input.staffId }, { actor: { type: 'staff', id: input.grantedBy } })
  const expiresAt = new Date(now.getTime() + input.hours * 3_600_000)

  // Granting again replaces the end time (the latest call wins), so never shorten a running grant.
  const current = (await staff.getDirectPermissionAssignments()).find((a) => a.permission.name === input.permission)
  if (current && (current.expiresAt === null || current.expiresAt >= expiresAt)) return current.expiresAt

  await staff.givePermissionTo(input.permission, { expiresAt })
  return expiresAt
}
