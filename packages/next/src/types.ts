import type { Many } from '@anievo-id/rbac-evolution'

export type MaybePromise<T> = T | Promise<T>

/**
 * What a guard requires — mirrors spatie's `permission`, `role` and `role_or_permission` middleware.
 * Arrays and `'a|b'` strings mean "any of" (like `permission:a|b` / spatie's `canAny()`).
 * With `all: true`, every listed permission or role is required (spatie v8.5 `canAll()`); a `'a|b'`
 * entry still means "a or b" within that entry.
 */
export type Requirement =
  | { permission: Many<string>; role?: never; roleOrPermission?: never; all?: boolean }
  | { permission?: never; role: Many<string>; roleOrPermission?: never; all?: boolean }
  | { permission?: never; role?: never; roleOrPermission: Many<string>; all?: never }

/** One requirement as groups: every group must pass, any name inside a group passes it. */
export function requirementGroups(names: Many<string>, all: boolean | undefined): string[][] {
  const entries = (typeof names === 'string' ? [names] : [...names]).map((entry) =>
    entry
      .split('|')
      .map((n) => n.trim())
      .filter((n) => n !== ''),
  )
  // shortcut: an entry that is only pipes/spaces yields an empty group, which nobody satisfies.
  return all ? entries : [entries.flat()]
}

/** Evaluates a requirement with any/all checkers for single names. Empty requirements deny. */
export async function checkRequirement(
  requirement: Requirement,
  can: (name: string) => boolean | Promise<boolean>,
  hasRole: (name: string) => boolean | Promise<boolean>,
): Promise<boolean> {
  const some = async (group: string[], fn: (n: string) => boolean | Promise<boolean>) => {
    for (const n of group) if (await fn(n)) return true
    return false
  }
  const every = async (groups: string[][], fn: (group: string[]) => Promise<boolean>) => {
    if (groups.length === 0) return false
    for (const g of groups) if (!(await fn(g))) return false
    return true
  }
  if (requirement.permission !== undefined) {
    return every(requirementGroups(requirement.permission, requirement.all), (g) => some(g, can))
  }
  if (requirement.role !== undefined) {
    return every(requirementGroups(requirement.role, requirement.all), (g) => some(g, hasRole))
  }
  const [group = []] = requirementGroups(requirement.roleOrPermission, false)
  return (await some(group, hasRole)) || (await some(group, can))
}

export type FailureReason = 'unauthenticated' | 'unauthorized'
