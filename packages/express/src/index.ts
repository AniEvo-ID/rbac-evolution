/**
 * @anievo-id/rbac-evolution-express
 *
 * Express middleware for rbac-evolution — works with Express 4 and 5.
 */

export { asyncHandler, rbacMiddleware } from './middleware'
export type { RbacMiddlewareOptions } from './middleware'

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
  GuardKind,
  Guard,
  GuardNames,
  Guards,
  PermissionGuardOptions,
  RoleGuardOptions,
  RoleOrPermissionGuardOptions,
} from './guards'
