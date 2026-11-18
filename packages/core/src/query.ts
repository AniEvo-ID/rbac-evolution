import { GuardDoesNotMatch, RbacError } from './errors'
import type { ScopeOptions } from './rbac'
import type { Id, Permission, PermissionInput } from './types'
import { wildcardImplies } from './wildcard'

/** Options of {@link Rbac.subjectsWithPermission}. */
export interface SubjectsWithPermissionOptions<G extends string = string> extends ScopeOptions<G> {
  /**
   * With `wildcard: true`, also return subjects whose granted permission is a wildcard that implies one of the
   * given names (`articles.*` or `*` for `articles.edit`), directly or through a role. The names then don't need
   * to exist as permissions, as with `hasPermissionTo()`. Has no effect when `wildcard` is off.
   * Default: `false` (only exact permission rows match, and unknown names throw `PermissionDoesNotExist`).
   */
  expandWildcards?: boolean | undefined
}

/** Options of {@link Rbac.subjectsWithoutRole}. */
export interface SubjectsWithoutRoleOptions<G extends string = string> extends ScopeOptions<G> {
  /**
   * The candidate ids (a page of your users, the members of a team...). The engine only knows subjects that have
   * assignments, so it filters these instead of listing every subject. Ids are compared as strings, so `1` and
   * `'1'` are the same subject. The result keeps their order.
   */
  among: readonly Id[]
}

/** Options of {@link Rbac.subjectsWithoutPermission}. */
export interface SubjectsWithoutPermissionOptions<G extends string = string> extends SubjectsWithPermissionOptions<G> {
  /** The candidate ids, as in {@link SubjectsWithoutRoleOptions.among}. */
  among: readonly Id[]
}

/** @internal The ids of `among` that are not in `holders` (compared as strings), in the order of `among`. */
export function idsWithout(among: readonly Id[], holders: readonly Id[]): Id[] {
  const held = new Set(holders.map(String))
  return among.filter((id) => !held.has(String(id)))
}

/**
 * @internal The stored permissions of a guard that imply ANY of the wanted ones, by the wildcard rules
 * (an exact match included). Permission objects must belong to the guard.
 */
export function expandWildcardPermissions(
  stored: readonly Permission[],
  wanted: readonly PermissionInput[],
  guardName: string,
): Permission[] {
  const names = wanted.map((input) => {
    if (typeof input !== 'string') {
      if (input.guardName !== guardName) throw new GuardDoesNotMatch(input.guardName, guardName)
      return input.name
    }
    const name = input.trim()
    if (name === '') throw new RbacError('INVALID_NAME', 'Role and permission names must not be empty.')
    return name
  })
  return stored.filter((permission) =>
    names.some((name) => {
      try {
        return wildcardImplies(permission.name, name)
      } catch {
        return false
      }
    }),
  )
}
