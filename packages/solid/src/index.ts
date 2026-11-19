/**
 * @anievo-id/rbac-evolution-solid
 *
 * Client-side UI helpers for Solid. They only show/hide UI: always enforce authorization on the server.
 */

export { createRbacChecker } from './checker'
export type { RbacChecker, RbacCheckerOptions } from './checker'

export {
  RbacProvider,
  useCan,
  useCanAll,
  useCanAny,
  useCannot,
  useHasAllRoles,
  useHasAnyRole,
  useHasRole,
  useRbac,
} from './context'
export type { RbacProviderProps, SolidElement } from './context'

export { Can, Cannot, HasRole, UnlessRole } from './components'
export type { CannotProps, CanProps, HasRoleProps, PermissionCondition, RoleCondition, UnlessRoleProps } from './components'
