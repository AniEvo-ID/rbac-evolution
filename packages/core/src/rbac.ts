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
import { RbacEmitter, type RbacEventListener, type RbacEventName } from './events'
import { type SyncDefinition, type SyncOptions, type SyncResult, syncDefinition } from './sync'
import type {
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
import { parseWildcardPermission, wildcardImplies } from './wildcard'

export interface GuardOptions {
  /** Guard name, e.g. `web` or `api`. Defaults to `defaultGuard`. */
  guard?: string
}

export interface ScopeOptions extends GuardOptions {
  /** Team id. Only allowed when `teams` is enabled. */
  team?: TeamId
}

/** Context passed to the {@link RbacOptions.before} hook. */
export interface BeforeContext<T extends RbacTypeConfig = DefaultRbacTypes> {
  /** The subject being checked (already scoped to its guard & team). */
  subject: SubjectRbac<T>
  /** The permission name being checked. */
  permission: string
}

/** Return `true` to allow, `false` to deny, `undefined` to continue with the normal check. */
export type BeforeHook<T extends RbacTypeConfig = DefaultRbacTypes> = (
  ctx: BeforeContext<T>,
) => boolean | undefined | Promise<boolean | undefined>

export interface RbacOptions<T extends RbacTypeConfig = DefaultRbacTypes> {
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
  /**
   * Runs before every `can()` / `cannot()` / `canAny()` / `canAll()` check (spatie's `Gate::before`).
   * Return `true` to allow, `false` to deny, `undefined` to fall through to the normal check.
   * Not applied to `hasPermissionTo()` & co., which stay pure data checks.
   */
  before?: BeforeHook<T>
  /**
   * Subjects having ANY of these roles pass every `can()` check (super-admin).
   * Evaluated after `before` (if `before` returned `undefined`).
   */
  superAdminRoles?: readonly RoleName<T>[]
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

function uniqueIds(ids: readonly Id[]): Id[] {
  const seen = new Set<string>()
  return ids.filter((id) => {
    const k = idKey(id)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/** Items whose id is (`keep = true`) / is not (`keep = false`) in `ids`. */
function filterByIds<T extends { id: Id }>(items: readonly T[], ids: readonly Id[], keep: boolean): T[] {
  const set = new Set(ids.map(idKey))
  return items.filter((item) => set.has(idKey(item.id)) === keep)
}

/** Ids in `ids` that are not in `remove`. */
function filterIds(ids: readonly Id[], remove: readonly Id[]): Id[] {
  const set = new Set(remove.map(idKey))
  return ids.filter((id) => !set.has(idKey(id)))
}

function normalizeName(name: string): string {
  const trimmed = name.trim()
  if (trimmed === '') throw new RbacError('INVALID_NAME', 'Role and permission names must not be empty.')
  return trimmed
}

/**
 * Engine internals shared by `Rbac`, `RoleRbac`, `SubjectRbac` and `sync`. Not exported from the package:
 * reach them with {@link internalsOf} inside core only.
 */
export interface RbacInternals<T extends RbacTypeConfig = DefaultRbacTypes> {
  readonly events: RbacEmitter
  remember<V>(key: string, compute: () => Promise<V>): Promise<V>
  permissionExists(name: string, guardName: string): Promise<boolean>
  gate(subject: SubjectRbac<T>, permission: string): Promise<boolean | undefined>
  resolveGuard(guard: string | undefined): string
  resolveTeam(team: TeamId | undefined): TeamId
  visibleTeams(teamId: TeamId): TeamId[]
  resolvePermissions(inputs: readonly PermissionInput[], guardName: string): Promise<Permission[]>
  resolveRoles(inputs: readonly RoleInput[], guardName: string, teamId: TeamId): Promise<Role[]>
  permissionMatches(granted: readonly string[], required: string): boolean
}

/** Set by a static block of `Rbac`, the only place that can read its private fields. */
let internalsOf!: <T extends RbacTypeConfig>(rbac: Rbac<T>) => RbacInternals<T>

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
 *
 * `T` optionally narrows the accepted permission / role names, see {@link RbacTypeConfig}.
 */
export class Rbac<T extends RbacTypeConfig = DefaultRbacTypes> {
  readonly adapter: RbacAdapter
  readonly defaultGuard: string
  readonly wildcard: boolean
  readonly teams: boolean
  readonly #cache: CacheStore | null
  readonly #cacheTtl: number
  readonly #before: BeforeHook<T> | undefined
  readonly #superAdminRoles: readonly string[]
  readonly #events = new RbacEmitter()
  /** Bumped on every change, so a lookup that started before the change never caches its stale result. */
  #generation = 0
  readonly #internals: RbacInternals<T>

  static {
    internalsOf = <U extends RbacTypeConfig>(rbac: Rbac<U>): RbacInternals<U> => rbac.#internals
  }

  constructor(options: RbacOptions<T>) {
    this.adapter = options.adapter
    this.defaultGuard = options.defaultGuard ?? 'web'
    this.wildcard = options.wildcard ?? false
    this.teams = options.teams ?? false
    this.#cache = options.cache === false ? null : (options.cache ?? new MemoryCache())
    this.#cacheTtl = options.cacheTtl ?? DAY_MS
    this.#before = options.before
    this.#superAdminRoles = options.superAdminRoles ?? []
    this.#internals = {
      events: this.#events,
      remember: (key, compute) => this.#remember(key, compute),
      permissionExists: (name, guardName) => this.#permissionExists(name, guardName),
      gate: (subject, permission) => this.#gate(subject, permission),
      resolveGuard: (guard) => this.#resolveGuard(guard),
      resolveTeam: (team) => this.#resolveTeam(team),
      visibleTeams: (teamId) => this.#visibleTeams(teamId),
      resolvePermissions: (inputs, guardName) => this.#resolvePermissions(inputs, guardName),
      resolveRoles: (inputs, guardName, teamId) => this.#resolveRoles(inputs, guardName, teamId),
      permissionMatches: (granted, required) => this.#permissionMatches(granted, required),
    }
  }

  /** Work with the roles & permissions of a subject (usually a user). */
  for(subject: Subject, options: ScopeOptions = {}): SubjectRbac<T> {
    return new SubjectRbac<T>(this, subject, this.#resolveGuard(options.guard), this.#resolveTeam(options.team))
  }

  /** Work with the permissions of a role. */
  role(role: RoleInput<RoleName<T>>, options: ScopeOptions = {}): RoleRbac<T> {
    if (typeof role !== 'string') return new RoleRbac<T>(this, role, role.guardName, role.teamId)
    return new RoleRbac<T>(this, role, this.#resolveGuard(options.guard), this.#resolveTeam(options.team))
  }

  // ----------------------------------------------------------------------- events

  /**
   * Listens to an event. Listeners run in registration order and are awaited one by one,
   * after the change has been written by the adapter. Returns an unsubscribe function.
   */
  on<K extends RbacEventName>(event: K, listener: RbacEventListener<K>): () => void {
    return this.#events.on(event, listener)
  }

  /** Removes a listener added with {@link on}. */
  off<K extends RbacEventName>(event: K, listener: RbacEventListener<K>): void {
    this.#events.off(event, listener)
  }

  // ------------------------------------------------------------------ permissions

  async createPermission(name: PermissionName<T>, options: GuardOptions = {}): Promise<Permission> {
    const guardName = this.#resolveGuard(options.guard)
    const permissionName = normalizeName(name)
    if (this.wildcard) parseWildcardPermission(permissionName)

    if (await this.findPermission(permissionName as PermissionName<T>, { guard: guardName })) {
      throw new PermissionAlreadyExists(permissionName, guardName)
    }
    const permission = await this.adapter.createPermission({ name: permissionName, guardName })
    await this.forgetCachedPermissions()
    await this.#events.emit({ event: 'permission.created', permission })
    return permission
  }

  async findPermission(name: PermissionName<T>, options: GuardOptions = {}): Promise<Permission | null> {
    const [permission] = await this.adapter.findPermissions({
      names: [normalizeName(name)],
      guardName: this.#resolveGuard(options.guard),
    })
    return permission ?? null
  }

  async findPermissionOrFail(name: PermissionName<T>, options: GuardOptions = {}): Promise<Permission> {
    const permission = await this.findPermission(name, options)
    if (!permission) throw new PermissionDoesNotExist(normalizeName(name), this.#resolveGuard(options.guard))
    return permission
  }

  async findOrCreatePermission(name: PermissionName<T>, options: GuardOptions = {}): Promise<Permission> {
    return (await this.findPermission(name, options)) ?? this.createPermission(name, options)
  }

  async getPermissions(options: GuardOptions = {}): Promise<Permission[]> {
    return this.adapter.findPermissions({ guardName: this.#resolveGuard(options.guard) })
  }

  async deletePermission(permission: PermissionInput<PermissionName<T>>, options: GuardOptions = {}): Promise<void> {
    const guardName = typeof permission === 'string' ? this.#resolveGuard(options.guard) : permission.guardName
    const [resolved] = await this.#resolvePermissions([permission], guardName)
    await this.adapter.deletePermission(resolved!.id)
    await this.forgetCachedPermissions()
    await this.#events.emit({ event: 'permission.deleted', permission: resolved! })
  }

  // ------------------------------------------------------------------------ roles

  async createRole(name: RoleName<T>, options: ScopeOptions = {}): Promise<Role> {
    const guardName = this.#resolveGuard(options.guard)
    const teamId = this.#resolveTeam(options.team)
    const roleName = normalizeName(name)

    const existing = await this.adapter.findRoles({ names: [roleName], guardName, teamIds: [teamId] })
    if (existing.length > 0) throw new RoleAlreadyExists(roleName, guardName)

    const role = await this.adapter.createRole({ name: roleName, guardName, teamId })
    await this.forgetCachedPermissions()
    await this.#events.emit({ event: 'role.created', role, teamId: role.teamId })
    return role
  }

  /** Finds a role. With a team, a team-specific role wins over a global role of the same name. */
  async findRole(name: RoleName<T>, options: ScopeOptions = {}): Promise<Role | null> {
    const guardName = this.#resolveGuard(options.guard)
    const teamId = this.#resolveTeam(options.team)
    const roleName = normalizeName(name)
    const roles = await this.adapter.findRoles({ names: [roleName], guardName, teamIds: this.#visibleTeams(teamId) })
    return Rbac.pickRole(roles, roleName, teamId) ?? null
  }

  async findRoleOrFail(name: RoleName<T>, options: ScopeOptions = {}): Promise<Role> {
    const role = await this.findRole(name, options)
    if (!role) throw new RoleDoesNotExist(normalizeName(name), this.#resolveGuard(options.guard))
    return role
  }

  async findOrCreateRole(name: RoleName<T>, options: ScopeOptions = {}): Promise<Role> {
    return (await this.findRole(name, options)) ?? this.createRole(name, options)
  }

  /** Lists roles visible in the given scope (global roles + roles of the given team). */
  async getRoles(options: ScopeOptions = {}): Promise<Role[]> {
    const teamId = this.#resolveTeam(options.team)
    return this.adapter.findRoles({ guardName: this.#resolveGuard(options.guard), teamIds: this.#visibleTeams(teamId) })
  }

  async deleteRole(role: RoleInput<RoleName<T>>, options: ScopeOptions = {}): Promise<void> {
    const resolved = await this.role(role, options).get()
    await this.adapter.deleteRole(resolved.id)
    await this.forgetCachedPermissions()
    await this.#events.emit({ event: 'role.deleted', role: resolved, teamId: resolved.teamId })
  }

  // ------------------------------------------------------------------------- sync

  /**
   * Declaratively seeds roles & permissions (spatie's "Database Seeding"): creates missing
   * permissions and roles, and syncs each role's permissions to exactly the given list.
   * Idempotent — running it again changes nothing. Uses the regular engine methods, so the
   * usual events fire.
   *
   * ```ts
   * await rbac.sync({
   *   permissions: ['edit articles', 'delete articles'],
   *   roles: { admin: '*', writer: ['edit articles'] },
   * })
   * ```
   *
   * - `'*'` gives a role every permission of its guard (after the sync).
   * - Pass an array of definitions (each with its own `guard` / `team`) to sync several scopes.
   * - `prune: true` deletes roles & permissions of the synced scopes that aren't in the definition.
   * - `dryRun: true` returns the plan without writing anything.
   *
   * Not atomic: adapters have no transactions, so a failure midway leaves the earlier changes.
   */
  async sync(
    definition: SyncDefinition<T> | readonly SyncDefinition<T>[],
    options: SyncOptions = {},
  ): Promise<SyncResult> {
    return syncDefinition(this, this.#internals, definition, options)
  }

  // ---------------------------------------------------------------------- queries

  /**
   * Ids of subjects of `subjectType` that have ANY of the given roles in the given scope
   * (spatie: `User::role('writer')->get()`). Throws `RoleDoesNotExist` for unknown roles.
   */
  async subjectsWithRole(
    subjectType: string,
    roles: Many<RoleInput<RoleName<T>>>,
    options: ScopeOptions = {},
  ): Promise<Id[]> {
    const guardName = this.#resolveGuard(options.guard)
    const teamId = this.#resolveTeam(options.team)
    const resolved = await this.#resolveRoles(flatten([roles]), guardName, teamId)
    if (resolved.length === 0) return []
    return this.adapter.getSubjectIdsWithRoles(
      subjectType,
      resolved.map((r) => r.id),
      teamId,
    )
  }

  /**
   * Ids of subjects of `subjectType` that have ANY of the given permissions in the given scope —
   * directly or via one of their roles (spatie: `User::permission('edit')->get()`).
   * Throws `PermissionDoesNotExist` for unknown permissions. Wildcards are not expanded.
   */
  async subjectsWithPermission(
    subjectType: string,
    permissions: Many<PermissionInput<PermissionName<T>>>,
    options: ScopeOptions = {},
  ): Promise<Id[]> {
    const guardName = this.#resolveGuard(options.guard)
    const teamId = this.#resolveTeam(options.team)
    const resolved = await this.#resolvePermissions(flatten([permissions]), guardName)
    if (resolved.length === 0) return []
    const permissionIds = resolved.map((p) => p.id)
    const wanted = new Set(permissionIds.map(idKey))

    const roles = await this.adapter.findRoles({ guardName, teamIds: this.#visibleTeams(teamId) })
    const links = roles.length > 0 ? await this.adapter.getRolePermissionLinks(roles.map((r) => r.id)) : []
    const roleIds = uniqueIds(links.filter((l) => wanted.has(idKey(l.permissionId))).map((l) => l.roleId))

    const viaRoles = roleIds.length > 0 ? await this.adapter.getSubjectIdsWithRoles(subjectType, roleIds, teamId) : []
    const direct = await this.adapter.getSubjectIdsWithPermissions(subjectType, permissionIds, teamId)
    return uniqueIds([...viaRoles, ...direct])
  }

  // ------------------------------------------------------------------------ cache

  /** Clears every cached role/permission lookup. Called automatically after each change. */
  async forgetCachedPermissions(): Promise<void> {
    this.#generation++
    await this.#cache?.clear()
  }

  async #remember<V>(key: string, compute: () => Promise<V>): Promise<V> {
    if (!this.#cache) return compute()
    const hit = await this.#cache.get(key)
    if (hit !== undefined) return hit as V
    const generation = this.#generation
    const value = await compute()
    // shortcut: the counter is per process; a cache shared between processes can still get a stale
    // entry from another process's in-flight lookup (bounded by cacheTtl). Use a versioned store if that matters.
    if (generation === this.#generation) await this.#cache.set(key, value, this.#cacheTtl)
    return value
  }

  /**
   * Whether a permission with this name exists in the guard.
   * With caching on, the guard's permission names are cached (cleared on every change),
   * so repeated `can()` checks don't hit the database.
   */
  async #permissionExists(name: string, guardName: string): Promise<boolean> {
    if (!this.#cache) {
      const [permission] = await this.adapter.findPermissions({ names: [name], guardName })
      return permission !== undefined
    }
    const names = await this.#remember(`rbac:permissions:${JSON.stringify([guardName])}`, async () =>
      (await this.adapter.findPermissions({ guardName })).map((p) => p.name),
    )
    return names.includes(name)
  }

  // ---------------------------------------------------------------------- internal

  /** Runs the `before` hook and the super-admin check. `undefined` = no decision. */
  async #gate(subject: SubjectRbac<T>, permission: string): Promise<boolean | undefined> {
    if (this.#before) {
      const decision = await this.#before({ subject, permission })
      if (typeof decision === 'boolean') return decision
    }
    if (this.#superAdminRoles.length > 0 && (await subject.hasAnyRole(this.#superAdminRoles as RoleName<T>[]))) {
      return true
    }
    return undefined
  }

  #resolveGuard(guard: string | undefined): string {
    return guard ?? this.defaultGuard
  }

  #resolveTeam(team: TeamId | undefined): TeamId {
    if (team === undefined || team === null) return null
    if (!this.teams) {
      throw new RbacError('TEAMS_NOT_ENABLED', 'A team was given but teams are not enabled. Use `createRbac({ teams: true })`.')
    }
    return team
  }

  #visibleTeams(teamId: TeamId): TeamId[] {
    return teamId === null ? [null] : [teamId, null]
  }

  /** Resolves names/objects to permissions, validating existence and guard. */
  async #resolvePermissions(inputs: readonly PermissionInput[], guardName: string): Promise<Permission[]> {
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

  /** Resolves names/objects to roles, validating existence, guard and team. */
  async #resolveRoles(inputs: readonly RoleInput[], guardName: string, teamId: TeamId): Promise<Role[]> {
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
        ? await this.adapter.findRoles({ names, guardName, teamIds: this.#visibleTeams(teamId) })
        : []
    const picked = names.map((name) => {
      const role = Rbac.pickRole(found, name, teamId)
      if (!role) throw new RoleDoesNotExist(name, guardName)
      return role
    })
    return uniqueById([...picked, ...objects])
  }

  #permissionMatches(granted: readonly string[], required: string): boolean {
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
export class RoleRbac<T extends RbacTypeConfig = DefaultRbacTypes> {
  readonly #core: RbacInternals<T>

  constructor(
    private readonly rbac: Rbac<T>,
    private readonly input: RoleInput,
    readonly guardName: string,
    readonly teamId: TeamId,
  ) {
    this.#core = internalsOf(rbac)
  }

  /** Returns the role, throwing `RoleDoesNotExist` if it can't be found. */
  async get(): Promise<Role> {
    const [role] = await this.#core.resolveRoles([this.input], this.guardName, this.teamId)
    return role!
  }

  async givePermissionTo(...permissions: Many<PermissionInput<PermissionName<T>>>[]): Promise<this> {
    const role = await this.get()
    const resolved = await this.#core.resolvePermissions(flatten(permissions), role.guardName)
    const track = this.#core.events.has('permission.attached')
    const before = track ? await this.currentPermissionIds(role) : []
    await this.rbac.adapter.attachRolePermissions(role.id, resolved.map((p) => p.id))
    await this.rbac.forgetCachedPermissions()
    if (track) await this.emit('permission.attached', role, filterByIds(resolved, before, false))
    return this
  }

  async revokePermissionTo(...permissions: Many<PermissionInput<PermissionName<T>>>[]): Promise<this> {
    const role = await this.get()
    const resolved = await this.#core.resolvePermissions(flatten(permissions), role.guardName)
    const track = this.#core.events.has('permission.detached')
    const before = track ? await this.currentPermissionIds(role) : []
    await this.rbac.adapter.detachRolePermissions(role.id, resolved.map((p) => p.id))
    await this.rbac.forgetCachedPermissions()
    if (track) await this.emit('permission.detached', role, filterByIds(resolved, before, true))
    return this
  }

  /** Replaces all permissions of the role with the given ones. */
  async syncPermissions(...permissions: Many<PermissionInput<PermissionName<T>>>[]): Promise<this> {
    const role = await this.get()
    const resolved = await this.#core.resolvePermissions(flatten(permissions), role.guardName)
    const track = this.#core.events.has('permission.attached') || this.#core.events.has('permission.detached')
    const current = track ? await this.getPermissions() : []
    const newIds = resolved.map((p) => p.id)
    // Attach first, then detach the rest: a failure midway leaves extra permissions, never none.
    await this.rbac.adapter.attachRolePermissions(role.id, newIds)
    const staleIds = filterIds(await this.currentPermissionIds(role), newIds)
    if (staleIds.length > 0) await this.rbac.adapter.detachRolePermissions(role.id, staleIds)
    await this.rbac.forgetCachedPermissions()
    if (track) {
      await this.emit('permission.detached', role, filterByIds(current, newIds, false))
      await this.emit('permission.attached', role, filterByIds(resolved, current.map((p) => p.id), false))
    }
    return this
  }

  /**
   * Makes the given subjects of `subjectType` the only ones holding this role in the current
   * scope (spatie v7.4: `Role::syncModels()`). Other subject types are untouched.
   */
  async syncSubjects(subjectType: string, ids: readonly Id[]): Promise<this> {
    const role = await this.get()
    const scope = { guard: role.guardName, team: this.teamId }
    const before = await this.rbac.adapter.getSubjectIdsWithRoles(subjectType, [role.id], this.teamId)
    const current = new Set(before.map(String))
    const wanted = new Set(ids.map(String))
    // shortcut: one assign/remove per changed subject; batch in the adapter if roles go to thousands of subjects at once
    // Attach first, then detach the rest: a failure midway leaves extra holders, never none.
    for (const id of ids) {
      if (!current.has(String(id))) await this.rbac.for({ type: subjectType, id }, scope).assignRole(role)
    }
    // Only detach holders seen before attaching, so a concurrent sync's new holders are never removed.
    for (const id of before) {
      if (!wanted.has(String(id))) await this.rbac.for({ type: subjectType, id }, scope).removeRole(role)
    }
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

  async hasPermissionTo(permission: PermissionInput<PermissionName<T>>): Promise<boolean> {
    const name = typeof permission === 'string' ? normalizeName(permission) : permission.name
    return this.#core.permissionMatches(await this.getPermissionNames(), name)
  }

  private async currentPermissionIds(role: Role): Promise<Id[]> {
    return (await this.rbac.adapter.getRolePermissionLinks([role.id])).map((l) => l.permissionId)
  }

  private async emit(
    event: 'permission.attached' | 'permission.detached',
    role: Role,
    permissions: Permission[],
  ): Promise<void> {
    if (permissions.length === 0) return
    await this.#core.events.emit({
      event,
      target: 'role',
      role,
      permissions,
      guardName: role.guardName,
      teamId: role.teamId,
    })
  }
}

interface SubjectState {
  roles: Role[]
  direct: Permission[]
  viaRoles: Permission[]
}

/** Roles & permissions of a single subject. Obtain with `rbac.for(user)`. */
export class SubjectRbac<T extends RbacTypeConfig = DefaultRbacTypes> {
  readonly #core: RbacInternals<T>

  constructor(
    private readonly rbac: Rbac<T>,
    readonly subject: Subject,
    readonly guardName: string,
    readonly teamId: TeamId,
  ) {
    this.#core = internalsOf(rbac)
  }

  // ------------------------------------------------------------------------ roles

  async assignRole(...roles: Many<RoleInput<RoleName<T>>>[]): Promise<this> {
    const { adapter } = this.rbac
    const { events } = this.#core
    const resolved = await this.#core.resolveRoles(flatten(roles), this.guardName, this.teamId)
    const track = events.has('role.attached')
    const before = track ? await adapter.getSubjectRoleIds(this.subject, this.teamId) : []
    await adapter.attachSubjectRoles(this.subject, resolved.map((r) => r.id), this.teamId)
    await this.rbac.forgetCachedPermissions()
    if (track) await this.emitRoles('role.attached', filterByIds(resolved, before, false))
    return this
  }

  async removeRole(...roles: Many<RoleInput<RoleName<T>>>[]): Promise<this> {
    const { adapter } = this.rbac
    const { events } = this.#core
    const resolved = await this.#core.resolveRoles(flatten(roles), this.guardName, this.teamId)
    const track = events.has('role.detached')
    const before = track ? await adapter.getSubjectRoleIds(this.subject, this.teamId) : []
    await adapter.detachSubjectRoles(this.subject, resolved.map((r) => r.id), this.teamId)
    await this.rbac.forgetCachedPermissions()
    if (track) await this.emitRoles('role.detached', filterByIds(resolved, before, true))
    return this
  }

  /** Replaces all roles (in the current guard & team) with the given ones. */
  async syncRoles(...roles: Many<RoleInput<RoleName<T>>>[]): Promise<this> {
    const resolved = await this.#core.resolveRoles(flatten(roles), this.guardName, this.teamId)
    const current = (await this.state()).roles
    const newIds = resolved.map((r) => r.id)
    // Attach first, then detach the rest: a failure midway leaves extra roles, never none.
    await this.rbac.adapter.attachSubjectRoles(this.subject, newIds, this.teamId)
    const stale = filterByIds(current, newIds, false)
    if (stale.length > 0) await this.rbac.adapter.detachSubjectRoles(this.subject, stale.map((r) => r.id), this.teamId)
    await this.rbac.forgetCachedPermissions()
    await this.emitRoles('role.detached', filterByIds(current, resolved.map((r) => r.id), false))
    await this.emitRoles('role.attached', filterByIds(resolved, current.map((r) => r.id), false))
    return this
  }

  async getRoles(): Promise<Role[]> {
    return [...(await this.state()).roles]
  }

  async getRoleNames(): Promise<string[]> {
    return (await this.state()).roles.map((r) => r.name)
  }

  /** `true` if the subject has the role — or ANY of the roles when given an array. */
  async hasRole(roles: Many<RoleInput<RoleName<T>>>): Promise<boolean> {
    return this.hasAnyRole(roles)
  }

  async hasAnyRole(...roles: Many<RoleInput<RoleName<T>>>[]): Promise<boolean> {
    const mine = (await this.state()).roles
    return flatten(roles).some((wanted) => mine.some((r) => SubjectRbac.roleMatches(r, wanted)))
  }

  async hasAllRoles(...roles: Many<RoleInput<RoleName<T>>>[]): Promise<boolean> {
    const mine = (await this.state()).roles
    return flatten(roles).every((wanted) => mine.some((r) => SubjectRbac.roleMatches(r, wanted)))
  }

  /** `true` if the subject has ALL the given roles and no other role (in the current guard & team). */
  async hasExactRoles(...roles: Many<RoleInput<RoleName<T>>>[]): Promise<boolean> {
    const mine = uniqueById((await this.state()).roles)
    const matched = new Set<string>()
    for (const wanted of flatten(roles)) {
      const role = mine.find((r) => SubjectRbac.roleMatches(r, wanted))
      if (!role) return false
      matched.add(idKey(role.id))
    }
    return matched.size === mine.length
  }

  // ------------------------------------------------------------ direct permissions

  async givePermissionTo(...permissions: Many<PermissionInput<PermissionName<T>>>[]): Promise<this> {
    const { adapter } = this.rbac
    const { events } = this.#core
    const resolved = await this.#core.resolvePermissions(flatten(permissions), this.guardName)
    const track = events.has('permission.attached')
    const before = track ? await adapter.getSubjectPermissionIds(this.subject, this.teamId) : []
    await adapter.attachSubjectPermissions(this.subject, resolved.map((p) => p.id), this.teamId)
    await this.rbac.forgetCachedPermissions()
    if (track) await this.emitPermissions('permission.attached', filterByIds(resolved, before, false))
    return this
  }

  async revokePermissionTo(...permissions: Many<PermissionInput<PermissionName<T>>>[]): Promise<this> {
    const { adapter } = this.rbac
    const { events } = this.#core
    const resolved = await this.#core.resolvePermissions(flatten(permissions), this.guardName)
    const track = events.has('permission.detached')
    const before = track ? await adapter.getSubjectPermissionIds(this.subject, this.teamId) : []
    await adapter.detachSubjectPermissions(this.subject, resolved.map((p) => p.id), this.teamId)
    await this.rbac.forgetCachedPermissions()
    if (track) await this.emitPermissions('permission.detached', filterByIds(resolved, before, true))
    return this
  }

  /** Replaces all direct permissions (in the current guard & team) with the given ones. */
  async syncPermissions(...permissions: Many<PermissionInput<PermissionName<T>>>[]): Promise<this> {
    const resolved = await this.#core.resolvePermissions(flatten(permissions), this.guardName)
    const current = (await this.state()).direct
    const newIds = resolved.map((p) => p.id)
    // Attach first, then detach the rest: a failure midway leaves extra permissions, never none.
    await this.rbac.adapter.attachSubjectPermissions(this.subject, newIds, this.teamId)
    const stale = filterByIds(current, newIds, false)
    if (stale.length > 0) {
      await this.rbac.adapter.detachSubjectPermissions(this.subject, stale.map((p) => p.id), this.teamId)
    }
    await this.rbac.forgetCachedPermissions()
    await this.emitPermissions('permission.detached', filterByIds(current, resolved.map((p) => p.id), false))
    await this.emitPermissions('permission.attached', filterByIds(resolved, current.map((p) => p.id), false))
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
   * Checks a permission (direct or via roles). Pure data check: the `before` hook and
   * `superAdminRoles` are NOT applied (like spatie, where only `can()` goes through the Gate).
   * Throws `PermissionDoesNotExist` if the permission is unknown (when wildcard is off).
   * Use {@link can} for a check that never throws.
   */
  async hasPermissionTo(permission: PermissionInput<PermissionName<T>>): Promise<boolean> {
    const name = await this.requirePermissionName(permission)
    return this.#core.permissionMatches(await this.getPermissionNames(), name)
  }

  /** Checks a direct permission only (ignores roles). */
  async hasDirectPermission(permission: PermissionInput<PermissionName<T>>): Promise<boolean> {
    const name = await this.requirePermissionName(permission)
    const direct = (await this.state()).direct.map((p) => p.name)
    return this.#core.permissionMatches(direct, name)
  }

  /**
   * Authorization check: runs the `before` hook and `superAdminRoles` first, then falls back
   * to {@link hasPermissionTo}, returning `false` instead of throwing.
   */
  async can(permission: PermissionInput<PermissionName<T>>): Promise<boolean> {
    const name = typeof permission === 'string' ? permission.trim() : permission.name
    const decision = await this.#core.gate(this, name)
    if (decision !== undefined) return decision
    return this.check(permission)
  }

  async cannot(permission: PermissionInput<PermissionName<T>>): Promise<boolean> {
    return !(await this.can(permission))
  }

  async canAny(...permissions: Many<PermissionInput<PermissionName<T>>>[]): Promise<boolean> {
    for (const permission of flatten(permissions)) {
      if (await this.can(permission)) return true
    }
    return false
  }

  async canAll(...permissions: Many<PermissionInput<PermissionName<T>>>[]): Promise<boolean> {
    for (const permission of flatten(permissions)) {
      if (!(await this.can(permission))) return false
    }
    return true
  }

  /** `true` if the subject has ANY of the permissions. Pure data check (no `before` / super-admin), never throws. */
  async hasAnyPermission(...permissions: Many<PermissionInput<PermissionName<T>>>[]): Promise<boolean> {
    for (const permission of flatten(permissions)) {
      if (await this.check(permission)) return true
    }
    return false
  }

  /** `true` if the subject has ALL the permissions. Pure data check (no `before` / super-admin), never throws. */
  async hasAllPermissions(...permissions: Many<PermissionInput<PermissionName<T>>>[]): Promise<boolean> {
    for (const permission of flatten(permissions)) {
      if (!(await this.check(permission))) return false
    }
    return true
  }

  /** Serializable `{ roles, permissions }` — e.g. to hydrate a React/Vue client. */
  async snapshot(): Promise<RbacSnapshot> {
    return { roles: await this.getRoleNames(), permissions: await this.getPermissionNames() }
  }

  // ------------------------------------------------------------------- internal

  /** {@link hasPermissionTo} that returns `false` instead of throwing. */
  private async check(permission: PermissionInput<PermissionName<T>>): Promise<boolean> {
    try {
      return await this.hasPermissionTo(permission)
    } catch (error) {
      if (error instanceof RbacError) return false
      throw error
    }
  }

  private async requirePermissionName(permission: PermissionInput): Promise<string> {
    if (typeof permission !== 'string') {
      if (permission.guardName !== this.guardName) throw new GuardDoesNotMatch(permission.guardName, this.guardName)
      return permission.name
    }
    const name = normalizeName(permission)
    if (!this.rbac.wildcard && !(await this.#core.permissionExists(name, this.guardName))) {
      throw new PermissionDoesNotExist(name, this.guardName)
    }
    return name
  }

  private state(): Promise<SubjectState> {
    const key = `rbac:${JSON.stringify([this.guardName, this.teamId, this.subject.type, String(this.subject.id)])}`
    return this.#core.remember(key, async () => {
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

  private async emitRoles(event: 'role.attached' | 'role.detached', roles: Role[]): Promise<void> {
    if (roles.length === 0) return
    await this.#core.events.emit({
      event,
      subject: this.subject,
      roles,
      guardName: this.guardName,
      teamId: this.teamId,
    })
  }

  private async emitPermissions(
    event: 'permission.attached' | 'permission.detached',
    permissions: Permission[],
  ): Promise<void> {
    if (permissions.length === 0) return
    await this.#core.events.emit({
      event,
      target: 'subject',
      subject: this.subject,
      permissions,
      guardName: this.guardName,
      teamId: this.teamId,
    })
  }

  private static roleMatches(role: Role, wanted: RoleInput): boolean {
    return typeof wanted === 'string' ? role.name === wanted.trim() : idKey(role.id) === idKey(wanted.id)
  }
}

/**
 * Creates the RBAC engine. Pass a type argument to restrict permission / role names:
 * `createRbac<{ permissions: 'edit' | 'delete'; roles: 'writer' }>({ adapter })`.
 */
export function createRbac<T extends RbacTypeConfig = DefaultRbacTypes>(options: RbacOptions<T>): Rbac<T> {
  return new Rbac<T>(options)
}
