/** Which kind of requirement failed — same values as the Express package. */
export type RequirementKind = 'permission' | 'role' | 'role_or_permission'

/** A name, a pipe-separated list (`'edit|delete'` = any of), or an array of names. */
export type RequirementNames = string | readonly string[]

export const MESSAGES: Record<RequirementKind, string> = {
  permission: 'User does not have the right permissions.',
  role: 'User does not have the right roles.',
  role_or_permission: 'User does not have any of the necessary access rights.',
}

export const UNAUTHENTICATED_MESSAGE = 'User is not logged in.'

const split = (name: string): string[] =>
  name
    .split('|')
    .map((n) => n.trim())
    .filter((n) => n !== '')

/** Each argument is a group (pipes = any within the group); arrays contribute one group per item. */
export function toGroups(names: readonly RequirementNames[]): string[][] {
  const groups: string[][] = []
  for (const name of names) {
    for (const item of typeof name === 'string' ? [name] : name) {
      const group = split(item)
      if (group.length > 0) groups.push(group)
    }
  }
  return groups
}

/**
 * Normalizes a requirement into groups: every group must pass, a group passes when ANY of its names matches.
 *
 * - permissions: every argument is required, pipes mean any, `any` = any of everything
 * - roles: any of them, `all` = all of them
 * - role or permission: any of them
 */
export function requirementGroups(
  kind: RequirementKind,
  names: readonly RequirementNames[],
  flags: { any?: boolean | undefined; all?: boolean | undefined } = {},
): string[][] {
  const groups = toGroups(names)
  if (kind === 'permission') return flags.any ? [groups.flat()] : groups
  const all = groups.flat()
  if (kind === 'role' && flags.all) return all.map((r) => [r])
  return all.length > 0 ? [all] : []
}
