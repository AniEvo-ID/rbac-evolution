/**
 * @anievo-id/rbac-evolution-react-router
 *
 * React Router 7 and 8 (framework mode) and Remix: guards for loaders and actions, and the snapshot for
 * `<RbacProvider>` of `@anievo-id/rbac-evolution-react`. Server-only: import it from `*.server.ts` modules, loaders
 * and actions.
 */

export { createRbacServer } from './server'
export type {
  GetSnapshotOptions,
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
  RbacServer,
  RbacServerOptions,
  RoleGuardOptions,
  RoleOrPermissionGuardOptions,
  RouteArgs,
  RouteGuardOptions,
  ScopedGuard,
  ScopedGuards,
  TypesOf,
} from './server'
