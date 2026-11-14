/**
 * @anievo-id/rbac-evolution-next/middleware
 *
 * Middleware-only entry: does not import `next/navigation`.
 */

export { createRbacMiddleware } from './middleware'
export type {
  MiddlewareRequest,
  RbacMiddlewareOptions,
  RbacMiddlewareRule,
  RbacMiddlewareWithRbac,
  RbacMiddlewareWithSnapshot,
} from './middleware'
export { compilePathPattern, matchPath } from './matcher'
export type { PathMatcher } from './matcher'
export { snapshotSatisfies } from './snapshot'
export type { SnapshotCheckOptions } from './snapshot'
export type { MaybePromise, Requirement } from './types'
