import type { Id, Permission, Role, Subject, TeamId } from './types'

export interface FindPermissionsQuery {
  ids?: readonly Id[] | undefined
  names?: readonly string[] | undefined
  guardName?: string | undefined
}

export interface FindRolesQuery {
  ids?: readonly Id[] | undefined
  names?: readonly string[] | undefined
  guardName?: string | undefined
  /** Match roles whose `teamId` is one of these values (`null` = global roles). */
  teamIds?: readonly TeamId[] | undefined
}

export interface RolePermissionLink {
  roleId: Id
  permissionId: Id
}

/** One row of `model_has_roles`: a subject holds a role in a team (`null` = global). */
export interface SubjectRoleLink {
  subject: Subject
  roleId: Id
  teamId: TeamId
}

/** One row of `model_has_permissions`: a subject holds a direct permission in a team (`null` = global). */
export interface SubjectPermissionLink {
  subject: Subject
  permissionId: Id
  teamId: TeamId
}

/** Rows of `model_has_roles` and `model_has_permissions`, as returned by the optional bulk reads of {@link RbacAdapter}. */
export interface SubjectLinks {
  roles: SubjectRoleLink[]
  permissions: SubjectPermissionLink[]
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

  // optional bulk operations: the engine checks for each one before use (see each method for its fallback)

  /**
   * Every role and direct-permission link of the subject, in EVERY team (global included), whatever the guard.
   * Match the subject exactly, like `getSubjectRoleIds`.
   *
   * Used by `rbac.for(subject).teams()` and `revokeAll({ allTeams: true })`. No fallback: the required
   * methods can only read one team at a time, so without it those two throw `ADAPTER_METHOD_MISSING`.
   */
  getSubjectLinks?(subject: Subject): Promise<SubjectLinks>

  /**
   * Every role and direct-permission link held in the team, by any subject, whatever the guard.
   * Match the team id exactly. Never called with `null` (the global scope).
   *
   * Used by `rbac.deleteTeam()`. No fallback: the required methods need each subject's type and id, so
   * without it `deleteTeam()` throws `ADAPTER_METHOD_MISSING` before writing anything.
   */
  getTeamLinks?(teamId: Id): Promise<SubjectLinks>

  /**
   * Removes every role and direct-permission link held in the team (`model_has_*` rows only; roles stay).
   * Match the team id exactly. Never called with `null` (the global scope).
   *
   * Used by `rbac.deleteTeam()`. Fallback: one `detachSubjectRoles` and one `detachSubjectPermissions`
   * call (with `undefined` ids) per subject returned by `getTeamLinks`.
   */
  detachTeamLinks?(teamId: Id): Promise<void>
}
