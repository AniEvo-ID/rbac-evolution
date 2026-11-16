/**
 * @anievo-id/rbac-evolution-hono
 *
 * Hono middleware for rbac-evolution — runs anywhere Hono runs (Node, Bun, Deno, Workers, edge).
 */

export { rbacMiddleware } from './middleware'
export type { RbacEnv, RbacMiddlewareOptions, RbacVariables } from './middleware'

export {
  createGuards,
  RbacMiddlewareMissingError,
  requirePermission,
  requireRole,
  requireRoleOrPermission,
  canAny,
  canAll,
} from './guards'
export type {
  GuardContext,
  GuardHandler,
  GuardHandlers,
  RouteGuardOptions,
  GuardKind,
  Guard,
  GuardNames,
  Guards,
  PermissionGuardOptions,
  RoleGuardOptions,
  RoleOrPermissionGuardOptions,
} from './guards'
