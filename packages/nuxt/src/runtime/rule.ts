import {
  permissionRequirement,
  type RbacRequirement,
  type RequirementKind,
  type RequirementNames,
  REQUIREMENT_MESSAGES,
  roleOrPermissionRequirement,
  roleRequirement,
} from '@anievo-id/rbac-evolution'
import type { VueRbac } from '@anievo-id/rbac-evolution-vue'

/** `definePageMeta({ rbac: { ... } })` — same semantics as the Express / Nest guards. */
export interface RbacRouteRule {
  /** Every name is required; `'a|b'` = any of them. With `any: true`, any of all the names. */
  permission?: RequirementNames | undefined
  /** Any of the roles; with `all: true`, all of them. `'a|b'` is supported. */
  role?: RequirementNames | undefined
  /** Any of the names, as a role OR as a permission. */
  roleOrPermission?: RequirementNames | undefined
  /** Permissions: pass with ANY of them instead of all. */
  any?: boolean
  /** Roles: require ALL of them instead of any. */
  all?: boolean
  /** Where to send a user who lacks access. Default: the module's `forbiddenRedirect`, else a 403 error page. */
  redirect?: string
  /** Where to send a guest. Default: the module's `unauthenticatedRedirect`, else a 401 error page. */
  guestRedirect?: string
}

export type RouteRuleResult =
  | { ok: true }
  | { ok: false; status: 401; error: 'UNAUTHENTICATED' }
  | { ok: false; status: 403; error: 'FORBIDDEN'; reason: RequirementKind; message: string }

const list = (names: RequirementNames | undefined): RequirementNames[] =>
  names === undefined ? [] : [names]

/** A requirement without names can never be met: no groups, so the check below denies. */
const groupsOf = (kind: RequirementKind, build: () => RbacRequirement): [RequirementKind, string[][]] => {
  try {
    return [kind, build().requirements]
  } catch {
    return [kind, []]
  }
}

/**
 * Evaluates a route rule against the client-side snapshot. Pure and synchronous —
 * used by the `rbac` route middleware, exported for custom middleware.
 */
export function evaluateRouteRule(rbac: VueRbac, rule: RbacRouteRule, isGuest: boolean): RouteRuleResult {
  const checks: [RequirementKind, string[][]][] = []
  // A key that is present but undefined (e.g. `permission: config.missing`) is a requirement nobody meets:
  // fail closed instead of silently opening the page. A rule without any requirement key still passes.
  if ('permission' in rule) {
    checks.push(groupsOf('permission', () => permissionRequirement(list(rule.permission), { any: rule.any })))
  }
  if ('role' in rule) {
    checks.push(groupsOf('role', () => roleRequirement(list(rule.role), { all: rule.all })))
  }
  if ('roleOrPermission' in rule) {
    checks.push(groupsOf('role_or_permission', () => roleOrPermissionRequirement(list(rule.roleOrPermission))))
  }
  if (checks.length === 0) return { ok: true }
  if (isGuest) return { ok: false, status: 401, error: 'UNAUTHENTICATED' }

  for (const [kind, groups] of checks) {
    const pass =
      groups.length > 0 &&
      groups.every((group) => {
        if (kind === 'permission') return rbac.canAny(group)
        if (kind === 'role') return rbac.hasAnyRole(group)
        return rbac.hasAnyRole(group) || rbac.canAny(group)
      })
    if (!pass) return { ok: false, status: 403, error: 'FORBIDDEN', reason: kind, message: REQUIREMENT_MESSAGES[kind] }
  }
  return { ok: true }
}
