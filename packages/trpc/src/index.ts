/**
 * @anievo-id/rbac-evolution-trpc
 *
 * tRPC middleware for rbac-evolution: `t.procedure.use(requirePermission('posts.edit'))`, with a non-null,
 * typed `ctx.rbac` after the guard.
 */

export { createRbacContext } from './context'
export type { GuardSubject, RbacContext, RbacContextOptions, TypesOf } from './context'

export { getRbacErrorBody, RbacAccessError, RbacContextMissingError, rbacErrorFormatter } from './errors'
export type { RbacErrorBody } from './errors'

export {
  createGuards,
  requirePermission,
  requireRole,
  requireRoleOrPermission,
  canAny,
  canAll,
} from './guards'
export type {
  CreateGuardsOptions,
  GuardCallOptions,
  GuardContext,
  GuardHandler,
  GuardHandlerOptions,
  GuardHandlers,
  GuardKind,
  Guard,
  GuardNames,
  Guards,
  GuardsFor,
  PermissionGuardOptions,
  RbacMiddleware,
  RbacProcedureContext,
  RbacResolver,
  RoleGuardOptions,
  RoleOrPermissionGuardOptions,
  RouteGuardOptions,
  ScopedGuard,
  ScopedGuards,
} from './guards'
