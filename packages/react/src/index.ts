/**
 * @anievo-id/rbac-evolution-react
 *
 * Client-side UI helpers. They only show/hide UI — always enforce authorization on the server.
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
export type { RbacProviderProps } from './context'

export { Can, Cannot, HasRole, UnlessRole } from './components'
export type { CannotProps, CanProps, HasRoleProps, PermissionCondition, RoleCondition, UnlessRoleProps } from './components'
