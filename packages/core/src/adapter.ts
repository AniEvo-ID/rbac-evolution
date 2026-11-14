import type { Id, Permission, Role, Subject, TeamId } from './types'

export interface FindPermissionsQuery {
  ids?: readonly Id[]
  names?: readonly string[]
  guardName?: string
}

export interface FindRolesQuery {
  ids?: readonly Id[]
  names?: readonly string[]
  guardName?: string
  /** Match roles whose `teamId` is one of these values (`null` = global roles). */
  teamIds?: readonly TeamId[]
}

export interface RolePermissionLink {
  roleId: Id
  permissionId: Id
}

/**
 * Storage layer. Implement this to plug rbac-evolution into any database / ORM
 * (Prisma, Drizzle, TypeORM, Mongoose, ...).
 *
 * Conceptually it maps to the same tables as spatie/laravel-permission:
 * `permissions`, `roles`, `role_has_permissions`, `model_has_roles`, `model_has_permissions`.
 *
 * Rules for implementers:
 * - All `attach*` methods must be idempotent (attaching an existing link is a no-op).
 * - `detach*` methods with `undefined` ids remove every link for that owner (and team).
 * - `deletePermission` / `deleteRole` must also remove their links.
 * - Uniqueness of names is checked by the engine; adapters may additionally enforce it.
 */
export interface RbacAdapter {
  // permissions
  createPermission(data: { name: string; guardName: string }): Promise<Permission>
  findPermissions(query?: FindPermissionsQuery): Promise<Permission[]>
  deletePermission(id: Id): Promise<void>

  // roles
  createRole(data: { name: string; guardName: string; teamId: TeamId }): Promise<Role>
  findRoles(query?: FindRolesQuery): Promise<Role[]>
  deleteRole(id: Id): Promise<void>

  // role ↔ permission
  getRolePermissionLinks(roleIds: readonly Id[]): Promise<RolePermissionLink[]>
  attachRolePermissions(roleId: Id, permissionIds: readonly Id[]): Promise<void>
  detachRolePermissions(roleId: Id, permissionIds?: readonly Id[]): Promise<void>

  // subject ↔ role
  getSubjectRoleIds(subject: Subject, teamId: TeamId): Promise<Id[]>
  attachSubjectRoles(subject: Subject, roleIds: readonly Id[], teamId: TeamId): Promise<void>
  detachSubjectRoles(subject: Subject, roleIds: readonly Id[] | undefined, teamId: TeamId): Promise<void>

  // subject ↔ permission (direct permissions)
  getSubjectPermissionIds(subject: Subject, teamId: TeamId): Promise<Id[]>
  attachSubjectPermissions(subject: Subject, permissionIds: readonly Id[], teamId: TeamId): Promise<void>
  detachSubjectPermissions(
    subject: Subject,
    permissionIds: readonly Id[] | undefined,
    teamId: TeamId,
  ): Promise<void>

  // reverse lookups (spatie: `User::role('writer')->get()`, `User::permission('edit')->get()`)
  /** Ids of subjects of `subjectType` that have ANY of the given roles in the given team. Unique. */
  getSubjectIdsWithRoles(subjectType: string, roleIds: readonly Id[], teamId: TeamId): Promise<Id[]>
  /** Ids of subjects of `subjectType` that have ANY of the given DIRECT permissions in the given team. Unique. */
  getSubjectIdsWithPermissions(subjectType: string, permissionIds: readonly Id[], teamId: TeamId): Promise<Id[]>
}
