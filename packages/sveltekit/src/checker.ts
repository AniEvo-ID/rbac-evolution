import { type RbacSnapshot, wildcardImplies } from '@anievo-id/rbac-evolution'

/** A permission or role name, or a list of them. `N` is `string` without typed names. */
export type NameList<N extends string = string> = N | readonly N[]

export interface RbacCheckerOptions {
  /** Match permissions with wildcard semantics (`articles.*` covers `articles.edit`). Must mirror `createRbac({ wildcard })`. Default: `false`. */
  wildcard?: boolean | undefined
  /** Roles that pass every permission check, like a `Gate::before` super-admin rule. Default: `[]`. */
  superAdminRoles?: readonly string[] | undefined
}

/**
 * Synchronous checks against a {@link RbacSnapshot}, with the same rules as the Vue package:
 *
 * - `can(list)` / `canAll(list)` need ALL of the permissions, `canAny(list)` ANY of them;
 * - `hasRole('a|b')` / `hasRole(['a', 'b'])` / `hasAnyRole` need ANY of the roles, `hasAllRoles` ALL of them;
 * - a name in the snapshot's `denied` (`snapshot({ checkBefore })`) is never allowed, super-admins included;
 * - an empty list is never allowed (deny by default).
 *
 * This is for UI only: the server must always enforce authorization.
 */
export interface RbacChecker {
  /** The snapshot the checks run against. A guest's is empty. */
  readonly snapshot: Readonly<RbacSnapshot>
  /** `true` when there is no subject (a `null` / `undefined` snapshot). */
  readonly isGuest: boolean
  /** `true` if the subject has the permission (or, for a list, ALL of them). */
  can(permission: NameList): boolean
  /** `!can(permission)`. */
  cannot(permission: NameList): boolean
  /** `true` if the subject has ANY of the permissions. */
  canAny(permissions: NameList): boolean
  /** `true` if the subject has ALL of the permissions. */
  canAll(permissions: NameList): boolean
  /** `true` if the subject has the role, or ANY of the roles. Supports `'writer|editor'`. */
  hasRole(roles: NameList): boolean
  hasAnyRole(roles: NameList): boolean
  hasAllRoles(roles: NameList): boolean
  /** `true` if the subject has one of the configured `superAdminRoles`. */
  isSuperAdmin(): boolean
}

const EMPTY: Readonly<RbacSnapshot> = Object.freeze({ roles: [], permissions: [] })

// `null` / `undefined` (e.g. a typo in a prop binding) is an empty list, so every check fails.
const toList = (value: NameList | null | undefined): string[] =>
  (value == null ? [] : typeof value === 'string' ? [value] : [...value]).map((v) => v.trim()).filter((v) => v !== '')

/** Like {@link toList}, but also splits spatie-style pipes: `'writer|editor'`. */
const toRoleList = (value: NameList): string[] => toList(value).flatMap((v) => toList(v.split('|')))

function normalize(snapshot: RbacSnapshot | null | undefined): Readonly<RbacSnapshot> {
  if (!snapshot) return EMPTY
  return Object.freeze({
    roles: snapshot.roles.map((r) => r.trim()),
    permissions: snapshot.permissions.map((p) => p.trim()),
    // Names the server's `before` hook denies (`snapshot({ checkBefore })`). Kept absent for older snapshots.
    ...(snapshot.denied ? { denied: snapshot.denied.map((d) => d.trim()) } : {}),
  })
}

/**
 * Builds a pure checker for a snapshot (as returned by `getSnapshot(event)` / `rbac.for(user).snapshot()`).
 * `setRbacContext()` uses it; use it on its own in a universal `load` (`+page.ts`) with the layout's data.
 */
export function createRbacChecker(snapshot: RbacSnapshot | null | undefined, options: RbacCheckerOptions = {}): RbacChecker {
  const state = normalize(snapshot)
  const wildcard = options.wildcard ?? false
  const roles = new Set(state.roles)
  const denied = new Set(state.denied ?? [])
  const superAdmin = toList(options.superAdminRoles ?? []).some((r) => roles.has(r))

  const matches = (required: string): boolean => {
    if (state.permissions.includes(required)) return true
    if (!wildcard) return false
    return state.permissions.some((pattern) => {
      try {
        return wildcardImplies(pattern, required)
      } catch {
        return false
      }
    })
  }

  /** One permission. Like the server, a `before` denial wins over super-admin and stored grants. */
  const allows = (permission: string): boolean => !denied.has(permission) && (superAdmin || matches(permission))

  const canAny = (permissions: NameList): boolean => toList(permissions).some(allows)
  const canAll = (permissions: NameList): boolean => {
    const wanted = toList(permissions)
    return wanted.length > 0 && wanted.every(allows)
  }
  const hasAnyRole = (list: NameList): boolean => toRoleList(list).some((r) => roles.has(r))
  const hasAllRoles = (list: NameList): boolean => {
    const wanted = toRoleList(list)
    return wanted.length > 0 && wanted.every((r) => roles.has(r))
  }

  return {
    snapshot: state,
    isGuest: !snapshot,
    can: canAll,
    cannot: (permission) => !canAll(permission),
    canAny,
    canAll,
    hasRole: hasAnyRole,
    hasAnyRole,
    hasAllRoles,
    isSuperAdmin: () => superAdmin,
  }
}
