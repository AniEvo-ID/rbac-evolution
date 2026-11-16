import type { Rbac } from './rbac'
import type { DefaultRbacTypes, PermissionName, RbacTypeConfig, RoleName } from './types'

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
 */
export interface RbacNames<T extends RbacTypeConfig = DefaultRbacTypes> {
  /** Every role name the app knows. Enables {@link isRoleName}. */
  roles?: readonly RoleName<T>[] | undefined
  /** Every permission name the app knows. Enables {@link isPermissionName}. */
  permissions?: readonly PermissionName<T>[] | undefined
}

interface NameSets {
  roles: ReadonlySet<string> | undefined
  permissions: ReadonlySet<string> | undefined
}

const namesOf = new WeakMap<object, NameSets>()

function toSet(list: readonly unknown[] | undefined, key: keyof NameSets): ReadonlySet<string> | undefined {
  if (list === undefined) return undefined
  if (!Array.isArray(list) || list.some((name) => typeof name !== 'string')) {
    throw new TypeError(`\`names.${key}\` must be an array of strings.`)
  }
  return new Set(list as readonly string[])
}

/** Called by the `Rbac` constructor. Not exported from the package. */
export function registerNames(rbac: object, names: RbacNames<RbacTypeConfig> | undefined): void {
  namesOf.set(rbac, {
    roles: toSet(names?.roles, 'roles'),
    permissions: toSet(names?.permissions, 'permissions'),
  })
}

function check(rbac: object, key: keyof NameSets, fn: string, value: unknown): boolean {
  const set = namesOf.get(rbac)?.[key]
  if (set === undefined) {
    throw new TypeError(`${fn}() needs the list of names: pass \`names: { ${key}: [...] }\` to createRbac().`)
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
 * ```ts
 * if (!isRoleName(rbac, req.body.role)) return res.status(422).json({ error: 'Unknown role' })
 * await rbac.for(user).assignRole(req.body.role) // typed
 * ```
 */
export function isRoleName<T extends RbacTypeConfig>(rbac: Rbac<T>, value: unknown): value is RoleName<T> {
  return check(rbac, 'roles', 'isRoleName', value)
}

/**
 * `true` if `value` is one of the permission names listed in `createRbac({ names: { permissions } })`, and narrows
 * it to the engine's `PermissionName<T>`. Same rules as {@link isRoleName}: exact names from the list, no database
 * query, a `TypeError` if the engine has no `names.permissions`.
 */
export function isPermissionName<T extends RbacTypeConfig>(rbac: Rbac<T>, value: unknown): value is PermissionName<T> {
  return check(rbac, 'permissions', 'isPermissionName', value)
}
