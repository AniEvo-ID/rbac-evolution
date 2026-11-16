import type { GuardOptions, Rbac } from './rbac'
import type {
  CheckGuard,
  DefaultGuardName,
  DefaultRbacTypes,
  GuardName,
  PermissionName,
  RbacTypeConfig,
  RoleName,
} from './types'

/** The lists of one guard in {@link RbacNames}`['guards']`. */
export interface RbacGuardNames<T extends RbacTypeConfig = DefaultRbacTypes, G extends string = DefaultGuardName<T>> {
  /** Every role name of the guard. */
  roles?: readonly RoleName<T, G>[] | undefined
  /** Every permission name of the guard. */
  permissions?: readonly PermissionName<T, G>[] | undefined
}

/**
 * The typed names as values, for the {@link isRoleName} / {@link isPermissionName} type guards
 * (`createRbac({ names })`). Types only exist at compile time, so the engine needs the lists to check user input.
 *
 * Each entry must be one of the typed names. Derive the type from the lists to keep them complete:
 *
 * ```ts
 * const roles = ['writer', 'editor', 'admin'] as const
 * type AppRbac = { roles: (typeof roles)[number] }
 * const rbac = createRbac<AppRbac>({ adapter, names: { roles } })
 * ```
 *
 * With per-guard names, give each guard its lists in `guards`: `names: { guards: { web: { roles }, api: { ... } } }`.
 */
export interface RbacNames<T extends RbacTypeConfig = DefaultRbacTypes> {
  /** Every role name the app knows. Enables {@link isRoleName}. Used for guards without their own list. */
  roles?: readonly RoleName<T, string>[] | undefined
  /** Every permission name the app knows. Enables {@link isPermissionName}. Used for guards without their own list. */
  permissions?: readonly PermissionName<T, string>[] | undefined
  /**
   * Lists per guard, checked by `isRoleName(rbac, value, { guard })` (the default guard's list without `guard`).
   * A guard without a list here uses `roles` / `permissions`.
   */
  guards?: { readonly [G in GuardName<T>]?: RbacGuardNames<T, G> | undefined } | undefined
}

interface NameSets {
  roles: ReadonlySet<string> | undefined
  permissions: ReadonlySet<string> | undefined
}

interface EngineNames extends NameSets {
  guards: ReadonlyMap<string, NameSets>
}

const namesOf = new WeakMap<object, EngineNames>()

function toSet(list: readonly unknown[] | undefined, path: string): ReadonlySet<string> | undefined {
  if (list === undefined) return undefined
  if (!Array.isArray(list) || list.some((name) => typeof name !== 'string')) {
    throw new TypeError(`\`${path}\` must be an array of strings.`)
  }
  return new Set(list as readonly string[])
}

/** Called by the `Rbac` constructor. Not exported from the package. */
export function registerNames(rbac: object, names: RbacNames<RbacTypeConfig> | undefined): void {
  const guards = new Map<string, NameSets>()
  const byGuard: unknown = names?.guards
  if (byGuard !== undefined) {
    if (typeof byGuard !== 'object' || byGuard === null || Array.isArray(byGuard)) {
      throw new TypeError('`names.guards` must be an object with `{ roles, permissions }` per guard.')
    }
    for (const [guard, lists] of Object.entries(byGuard as Record<string, RbacGuardNames<RbacTypeConfig, string>>)) {
      if (lists === undefined) continue
      guards.set(guard, {
        roles: toSet(lists.roles, `names.guards.${guard}.roles`),
        permissions: toSet(lists.permissions, `names.guards.${guard}.permissions`),
      })
    }
  }
  namesOf.set(rbac, {
    roles: toSet(names?.roles, 'names.roles'),
    permissions: toSet(names?.permissions, 'names.permissions'),
    guards,
  })
}

function check(rbac: Rbac<RbacTypeConfig>, key: keyof NameSets, fn: string, value: unknown, guard: string | undefined): boolean {
  const names = namesOf.get(rbac)
  const guardName = guard ?? rbac.defaultGuard
  const set = names?.guards.get(guardName)?.[key] ?? names?.[key]
  if (set === undefined) {
    const perGuard = names !== undefined && names.guards.size > 0
    throw new TypeError(
      perGuard
        ? `${fn}() needs the list of names of guard \`${guardName}\`: pass \`names: { guards: { ${guardName}: { ${key}: [...] } } }\` to createRbac().`
        : `${fn}() needs the list of names: pass \`names: { ${key}: [...] }\` to createRbac().`,
    )
  }
  return typeof value === 'string' && set.has(value)
}

/**
 * `true` if `value` is one of the role names listed in `createRbac({ names: { roles } })`, and narrows it to the
 * engine's `RoleName<T>`. Use it on user input before `assignRole()` / `syncRoles()`, so an unknown role is a
 * 422 instead of a `RoleDoesNotExist` (500).
 *
 * It checks the list, not the database: exact names only (no wildcards, no pipes), and no query. A listed role
 * that was never created still passes. Throws a `TypeError` if the engine has no `names.roles`.
 *
 * With per-guard lists (`names.guards`), `{ guard }` checks the list of that guard and narrows to its names;
 * without it, the default guard's list is used. A guard without its own list uses `names.roles`.
 *
 * ```ts
 * if (!isRoleName(rbac, req.body.role)) return res.status(422).json({ error: 'Unknown role' })
 * await rbac.for(user).assignRole(req.body.role) // typed
 * ```
 */
export function isRoleName<T extends RbacTypeConfig, G extends string = DefaultGuardName<T>>(
  rbac: Rbac<T>,
  value: unknown,
  options?: GuardOptions<CheckGuard<T, G>>,
): value is RoleName<T, G> {
  return check(rbac as unknown as Rbac<RbacTypeConfig>, 'roles', 'isRoleName', value, options?.guard)
}

/**
 * `true` if `value` is one of the permission names listed in `createRbac({ names: { permissions } })`, and narrows
 * it to the engine's `PermissionName<T>`. Same rules as {@link isRoleName}: exact names from the list, no database
 * query, a `TypeError` if the engine has no `names.permissions`, and `{ guard }` for per-guard lists.
 */
export function isPermissionName<T extends RbacTypeConfig, G extends string = DefaultGuardName<T>>(
  rbac: Rbac<T>,
  value: unknown,
  options?: GuardOptions<CheckGuard<T, G>>,
): value is PermissionName<T, G> {
  return check(rbac as unknown as Rbac<RbacTypeConfig>, 'permissions', 'isPermissionName', value, options?.guard)
}
