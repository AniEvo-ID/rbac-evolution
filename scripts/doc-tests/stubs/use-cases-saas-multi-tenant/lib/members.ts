// Stub: a copy of the `lib/members.ts` block of docs/use-cases/saas-multi-tenant.md.
import type { Rbac } from '@anievo-id/rbac-evolution'
import type { SaasRbac } from '@/lib/rbac'

export async function isLastOwner(rbac: Rbac<SaasRbac>, orgId: string, userId: string): Promise<boolean> {
  const owners = await rbac.subjectsWithRole('user', 'owner', { team: orgId })
  return owners.length === 1 && String(owners[0]) === userId
}
