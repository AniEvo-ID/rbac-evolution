import { createContext, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'
import type { Many, RbacSnapshot } from '@anievo-id/rbac-evolution'
import { createRbacChecker } from './checker'
import type { RbacChecker } from './checker'

const RbacContext = createContext<RbacChecker | null>(null)
RbacContext.displayName = 'RbacContext'

export interface RbacProviderProps {
  /** Roles & permissions of the current user, e.g. from `rbac.for(user).snapshot()` on the server. `null` = guest. */
  snapshot: RbacSnapshot | null | undefined
  /** Enable wildcard matching (`articles.*`). Must match the server's `wildcard` setting. Default: `false`. */
  wildcard?: boolean
  /** Roles that pass every `can` check (super admin). */
  superAdminRoles?: readonly string[]
  children?: ReactNode
}

/**
 * Provides a user's roles & permissions to `useCan()`, `<Can>`, ...
 *
 * UI only: this hides and shows elements. Always enforce authorization on the server.
 */
export function RbacProvider({ snapshot, wildcard = false, superAdminRoles, children }: RbacProviderProps) {
  const superKey = superAdminRoles?.join('\u0000') ?? ''
  const checker = useMemo(
    () => createRbacChecker(snapshot, superAdminRoles ? { wildcard, superAdminRoles } : { wildcard }),
    // `superKey` keeps inline arrays (`superAdminRoles={['admin']}`) from recomputing every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [snapshot, wildcard, superKey],
  )
  return <RbacContext.Provider value={checker}>{children}</RbacContext.Provider>
}

/** Returns the checker of the nearest `RbacProvider`. Throws when there is none. */
export function useRbac(): RbacChecker {
  const checker = useContext(RbacContext)
  if (!checker) {
    throw new Error('useRbac() must be used inside <RbacProvider>.')
  }
  return checker
}

export function useCan(permission: string): boolean {
  return useRbac().can(permission)
}

export function useCannot(permission: string): boolean {
  return useRbac().cannot(permission)
}

export function useCanAny(...permissions: Many<string>[]): boolean {
  return useRbac().canAny(...permissions)
}

export function useCanAll(...permissions: Many<string>[]): boolean {
  return useRbac().canAll(...permissions)
}

/** `true` if the user has the role — or ANY of the roles when given an array. */
export function useHasRole(role: Many<string>): boolean {
  return useRbac().hasRole(role)
}

export function useHasAnyRole(...roles: Many<string>[]): boolean {
  return useRbac().hasAnyRole(...roles)
}

export function useHasAllRoles(...roles: Many<string>[]): boolean {
  return useRbac().hasAllRoles(...roles)
}
