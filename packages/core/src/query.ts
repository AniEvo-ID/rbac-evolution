import { GuardDoesNotMatch, RbacError } from './errors'
import type { ScopeOptions } from './rbac'
import type { Permission, PermissionInput } from './types'
import { wildcardImplies } from './wildcard'

/** Options of {@link Rbac.subjectsWithPermission}. */
export interface SubjectsWithPermissionOptions extends ScopeOptions {
  /**
   * With `wildcard: true`, also return subjects whose granted permission is a wildcard that implies one of the
   * given names (`articles.*` or `*` for `articles.edit`), directly or through a role. The names then don't need
   * to exist as permissions, as with `hasPermissionTo()`. Has no effect when `wildcard` is off.
   * Default: `false` (only exact permission rows match, and unknown names throw `PermissionDoesNotExist`).
   */
  expandWildcards?: boolean | undefined
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
