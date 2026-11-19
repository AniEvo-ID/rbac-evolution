import { wildcardImplies } from '@anievo-id/rbac-evolution'
import type { Many, RbacSnapshot } from '@anievo-id/rbac-evolution'

export interface RbacCheckerOptions {
  /** Treat granted permissions as wildcard patterns (`articles.*`). Must match the server's `wildcard` setting. */
  wildcard?: boolean | undefined
  /** Roles that pass every permission check (like spatie's `Gate::before` super-admin pattern). */
  superAdminRoles?: readonly string[] | undefined
  /** The snapshot is still being fetched: `<Can>`, `<Cannot>` and `<HasRole>` render nothing. Default: `false`. */
  loading?: boolean | undefined
}

/** Synchronous checks against a {@link RbacSnapshot}. */
export interface RbacChecker {
  readonly roles: readonly string[]
  readonly permissions: readonly string[]
  /** `true` if the subject has one of the configured `superAdminRoles`. */
  readonly isSuperAdmin: boolean
  /** `true` while the snapshot is still being fetched (the `loading` option). Every check, `cannot` included, returns `false` meanwhile. */
  readonly loading: boolean
  can(permission: string): boolean
  cannot(permission: string): boolean
  /** `true` if ANY of the permissions is granted. `false` for an empty list. */
  canAny(...permissions: Many<string>[]): boolean
  /** `true` if ALL of the permissions are granted. `false` for an empty list (deny by default, like the Vue package). */
  canAll(...permissions: Many<string>[]): boolean
  /** `true` if the subject has the role — or ANY of the roles when given an array. */
  hasRole(roles: Many<string>): boolean
  hasAnyRole(...roles: Many<string>[]): boolean
  hasAllRoles(...roles: Many<string>[]): boolean
}

const EMPTY: RbacSnapshot = { roles: [], permissions: [] }

function flatten(items: readonly Many<string>[]): string[] {
  const out: string[] = []
  for (const item of items) {
    if (typeof item === 'string') out.push(item)
    else out.push(...item)
  }
  return out
}

function safeImplies(granted: string, required: string): boolean {
  try {
    return wildcardImplies(granted, required)
  } catch {
    return false
  }
}

/**
 * Builds a pure, synchronous checker for a snapshot (as returned by `rbac.for(user).snapshot()`).
 * Used by `RbacProvider`, but usable on its own too (no Solid needed).
 */
export function createRbacChecker(
  snapshot: RbacSnapshot | null | undefined,
  options: RbacCheckerOptions = {},
): RbacChecker {
  const { roles, permissions } = snapshot ?? EMPTY
  const roleSet = new Set(roles)
  const permissionSet = new Set(permissions)
  // Names the server's `before` hook denies (`snapshot({ checkBefore })`). Absent in older snapshots: nothing denied.
  const deniedSet = new Set((snapshot?.denied ?? []).map((name) => name.trim()))
  const wildcard = options.wildcard ?? false
  // While loading, every check (`cannot` too) is false: neither a stale grant nor "no access" UI shows.
  const loading = options.loading ?? false
  const isSuperAdmin = !loading && (options.superAdminRoles ?? []).some((r) => roleSet.has(r))

  const can = (permission: string): boolean => {
    if (loading) return false
    // Like the server: `before` runs first, so its denial wins over super-admin and stored grants.
    if (deniedSet.has(permission.trim())) return false
    if (isSuperAdmin) return true
    const name = permission.trim()
    if (name === '') return false
    if (permissionSet.has(name)) return true
    return wildcard && permissions.some((granted) => safeImplies(granted, name))
  }
  const hasOne = (role: string): boolean => !loading && roleSet.has(role.trim())

  return {
    roles,
    permissions,
    isSuperAdmin,
    loading,
    can,
    cannot: (permission) => !loading && !can(permission),
    canAny: (...list) => flatten(list).some(can),
    canAll: (...list) => {
      const wanted = flatten(list)
      return wanted.length > 0 && wanted.every(can)
    },
    hasRole: (list) => flatten([list]).some(hasOne),
    hasAnyRole: (...list) => flatten(list).some(hasOne),
    hasAllRoles: (...list) => {
      const wanted = flatten(list)
      return wanted.length > 0 && wanted.every(hasOne)
    },
  }
}
