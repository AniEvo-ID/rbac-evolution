/**
 * @anievo-id/rbac-evolution-fastify
 *
 * Fastify plugin and `preHandler` guards for rbac-evolution.
 */

export { rbacPlugin } from './plugin'
export type { RbacHook, RbacPluginOptions } from './plugin'

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
  GuardHook,
  GuardKind,
  GuardNames,
  PermissionGuardOptions,
  RoleGuardOptions,
  RoleOrPermissionGuardOptions,
} from './guards'
