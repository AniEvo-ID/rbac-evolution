import { RbacError } from './errors'
import type { Rbac, RbacInternals } from './rbac'
import type {
  DefaultRbacTypes,
  Id,
  Permission,
  PermissionName,
  RbacTypeConfig,
  Role,
  RoleName,
  TeamId,
} from './types'
import { parseWildcardPermission } from './wildcard'

/** The permissions of a role in a {@link SyncDefinition}: an explicit list, or `'*'` for every permission of the guard. */
export type SyncRolePermissions<T extends RbacTypeConfig = DefaultRbacTypes> = readonly PermissionName<T>[] | '*'

/**
 * Declarative description of the roles & permissions of ONE guard (and optionally one team).
 *
 * ```ts
 * await rbac.sync({
 *   permissions: ['edit articles', 'delete articles'],
 *   roles: { admin: '*', writer: ['edit articles'] },
 * })
 * ```
 *
 * Pass an array of definitions to sync several guards / teams at once.
 */
export interface SyncDefinition<T extends RbacTypeConfig = DefaultRbacTypes> {
  /** Guard of this block. Default: the `guard` option, then `defaultGuard`. */
  guard?: string
  /** Team of the roles in this block (requires `teams: true`). Default: the `team` option, then global (`null`). */
  team?: TeamId
  /** Permissions of the guard. Permissions referenced by a role are created too, even if not listed here. */
  permissions?: readonly PermissionName<T>[]
  /** Roles and their permissions. Each role's permissions are synced (replaced) to exactly this list. */
  roles?: { readonly [R in RoleName<T>]?: SyncRolePermissions<T> }
}

export interface SyncOptions {
  /** Default guard for definitions without a `guard`. Default: `defaultGuard`. */
  guard?: string
  /** Default team for definitions without a `team`. */
  team?: TeamId
  /**
   * Delete roles & permissions that are not in the definition. Roles are pruned per guard + team
   * scope present in the definition; permissions (which are guard-wide) only for guards that have a
   * global (team-less) definition. Other guards and teams are never touched. Default: `false`.
   */
  prune?: boolean
  /** Compute and return the plan without writing anything. Default: `false`. */
  dryRun?: boolean
}

export interface SyncPermissionChange {
  name: string
  guard: string
}

export interface SyncRoleChange {
  name: string
  guard: string
  team: TeamId
  /** Permissions of the role: given to a created role / held by a deleted role. */
  permissions: string[]
}

export interface SyncRoleUpdate {
  name: string
  guard: string
  team: TeamId
  /** Permissions newly given to the role. */
  attached: string[]
  /** Permissions taken away from the role. */
  detached: string[]
}

/** What {@link Rbac.sync} did — or, with `dryRun`, would do. */
export interface SyncResult {
  dryRun: boolean
  created: { permissions: SyncPermissionChange[]; roles: SyncRoleChange[] }
  /** Existing roles whose permissions changed. */
  updated: { roles: SyncRoleUpdate[] }
  deleted: { permissions: SyncPermissionChange[]; roles: SyncRoleChange[] }
}

interface Block {
  guard: string
  team: TeamId
  permissions: string[]
  roles: Map<string, string[] | '*'>
}

interface RolePlan {
  name: string
  guard: string
  team: TeamId
  existing: Role | null
  desired: string[]
  current: string[]
}

const idKey = (id: Id | null): string => (id === null ? '\u0000null' : String(id))

function invalid(message: string): RbacError {
  return new RbacError('INVALID_SYNC_DEFINITION', message)
}

function cleanName(value: unknown, where: string): string {
  if (typeof value !== 'string') throw invalid(`${where} must be a string, got ${typeof value}.`)
  const name = value.trim()
  if (name === '') throw new RbacError('INVALID_NAME', 'Role and permission names must not be empty.')
  return name
}

function pushUnique(list: string[], name: string): void {
  if (!list.includes(name)) list.push(name)
}

/** Validates (definitions may come from JSON) and normalizes the definition into blocks. */
function normalize<T extends RbacTypeConfig>(
  core: RbacInternals<T>,
  definition: SyncDefinition<T> | readonly SyncDefinition<T>[],
  options: SyncOptions,
): Block[] {
  const list: readonly unknown[] = Array.isArray(definition) ? definition : [definition]
  const blocks: Block[] = []

  list.forEach((raw, index) => {
    const at = list.length > 1 ? `definition[${index}]` : 'definition'
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw invalid(`${at} must be an object.`)
    const def = raw as Record<string, unknown>

    const guardInput = def['guard'] ?? options.guard
    if (guardInput !== undefined && typeof guardInput !== 'string') throw invalid(`${at}.guard must be a string.`)
    const guard = core.resolveGuard(guardInput === undefined ? undefined : cleanName(guardInput, `${at}.guard`))
    const teamInput = def['team'] !== undefined ? def['team'] : options.team
    if (teamInput !== undefined && teamInput !== null && typeof teamInput !== 'string' && typeof teamInput !== 'number') {
      throw invalid(`${at}.team must be a string, a number or null.`)
    }
    const team = core.resolveTeam(teamInput)

    let block = blocks.find((b) => b.guard === guard && idKey(b.team) === idKey(team))
    if (!block) {
      block = { guard, team, permissions: [], roles: new Map() }
      blocks.push(block)
    }

    const permissions = def['permissions']
    if (permissions !== undefined) {
      if (!Array.isArray(permissions)) throw invalid(`${at}.permissions must be an array of names.`)
      for (const p of permissions as unknown[]) pushUnique(block.permissions, cleanName(p, `${at}.permissions[]`))
    }

    const roles = def['roles']
    if (roles !== undefined) {
      if (typeof roles !== 'object' || roles === null || Array.isArray(roles)) {
        throw invalid(`${at}.roles must be an object mapping role names to permissions.`)
      }
      for (const [rawName, value] of Object.entries(roles)) {
        if (value === undefined) continue
        const name = cleanName(rawName, `${at}.roles key`)
        if (block.roles.has(name)) {
          throw invalid(`Role \`${name}\` is defined twice for guard \`${guard}\`${team === null ? '' : ` (team ${String(team)})`}.`)
        }
        if (value === '*') {
          block.roles.set(name, '*')
        } else if (Array.isArray(value)) {
          const names: string[] = []
          for (const p of value as unknown[]) pushUnique(names, cleanName(p, `${at}.roles.${name}[]`))
          block.roles.set(name, names)
        } else {
          throw invalid(`${at}.roles.${name} must be an array of permission names or '*'.`)
        }
      }
    }
  })

  return blocks
}

/** @internal Implementation of {@link Rbac.sync}. */
export async function syncDefinition<T extends RbacTypeConfig>(
  rbac: Rbac<T>,
  core: RbacInternals<T>,
  definition: SyncDefinition<T> | readonly SyncDefinition<T>[],
  options: SyncOptions = {},
): Promise<SyncResult> {
  const blocks = normalize(core, definition, options)
  const prune = options.prune ?? false
  const dryRun = options.dryRun ?? false
  const result: SyncResult = {
    dryRun,
    created: { permissions: [], roles: [] },
    updated: { roles: [] },
    deleted: { permissions: [], roles: [] },
  }

  // ------------------------------------------------------------- permissions, per guard
  const guards = [...new Set(blocks.map((b) => b.guard))]
  const existingPermissions = new Map<string, Permission[]>()
  /** Names of every permission of the guard once the sync is done (what `'*'` expands to). */
  const finalPermissions = new Map<string, string[]>()
  const permissionsToDelete: Permission[] = []

  for (const guard of guards) {
    const declared: string[] = []
    for (const block of blocks.filter((b) => b.guard === guard)) {
      for (const p of block.permissions) pushUnique(declared, p)
      for (const list of block.roles.values()) if (list !== '*') for (const p of list) pushUnique(declared, p)
    }
    if (rbac.wildcard) for (const p of declared) parseWildcardPermission(p)

    const existing = await rbac.adapter.findPermissions({ guardName: guard })
    existingPermissions.set(guard, existing)
    const existingNames = existing.map((p) => p.name)

    for (const name of declared) {
      if (!existingNames.includes(name)) result.created.permissions.push({ name, guard })
    }
    // Permissions are guard-wide: only a global (team-less) definition is authoritative for them.
    const ownsPermissions = blocks.some((b) => b.guard === guard && b.team === null)
    const stale = prune && ownsPermissions ? existing.filter((p) => !declared.includes(p.name)) : []
    permissionsToDelete.push(...stale)
    for (const p of stale) result.deleted.permissions.push({ name: p.name, guard })

    finalPermissions.set(guard, [
      ...existingNames.filter((n) => !stale.some((p) => p.name === n)),
      ...declared.filter((n) => !existingNames.includes(n)),
    ])
  }

  // ------------------------------------------------------------- roles, per guard + team
  const plans: RolePlan[] = []
  const rolesToDelete: Role[] = []

  for (const block of blocks) {
    const { guard, team } = block
    const existing = await rbac.adapter.findRoles({ guardName: guard, teamIds: [team] })
    const links = existing.length > 0 ? await rbac.adapter.getRolePermissionLinks(existing.map((r) => r.id)) : []
    const permissionNames = new Map((existingPermissions.get(guard) ?? []).map((p) => [idKey(p.id), p.name]))
    const namesOf = (role: Role): string[] => {
      const names: string[] = []
      for (const link of links) {
        if (idKey(link.roleId) !== idKey(role.id)) continue
        const name = permissionNames.get(idKey(link.permissionId))
        if (name !== undefined) pushUnique(names, name)
      }
      return names
    }

    for (const [name, wanted] of block.roles) {
      const role = existing.find((r) => r.name === name) ?? null
      const desired = wanted === '*' ? [...(finalPermissions.get(guard) ?? [])] : wanted
      const plan: RolePlan = { name, guard, team, existing: role, desired, current: role ? namesOf(role) : [] }
      plans.push(plan)

      if (!role) {
        result.created.roles.push({ name, guard, team, permissions: [...desired] })
        continue
      }
      const attached = desired.filter((p) => !plan.current.includes(p))
      const detached = plan.current.filter((p) => !desired.includes(p))
      if (attached.length > 0 || detached.length > 0) {
        result.updated.roles.push({ name, guard, team, attached, detached })
      }
    }

    if (prune) {
      for (const role of existing) {
        if (block.roles.has(role.name)) continue
        rolesToDelete.push(role)
        result.deleted.roles.push({ name: role.name, guard, team, permissions: namesOf(role) })
      }
    }
  }

  if (dryRun) return result

  // ---------------------------------------------------------------------------- apply
  // Engine methods are used for every write, so the usual events fire and the cache is cleared.
  for (const { name, guard } of result.created.permissions) {
    await rbac.createPermission(name as PermissionName<T>, { guard })
  }
  for (const plan of plans) {
    const changed =
      plan.existing === null ||
      plan.desired.length !== plan.current.length ||
      plan.desired.some((p) => !plan.current.includes(p))
    if (!changed) continue
    const role = plan.existing ?? (await rbac.createRole(plan.name as RoleName<T>, { guard: plan.guard, team: plan.team }))
    if (plan.existing === null && plan.desired.length === 0) continue
    await rbac.role(role).syncPermissions(plan.desired as PermissionName<T>[])
  }
  for (const role of rolesToDelete) await rbac.deleteRole(role)
  for (const permission of permissionsToDelete) await rbac.deletePermission(permission)

  return result
}
