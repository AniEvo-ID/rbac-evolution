// Stub: a copy of the `lib/org.ts` block of docs/use-cases/saas-multi-tenant.md.
import { cache } from 'react'
import { cookies } from 'next/headers'
import { auth } from '@/auth'
import { rbac } from '@/lib/rbac'

/** The organizations of the signed-in user: the teams where they have a role. */
export const myOrgIds = cache(async (): Promise<string[]> => {
  const session = await auth()
  if (!session?.user?.id) return []
  return (await rbac.for({ type: 'user', id: session.user.id }).teams()).map(String)
})

/** The organization the user works in: the `org` cookie, if the user is a member of it. */
export const currentOrgId = cache(async (): Promise<string | undefined> => {
  const orgId = (await cookies()).get('org')?.value
  return orgId && (await myOrgIds()).includes(orgId) ? orgId : undefined
})
