/**
 * @anievo-id/rbac-evolution-next
 *
 * Server-side helpers for Next.js: server components, server actions, route handlers and middleware.
 */

export { createNextRbac, forbiddenMessage } from './server'
export type { AuthorizeResult, NextRbac, NextRbacOptions, RequireOptions, WithRbacOptions } from './server'

export { RbacUnauthorizedError } from './errors'

export * from './middleware-entry'
export type { FailureReason } from './types'
