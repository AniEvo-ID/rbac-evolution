/**
 * @anievo-id/rbac-evolution-tanstack-start
 *
 * TanStack Start (React and Solid): guards for server functions, middleware and server routes, and the snapshot for
 * `<RbacProvider>` of `@anievo-id/rbac-evolution-react`. Server-only: call it inside server functions, `.server()`
 * middleware and server route handlers.
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
  RouteGuardOptions,
  ScopedGuard,
  ScopedGuards,
  TypesOf,
} from './server'
