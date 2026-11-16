import type {
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
} from '../adapter'
import type { Id, Permission, Role, Subject, TeamId } from '../types'

interface SubjectLink {
  subjectType: string
  subjectId: Id
  targetId: Id
  teamId: TeamId
  /** Only kept with `{ expiry: true }`. */
  expiresAt?: Date | null
}

export interface MemoryAdapterOptions {
  /**
   * Store an expiry per role assignment and direct permission, so `assignRole(..., { expiresAt })` works.
   * Default: `false`, as for the database adapters.
   */
  expiry?: boolean | undefined
}

const key = (id: Id | null): string => (id === null ? '\u0000null' : String(id))
const same = (a: Id | null, b: Id | null): boolean => key(a) === key(b)
const inIds = (ids: readonly (Id | null)[], id: Id | null): boolean => ids.some((x) => same(x, id))
const isSubject = (l: SubjectLink, s: Subject): boolean => l.subjectType === s.type && same(l.subjectId, s.id)

/**
 * In-memory adapter. Great for tests, prototypes, or apps whose roles are defined in code.
 * Data is lost when the process exits.
 */
export class MemoryAdapter implements RbacAdapter {
  readonly supportsExpiry: boolean
  private nextId = 1
  private permissions: Permission[] = []
  private roles: Role[] = []
  private rolePermissions: RolePermissionLink[] = []
  private subjectRoles: SubjectLink[] = []
  private subjectPermissions: SubjectLink[] = []

  constructor(options: MemoryAdapterOptions = {}) {
    this.supportsExpiry = options.expiry === true
  }

  // ---------------------------------------------------------------- permissions

  async createPermission(data: { name: string; guardName: string }): Promise<Permission> {
    const permission: Permission = { id: this.nextId++, name: data.name, guardName: data.guardName }
    this.permissions.push(permission)
    return { ...permission }
  }

  async findPermissions(query: FindPermissionsQuery = {}): Promise<Permission[]> {
    return this.permissions
      .filter(
        (p) =>
          (query.ids === undefined || inIds(query.ids, p.id)) &&
          (query.names === undefined || query.names.includes(p.name)) &&
          (query.guardName === undefined || p.guardName === query.guardName),
      )
      .map((p) => ({ ...p }))
  }

  async deletePermission(id: Id): Promise<void> {
    this.permissions = this.permissions.filter((p) => !same(p.id, id))
    this.rolePermissions = this.rolePermissions.filter((l) => !same(l.permissionId, id))
    this.subjectPermissions = this.subjectPermissions.filter((l) => !same(l.targetId, id))
  }

  // ---------------------------------------------------------------------- roles

  async createRole(data: { name: string; guardName: string; teamId: TeamId }): Promise<Role> {
    const role: Role = { id: this.nextId++, name: data.name, guardName: data.guardName, teamId: data.teamId }
    this.roles.push(role)
    return { ...role }
  }

  async findRoles(query: FindRolesQuery = {}): Promise<Role[]> {
    return this.roles
      .filter(
        (r) =>
          (query.ids === undefined || inIds(query.ids, r.id)) &&
          (query.names === undefined || query.names.includes(r.name)) &&
          (query.guardName === undefined || r.guardName === query.guardName) &&
          (query.teamIds === undefined || inIds(query.teamIds, r.teamId)),
      )
      .map((r) => ({ ...r }))
  }

  async deleteRole(id: Id): Promise<void> {
    this.roles = this.roles.filter((r) => !same(r.id, id))
    this.rolePermissions = this.rolePermissions.filter((l) => !same(l.roleId, id))
    this.subjectRoles = this.subjectRoles.filter((l) => !same(l.targetId, id))
  }

  // ---------------------------------------------------------- role ↔ permission

  async getRolePermissionLinks(roleIds: readonly Id[]): Promise<RolePermissionLink[]> {
    return this.rolePermissions.filter((l) => inIds(roleIds, l.roleId)).map((l) => ({ ...l }))
  }

  async attachRolePermissions(roleId: Id, permissionIds: readonly Id[]): Promise<void> {
    for (const permissionId of permissionIds) {
      const exists = this.rolePermissions.some((l) => same(l.roleId, roleId) && same(l.permissionId, permissionId))
      if (!exists) this.rolePermissions.push({ roleId, permissionId })
    }
  }

  async detachRolePermissions(roleId: Id, permissionIds?: readonly Id[]): Promise<void> {
    this.rolePermissions = this.rolePermissions.filter(
      (l) => !(same(l.roleId, roleId) && (permissionIds === undefined || inIds(permissionIds, l.permissionId))),
    )
  }

  // ------------------------------------------------------------- subject links

  async getSubjectRoleIds(subject: Subject, teamId: TeamId): Promise<Id[]> {
    return MemoryAdapter.getLinks(this.subjectRoles, subject, teamId)
  }

  async attachSubjectRoles(
    subject: Subject,
    roleIds: readonly Id[],
    teamId: TeamId,
    options?: AttachLinkOptions,
  ): Promise<void> {
    this.attach(this.subjectRoles, subject, roleIds, teamId, options)
  }

  async detachSubjectRoles(subject: Subject, roleIds: readonly Id[] | undefined, teamId: TeamId): Promise<void> {
    this.subjectRoles = MemoryAdapter.detach(this.subjectRoles, subject, roleIds, teamId)
  }

  async getSubjectPermissionIds(subject: Subject, teamId: TeamId): Promise<Id[]> {
    return MemoryAdapter.getLinks(this.subjectPermissions, subject, teamId)
  }

  async attachSubjectPermissions(
    subject: Subject,
    permissionIds: readonly Id[],
    teamId: TeamId,
    options?: AttachLinkOptions,
  ): Promise<void> {
    this.attach(this.subjectPermissions, subject, permissionIds, teamId, options)
  }

  async detachSubjectPermissions(
    subject: Subject,
    permissionIds: readonly Id[] | undefined,
    teamId: TeamId,
  ): Promise<void> {
    this.subjectPermissions = MemoryAdapter.detach(this.subjectPermissions, subject, permissionIds, teamId)
  }

  async getSubjectIdsWithRoles(
    subjectType: string,
    roleIds: readonly Id[],
    teamId: TeamId,
    options?: ActiveLinkOptions,
  ): Promise<Id[]> {
    return this.reverse(this.subjectRoles, subjectType, roleIds, teamId, options)
  }

  async getSubjectIdsWithPermissions(
    subjectType: string,
    permissionIds: readonly Id[],
    teamId: TeamId,
    options?: ActiveLinkOptions,
  ): Promise<Id[]> {
    return this.reverse(this.subjectPermissions, subjectType, permissionIds, teamId, options)
  }

  // ----------------------------------------------------------- expiry (optional)

  async getSubjectRoleLinks(subject: Subject, teamId: TeamId): Promise<SubjectRoleLink[]> {
    return this.toLinks(this.subjectRoles.filter((l) => isSubject(l, subject) && same(l.teamId, teamId)), []).roles
  }

  async getSubjectPermissionLinks(subject: Subject, teamId: TeamId): Promise<SubjectPermissionLink[]> {
    const links = this.subjectPermissions.filter((l) => isSubject(l, subject) && same(l.teamId, teamId))
    return this.toLinks([], links).permissions
  }

  async deleteExpiredLinks(now: Date): Promise<DeletedLinkCounts> {
    const expired = (l: SubjectLink): boolean => l.expiresAt != null && l.expiresAt.getTime() <= now.getTime()
    const roles = this.subjectRoles.filter(expired).length
    const permissions = this.subjectPermissions.filter(expired).length
    this.subjectRoles = this.subjectRoles.filter((l) => !expired(l))
    this.subjectPermissions = this.subjectPermissions.filter((l) => !expired(l))
    return { roles, permissions }
  }

  // ------------------------------------------------------------- bulk (optional)

  async getSubjectLinks(subject: Subject): Promise<SubjectLinks> {
    return this.toLinks(
      this.subjectRoles.filter((l) => isSubject(l, subject)),
      this.subjectPermissions.filter((l) => isSubject(l, subject)),
    )
  }

  async getTeamLinks(teamId: Id): Promise<SubjectLinks> {
    return this.toLinks(
      this.subjectRoles.filter((l) => same(l.teamId, teamId)),
      this.subjectPermissions.filter((l) => same(l.teamId, teamId)),
    )
  }

  async detachTeamLinks(teamId: Id): Promise<void> {
    this.subjectRoles = this.subjectRoles.filter((l) => !same(l.teamId, teamId))
    this.subjectPermissions = this.subjectPermissions.filter((l) => !same(l.teamId, teamId))
  }

  // -------------------------------------------------------------------- helpers

  private toLinks(roles: SubjectLink[], permissions: SubjectLink[]): SubjectLinks {
    const subject = (l: SubjectLink): Subject => ({ type: l.subjectType, id: l.subjectId })
    // Without expiry, links look exactly as in 1.1 (no `expiresAt` key).
    const expiry = (l: SubjectLink) => (this.supportsExpiry ? { expiresAt: MemoryAdapter.copy(l.expiresAt) } : {})
    return {
      roles: roles.map((l) => ({ subject: subject(l), roleId: l.targetId, teamId: l.teamId, ...expiry(l) })),
      permissions: permissions.map((l) => ({
        subject: subject(l),
        permissionId: l.targetId,
        teamId: l.teamId,
        ...expiry(l),
      })),
    }
  }

  private static copy(date: Date | null | undefined): Date | null {
    return date === undefined || date === null ? null : new Date(date.getTime())
  }

  private static getLinks(links: SubjectLink[], subject: Subject, teamId: TeamId): Id[] {
    return links.filter((l) => isSubject(l, subject) && same(l.teamId, teamId)).map((l) => l.targetId)
  }

  private attach(
    links: SubjectLink[],
    subject: Subject,
    ids: readonly Id[],
    teamId: TeamId,
    options: AttachLinkOptions | undefined,
  ): void {
    // The expiry is only stored with `{ expiry: true }`; then the latest attach of a link sets it.
    const expiry = this.supportsExpiry ? { expiresAt: MemoryAdapter.copy(options?.expiresAt) } : {}
    for (const targetId of ids) {
      const existing = links.find((l) => isSubject(l, subject) && same(l.targetId, targetId) && same(l.teamId, teamId))
      if (existing) Object.assign(existing, expiry)
      else links.push({ subjectType: subject.type, subjectId: subject.id, targetId, teamId, ...expiry })
    }
  }

  private static detach(
    links: SubjectLink[],
    subject: Subject,
    ids: readonly Id[] | undefined,
    teamId: TeamId,
  ): SubjectLink[] {
    return links.filter(
      (l) => !(isSubject(l, subject) && same(l.teamId, teamId) && (ids === undefined || inIds(ids, l.targetId))),
    )
  }

  private reverse(
    links: SubjectLink[],
    subjectType: string,
    ids: readonly Id[],
    teamId: TeamId,
    options: ActiveLinkOptions | undefined,
  ): Id[] {
    const seen = new Set<string>()
    const out: Id[] = []
    const now = this.supportsExpiry ? options?.now.getTime() : undefined
    for (const l of links) {
      if (l.subjectType !== subjectType || !same(l.teamId, teamId) || !inIds(ids, l.targetId)) continue
      if (now !== undefined && l.expiresAt != null && l.expiresAt.getTime() <= now) continue
      const k = key(l.subjectId)
      if (seen.has(k)) continue
      seen.add(k)
      out.push(l.subjectId)
    }
    return out
  }
}
