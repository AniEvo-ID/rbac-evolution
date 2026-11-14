import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createNextRbac } from '@anievo-id/rbac-evolution-next'
import { SESSION_COOKIE, parseUserId } from './demo-auth'
import { prisma } from './prisma'
import { rbac } from './rbac-engine'

export { rbac }

/** The logged-in demo user, or `null` for guests. */
export async function getCurrentUser() {
  const id = parseUserId((await cookies()).get(SESSION_COOKIE)?.value)
  return id === null ? null : prisma.user.findUnique({ where: { id } })
}

export const {
  getSubject,
  getSnapshot,
  can,
  requirePermission,
  requireRole,
  withPermission,
  withRole,
  withRbac,
} = createNextRbac({
  rbac,
  getSubject: async () => {
    const user = await getCurrentUser()
    return user ? { type: 'user', id: user.id } : null
  },
  loginUrl: '/login',
  // The default is notFound(), which hides that the page exists. The demo shows a 403 page instead.
  onUnauthorized: () => redirect('/forbidden'),
})
