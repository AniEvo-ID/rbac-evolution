// The guide's `src/middleware.ts`, as `src/server/stats.ts` imports it.
import { createMiddleware } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { rbacServer } from './rbac'

export const adminOnly = createMiddleware({ type: 'function' }).server(async ({ next }) => {
  const rbac = await rbacServer.requireRole(getRequest(), 'admin')
  return next({ context: { rbac } })
})
