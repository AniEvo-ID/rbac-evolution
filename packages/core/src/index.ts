/**
 * @anievo-id/rbac-evolution
 *
 * Framework-agnostic RBAC engine — roles, permissions, guards, wildcards and teams.
 */

export { createRbac, Rbac, RoleRbac, SubjectRbac } from './rbac'
export type { BeforeContext, BeforeHook, GuardOptions, RbacOptions, ScopeOptions } from './rbac'

export type {
  PermissionAttachedEvent,
  PermissionCreatedEvent,
  PermissionDeletedEvent,
  PermissionDetachedEvent,
  PermissionTarget,
  RbacEvent,
  RbacEventListener,
  RbacEventMap,
  RbacEventName,
  RoleAttachedEvent,
  RoleCreatedEvent,
  RoleDeletedEvent,
  RoleDetachedEvent,
} from './events'

export type {
  FindPermissionsQuery,
  FindRolesQuery,
  RbacAdapter,
  RolePermissionLink,
} from './adapter'
export { MemoryAdapter } from './adapters/memory'

export { MemoryCache } from './cache'
export type { CacheStore } from './cache'

export {
  GuardDoesNotMatch,
  InvalidWildcardPermission,
  PermissionAlreadyExists,
  PermissionDoesNotExist,
  RbacError,
  RoleAlreadyExists,
  RoleDoesNotExist,
} from './errors'
export type { RbacErrorCode } from './errors'

export { parseWildcardPermission, wildcardImplies } from './wildcard'

export type {
  DefaultRbacTypes,
  Id,
  Many,
  Permission,
  PermissionInput,
  PermissionName,
  RbacSnapshot,
  RbacTypeConfig,
  Role,
  RoleInput,
  RoleName,
  Subject,
  TeamId,
} from './types'

export const VERSION = '0.0.0'
