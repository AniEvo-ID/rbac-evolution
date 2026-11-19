import type { Many, RbacSnapshot } from '@anievo-id/rbac-evolution'
import { type Accessor, createComponent, createContext, createMemo, useContext } from 'solid-js'
import { type RbacChecker, createRbacChecker } from './checker'

/**
 * What a Solid component renders: `JSX.Element` in Solid 1.x, `Element` in 2.x (where `solid-js` no longer exports the
 * `JSX` namespace). Taken from `createComponent`, which both versions export, so one build types against either.
 */
export type SolidElement = ReturnType<typeof createComponent>

const RbacContext = createContext<Accessor<RbacChecker>>()

export interface RbacProviderProps {
  /** Roles & permissions of the current user, e.g. from `rbac.for(user).snapshot()` on the server. `null` = guest. */
  snapshot: RbacSnapshot | null | undefined
  /** Enable wildcard matching (`articles.*`). Must match the server's `wildcard` setting. Default: `false`. */
  wildcard?: boolean | undefined
  /** Roles that pass every `can` check (super admin). */
  superAdminRoles?: readonly string[] | undefined
  /**
   * The snapshot is still being fetched. `<Can>`, `<Cannot>`, `<HasRole>` and `<UnlessRole>` then render nothing
   * (not even `fallback`), so nothing flashes before the real permissions arrive. Default: `false`.
   */
  loading?: boolean | undefined
  children?: SolidElement
}

type ProviderComponent = (props: { value: Accessor<RbacChecker>; children?: SolidElement }) => SolidElement

/**
 * Provides a user's roles & permissions to `useCan()`, `<Can>`, ... Every prop is reactive: pass a signal or a
 * resource (`snapshot={data()}`) and everything below updates.
 *
 * UI only: this hides and shows elements. Always enforce authorization on the server.
 */
export function RbacProvider(props: RbacProviderProps): SolidElement {
  const checker = createMemo(() =>
    createRbacChecker(props.snapshot, {
      wildcard: props.wildcard ?? false,
      superAdminRoles: props.superAdminRoles,
      loading: props.loading ?? false,
    }),
  )
  // Solid 1.x: `Context.Provider`. Solid 2.x: the context itself is the provider component.
  const Provider = ((RbacContext as unknown as { Provider?: ProviderComponent }).Provider ??
    RbacContext) as unknown as ProviderComponent
  return createComponent(Provider, {
    value: checker,
    get children() {
      return props.children
    },
  })
}

/** The checker of the nearest `RbacProvider`, as an accessor. Throws when there is none. */
export function useRbac(): Accessor<RbacChecker> {
  let checker: Accessor<RbacChecker> | undefined
  try {
    checker = useContext(RbacContext)
  } catch {
    // Solid 2 throws itself for a context without a provider and default value.
  }
  if (!checker) throw new Error('useRbac() must be used inside <RbacProvider>.')
  return checker
}

/** `true` if the user has the permission. */
export function useCan(permission: string): Accessor<boolean> {
  const rbac = useRbac()
  return () => rbac().can(permission)
}

/** `true` if the user does NOT have the permission (`false` while loading). */
export function useCannot(permission: string): Accessor<boolean> {
  const rbac = useRbac()
  return () => rbac().cannot(permission)
}

/** `true` if the user has ANY of the permissions. */
export function useCanAny(...permissions: Many<string>[]): Accessor<boolean> {
  const rbac = useRbac()
  return () => rbac().canAny(...permissions)
}

/** `true` if the user has ALL of the permissions. */
export function useCanAll(...permissions: Many<string>[]): Accessor<boolean> {
  const rbac = useRbac()
  return () => rbac().canAll(...permissions)
}

/** `true` if the user has the role, or ANY of the roles when given an array. */
export function useHasRole(role: Many<string>): Accessor<boolean> {
  const rbac = useRbac()
  return () => rbac().hasRole(role)
}

/** `true` if the user has ANY of the roles. */
export function useHasAnyRole(...roles: Many<string>[]): Accessor<boolean> {
  const rbac = useRbac()
  return () => rbac().hasAnyRole(...roles)
}

/** `true` if the user has ALL of the roles. */
export function useHasAllRoles(...roles: Many<string>[]): Accessor<boolean> {
  const rbac = useRbac()
  return () => rbac().hasAllRoles(...roles)
}
