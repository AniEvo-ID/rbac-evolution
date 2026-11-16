// Stub: a copy of the `lib/org.ts` block of docs/use-cases/saas-multi-tenant.md.
import { cache } from 'react'
import { cookies } from 'next/headers'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

/** The organization the user works in: the `org` cookie, if the user is a member of it. */
export const currentOrgId = cache(async (): Promise<string | undefined> => {
  const session = await auth()
  const orgId = (await cookies()).get('org')?.value
  if (!session?.user?.id || !orgId) return undefined

  const member = await prisma.membership.findFirst({ where: { orgId, userId: session.user.id } })
  return member ? orgId : undefined
})
