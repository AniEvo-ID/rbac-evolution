/**
 * @anievo-id/rbac-evolution-elysia
 *
 * Elysia plugin and `beforeHandle` guards for rbac-evolution (Bun, Node, Deno, Cloudflare Workers).
 */

export { rbacPlugin } from './plugin'
export type { RbacContext, RbacPluginOptions, RbacRequestContext, TypesOf } from './plugin'

export {
  createGuards,
  RbacPluginMissingError,
  requirePermission,
  requireRole,
  requireRoleOrPermission,
  canAny,
  canAll,
} from './guards'
export type {
  BeforeHandle,
  GuardContext,
  GuardHandler,
  GuardHandlerContext,
  GuardHandlers,
  RouteGuardOptions,
  GuardKind,
  Guard,
  GuardNames,
  Guards,
  GuardsFor,
  ScopedGuard,
  ScopedGuards,
  PermissionGuardOptions,
  RoleGuardOptions,
  RoleOrPermissionGuardOptions,
} from './guards'
