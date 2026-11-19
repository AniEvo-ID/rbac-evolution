import { createMemo, untrack } from 'solid-js'
import type { RbacChecker } from './checker'
import { useRbac } from './context'
import type { SolidElement } from './context'

/** Exactly one of `permission`, `anyOf` or `allOf`. */
export type PermissionCondition =
  | { permission: string; anyOf?: never; allOf?: never }
  | { permission?: never; anyOf: readonly string[]; allOf?: never }
  | { permission?: never; anyOf?: never; allOf: readonly string[] }

/** Exactly one of `role`, `anyOf` or `allOf`. */
export type RoleCondition =
  | { role: string; anyOf?: never; allOf?: never }
  | { role?: never; anyOf: readonly string[]; allOf?: never }
  | { role?: never; anyOf?: never; allOf: readonly string[] }

interface GateProps {
  children?: SolidElement
  /** Rendered when the check fails. Default: nothing. */
  fallback?: SolidElement
}

export type CanProps = PermissionCondition & GateProps
export type CannotProps = PermissionCondition & GateProps
export type HasRoleProps = RoleCondition & GateProps
export type UnlessRoleProps = RoleCondition & GateProps

interface LooseCondition {
  permission?: string | undefined
  role?: string | undefined
  anyOf?: readonly string[] | undefined
  allOf?: readonly string[] | undefined
}

const hasCondition = (p: LooseCondition): boolean =>
  p.permission !== undefined || p.role !== undefined || p.anyOf !== undefined || p.allOf !== undefined

// Conditions are ANDed; no condition at all is denied (deny by default, also for untyped JS callers).
function checkPermissions(rbac: RbacChecker, p: LooseCondition): boolean {
  if (!hasCondition(p)) return false
  return (
    (p.permission === undefined || rbac.can(p.permission)) &&
    (p.anyOf === undefined || rbac.canAny(p.anyOf)) &&
    (p.allOf === undefined || rbac.canAll(p.allOf))
  )
}

function checkRoles(rbac: RbacChecker, p: LooseCondition): boolean {
  if (!hasCondition(p)) return false
  return (
    (p.role === undefined || rbac.hasRole(p.role)) &&
    (p.anyOf === undefined || rbac.hasAnyRole(p.anyOf)) &&
    (p.allOf === undefined || rbac.hasAllRoles(p.allOf))
  )
}

/**
 * Renders `children` when `pass` is true, else `fallback`, and nothing while loading. Like `<Show>`: the branch is
 * only rebuilt when the result changes, and the children are created untracked.
 */
function gate(props: GateProps, pass: (rbac: RbacChecker) => boolean): SolidElement {
  const rbac = useRbac()
  const state = createMemo(() => (rbac().loading ? 'loading' : pass(rbac()) ? 'pass' : 'fail'))
  const view = (): SolidElement => {
    const s = state()
    if (s === 'loading') return null
    return untrack(() => (s === 'pass' ? props.children : props.fallback))
  }
  return view as unknown as SolidElement
}

/** Renders `children` if the user has the permission(s), like spatie's `@can` / `@canany`. */
export function Can(props: CanProps): SolidElement {
  return gate(props, (rbac) => checkPermissions(rbac, props))
}

/** Renders `children` if the user does NOT have the permission(s), like spatie's `@cannot`. */
export function Cannot(props: CannotProps): SolidElement {
  return gate(props, (rbac) => hasCondition(props) && !checkPermissions(rbac, props))
}

/** Renders `children` if the user has the role(s), like spatie's `@role` / `@hasanyrole` / `@hasallroles`. */
export function HasRole(props: HasRoleProps): SolidElement {
  return gate(props, (rbac) => checkRoles(rbac, props))
}

/**
 * Renders `children` if the user does NOT have the role(s), like spatie's `@unlessrole`.
 * `anyOf`: none of them. `allOf`: not all of them. Without a condition it renders `fallback` (deny by default).
 */
export function UnlessRole(props: UnlessRoleProps): SolidElement {
  return gate(props, (rbac) => hasCondition(props) && !checkRoles(rbac, props))
}
