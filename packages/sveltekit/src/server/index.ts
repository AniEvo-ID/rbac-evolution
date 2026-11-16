/**
 * @anievo-id/rbac-evolution-sveltekit/server
 *
 * Server side of the SvelteKit integration: the `handle` hook, the guards for `load` functions, form actions and
 * `+server.ts` endpoints, and the snapshot for the client. Import it from server-only modules
 * (`hooks.server.ts`, `+page.server.ts`, `+layout.server.ts`, `+server.ts`, `$lib/server/*`).
 */

export { getRbac, getSnapshot, RbacHandleMissingError, rbacHandle } from './handle.js'
export type { GetSnapshotOptions, RbacEvent, RbacHandle, RbacHandleOptions, RbacLocals } from './handle.js'

export {
  canAll,
  canAny,
  createGuards,
  requirePermission,
  requireRole,
  requireRoleOrPermission,
} from './guards.js'
export type {
  Guard,
  GuardContext,
  GuardHandler,
  GuardHandlers,
  GuardKind,
  GuardNames,
  Guards,
  GuardsFor,
  PermissionGuardOptions,
  RbacErrorBody,
  RoleGuardOptions,
  RoleOrPermissionGuardOptions,
  RouteGuardOptions,
  ScopedGuard,
  ScopedGuards,
} from './guards.js'

export type { TypesOf } from '../types.js'
