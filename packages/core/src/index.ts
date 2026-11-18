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
export type { RbacGuardNames, RbacNames } from './names'
export type {
  GuardSyncDefinition,
  SyncDefinition,
  SyncDefinitions,
  SyncOptions,
  SyncPermissionChange,
  SyncResult,
  SyncRoleChange,
  SyncRolePermissions,
  SyncRoleUpdate,
} from './sync'
export type { SubjectsWithoutPermissionOptions, SubjectsWithoutRoleOptions, SubjectsWithPermissionOptions } from './query'
export type { ExpiryArgs, ExpiryOptions, PermissionAssignment, RoleAssignment } from './expiry'

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
  ActiveLinkOptions,
  AttachLinkOptions,
  DeletedLinkCounts,
  FindPermissionsQuery,
  FindRolesQuery,
  RbacAdapter,
  RolePermissionLink,
  SubjectLinks,
  SubjectPermissionLink,
  SubjectRoleLink,
} from './adapter'
export { MemoryAdapter, type MemoryAdapterOptions } from './adapters/memory'

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
  CheckRequirementGuard,
  CheckRequirementName,
  GuardRequirementArgs,
  NamesRequired,
  OptionsMustBeLast,
  PermissionRequirementOptions,
  RbacRequirement,
  RequirementArgs,
  RequirementGuard,
  RequirementKind,
  RequirementName,
  RequirementNames,
  RoleRequirementOptions,
  UnknownGuardName,
  UnknownRequirementName,
} from './requirements'

export type {
  CheckGuard,
  DefaultGuardName,
  DefaultRbacTypes,
  GuardName,
  Id,
  Many,
  Permission,
  PermissionInput,
  PermissionName,
  RbacGuardTypes,
  RbacSnapshot,
  RbacTypeConfig,
  Role,
  RoleInput,
  RoleName,
  ScopedGuardName,
  SnapshotOptions,
  Subject,
  TeamId,
} from './types'

/** Version of this package (read from package.json at build time). */
export const VERSION: string = version
