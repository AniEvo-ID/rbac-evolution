/**
 * @anievo-id/rbac-evolution-fastify
 *
 * Fastify plugin and `preHandler` guards for rbac-evolution.
 */

export { rbacPlugin } from './plugin'
export type { RbacHook, RbacPluginOptions, RbacRegister, RbacRequest, RegisteredRbacTypes } from './plugin'

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
  GuardRequest,
  RouteGuardOptions,
  GuardHook,
  GuardKind,
  Guard,
  GuardNames,
  Guards,
  PermissionGuardOptions,
  RoleGuardOptions,
  RoleOrPermissionGuardOptions,
} from './guards'
