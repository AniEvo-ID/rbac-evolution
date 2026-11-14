import type { RbacAdapter } from './adapter'
import { type CacheStore, MemoryCache } from './cache'
import {
  GuardDoesNotMatch,
  PermissionAlreadyExists,
  PermissionDoesNotExist,
  RbacError,
  RoleAlreadyExists,
  RoleDoesNotExist,
} from './errors'
import type {
  Id,
  Many,
  Permission,
  PermissionInput,
  RbacSnapshot,
  Role,
  RoleInput,
  Subject,
  TeamId,
} from './types'
import { parseWildcardPermission, wildcardImplies } from './wildcard'

export interface GuardOptions {
  /** Guard name, e.g. `web` or `api`. Defaults to `defaultGuard`. */
  guard?: string
}

export interface ScopeOptions extends GuardOptions {
  /** Team id. Only allowed when `teams` is enabled. */
  team?: TeamId
}

export interface RbacOptions {
  /** Storage adapter (e.g. `new MemoryAdapter()`, Prisma, Drizzle, ...). */
  adapter: RbacAdapter
  /** Guard used when none is given. Default: `web`. */
  defaultGuard?: string
  /** Enable wildcard permissions like `articles.*`. Default: `false`. */
  wildcard?: boolean
  /** Enable team-scoped roles & permissions (multi-tenancy). Default: `false`. */
  teams?: boolean
  /** Cache store, or `false` to disable caching. Default: in-memory cache. */
  cache?: CacheStore | false
  /** Cache TTL in milliseconds. Default: 24 hours. */
  cacheTtl?: number
}

const DAY_MS = 24 * 60 * 60 * 1000

const idKey = (id: Id | null): string => (id === null ? '\u0000null' : String(id))

function flatten<T>(items: readonly Many<T>[]): T[] {
  const out: T[] = []
  for (const item of items) {
    if (Array.isArray(item)) out.push(...(item as readonly T[]))
    else out.push(item as T)
  }
  return out
}

function uniqueById<T extends { id: Id }>(items: readonly T[]): T[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const k = idKey(item.id)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

function normalizeName(name: string): string {
  const trimmed = name.trim()
  if (trimmed === '') throw new RbacError('INVALID_NAME', 'Role and permission names must not be empty.')
  return trimmed
}

/**
 * The RBAC engine. Create one per app with {@link createRbac}.
 *
 * ```ts
 * const rbac = createRbac({ adapter: new MemoryAdapter() })
 * await rbac.createPermission('edit articles')
 * await rbac.createRole('writer')
 * await rbac.role('writer').givePermissionTo('edit articles')
 * await rbac.for({ type: 'user', id: 1 }).assignRole('writer')
 * await rbac.for({ type: 'user', id: 1 }).can('edit articles') // true
 * ```
 */
export class Rbac {
  readonly adapter: RbacAdapter
  readonly defaultGuard: string
  readonly wildcard: boolean
  readonly teams: boolean
  readonly #cache: CacheStore | null
  readonly #cacheTtl: number

  constructor(options: RbacOptions) {
    this.adapter = options.adapter
    this.defaultGuard = options.defaultGuard ?? 'web'
    this.wildcard = options.wildcard ?? false
    this.teams = options.teams ?? false
    this.#cache = options.cache === false ? null : (options.cache ?? new MemoryCache())
    this.#cacheTtl = options.cacheTtl ?? DAY_MS
  }

  /** Work with the roles & permissions of a subject (usually a user). */
  for(subject: Subject, options: ScopeOptions = {}): SubjectRbac {
    return new SubjectRbac(this, subject, this.resolveGuard(options.guard), this.resolveTeam(options.team))
  }

  /** Work with the permissions of a role. */
  role(role: RoleInput, options: ScopeOptions = {}): RoleRbac {
    if (typeof role !== 'string') return new RoleRbac(this, role, role.guardName, role.teamId)
    return new RoleRbac(this, role, this.resolveGuard(options.guard), this.resolveTeam(options.team))
  }

  // ------------------------------------------------------------------ permissions

  async createPermission(name: string, options: GuardOptions = {}): Promise<Permission> {
    const guardName = this.resolveGuard(options.guard)
    const permissionName = normalizeName(name)
    if (this.wildcard) parseWildcardPermission(permissionName)

    if (await this.findPermission(permissionName, { guard: guardName })) {
      throw new PermissionAlreadyExists(permissionName, guardName)
    }
    const permission = await this.adapter.createPermission({ name: permissionName, guardName })
    await this.forgetCachedPermissions()
    return permission
  }

  async findPermission(name: string, options: GuardOptions = {}): Promise<Permission | null> {
    const [permission] = await this.adapter.findPermissions({
      names: [normalizeName(name)],
      guardName: this.resolveGuard(options.guard),
    })
    return permission ?? null
  }

  async findPermissionOrFail(name: string, options: GuardOptions = {}): Promise<Permission> {
    const permission = await this.findPermission(name, options)
    if (!permission) throw new PermissionDoesNotExist(normalizeName(name), this.resolveGuard(options.guard))
    return permission
  }

  async findOrCreatePermission(name: string, options: GuardOptions = {}): Promise<Permission> {
    return (await this.findPermission(name, options)) ?? this.createPermission(name, options)
  }

  async getPermissions(options: GuardOptions = {}): Promise<Permission[]> {
    return this.adapter.findPermissions({ guardName: this.resolveGuard(options.guard) })
  }

  async deletePermission(permission: PermissionInput, options: GuardOptions = {}): Promise<void> {
    const guardName = typeof permission === 'string' ? this.resolveGuard(options.guard) : permission.guardName
    const [resolved] = await this.resolvePermissions([permission], guardName)
    await this.adapter.deletePermission(resolved!.id)
    await this.forgetCachedPermissions()
  }

  // ------------------------------------------------------------------------ roles

  async createRole(name: string, options: ScopeOptions = {}): Promise<Role> {
    const guardName = this.resolveGuard(options.guard)
    const teamId = this.resolveTeam(options.team)
    const roleName = normalizeName(name)

    const existing = await this.adapter.findRoles({ names: [roleName], guardName, teamIds: [teamId] })
    if (existing.length > 0) throw new RoleAlreadyExists(roleName, guardName)

    const role = await this.adapter.createRole({ name: roleName, guardName, teamId })
    await this.forgetCachedPermissions()
    return role
  }

  /** Finds a role. With a team, a team-specific role wins over a global role of the same name. */
  async findRole(name: string, options: ScopeOptions = {}): Promise<Role | null> {
    const guardName = this.resolveGuard(options.guard)
    const teamId = this.resolveTeam(options.team)
    const roleName = normalizeName(name)
    const roles = await this.adapter.findRoles({ names: [roleName], guardName, teamIds: this.visibleTeams(teamId) })
    return Rbac.pickRole(roles, roleName, teamId) ?? null
  }

  async findRoleOrFail(name: string, options: ScopeOptions = {}): Promise<Role> {
    const role = await this.findRole(name, options)
    if (!role) throw new RoleDoesNotExist(normalizeName(name), this.resolveGuard(options.guard))
    return role
  }

  async findOrCreateRole(name: string, options: ScopeOptions = {}): Promise<Role> {
    return (await this.findRole(name, options)) ?? this.createRole(name, options)
  }

  /** Lists roles visible in the given scope (global roles + roles of the given team). */
  async getRoles(options: ScopeOptions = {}): Promise<Role[]> {
    const teamId = this.resolveTeam(options.team)
    return this.adapter.findRoles({ guardName: this.resolveGuard(options.guard), teamIds: this.visibleTeams(teamId) })
  }

  async deleteRole(role: RoleInput, options: ScopeOptions = {}): Promise<void> {
    const resolved = await this.role(role, options).get()
    await this.adapter.deleteRole(resolved.id)
    await this.forgetCachedPermissions()
  }

  // ------------------------------------------------------------------------ cache

  /** Clears every cached role/permission lookup. Called automatically after each change. */
  async forgetCachedPermissions(): Promise<void> {
    await this.#cache?.clear()
  }

  /** @internal */
  async remember<T>(key: string, compute: () => Promise<T>): Promise<T> {
    if (!this.#cache) return compute()
    const hit = await this.#cache.get(key)
    if (hit !== undefined) return hit as T
    const value = await compute()
    await this.#cache.set(key, value, this.#cacheTtl)
    return value
  }

  // ---------------------------------------------------------------------- internal

  /** @internal */
  resolveGuard(guard: string | undefined): string {
    return guard ?? this.defaultGuard
  }

  /** @internal */
  resolveTeam(team: TeamId | undefined): TeamId {
    if (team === undefined || team === null) return null
    if (!this.teams) {
      throw new RbacError('TEAMS_NOT_ENABLED', 'A team was given but teams are not enabled. Use `createRbac({ teams: true })`.')
    }
    return team
  }

  /** @internal */
  visibleTeams(teamId: TeamId): TeamId[] {
    return teamId === null ? [null] : [teamId, null]
  }

  /** @internal Resolves names/objects to permissions, validating existence and guard. */
  async resolvePermissions(inputs: readonly PermissionInput[], guardName: string): Promise<Permission[]> {
    const names: string[] = []
    const objects: Permission[] = []

    for (const input of inputs) {
      if (typeof input === 'string') {
        names.push(normalizeName(input))
      } else {
        if (input.guardName !== guardName) throw new GuardDoesNotMatch(input.guardName, guardName)
        objects.push(input)
      }
    }

    const found = names.length > 0 ? await this.adapter.findPermissions({ names, guardName }) : []
    for (const name of names) {
      if (!found.some((p) => p.name === name)) throw new PermissionDoesNotExist(name, guardName)
    }
    return uniqueById([...found, ...objects])
  }

  /** @internal Resolves names/objects to roles, validating existence, guard and team. */
  async resolveRoles(inputs: readonly RoleInput[], guardName: string, teamId: TeamId): Promise<Role[]> {
    const names: string[] = []
    const objects: Role[] = []

    for (const input of inputs) {
      if (typeof input === 'string') {
        names.push(normalizeName(input))
      } else {
        if (input.guardName !== guardName) throw new GuardDoesNotMatch(input.guardName, guardName)
        if (input.teamId !== null && idKey(input.teamId) !== idKey(teamId)) {
          throw new RbacError('TEAM_DOES_NOT_MATCH', `Role \`${input.name}\` belongs to another team.`)
        }
        objects.push(input)
      }
    }

    const found =
      names.length > 0
        ? await this.adapter.findRoles({ names, guardName, teamIds: this.visibleTeams(teamId) })
        : []
    const picked = names.map((name) => {
      const role = Rbac.pickRole(found, name, teamId)
      if (!role) throw new RoleDoesNotExist(name, guardName)
      return role
    })
    return uniqueById([...picked, ...objects])
  }

  /** @internal */
  permissionMatches(granted: readonly string[], required: string): boolean {
    if (!this.wildcard) return granted.includes(required)
    return granted.some((pattern) => {
      try {
        return wildcardImplies(pattern, required)
      } catch {
        return false
      }
    })
  }

  private static pickRole(roles: readonly Role[], name: string, teamId: TeamId): Role | undefined {
    const candidates = roles.filter((r) => r.name === name)
    return candidates.find((r) => idKey(r.teamId) === idKey(teamId)) ?? candidates.find((r) => r.teamId === null)
  }
}

/** Permissions of a single role. Obtain with `rbac.role('writer')`. */
export class RoleRbac {
  constructor(
    private readonly rbac: Rbac,
    private readonly input: RoleInput,
    readonly guardName: string,
    readonly teamId: TeamId,
  ) {}

  /** Returns the role, throwing `RoleDoesNotExist` if it can't be found. */
  async get(): Promise<Role> {
    const [role] = await this.rbac.resolveRoles([this.input], this.guardName, this.teamId)
    return role!
  }

  async givePermissionTo(...permissions: Many<PermissionInput>[]): Promise<this> {
    const role = await this.get()
    const resolved = await this.rbac.resolvePermissions(flatten(permissions), role.guardName)
    await this.rbac.adapter.attachRolePermissions(role.id, resolved.map((p) => p.id))
    await this.rbac.forgetCachedPermissions()
    return this
  }

  async revokePermissionTo(...permissions: Many<PermissionInput>[]): Promise<this> {
    const role = await this.get()
    const resolved = await this.rbac.resolvePermissions(flatten(permissions), role.guardName)
    await this.rbac.adapter.detachRolePermissions(role.id, resolved.map((p) => p.id))
    await this.rbac.forgetCachedPermissions()
    return this
  }

  /** Replaces all permissions of the role with the given ones. */
  async syncPermissions(...permissions: Many<PermissionInput>[]): Promise<this> {
    const role = await this.get()
    const resolved = await this.rbac.resolvePermissions(flatten(permissions), role.guardName)
    await this.rbac.adapter.detachRolePermissions(role.id)
    await this.rbac.adapter.attachRolePermissions(role.id, resolved.map((p) => p.id))
    await this.rbac.forgetCachedPermissions()
    return this
  }

  async getPermissions(): Promise<Permission[]> {
    const role = await this.get()
    const links = await this.rbac.adapter.getRolePermissionLinks([role.id])
    if (links.length === 0) return []
    return this.rbac.adapter.findPermissions({ ids: links.map((l) => l.permissionId), guardName: role.guardName })
  }

  async getPermissionNames(): Promise<string[]> {
    return (await this.getPermissions()).map((p) => p.name)
  }

  async hasPermissionTo(permission: PermissionInput): Promise<boolean> {
    const name = typeof permission === 'string' ? normalizeName(permission) : permission.name
    return this.rbac.permissionMatches(await this.getPermissionNames(), name)
  }
}

interface SubjectState {
  roles: Role[]
  direct: Permission[]
  viaRoles: Permission[]
}

/** Roles & permissions of a single subject. Obtain with `rbac.for(user)`. */
export class SubjectRbac {
  constructor(
    private readonly rbac: Rbac,
    readonly subject: Subject,
    readonly guardName: string,
    readonly teamId: TeamId,
  ) {}

  // ------------------------------------------------------------------------ roles

  async assignRole(...roles: Many<RoleInput>[]): Promise<this> {
    const resolved = await this.rbac.resolveRoles(flatten(roles), this.guardName, this.teamId)
    await this.rbac.adapter.attachSubjectRoles(this.subject, resolved.map((r) => r.id), this.teamId)
    await this.rbac.forgetCachedPermissions()
    return this
  }

  async removeRole(...roles: Many<RoleInput>[]): Promise<this> {
    const resolved = await this.rbac.resolveRoles(flatten(roles), this.guardName, this.teamId)
    await this.rbac.adapter.detachSubjectRoles(this.subject, resolved.map((r) => r.id), this.teamId)
    await this.rbac.forgetCachedPermissions()
    return this
  }

  /** Replaces all roles (in the current guard & team) with the given ones. */
  async syncRoles(...roles: Many<RoleInput>[]): Promise<this> {
    const resolved = await this.rbac.resolveRoles(flatten(roles), this.guardName, this.teamId)
    const current = (await this.state()).roles
    await this.rbac.adapter.detachSubjectRoles(this.subject, current.map((r) => r.id), this.teamId)
    await this.rbac.adapter.attachSubjectRoles(this.subject, resolved.map((r) => r.id), this.teamId)
    await this.rbac.forgetCachedPermissions()
    return this
  }

  async getRoles(): Promise<Role[]> {
    return [...(await this.state()).roles]
  }

  async getRoleNames(): Promise<string[]> {
    return (await this.state()).roles.map((r) => r.name)
  }

  /** `true` if the subject has the role — or ANY of the roles when given an array. */
  async hasRole(roles: Many<RoleInput>): Promise<boolean> {
    return this.hasAnyRole(roles)
  }

  async hasAnyRole(...roles: Many<RoleInput>[]): Promise<boolean> {
    const mine = (await this.state()).roles
    return flatten(roles).some((wanted) => mine.some((r) => SubjectRbac.roleMatches(r, wanted)))
  }

  async hasAllRoles(...roles: Many<RoleInput>[]): Promise<boolean> {
    const mine = (await this.state()).roles
    return flatten(roles).every((wanted) => mine.some((r) => SubjectRbac.roleMatches(r, wanted)))
  }

  // ------------------------------------------------------------ direct permissions

  async givePermissionTo(...permissions: Many<PermissionInput>[]): Promise<this> {
    const resolved = await this.rbac.resolvePermissions(flatten(permissions), this.guardName)
    await this.rbac.adapter.attachSubjectPermissions(this.subject, resolved.map((p) => p.id), this.teamId)
    await this.rbac.forgetCachedPermissions()
    return this
  }

  async revokePermissionTo(...permissions: Many<PermissionInput>[]): Promise<this> {
    const resolved = await this.rbac.resolvePermissions(flatten(permissions), this.guardName)
    await this.rbac.adapter.detachSubjectPermissions(this.subject, resolved.map((p) => p.id), this.teamId)
    await this.rbac.forgetCachedPermissions()
    return this
  }

  /** Replaces all direct permissions (in the current guard & team) with the given ones. */
  async syncPermissions(...permissions: Many<PermissionInput>[]): Promise<this> {
    const resolved = await this.rbac.resolvePermissions(flatten(permissions), this.guardName)
    const current = (await this.state()).direct
    await this.rbac.adapter.detachSubjectPermissions(this.subject, current.map((p) => p.id), this.teamId)
    await this.rbac.adapter.attachSubjectPermissions(this.subject, resolved.map((p) => p.id), this.teamId)
    await this.rbac.forgetCachedPermissions()
    return this
  }

  // ------------------------------------------------------------------- queries

  async getDirectPermissions(): Promise<Permission[]> {
    return [...(await this.state()).direct]
  }

  async getPermissionsViaRoles(): Promise<Permission[]> {
    return [...(await this.state()).viaRoles]
  }

  async getAllPermissions(): Promise<Permission[]> {
    const { direct, viaRoles } = await this.state()
    return uniqueById([...direct, ...viaRoles])
  }

  async getPermissionNames(): Promise<string[]> {
    return (await this.getAllPermissions()).map((p) => p.name)
  }

  /**
   * Checks a permission (direct or via roles).
   * Throws `PermissionDoesNotExist` if the permission is unknown (when wildcard is off).
   * Use {@link can} for a check that never throws.
   */
  async hasPermissionTo(permission: PermissionInput): Promise<boolean> {
    const name = await this.requirePermissionName(permission)
    return this.rbac.permissionMatches(await this.getPermissionNames(), name)
  }

  /** Checks a direct permission only (ignores roles). */
  async hasDirectPermission(permission: PermissionInput): Promise<boolean> {
    const name = await this.requirePermissionName(permission)
    const direct = (await this.state()).direct.map((p) => p.name)
    return this.rbac.permissionMatches(direct, name)
  }

  /** Like {@link hasPermissionTo}, but returns `false` instead of throwing. */
  async can(permission: PermissionInput): Promise<boolean> {
    try {
      return await this.hasPermissionTo(permission)
    } catch (error) {
      if (error instanceof RbacError) return false
      throw error
    }
  }

  async cannot(permission: PermissionInput): Promise<boolean> {
    return !(await this.can(permission))
  }

  async canAny(...permissions: Many<PermissionInput>[]): Promise<boolean> {
    for (const permission of flatten(permissions)) {
      if (await this.can(permission)) return true
    }
    return false
  }

  async canAll(...permissions: Many<PermissionInput>[]): Promise<boolean> {
    for (const permission of flatten(permissions)) {
      if (!(await this.can(permission))) return false
    }
    return true
  }

  /** Alias of {@link canAny} (spatie naming). */
  async hasAnyPermission(...permissions: Many<PermissionInput>[]): Promise<boolean> {
    return this.canAny(...permissions)
  }

  /** Alias of {@link canAll} (spatie naming). */
  async hasAllPermissions(...permissions: Many<PermissionInput>[]): Promise<boolean> {
    return this.canAll(...permissions)
  }

  /** Serializable `{ roles, permissions }` — e.g. to hydrate a React/Vue client. */
  async snapshot(): Promise<RbacSnapshot> {
    return { roles: await this.getRoleNames(), permissions: await this.getPermissionNames() }
  }

  // ------------------------------------------------------------------- internal

  private async requirePermissionName(permission: PermissionInput): Promise<string> {
    if (typeof permission !== 'string') {
      if (permission.guardName !== this.guardName) throw new GuardDoesNotMatch(permission.guardName, this.guardName)
      return permission.name
    }
    const name = normalizeName(permission)
    if (!this.rbac.wildcard && !(await this.rbac.findPermission(name, { guard: this.guardName }))) {
      throw new PermissionDoesNotExist(name, this.guardName)
    }
    return name
  }

  private state(): Promise<SubjectState> {
    const key = `rbac:${JSON.stringify([this.guardName, this.teamId, this.subject.type, String(this.subject.id)])}`
    return this.rbac.remember(key, async () => {
      const { adapter } = this.rbac

      const roleIds = await adapter.getSubjectRoleIds(this.subject, this.teamId)
      const roles = roleIds.length > 0 ? await adapter.findRoles({ ids: roleIds, guardName: this.guardName }) : []

      const directIds = await adapter.getSubjectPermissionIds(this.subject, this.teamId)
      const direct =
        directIds.length > 0 ? await adapter.findPermissions({ ids: directIds, guardName: this.guardName }) : []

      const links = roles.length > 0 ? await adapter.getRolePermissionLinks(roles.map((r) => r.id)) : []
      const viaRoles =
        links.length > 0
          ? await adapter.findPermissions({ ids: links.map((l) => l.permissionId), guardName: this.guardName })
          : []

      return { roles, direct, viaRoles }
    })
  }

  private static roleMatches(role: Role, wanted: RoleInput): boolean {
    return typeof wanted === 'string' ? role.name === wanted.trim() : idKey(role.id) === idKey(wanted.id)
  }
}

export function createRbac(options: RbacOptions): Rbac {
  return new Rbac(options)
}
