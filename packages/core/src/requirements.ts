import type { SubjectRbac } from './rbac'

/**
 * Shared requirement logic for the framework integrations (spatie's `permission:`, `role:` and
 * `role_or_permission:` middleware), so every package parses names and checks them the same way.
 */

/** Which kind of requirement a guard checks. */
export type RequirementKind = 'permission' | 'role' | 'role_or_permission'

/** A name, a pipe-separated list (`'edit|delete'` = any of), or an array of names. */
export type RequirementNames = string | readonly string[]

/** A normalized requirement. Every group must pass; a group passes when ANY of its names matches. */
export interface RbacRequirement {
  kind: RequirementKind
  requirements: string[][]
}

export interface PermissionRequirementOptions {
  /** Pass when the subject has ANY of the permissions (instead of all). Default: `false`. */
  any?: boolean | undefined
}

export interface RoleRequirementOptions {
  /** Require ALL of the roles (instead of any). Default: `false`. */
  all?: boolean | undefined
}

/** Default 403 messages, per kind (same wording as spatie). */
export const REQUIREMENT_MESSAGES: Readonly<Record<RequirementKind, string>> = {
  permission: 'User does not have the right permissions.',
  role: 'User does not have the right roles.',
  role_or_permission: 'User does not have any of the necessary access rights.',
}

/** Default 401 message. */
export const UNAUTHENTICATED_MESSAGE = 'User is not logged in.'

const split = (name: string): string[] =>
  name
    .split('|')
    .map((n) => n.trim())
    .filter((n) => n !== '')

/** Each argument is a group (pipes = any within the group); arrays contribute one group per item. */
function toGroups(names: readonly RequirementNames[]): string[][] {
  const groups: string[][] = []
  for (const name of names) {
    for (const item of typeof name === 'string' ? [name] : name) {
      const group = split(item)
      if (group.length > 0) groups.push(group)
    }
  }
  return groups
}

function ensure(requirement: RbacRequirement): RbacRequirement {
  const { requirements } = requirement
  if (requirements.length === 0 || requirements.some((group) => group.length === 0)) {
    throw new TypeError(`[rbac-evolution] A ${requirement.kind} requirement needs at least one name.`)
  }
  return requirement
}

/** Splits `(...names, options?)` guard arguments: a trailing plain object is the options. */
export function splitRequirementArgs<O extends object>(
  args: readonly (RequirementNames | O)[],
): { names: RequirementNames[]; options: O | undefined } {
  const last = args[args.length - 1]
  if (last !== undefined && typeof last === 'object' && !Array.isArray(last)) {
    return { names: args.slice(0, -1) as RequirementNames[], options: last as O }
  }
  return { names: args as RequirementNames[], options: undefined }
}

/** `'a', 'b'` = all; `'a|b'` = any; `{ any: true }` = any of everything. Throws `TypeError` without names. */
export function permissionRequirement(
  names: readonly RequirementNames[],
  options: PermissionRequirementOptions = {},
): RbacRequirement {
  const groups = toGroups(names)
  return ensure({ kind: 'permission', requirements: options.any ? [groups.flat()] : groups })
}

/** Any of the roles by default; `{ all: true }` = all of them. Throws `TypeError` without names. */
export function roleRequirement(names: readonly RequirementNames[], options: RoleRequirementOptions = {}): RbacRequirement {
  const all = toGroups(names).flat()
  return ensure({ kind: 'role', requirements: options.all ? all.map((r) => [r]) : [all] })
}

/** Any of the names, as a role OR as a permission. Throws `TypeError` without names. */
export function roleOrPermissionRequirement(names: readonly RequirementNames[]): RbacRequirement {
  return ensure({ kind: 'role_or_permission', requirements: [toGroups(names).flat()] })
}

/** `true` when every group of the requirement passes for the subject. */
export async function satisfiesRequirement(rbac: SubjectRbac, requirement: RbacRequirement): Promise<boolean> {
  for (const group of requirement.requirements) {
    let pass: boolean
    switch (requirement.kind) {
      case 'permission':
        pass = await rbac.canAny(group)
        break
      case 'role':
        pass = await rbac.hasAnyRole(group)
        break
      default:
        pass = (await rbac.hasAnyRole(group)) || (await rbac.canAny(group))
    }
    if (!pass) return false
  }
  return true
}
