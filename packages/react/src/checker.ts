import { wildcardImplies } from '@anievo-id/rbac-evolution'
import type { Many, RbacSnapshot } from '@anievo-id/rbac-evolution'

export interface RbacCheckerOptions {
  /** Treat granted permissions as wildcard patterns (`articles.*`). Must match the server's `wildcard` setting. */
  wildcard?: boolean
  /** Roles that pass every permission check (like spatie's `Gate::before` super-admin pattern). */
  superAdminRoles?: readonly string[]
}

/** Synchronous checks against a {@link RbacSnapshot}. */
export interface RbacChecker {
  readonly roles: readonly string[]
  readonly permissions: readonly string[]
  /** `true` if the subject has one of the configured `superAdminRoles`. */
  readonly isSuperAdmin: boolean
  can(permission: string): boolean
  cannot(permission: string): boolean
  /** `true` if ANY of the permissions is granted. `false` for an empty list. */
  canAny(...permissions: Many<string>[]): boolean
  /** `true` if ALL of the permissions are granted. `true` for an empty list. */
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
 * Used by `RbacProvider`, but usable on its own too.
 */
export function createRbacChecker(
  snapshot: RbacSnapshot | null | undefined,
  options: RbacCheckerOptions = {},
): RbacChecker {
  const { roles, permissions } = snapshot ?? EMPTY
  const roleSet = new Set(roles)
  const permissionSet = new Set(permissions)
  const wildcard = options.wildcard ?? false
  const isSuperAdmin = (options.superAdminRoles ?? []).some((r) => roleSet.has(r))

  const can = (permission: string): boolean => {
    if (isSuperAdmin) return true
    const name = permission.trim()
    if (name === '') return false
    if (permissionSet.has(name)) return true
    return wildcard && permissions.some((granted) => safeImplies(granted, name))
  }
  const hasOne = (role: string): boolean => roleSet.has(role.trim())

  return {
    roles,
    permissions,
    isSuperAdmin,
    can,
    cannot: (permission) => !can(permission),
    canAny: (...list) => flatten(list).some(can),
    canAll: (...list) => flatten(list).every(can),
    hasRole: (list) => flatten([list]).some(hasOne),
    hasAnyRole: (...list) => flatten(list).some(hasOne),
    hasAllRoles: (...list) => flatten(list).every(hasOne),
  }
}
