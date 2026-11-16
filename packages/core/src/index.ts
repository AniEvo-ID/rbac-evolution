/**
 * @anievo-id/rbac-evolution
 *
 * Framework-agnostic RBAC engine — roles, permissions, guards, wildcards and teams.
 */

import { version } from '../package.json'

export { createRbac, Rbac, RoleRbac, SubjectRbac } from './rbac'
export type { BeforeContext, BeforeHook, GuardOptions, RbacOptions, ScopeOptions } from './rbac'
export type { RevokeAllOptions, SubjectTeamsOptions } from './bulk'
export { isPermissionName, isRoleName } from './names'
export type { RbacNames } from './names'
export type {
  SyncDefinition,
  SyncOptions,
  SyncPermissionChange,
  SyncResult,
  SyncRoleChange,
  SyncRolePermissions,
  SyncRoleUpdate,
} from './sync'
export type { SubjectsWithPermissionOptions } from './query'

export type {
  ActorOptions,
  ActorResolver,
  PermissionAttachedEvent,
  PermissionCreatedEvent,
  PermissionDeletedEvent,
  PermissionDetachedEvent,
  PermissionTarget,
  RbacActor,
  RbacEvent,
  RbacEventBase,
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
  SubjectLinks,
  SubjectPermissionLink,
  SubjectRoleLink,
} from './adapter'
export { MemoryAdapter } from './adapters/memory'

export { MemoryCache, type MemoryCacheOptions } from './cache'
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
export type { WildcardPrefixCheck } from './wildcard'

export {
  permissionRequirement,
  REQUIREMENT_MESSAGES,
  roleOrPermissionRequirement,
  roleRequirement,
  satisfiesRequirement,
  splitRequirementArgs,
  UNAUTHENTICATED_MESSAGE,
} from './requirements'
export type {
  CheckRequirementName,
  NamesRequired,
  OptionsMustBeLast,
  PermissionRequirementOptions,
  RbacRequirement,
  RequirementArgs,
  RequirementKind,
  RequirementNames,
  RoleRequirementOptions,
  UnknownRequirementName,
} from './requirements'

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
  SnapshotOptions,
  Subject,
  TeamId,
} from './types'

/** Version of this package (read from package.json at build time). */
export const VERSION: string = version
