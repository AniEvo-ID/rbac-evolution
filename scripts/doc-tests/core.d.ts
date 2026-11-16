// Doc tests (scripts/doc-tests.mjs): the core package's exports, in scope for every checked block.
// A snippet that calls `createRbac(...)` or annotates `: Subject` without importing it means the one
// from '@anievo-id/rbac-evolution'. A block that imports a name itself shadows the one here.

type Core = typeof import('@anievo-id/rbac-evolution')
type RbacTypeConfig = import('@anievo-id/rbac-evolution').RbacTypeConfig
type DefaultRbacTypes = import('@anievo-id/rbac-evolution').DefaultRbacTypes

// --- values (functions, classes, constants) ---
declare const createRbac: Core['createRbac']
declare const MemoryAdapter: Core['MemoryAdapter']
declare const MemoryCache: Core['MemoryCache']
declare const Rbac: Core['Rbac']
declare const SubjectRbac: Core['SubjectRbac']
declare const RoleRbac: Core['RoleRbac']
declare const RbacError: Core['RbacError']
declare const PermissionDoesNotExist: Core['PermissionDoesNotExist']
declare const PermissionAlreadyExists: Core['PermissionAlreadyExists']
declare const RoleDoesNotExist: Core['RoleDoesNotExist']
declare const RoleAlreadyExists: Core['RoleAlreadyExists']
declare const GuardDoesNotMatch: Core['GuardDoesNotMatch']
declare const InvalidWildcardPermission: Core['InvalidWildcardPermission']
declare const wildcardImplies: Core['wildcardImplies']

// --- types ---
type Rbac<T extends RbacTypeConfig = DefaultRbacTypes> = import('@anievo-id/rbac-evolution').Rbac<T>
type SubjectRbac<T extends RbacTypeConfig = DefaultRbacTypes> = import('@anievo-id/rbac-evolution').SubjectRbac<T>
type RoleRbac<T extends RbacTypeConfig = DefaultRbacTypes> = import('@anievo-id/rbac-evolution').RoleRbac<T>
type RbacOptions<T extends RbacTypeConfig = DefaultRbacTypes> = import('@anievo-id/rbac-evolution').RbacOptions<T>
type RoleName<T extends RbacTypeConfig = DefaultRbacTypes> = import('@anievo-id/rbac-evolution').RoleName<T>
type SyncDefinition<T extends RbacTypeConfig = DefaultRbacTypes> = import('@anievo-id/rbac-evolution').SyncDefinition<T>
type MemoryAdapter = import('@anievo-id/rbac-evolution').MemoryAdapter
type MemoryCache = import('@anievo-id/rbac-evolution').MemoryCache
type RbacError = import('@anievo-id/rbac-evolution').RbacError
type RbacAdapter = import('@anievo-id/rbac-evolution').RbacAdapter
type CacheStore = import('@anievo-id/rbac-evolution').CacheStore
type Subject = import('@anievo-id/rbac-evolution').Subject
type Id = import('@anievo-id/rbac-evolution').Id
type TeamId = import('@anievo-id/rbac-evolution').TeamId
type Permission = import('@anievo-id/rbac-evolution').Permission
type Role = import('@anievo-id/rbac-evolution').Role
type RolePermissionLink = import('@anievo-id/rbac-evolution').RolePermissionLink
type SubjectLinks = import('@anievo-id/rbac-evolution').SubjectLinks
type FindPermissionsQuery = import('@anievo-id/rbac-evolution').FindPermissionsQuery
type FindRolesQuery = import('@anievo-id/rbac-evolution').FindRolesQuery
type RbacSnapshot = import('@anievo-id/rbac-evolution').RbacSnapshot
type RbacEvent = import('@anievo-id/rbac-evolution').RbacEvent
