import type { ActiveLinkOptions, DeletedLinkCounts, RbacAdapter } from './adapter'
import { type CacheStore, MemoryCache } from './cache'
import {
  GuardDoesNotMatch,
  PermissionAlreadyExists,
  PermissionDoesNotExist,
  RbacError,
  RoleAlreadyExists,
  RoleDoesNotExist,
} from './errors'
import {
  type ActorOptions,
  type ActorResolver,
  type RbacActor,
  RbacEmitter,
  type RbacEventListener,
  type RbacEventName,
} from './events'
import { expandWildcardPermissions, type SubjectsWithPermissionOptions } from './query'
import { type RbacNames, registerNames } from './names'
import { type SyncDefinition, type SyncDefinitions, type SyncOptions, type SyncResult, syncDefinition } from './sync'
import { deleteTeam, type RevokeAllOptions, revokeAll, subjectTeams, type SubjectTeamsOptions } from './bulk'
import {
  type ActiveLinks,
  activeLinks,
  earliest,
  type ExpiryArgs,
  type PermissionAssignment,
  requestedExpiry,
  type RoleAssignment,
  splitExpiryArgs,
} from './expiry'
import type {
  CheckGuard,
  DefaultGuardName,
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
  ScopedGuardName,
  SnapshotOptions,
  Subject,
  TeamId,
} from './types'
import {
  findPrefixImplications,
  parseWildcardPermission,
  prefixCheckActive,
  reportPrefixImplications,
  type WildcardPrefixCheck,
  wildcardImplies,
} from './wildcard'

/**
 * `G` is the type of `guard`: any string by default. The methods that take names pass the typed guards here
 * (see `CheckGuard`), so with per-guard names `guard` is checked and selects the names.
 */
export interface GuardOptions<G extends string = string> {
  /** Guard name, e.g. `web` or `api`. Defaults to `defaultGuard`. */
  guard?: G | undefined
}

export interface ScopeOptions<G extends string = string> extends GuardOptions<G> {
  /** Team id. Only allowed when `teams` is enabled. */
  team?: TeamId | undefined
}

/** Context passed to the {@link RbacOptions.before} hook. */
export interface BeforeContext<T extends RbacTypeConfig = DefaultRbacTypes> {
  /**
   * The subject being checked (already scoped to its guard & team). With per-guard names, it accepts the
   * names of every guard, since the hook runs for all of them.
   */
  subject: SubjectRbac<T, string>
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
  /**
   * Guard used when none is given. Default: `web`. With per-guard names (`RbacTypeConfig['guards']`), it must
   * be the typed `defaultGuard`.
   */
  defaultGuard?: DefaultGuardName<T> | undefined
  /** Enable wildcard permissions like `articles.*`. Default: `false`. */
  wildcard?: boolean | undefined
  /** Enable team-scoped roles & permissions (multi-tenancy). Default: `false`. */
  teams?: boolean | undefined
  /** Cache store, or `false` to disable caching. Default: in-memory cache. */
  cache?: CacheStore | false | undefined
  /** Cache TTL in milliseconds. Default: 24 hours. */
  cacheTtl?: number | undefined
  /**
   * Runs before every `can()` / `cannot()` / `canAny()` / `canAll()` check (spatie's `Gate::before`).
   * Return `true` to allow, `false` to deny, `undefined` to fall through to the normal check.
   * Not applied to `hasPermissionTo()` & co., which stay pure data checks.
   */
  before?: BeforeHook<T> | undefined
  /**
   * Subjects having ANY of these roles pass every `can()` check (super-admin).
   * Evaluated after `before` (if `before` returned `undefined`).
   */
  superAdminRoles?: readonly RoleName<T, string>[] | undefined
  /**
   * With `wildcard: true`, what `sync()` and `createPermission()` do when one permission name implies another
   * only because it is shorter (`orders.refund` implies `orders.refund.large`): `'warn'` logs a one-time
   * warning when `NODE_ENV` is `development`, `'error'` throws before writing, `'off'` says nothing.
   * Default: `'warn'`.
   */
  wildcardPrefixCheck?: WildcardPrefixCheck | undefined
  /**
   * Returns who makes the current change, for the `actor` field of events, when a write call doesn't pass
   * `actor` itself. Read it from your request context (e.g. an `AsyncLocalStorage`). Only called when an
   * event has listeners. Default: none, and events carry no `actor` unless a call passes one.
   */
  getActor?: ActorResolver | undefined
  /**
   * The typed names as values, for `isRoleName(rbac, value)` / `isPermissionName(rbac, value)`, which check user
   * input against them. Optional; the engine itself does not use them.
   */
  names?: RbacNames<T> | undefined
  /**
   * The engine's clock, used to decide whether an assignment's `expiresAt` has passed. Inject one in tests
   * to move time forward. Default: the system clock (`new Date()`).
   */
  now?: (() => Date) | undefined
}

const DAY_MS = 24 * 60 * 60 * 1000

const idKey = (id: Id | null): string => (id === null ? '\u0000null' : String(id))

const missingExpiryMethod = (method: keyof RbacAdapter, caller: string): RbacError =>
  new RbacError(
    'ADAPTER_METHOD_MISSING',
    `${caller} needs the adapter method \`${method}()\`: the adapter declares \`supportsExpiry\` but does not implement it.`,
  )

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
  /**
   * Cached `compute()`. `validUntil` gives the epoch ms after which a value is stale (an expiry inside it):
   * the entry's TTL is capped there, and a hit past it is recomputed.
   */
  remember<V>(key: string, compute: () => Promise<V>, validUntil?: (value: V) => number | undefined): Promise<V>
  /** Whether the adapter stores expiry (`supportsExpiry: true`). */
  readonly expiry: boolean
  /** The engine's clock, in epoch ms. */
  now(): number
  /** `[{ now }]` for the reverse lookups with expiry on, else `[]`. */
  activeArgs(): [] | [ActiveLinkOptions]
  /** The subject's active (not expired) role or direct-permission links in the team, with their expiry. */
  subjectLinks(kind: 'roles' | 'permissions', subject: Subject, teamId: TeamId): Promise<ActiveLinks>
  permissionExists(name: string, guardName: string): Promise<boolean>
  gate(subject: SubjectRbac<T, string>, permission: string): Promise<boolean | undefined>
  resolveGuard(guard: string | undefined): string
  resolveTeam(team: TeamId | undefined): TeamId
  visibleTeams(teamId: TeamId): TeamId[]
  resolvePermissions(inputs: readonly PermissionInput[], guardName: string): Promise<Permission[]>
  resolveRoles(inputs: readonly RoleInput[], guardName: string, teamId: TeamId): Promise<Role[]>
  permissionMatches(granted: readonly string[], required: string): boolean
  readonly wildcardPrefixCheck: WildcardPrefixCheck
  /** `createPermission`, optionally without the wildcard prefix check (`sync` runs its own). */
  createPermission(
    name: string,
    options: GuardOptions & ActorOptions,
    check: { prefixCheck: boolean },
  ): Promise<Permission>
}

/**
 * Filled by the `Rbac` constructor. A module-private WeakMap rather than a `static {}` block: a static block
 * runs when the class is defined, which bundlers treat as a side effect, so they kept the whole engine in
 * client bundles (React, Vue, Next.js middleware) that only import `wildcardImplies`.
 */
const INTERNALS = /* @__PURE__ */ new WeakMap<object, unknown>()
const internalsOf = <T extends RbacTypeConfig>(rbac: Rbac<T>): RbacInternals<T> =>
  INTERNALS.get(rbac) as RbacInternals<T>

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
  readonly #events: RbacEmitter
  readonly #wildcardPrefixCheck: WildcardPrefixCheck
  readonly #expiry: boolean
  readonly #clock: () => number
  /** Bumped on every change, so a lookup that started before the change never caches its stale result. */
  #generation = 0
  readonly #internals: RbacInternals<T>

  constructor(options: RbacOptions<T>) {
    this.adapter = options.adapter
    this.defaultGuard = options.defaultGuard ?? 'web'
    this.wildcard = options.wildcard ?? false
    this.teams = options.teams ?? false
    this.#cache = options.cache === false ? null : (options.cache ?? new MemoryCache())
    this.#cacheTtl = options.cacheTtl ?? DAY_MS
    this.#before = options.before
    this.#superAdminRoles = options.superAdminRoles ?? []
    this.#events = new RbacEmitter(options.getActor)
    this.#wildcardPrefixCheck = options.wildcardPrefixCheck ?? 'warn'
    this.#expiry = options.adapter.supportsExpiry === true
    const now = options.now
    this.#clock = now ? () => now().getTime() : () => Date.now()
    this.#internals = {
      events: this.#events,
      remember: (key, compute, validUntil) => this.#remember(key, compute, validUntil),
      expiry: this.#expiry,
      now: () => this.#clock(),
      activeArgs: () => this.#activeArgs(),
      subjectLinks: (kind, subject, teamId) => this.#subjectLinks(kind, subject, teamId),
      permissionExists: (name, guardName) => this.#permissionExists(name, guardName),
      gate: (subject, permission) => this.#gate(subject, permission),
      resolveGuard: (guard) => this.#resolveGuard(guard),
      resolveTeam: (team) => this.#resolveTeam(team),
      visibleTeams: (teamId) => this.#visibleTeams(teamId),
      resolvePermissions: (inputs, guardName) => this.#resolvePermissions(inputs, guardName),
      resolveRoles: (inputs, guardName, teamId) => this.#resolveRoles(inputs, guardName, teamId),
      permissionMatches: (granted, required) => this.#permissionMatches(granted, required),
      wildcardPrefixCheck: this.#wildcardPrefixCheck,
      createPermission: (name, options, check) => this.#createPermission(name, options, check),
    }
    INTERNALS.set(this, this.#internals)
    registerNames(this, options.names)
  }

  /**
   * Work with the roles & permissions of a subject (usually a user).
   * With per-guard names, the subject takes the names of `options.guard` (the default guard's without it).
   */
  for<G extends string = DefaultGuardName<T>>(
    subject: Subject,
    options: ScopeOptions<CheckGuard<T, G>> & ActorOptions = {},
  ): SubjectRbac<T, ScopedGuardName<T, G>> {
    const { actor } = options
    const guard = this.#resolveGuard(options.guard)
    return new SubjectRbac<T, ScopedGuardName<T, G>>(this, subject, guard, this.#resolveTeam(options.team), actor)
  }

  /**
   * Work with the permissions of a role. With per-guard names, the name and the permissions are those of
   * `options.guard` (a role object keeps its own guard at runtime; pass `guard` to type it too).
   */
  role<G extends string = DefaultGuardName<T>>(
    role: RoleInput<RoleName<T, G>>,
    options: ScopeOptions<CheckGuard<T, G>> & ActorOptions = {},
  ): RoleRbac<T, ScopedGuardName<T, G>> {
    const { actor } = options
    if (typeof role !== 'string') return new RoleRbac<T, ScopedGuardName<T, G>>(this, role, role.guardName, role.teamId, actor)
    const guard = this.#resolveGuard(options.guard)
    return new RoleRbac<T, ScopedGuardName<T, G>>(this, role, guard, this.#resolveTeam(options.team), actor)
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

  async createPermission<G extends string = DefaultGuardName<T>>(
    name: PermissionName<T, G>,
    options: GuardOptions<CheckGuard<T, G>> & ActorOptions = {},
  ): Promise<Permission> {
    return this.#createPermission(name, options, { prefixCheck: true })
  }

  async #createPermission(
    name: string,
    options: GuardOptions & ActorOptions,
    { prefixCheck }: { prefixCheck: boolean },
  ): Promise<Permission> {
    const guardName = this.#resolveGuard(options.guard)
    const permissionName = normalizeName(name)
    if (this.wildcard) parseWildcardPermission(permissionName)

    if (await this.findPermission(permissionName as PermissionName<T, string>, { guard: guardName })) {
      throw new PermissionAlreadyExists(permissionName, guardName)
    }
    if (prefixCheck && this.wildcard && prefixCheckActive(this.#wildcardPrefixCheck)) {
      const names = (await this.adapter.findPermissions({ guardName })).map((p) => p.name)
      const pairs = findPrefixImplications([...names, permissionName], new Set([permissionName]))
      reportPrefixImplications(this.#wildcardPrefixCheck, pairs, guardName)
    }
    const permission = await this.adapter.createPermission({ name: permissionName, guardName })
    await this.forgetCachedPermissions()
    await this.#events.emit({ event: 'permission.created', permission }, options.actor)
    return permission
  }

  async findPermission<G extends string = DefaultGuardName<T>>(
    name: PermissionName<T, G>,
    options: GuardOptions<CheckGuard<T, G>> = {},
  ): Promise<Permission | null> {
    const [permission] = await this.adapter.findPermissions({
      names: [normalizeName(name)],
      guardName: this.#resolveGuard(options.guard),
    })
    return permission ?? null
  }

  async findPermissionOrFail<G extends string = DefaultGuardName<T>>(
    name: PermissionName<T, G>,
    options: GuardOptions<CheckGuard<T, G>> = {},
  ): Promise<Permission> {
    const permission = await this.findPermission(name as PermissionName<T, string>, options as GuardOptions)
    if (!permission) throw new PermissionDoesNotExist(normalizeName(name), this.#resolveGuard(options.guard))
    return permission
  }

  /** Finds a permission by id in the guard (spatie: `Permission::findById($id, $guard)`), or `null`. */
  async findPermissionById(id: Id, options: GuardOptions = {}): Promise<Permission | null> {
    const [permission] = await this.adapter.findPermissions({ ids: [id], guardName: this.#resolveGuard(options.guard) })
    return permission ?? null
  }

  async findOrCreatePermission<G extends string = DefaultGuardName<T>>(
    name: PermissionName<T, G>,
    options: GuardOptions<CheckGuard<T, G>> & ActorOptions = {},
  ): Promise<Permission> {
    const wide = name as PermissionName<T, string>
    const opts = options as GuardOptions & ActorOptions
    return (await this.findPermission(wide, opts)) ?? this.createPermission(wide, opts)
  }

  async getPermissions(options: GuardOptions = {}): Promise<Permission[]> {
    return this.adapter.findPermissions({ guardName: this.#resolveGuard(options.guard) })
  }

  async deletePermission<G extends string = DefaultGuardName<T>>(
    permission: PermissionInput<PermissionName<T, G>>,
    options: GuardOptions<CheckGuard<T, G>> & ActorOptions = {},
  ): Promise<void> {
    const guardName = typeof permission === 'string' ? this.#resolveGuard(options.guard) : permission.guardName
    const [resolved] = await this.#resolvePermissions([permission], guardName)
    await this.adapter.deletePermission(resolved!.id)
    await this.forgetCachedPermissions()
    await this.#events.emit({ event: 'permission.deleted', permission: resolved! }, options.actor)
  }

  // ------------------------------------------------------------------------ roles

  async createRole<G extends string = DefaultGuardName<T>>(
    name: RoleName<T, G>,
    options: ScopeOptions<CheckGuard<T, G>> & ActorOptions = {},
  ): Promise<Role> {
    const guardName = this.#resolveGuard(options.guard)
    const teamId = this.#resolveTeam(options.team)
    const roleName = normalizeName(name)

    const existing = await this.adapter.findRoles({ names: [roleName], guardName, teamIds: [teamId] })
    if (existing.length > 0) throw new RoleAlreadyExists(roleName, guardName)

    const role = await this.adapter.createRole({ name: roleName, guardName, teamId })
    await this.forgetCachedPermissions()
    await this.#events.emit({ event: 'role.created', role, teamId: role.teamId }, options.actor)
    return role
  }

  /** Finds a role. With a team, a team-specific role wins over a global role of the same name. */
  async findRole<G extends string = DefaultGuardName<T>>(
    name: RoleName<T, G>,
    options: ScopeOptions<CheckGuard<T, G>> = {},
  ): Promise<Role | null> {
    const guardName = this.#resolveGuard(options.guard)
    const teamId = this.#resolveTeam(options.team)
    const roleName = normalizeName(name)
    const roles = await this.adapter.findRoles({ names: [roleName], guardName, teamIds: this.#visibleTeams(teamId) })
    return Rbac.pickRole(roles, roleName, teamId) ?? null
  }

  async findRoleOrFail<G extends string = DefaultGuardName<T>>(
    name: RoleName<T, G>,
    options: ScopeOptions<CheckGuard<T, G>> = {},
  ): Promise<Role> {
    const role = await this.findRole(name as RoleName<T, string>, options as ScopeOptions)
    if (!role) throw new RoleDoesNotExist(normalizeName(name), this.#resolveGuard(options.guard))
    return role
  }

  /** Finds a role by id in the guard (spatie: `Role::findById($id, $guard)`), or `null`. */
  async findRoleById(id: Id, options: GuardOptions = {}): Promise<Role | null> {
    const [role] = await this.adapter.findRoles({ ids: [id], guardName: this.#resolveGuard(options.guard) })
    return role ?? null
  }

  /**
   * Roles in the given scope that grant the permission directly (spatie: `$permission->roles`).
   * Throws `PermissionDoesNotExist` for an unknown permission. Wildcard grants are not expanded.
   */
  async rolesWithPermission<G extends string = DefaultGuardName<T>>(
    permission: PermissionInput<PermissionName<T, G>>,
    options: ScopeOptions<CheckGuard<T, G>> = {},
  ): Promise<Role[]> {
    const guardName = this.#resolveGuard(options.guard)
    const teamId = this.#resolveTeam(options.team)
    const [resolved] = await this.#resolvePermissions([permission], guardName)
    const roles = await this.adapter.findRoles({ guardName, teamIds: this.#visibleTeams(teamId) })
    if (roles.length === 0) return []
    const links = await this.adapter.getRolePermissionLinks(roles.map((r) => r.id))
    const holders = new Set(links.filter((l) => idKey(l.permissionId) === idKey(resolved!.id)).map((l) => idKey(l.roleId)))
    return roles.filter((r) => holders.has(idKey(r.id)))
  }

  async findOrCreateRole<G extends string = DefaultGuardName<T>>(
    name: RoleName<T, G>,
    options: ScopeOptions<CheckGuard<T, G>> & ActorOptions = {},
  ): Promise<Role> {
    const wide = name as RoleName<T, string>
    const opts = options as ScopeOptions & ActorOptions
    return (await this.findRole(wide, opts)) ?? this.createRole(wide, opts)
  }

  /** Lists roles visible in the given scope (global roles + roles of the given team). */
  async getRoles(options: ScopeOptions = {}): Promise<Role[]> {
    const teamId = this.#resolveTeam(options.team)
    return this.adapter.findRoles({ guardName: this.#resolveGuard(options.guard), teamIds: this.#visibleTeams(teamId) })
  }

  async deleteRole<G extends string = DefaultGuardName<T>>(
    role: RoleInput<RoleName<T, G>>,
    options: ScopeOptions<CheckGuard<T, G>> & ActorOptions = {},
  ): Promise<void> {
    const resolved = await this.role(role as RoleInput<RoleName<T, string>>, options as ScopeOptions & ActorOptions).get()
    await this.adapter.deleteRole(resolved.id)
    await this.forgetCachedPermissions()
    await this.#events.emit({ event: 'role.deleted', role: resolved, teamId: resolved.teamId }, options.actor)
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
  async sync<G extends string = DefaultGuardName<T>>(
    definition: SyncDefinitions<T, G>,
    options: SyncOptions<CheckGuard<T, G>> = {},
  ): Promise<SyncResult> {
    const definitions = definition as SyncDefinition<T> | readonly SyncDefinition<T>[]
    return syncDefinition(this, this.#internals, definitions, options as SyncOptions)
  }

  // ---------------------------------------------------------------------- queries

  /**
   * Ids of subjects of `subjectType` that have ANY of the given roles in the given scope
   * (spatie: `User::role('writer')->get()`). Throws `RoleDoesNotExist` for unknown roles.
   */
  async subjectsWithRole<G extends string = DefaultGuardName<T>>(
    subjectType: string,
    roles: Many<RoleInput<RoleName<T, G>>>,
    options: ScopeOptions<CheckGuard<T, G>> = {},
  ): Promise<Id[]> {
    const guardName = this.#resolveGuard(options.guard)
    const teamId = this.#resolveTeam(options.team)
    const resolved = await this.#resolveRoles(flatten([roles]), guardName, teamId)
    if (resolved.length === 0) return []
    return this.adapter.getSubjectIdsWithRoles(
      subjectType,
      resolved.map((r) => r.id),
      teamId,
      ...this.#activeArgs(),
    )
  }

  /**
   * Ids of subjects of `subjectType` that have ANY of the given permissions in the given scope —
   * directly or via one of their roles (spatie: `User::permission('edit')->get()`).
   * Throws `PermissionDoesNotExist` for unknown permissions. Wildcards are not expanded, unless
   * `expandWildcards: true` is passed with `wildcard: true`: then holders of a wildcard that implies a name
   * (`articles.*`, `*`) are returned too, and the names don't need to exist.
   */
  async subjectsWithPermission<G extends string = DefaultGuardName<T>>(
    subjectType: string,
    permissions: Many<PermissionInput<PermissionName<T, G>>>,
    options: SubjectsWithPermissionOptions<CheckGuard<T, G>> = {},
  ): Promise<Id[]> {
    const guardName = this.#resolveGuard(options.guard)
    const teamId = this.#resolveTeam(options.team)
    const resolved =
      options.expandWildcards && this.wildcard
        ? expandWildcardPermissions(await this.adapter.findPermissions({ guardName }), flatten([permissions]), guardName)
        : await this.#resolvePermissions(flatten([permissions]), guardName)
    if (resolved.length === 0) return []
    const permissionIds = resolved.map((p) => p.id)
    const wanted = new Set(permissionIds.map(idKey))

    const roles = await this.adapter.findRoles({ guardName, teamIds: this.#visibleTeams(teamId) })
    const links = roles.length > 0 ? await this.adapter.getRolePermissionLinks(roles.map((r) => r.id)) : []
    const roleIds = uniqueIds(links.filter((l) => wanted.has(idKey(l.permissionId))).map((l) => l.roleId))

    const active = this.#activeArgs()
    const viaRoles =
      roleIds.length > 0 ? await this.adapter.getSubjectIdsWithRoles(subjectType, roleIds, teamId, ...active) : []
    const direct = await this.adapter.getSubjectIdsWithPermissions(subjectType, permissionIds, teamId, ...active)
    return uniqueIds([...viaRoles, ...direct])
  }

  // ------------------------------------------------------------------------ teams

  /**
   * Deletes a team: every role and direct permission held in it (by any subject, in every guard), and every
   * role scoped to it (`teamId`), with their permission links. Global roles and permissions stay.
   * Emits `role.detached` / `permission.detached` per subject and guard, then `role.deleted` per team role.
   * Clears the cache, so no member keeps cached access.
   *
   * Throws `TEAMS_NOT_ENABLED` without `teams: true`, and `ADAPTER_METHOD_MISSING` (before any write) when
   * the adapter has no `getTeamLinks()`. Not atomic: a failure midway leaves the rest of the team in place.
   */
  async deleteTeam(teamId: Id): Promise<void> {
    await deleteTeam(this, this.#internals, teamId)
  }

  // ----------------------------------------------------------------------- expiry

  /**
   * Deletes every role assignment and direct permission whose `expiresAt` has passed (by the engine's clock),
   * for every subject, team and guard. Checks already ignore them, so access doesn't change: this only
   * keeps the tables small. Run it from a scheduled job. Emits no events (the access ended at `expiresAt`,
   * not now) and leaves the cache alone. Returns how many links were deleted.
   *
   * A no-op returning zeros when the adapter has no expiry support. Throws `ADAPTER_METHOD_MISSING` when it
   * declares `supportsExpiry` without `deleteExpiredLinks()`.
   */
  async pruneExpired(): Promise<DeletedLinkCounts> {
    if (!this.#expiry) return { roles: 0, permissions: 0 }
    if (!this.adapter.deleteExpiredLinks) throw missingExpiryMethod('deleteExpiredLinks', '`pruneExpired()`')
    return this.adapter.deleteExpiredLinks(new Date(this.#clock()))
  }

  #activeArgs(): [] | [ActiveLinkOptions] {
    return this.#expiry ? [{ now: new Date(this.#clock()) }] : []
  }

  async #subjectLinks(kind: 'roles' | 'permissions', subject: Subject, teamId: TeamId): Promise<ActiveLinks> {
    const { adapter } = this
    if (!this.#expiry) {
      const ids =
        kind === 'roles'
          ? await adapter.getSubjectRoleIds(subject, teamId)
          : await adapter.getSubjectPermissionIds(subject, teamId)
      return activeLinks(ids, (id) => id, () => null, 0)
    }
    const now = this.#clock()
    if (kind === 'roles') {
      if (!adapter.getSubjectRoleLinks) throw missingExpiryMethod('getSubjectRoleLinks', 'Expiry')
      return activeLinks(await adapter.getSubjectRoleLinks(subject, teamId), (l) => l.roleId, (l) => l.expiresAt, now)
    }
    if (!adapter.getSubjectPermissionLinks) throw missingExpiryMethod('getSubjectPermissionLinks', 'Expiry')
    return activeLinks(
      await adapter.getSubjectPermissionLinks(subject, teamId),
      (l) => l.permissionId,
      (l) => l.expiresAt,
      now,
    )
  }

  // ------------------------------------------------------------------------ cache

  /** Clears every cached role/permission lookup. Called automatically after each change. */
  async forgetCachedPermissions(): Promise<void> {
    this.#generation++
    await this.#cache?.clear()
  }

  async #remember<V>(
    key: string,
    compute: () => Promise<V>,
    validUntil?: (value: V) => number | undefined,
  ): Promise<V> {
    if (!this.#cache) return compute()
    const hit = await this.#cache.get(key)
    if (hit !== undefined) {
      // A shared store may round TTLs up (Redis `EX` is in seconds): the value itself says when it goes stale.
      const until = validUntil?.(hit as V)
      if (until === undefined || until > this.#clock()) return hit as V
    }
    const generation = this.#generation
    const value = await compute()
    const until = validUntil?.(value)
    // Never keep an entry past the earliest expiry inside it.
    const ttl = until === undefined ? this.#cacheTtl : Math.min(this.#cacheTtl, until - this.#clock())
    // shortcut: the counter is per process; a cache shared between processes can still get a stale
    // entry from another process's in-flight lookup (bounded by cacheTtl). Use a versioned store if that matters.
    if (generation === this.#generation && ttl > 0) await this.#cache.set(key, value, ttl)
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
  async #gate(subject: SubjectRbac<T, string>, permission: string): Promise<boolean | undefined> {
    if (this.#before) {
      const decision = await this.#before({ subject, permission })
      if (typeof decision === 'boolean') return decision
    }
    if (this.#superAdminRoles.length > 0 && (await subject.hasAnyRole(this.#superAdminRoles as RoleName<T, string>[]))) {
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
export class RoleRbac<T extends RbacTypeConfig = DefaultRbacTypes, G extends string = DefaultGuardName<T>> {
  readonly #core: RbacInternals<T>
  readonly #actor: RbacActor | undefined

  constructor(
    private readonly rbac: Rbac<T>,
    private readonly input: RoleInput,
    readonly guardName: string,
    readonly teamId: TeamId,
    actor?: RbacActor,
  ) {
    this.#core = internalsOf(rbac)
    this.#actor = actor
  }

  /** Returns the role, throwing `RoleDoesNotExist` if it can't be found. */
  async get(): Promise<Role> {
    const [role] = await this.#core.resolveRoles([this.input], this.guardName, this.teamId)
    return role!
  }

  async givePermissionTo(...permissions: Many<PermissionInput<PermissionName<T, G>>>[]): Promise<this> {
    const role = await this.get()
    const resolved = await this.#core.resolvePermissions(flatten(permissions), role.guardName)
    const track = this.#core.events.has('permission.attached')
    const before = track ? await this.currentPermissionIds(role) : []
    await this.rbac.adapter.attachRolePermissions(role.id, resolved.map((p) => p.id))
    await this.rbac.forgetCachedPermissions()
    if (track) await this.emit('permission.attached', role, filterByIds(resolved, before, false))
    return this
  }

  async revokePermissionTo(...permissions: Many<PermissionInput<PermissionName<T, G>>>[]): Promise<this> {
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
  async syncPermissions(...permissions: Many<PermissionInput<PermissionName<T, G>>>[]): Promise<this> {
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
    const scope = { guard: role.guardName, team: this.teamId, actor: this.#actor }
    const before = await this.rbac.adapter.getSubjectIdsWithRoles(
      subjectType,
      [role.id],
      this.teamId,
      ...this.#core.activeArgs(),
    )
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

  async hasPermissionTo(permission: PermissionInput<PermissionName<T, G>>): Promise<boolean> {
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
    }, this.#actor)
  }
}

interface SubjectState {
  roles: Role[]
  direct: Permission[]
  viaRoles: Permission[]
  /**
   * Expiry (epoch ms) of the role and direct-permission links that have one, by id. Only present when one
   * of them expires. Plain numbers, so the state survives a JSON cache (Redis, KV, ...).
   */
  expires?: { roles: Record<string, number>; direct: Record<string, number> }
  /** Epoch ms of the earliest of `expires`: the state is stale from then on (cache TTL and hit check). */
  validUntil?: number
}

/** The links of one kind held in a state, as `id → expiry` (`null` = permanent). */
function stateLinks(state: SubjectState, kind: 'roles' | 'permissions'): ActiveLinks {
  const items = kind === 'roles' ? state.roles : state.direct
  const expires = kind === 'roles' ? state.expires?.roles : state.expires?.direct
  return new Map(items.map((item) => [idKey(item.id), { id: item.id, expiresAt: expires?.[idKey(item.id)] ?? null }]))
}

/** Items that are new, or (with expiry) whose expiry the write changes. */
function changedLinks<V extends { id: Id }>(items: readonly V[], before: ActiveLinks, expiresAt: Date | null): V[] {
  const target = expiresAt === null ? null : expiresAt.getTime()
  return items.filter((item) => {
    const link = before.get(idKey(item.id))
    return link === undefined || link.expiresAt !== target
  })
}

/** Items held in `before` (active links). */
function heldLinks<V extends { id: Id }>(items: readonly V[], before: ActiveLinks): V[] {
  return items.filter((item) => before.has(idKey(item.id)))
}

/** Roles & permissions of a single subject. Obtain with `rbac.for(user)`. */
export class SubjectRbac<T extends RbacTypeConfig = DefaultRbacTypes, G extends string = DefaultGuardName<T>> {
  readonly #core: RbacInternals<T>
  readonly #actor: RbacActor | undefined

  constructor(
    private readonly rbac: Rbac<T>,
    readonly subject: Subject,
    readonly guardName: string,
    readonly teamId: TeamId,
    actor?: RbacActor,
  ) {
    this.#core = internalsOf(rbac)
    this.#actor = actor
  }

  /**
   * The same subject in another guard and/or team; options left out keep the current ones (spatie passes the
   * guard to each check: `$user->hasRole('admin', 'api')`).
   *
   * ```ts
   * await rbac.for(user).withScope({ guard: 'api' }).hasRole('admin')
   * ```
   */
  withScope<G2 extends string = G>(options: ScopeOptions<CheckGuard<T, G2>>): SubjectRbac<T, ScopedGuardName<T, G2>> {
    const scope: ScopeOptions & ActorOptions = {
      guard: options.guard ?? this.guardName,
      team: options.team === undefined ? this.teamId : options.team,
      actor: this.#actor,
    }
    return this.rbac.for(this.subject, scope) as unknown as SubjectRbac<T, ScopedGuardName<T, G2>>
  }

  // ------------------------------------------------------------------------ roles

  /**
   * Assigns roles. A last `{ expiresAt }` argument makes the assignments temporary (see {@link ExpiryOptions});
   * without it they are permanent, also for roles the subject already held with an expiry (the latest call wins).
   */
  async assignRole(...roles: ExpiryArgs<Many<RoleInput<RoleName<T, G>>>>): Promise<this> {
    const { items, options } = splitExpiryArgs(roles)
    const expiresAt = requestedExpiry(options, this.rbac.adapter) ?? null
    const resolved = await this.#core.resolveRoles(flatten(items), this.guardName, this.teamId)
    const track = this.#core.events.has('role.attached')
    const before = track ? await this.#core.subjectLinks('roles', this.subject, this.teamId) : undefined
    await this.attach('roles', resolved, expiresAt)
    await this.rbac.forgetCachedPermissions()
    if (before) await this.emitRoles('role.attached', changedLinks(resolved, before, expiresAt), expiresAt)
    return this
  }

  async removeRole(...roles: Many<RoleInput<RoleName<T, G>>>[]): Promise<this> {
    const { adapter } = this.rbac
    const resolved = await this.#core.resolveRoles(flatten(roles), this.guardName, this.teamId)
    const track = this.#core.events.has('role.detached')
    const before = track ? await this.#core.subjectLinks('roles', this.subject, this.teamId) : undefined
    await adapter.detachSubjectRoles(this.subject, resolved.map((r) => r.id), this.teamId)
    await this.rbac.forgetCachedPermissions()
    if (before) await this.emitRoles('role.detached', heldLinks(resolved, before))
    return this
  }

  /**
   * Replaces all roles (in the current guard & team) with the given ones. With a last `{ expiresAt }`, every
   * listed role gets that expiry; without it, roles the subject keeps keep theirs and new ones are permanent.
   */
  async syncRoles(...roles: ExpiryArgs<Many<RoleInput<RoleName<T, G>>>>): Promise<this> {
    const { items, options } = splitExpiryArgs(roles)
    const requested = requestedExpiry(options, this.rbac.adapter)
    const resolved = await this.#core.resolveRoles(flatten(items), this.guardName, this.teamId)
    const state = await this.state()
    const current = state.roles
    const before = stateLinks(state, 'roles')
    const newIds = resolved.map((r) => r.id)
    // Without an expiry, links that stay are left as they are (with expiry on: only the new ones are written).
    const keep = requested === undefined && this.#core.expiry
    const attached = keep ? resolved.filter((r) => !before.has(idKey(r.id))) : resolved
    // Attach first, then detach the rest: a failure midway leaves extra roles, never none.
    await this.attach('roles', attached, requested ?? null)
    const stale = filterByIds(current, newIds, false)
    if (stale.length > 0) await this.rbac.adapter.detachSubjectRoles(this.subject, stale.map((r) => r.id), this.teamId)
    await this.rbac.forgetCachedPermissions()
    await this.emitRoles('role.detached', filterByIds(current, resolved.map((r) => r.id), false))
    await this.emitRoles('role.attached', changedLinks(attached, before, requested ?? null), requested ?? null)
    return this
  }

  /**
   * The roles the subject holds (in the current guard & team), each with when the assignment ends
   * (`expiresAt`, `null` = permanent). Expired assignments are not listed.
   */
  async getRoleAssignments(): Promise<RoleAssignment[]> {
    const state = await this.state()
    const links = stateLinks(state, 'roles')
    return state.roles.map((role) => ({ role, expiresAt: SubjectRbac.toDate(links.get(idKey(role.id))?.expiresAt) }))
  }

  async getRoles(): Promise<Role[]> {
    return [...(await this.state()).roles]
  }

  async getRoleNames(): Promise<string[]> {
    return (await this.state()).roles.map((r) => r.name)
  }

  /** `true` if the subject has the role — or ANY of the roles when given an array. */
  async hasRole(roles: Many<RoleInput<RoleName<T, G>>>): Promise<boolean> {
    return this.hasAnyRole(roles)
  }

  async hasAnyRole(...roles: Many<RoleInput<RoleName<T, G>>>[]): Promise<boolean> {
    const mine = (await this.state()).roles
    return flatten(roles).some((wanted) => mine.some((r) => SubjectRbac.roleMatches(r, wanted)))
  }

  async hasAllRoles(...roles: Many<RoleInput<RoleName<T, G>>>[]): Promise<boolean> {
    const mine = (await this.state()).roles
    return flatten(roles).every((wanted) => mine.some((r) => SubjectRbac.roleMatches(r, wanted)))
  }

  /** `true` if the subject has ALL the given roles and no other role (in the current guard & team). */
  async hasExactRoles(...roles: Many<RoleInput<RoleName<T, G>>>[]): Promise<boolean> {
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

  /**
   * Gives direct permissions. A last `{ expiresAt }` argument makes the grants temporary (see
   * {@link ExpiryOptions}); without it they are permanent, also for ones already held with an expiry.
   */
  async givePermissionTo(...permissions: ExpiryArgs<Many<PermissionInput<PermissionName<T, G>>>>): Promise<this> {
    const { items, options } = splitExpiryArgs(permissions)
    const expiresAt = requestedExpiry(options, this.rbac.adapter) ?? null
    const resolved = await this.#core.resolvePermissions(flatten(items), this.guardName)
    const track = this.#core.events.has('permission.attached')
    const before = track ? await this.#core.subjectLinks('permissions', this.subject, this.teamId) : undefined
    await this.attach('permissions', resolved, expiresAt)
    await this.rbac.forgetCachedPermissions()
    if (before) {
      await this.emitPermissions('permission.attached', changedLinks(resolved, before, expiresAt), expiresAt)
    }
    return this
  }

  async revokePermissionTo(...permissions: Many<PermissionInput<PermissionName<T, G>>>[]): Promise<this> {
    const { adapter } = this.rbac
    const resolved = await this.#core.resolvePermissions(flatten(permissions), this.guardName)
    const track = this.#core.events.has('permission.detached')
    const before = track ? await this.#core.subjectLinks('permissions', this.subject, this.teamId) : undefined
    await adapter.detachSubjectPermissions(this.subject, resolved.map((p) => p.id), this.teamId)
    await this.rbac.forgetCachedPermissions()
    if (before) await this.emitPermissions('permission.detached', heldLinks(resolved, before))
    return this
  }

  /**
   * Replaces all direct permissions (in the current guard & team) with the given ones. `{ expiresAt }` works
   * as in {@link syncRoles}.
   */
  async syncPermissions(...permissions: ExpiryArgs<Many<PermissionInput<PermissionName<T, G>>>>): Promise<this> {
    const { items, options } = splitExpiryArgs(permissions)
    const requested = requestedExpiry(options, this.rbac.adapter)
    const resolved = await this.#core.resolvePermissions(flatten(items), this.guardName)
    const state = await this.state()
    const current = state.direct
    const before = stateLinks(state, 'permissions')
    const newIds = resolved.map((p) => p.id)
    const keep = requested === undefined && this.#core.expiry
    const attached = keep ? resolved.filter((p) => !before.has(idKey(p.id))) : resolved
    // Attach first, then detach the rest: a failure midway leaves extra permissions, never none.
    await this.attach('permissions', attached, requested ?? null)
    const stale = filterByIds(current, newIds, false)
    if (stale.length > 0) {
      await this.rbac.adapter.detachSubjectPermissions(this.subject, stale.map((p) => p.id), this.teamId)
    }
    await this.rbac.forgetCachedPermissions()
    await this.emitPermissions('permission.detached', filterByIds(current, resolved.map((p) => p.id), false))
    await this.emitPermissions(
      'permission.attached',
      changedLinks(attached, before, requested ?? null),
      requested ?? null,
    )
    return this
  }

  /**
   * The direct permissions the subject holds (in the current guard & team), each with when the grant ends
   * (`expiresAt`, `null` = permanent). Expired grants are not listed.
   */
  async getDirectPermissionAssignments(): Promise<PermissionAssignment[]> {
    const state = await this.state()
    const links = stateLinks(state, 'permissions')
    return state.direct.map((permission) => ({
      permission,
      expiresAt: SubjectRbac.toDate(links.get(idKey(permission.id))?.expiresAt),
    }))
  }

  // ---------------------------------------------------------------- everything

  /**
   * Removes every role and direct permission of the subject in the current guard and team
   * (`syncRoles()` plus `syncPermissions()` with nothing). `allGuards` and `allTeams` widen it; both
   * together remove the subject from everything, like spatie does when a model is deleted.
   * Emits `role.detached` / `permission.detached` per team and guard, for what was actually removed.
   *
   * `allTeams` needs the optional adapter method `getSubjectLinks()` when teams are enabled, and throws
   * `ADAPTER_METHOD_MISSING` without it.
   */
  async revokeAll(options: RevokeAllOptions = {}): Promise<this> {
    await revokeAll(this.rbac, this.#core, this, options)
    return this
  }

  /**
   * Ids of the teams where the subject has a role or a direct permission in the current guard
   * (every guard with `allGuards`). The global scope is not a team, so it is never listed.
   * Ids come back as the adapter stores them (the SQL adapters return strings). Order is not specified.
   *
   * Throws `TEAMS_NOT_ENABLED` without `teams: true`, and `ADAPTER_METHOD_MISSING` when the adapter has no
   * `getSubjectLinks()`.
   */
  async teams(options: SubjectTeamsOptions = {}): Promise<Id[]> {
    return subjectTeams(this.rbac, this.#core, this, options)
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
  async hasPermissionTo(permission: PermissionInput<PermissionName<T, G>>): Promise<boolean> {
    const name = await this.requirePermissionName(permission)
    return this.#core.permissionMatches(await this.getPermissionNames(), name)
  }

  /** Checks a direct permission only (ignores roles). */
  async hasDirectPermission(permission: PermissionInput<PermissionName<T, G>>): Promise<boolean> {
    const name = await this.requirePermissionName(permission)
    const direct = (await this.state()).direct.map((p) => p.name)
    return this.#core.permissionMatches(direct, name)
  }

  /** `true` if the subject has ANY of the permissions directly (ignores roles). Never throws. */
  async hasAnyDirectPermission(...permissions: Many<PermissionInput<PermissionName<T, G>>>[]): Promise<boolean> {
    for (const permission of flatten(permissions)) {
      if (await this.checkDirect(permission)) return true
    }
    return false
  }

  /** `true` if the subject has ALL the permissions directly (ignores roles). Never throws. */
  async hasAllDirectPermissions(...permissions: Many<PermissionInput<PermissionName<T, G>>>[]): Promise<boolean> {
    for (const permission of flatten(permissions)) {
      if (!(await this.checkDirect(permission))) return false
    }
    return true
  }

  /**
   * {@link hasPermissionTo} that returns `false` instead of throwing for an unknown permission or another guard
   * (spatie: `checkPermissionTo`). Pure data check: no `before` hook or super-admin.
   */
  async checkPermissionTo(permission: PermissionInput<PermissionName<T, G>>): Promise<boolean> {
    return this.check(permission)
  }

  /**
   * Authorization check: runs the `before` hook and `superAdminRoles` first, then falls back
   * to {@link hasPermissionTo}, returning `false` instead of throwing.
   */
  async can(permission: PermissionInput<PermissionName<T, G>>): Promise<boolean> {
    const name = typeof permission === 'string' ? permission.trim() : permission.name
    const decision = await this.#core.gate(this, name)
    if (decision !== undefined) return decision
    return this.check(permission)
  }

  async cannot(permission: PermissionInput<PermissionName<T, G>>): Promise<boolean> {
    return !(await this.can(permission))
  }

  async canAny(...permissions: Many<PermissionInput<PermissionName<T, G>>>[]): Promise<boolean> {
    for (const permission of flatten(permissions)) {
      if (await this.can(permission)) return true
    }
    return false
  }

  async canAll(...permissions: Many<PermissionInput<PermissionName<T, G>>>[]): Promise<boolean> {
    for (const permission of flatten(permissions)) {
      if (!(await this.can(permission))) return false
    }
    return true
  }

  /** `true` if the subject has ANY of the permissions. Pure data check (no `before` / super-admin), never throws. */
  async hasAnyPermission(...permissions: Many<PermissionInput<PermissionName<T, G>>>[]): Promise<boolean> {
    for (const permission of flatten(permissions)) {
      if (await this.check(permission)) return true
    }
    return false
  }

  /** `true` if the subject has ALL the permissions. Pure data check (no `before` / super-admin), never throws. */
  async hasAllPermissions(...permissions: Many<PermissionInput<PermissionName<T, G>>>[]): Promise<boolean> {
    for (const permission of flatten(permissions)) {
      if (!(await this.check(permission))) return false
    }
    return true
  }

  /**
   * Serializable `{ roles, permissions }` — e.g. to hydrate a React/Vue client. With `checkBefore`, the `before`
   * hook runs for those names and the ones it denies are listed in `denied`, so the UI hides them too.
   */
  async snapshot(options: SnapshotOptions<T, G> = {}): Promise<RbacSnapshot> {
    const snapshot: RbacSnapshot = { roles: await this.getRoleNames(), permissions: await this.getPermissionNames() }
    if (options.checkBefore === undefined) return snapshot
    const denied: string[] = []
    for (const name of new Set(options.checkBefore.map((n) => n.trim()))) {
      if (name !== '' && (await this.#core.gate(this, name)) === false) denied.push(name)
    }
    return { ...snapshot, denied }
  }

  // ------------------------------------------------------------------- internal

  /** {@link hasPermissionTo} that returns `false` instead of throwing. */
  private async check(permission: PermissionInput<PermissionName<T, G>>): Promise<boolean> {
    try {
      return await this.hasPermissionTo(permission)
    } catch (error) {
      if (error instanceof RbacError) return false
      throw error
    }
  }

  /** {@link hasDirectPermission} that returns `false` instead of throwing. */
  private async checkDirect(permission: PermissionInput<PermissionName<T, G>>): Promise<boolean> {
    try {
      return await this.hasDirectPermission(permission)
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
    return this.#core.remember(
      key,
      async () => {
        const { adapter } = this.rbac

        // Expired links are dropped here, against the engine's clock (with expiry off: every link).
        const roleLinks = await this.#core.subjectLinks('roles', this.subject, this.teamId)
        const roleIds = [...roleLinks.values()].map((l) => l.id)
        const roles = roleIds.length > 0 ? await adapter.findRoles({ ids: roleIds, guardName: this.guardName }) : []

        const directLinks = await this.#core.subjectLinks('permissions', this.subject, this.teamId)
        const directIds = [...directLinks.values()].map((l) => l.id)
        const direct =
          directIds.length > 0 ? await adapter.findPermissions({ ids: directIds, guardName: this.guardName }) : []

        const links = roles.length > 0 ? await adapter.getRolePermissionLinks(roles.map((r) => r.id)) : []
        const viaRoles =
          links.length > 0
            ? await adapter.findPermissions({ ids: links.map((l) => l.permissionId), guardName: this.guardName })
            : []

        const state: SubjectState = { roles, direct, viaRoles }
        const expiring = (items: readonly { id: Id }[], active: ActiveLinks): Record<string, number> => {
          const out: Record<string, number> = {}
          for (const item of items) {
            const ms = active.get(idKey(item.id))?.expiresAt
            if (ms !== undefined && ms !== null) out[idKey(item.id)] = ms
          }
          return out
        }
        const expires = { roles: expiring(roles, roleLinks), direct: expiring(direct, directLinks) }
        const validUntil = earliest([...Object.values(expires.roles), ...Object.values(expires.direct)])
        if (validUntil !== undefined) {
          state.expires = expires
          state.validUntil = validUntil
        }
        return state
      },
      (state) => state.validUntil,
    )
  }

  /** Attaches links, passing the expiry to adapters that store it (with expiry off it is always `null`). */
  private async attach(kind: 'roles' | 'permissions', items: readonly { id: Id }[], expiresAt: Date | null): Promise<void> {
    const { adapter } = this.rbac
    const ids = items.map((item) => item.id)
    const options = this.#core.expiry ? ([{ expiresAt }] as const) : ([] as const)
    if (kind === 'roles') await adapter.attachSubjectRoles(this.subject, ids, this.teamId, ...options)
    else await adapter.attachSubjectPermissions(this.subject, ids, this.teamId, ...options)
  }

  /** `expiresAt` for event payloads: only with expiry on, and only on `*.attached`. */
  private expiryField(expiresAt: Date | null | undefined): { expiresAt?: Date | null } {
    return expiresAt === undefined || !this.#core.expiry ? {} : { expiresAt }
  }

  private async emitRoles(
    event: 'role.attached' | 'role.detached',
    roles: Role[],
    expiresAt?: Date | null,
  ): Promise<void> {
    if (roles.length === 0) return
    await this.#core.events.emit({
      event,
      subject: this.subject,
      roles,
      guardName: this.guardName,
      teamId: this.teamId,
      ...this.expiryField(expiresAt),
    }, this.#actor)
  }

  private async emitPermissions(
    event: 'permission.attached' | 'permission.detached',
    permissions: Permission[],
    expiresAt?: Date | null,
  ): Promise<void> {
    if (permissions.length === 0) return
    await this.#core.events.emit({
      event,
      target: 'subject',
      subject: this.subject,
      permissions,
      guardName: this.guardName,
      teamId: this.teamId,
      ...this.expiryField(expiresAt),
    }, this.#actor)
  }

  private static toDate(ms: number | null | undefined): Date | null {
    return ms === undefined || ms === null ? null : new Date(ms)
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
