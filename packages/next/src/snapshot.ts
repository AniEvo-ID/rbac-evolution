import { wildcardImplies } from '@anievo-id/rbac-evolution'
import type { Many, RbacSnapshot } from '@anievo-id/rbac-evolution'
import { type Requirement, requirementGroups } from './types'

export interface SnapshotCheckOptions {
  /** Treat granted permissions as wildcard patterns. */
  wildcard?: boolean
  /** Roles that pass every permission check. */
  superAdminRoles?: readonly string[]
}


function safeImplies(granted: string, required: string): boolean {
  try {
    return wildcardImplies(granted, required)
  } catch {
    return false
  }
}

/** Synchronously checks a requirement against a snapshot. Arrays mean "any of". */
export function snapshotSatisfies(
  snapshot: RbacSnapshot,
  requirement: Requirement,
  options: SnapshotCheckOptions = {},
): boolean {
  const roles = new Set(snapshot.roles)
  const isSuperAdmin = (options.superAdminRoles ?? []).some((r) => roles.has(r))
  const hasRole = (role: string): boolean => roles.has(role.trim())
  const can = (permission: string): boolean => {
    if (isSuperAdmin) return true
    const name = permission.trim()
    if (name === '') return false
    if (snapshot.permissions.includes(name)) return true
    return (options.wildcard ?? false) && snapshot.permissions.some((g) => safeImplies(g, name))
  }

  const all = (groups: string[][], fn: (n: string) => boolean) =>
    groups.length > 0 && groups.every((group) => group.some(fn))
  if (requirement.permission !== undefined) return all(requirementGroups(requirement.permission, requirement.all), can)
  if (requirement.role !== undefined) return all(requirementGroups(requirement.role, requirement.all), hasRole)
  const [items = []] = requirementGroups(requirement.roleOrPermission, false)
  return items.some(hasRole) || items.some(can)
}
