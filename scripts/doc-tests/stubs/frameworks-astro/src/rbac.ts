// The guide's `src/rbac.ts` (its Setup block), as `src/middleware.ts` imports it.
import { createRbac, type RbacAdapter } from '@anievo-id/rbac-evolution'
import { createRbacServer } from '@anievo-id/rbac-evolution-astro'

declare const adapter: RbacAdapter

export const rbac = createRbac({ adapter })
export const rbacServer = createRbacServer({
  rbac,
  getSubject: ({ locals }) => (locals.user ? { type: 'user', id: locals.user.id } : null),
  unauthenticatedRedirect: ({ url }) => `/login?redirectTo=${url.pathname}`,
})
