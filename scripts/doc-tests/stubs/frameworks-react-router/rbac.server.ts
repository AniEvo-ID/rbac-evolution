// The guide's `app/rbac.server.ts` (its Setup block), as the route modules import it.
import { createRbac, type RbacAdapter } from '@anievo-id/rbac-evolution'
import { createRbacServer } from '@anievo-id/rbac-evolution-react-router'

declare const adapter: RbacAdapter
declare function getUser(request: Request): Promise<{ id: string } | null>

export const rbac = createRbac({ adapter })
export const rbacServer = createRbacServer({
  rbac,
  getSubject: async ({ request }) => {
    const user = await getUser(request)
    return user ? { type: 'user', id: user.id } : null
  },
})
