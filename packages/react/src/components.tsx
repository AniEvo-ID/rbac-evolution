import type { ReactNode } from 'react'
import type { RbacChecker } from './checker'
import { useRbac } from './context'

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
  children?: ReactNode
  /** Rendered when the check fails. Default: nothing. */
  fallback?: ReactNode
}

export type CanProps = PermissionCondition & GateProps
export type CannotProps = PermissionCondition & GateProps
export type HasRoleProps = RoleCondition & GateProps

interface LooseCondition {
  anyOf?: readonly string[] | undefined
  allOf?: readonly string[] | undefined
}

// Conditions are ANDed; no condition at all is denied (deny by default, also for untyped JS callers).
function checkPermissions(rbac: RbacChecker, p: LooseCondition & { permission?: string | undefined }): boolean {
  if (p.permission === undefined && p.anyOf === undefined && p.allOf === undefined) return false
  return (
    (p.permission === undefined || rbac.can(p.permission)) &&
    (p.anyOf === undefined || rbac.canAny(p.anyOf)) &&
    (p.allOf === undefined || rbac.canAll(p.allOf))
  )
}

function checkRoles(rbac: RbacChecker, p: LooseCondition & { role?: string | undefined }): boolean {
  if (p.role === undefined && p.anyOf === undefined && p.allOf === undefined) return false
  return (
    (p.role === undefined || rbac.hasRole(p.role)) &&
    (p.anyOf === undefined || rbac.hasAnyRole(p.anyOf)) &&
    (p.allOf === undefined || rbac.hasAllRoles(p.allOf))
  )
}

/** Renders `children` if the user has the permission(s) — like spatie's `@can` / `@canany`. */
export function Can(props: CanProps) {
  const rbac = useRbac()
  if (rbac.loading) return null
  return <>{checkPermissions(rbac, props) ? props.children : props.fallback}</>
}

/** Renders `children` if the user does NOT have the permission(s) — like spatie's `@cannot`. */
export function Cannot(props: CannotProps) {
  const rbac = useRbac()
  if (rbac.loading) return null
  return <>{checkPermissions(rbac, props) ? props.fallback : props.children}</>
}

/** Renders `children` if the user has the role(s) — like spatie's `@role` / `@hasanyrole` / `@hasallroles`. */
export function HasRole(props: HasRoleProps) {
  const rbac = useRbac()
  if (rbac.loading) return null
  return <>{checkRoles(rbac, props) ? props.children : props.fallback}</>
}
