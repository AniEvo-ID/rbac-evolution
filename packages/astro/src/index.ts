/**
 * @anievo-id/rbac-evolution-astro
 *
 * Astro: guards for pages, endpoints and middleware, and the snapshot for client islands
 * (`<RbacProvider>` of `@anievo-id/rbac-evolution-react`). Server-only: import it in frontmatter, endpoints and
 * `src/middleware.ts`.
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
  AstroContext,
  RouteGuardOptions,
  ScopedGuard,
  ScopedGuards,
  TypesOf,
} from './server'
