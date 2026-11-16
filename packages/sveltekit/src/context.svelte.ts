import type {
  DefaultGuardName,
  DefaultRbacTypes,
  PermissionName,
  Rbac,
  RbacSnapshot,
  RbacTypeConfig,
  RoleName,
} from '@anievo-id/rbac-evolution'
import { getContext, hasContext, setContext } from 'svelte'
import { createRbacChecker, type NameList, type RbacCheckerOptions } from './checker.js'
import type { CheckNames, TypesOf } from './types.js'

/**
 * The snapshot to check against: the value itself, or a getter such as `() => data.rbac`. With a getter, every
 * check re-runs when the data changes (e.g. after `invalidateAll()` on login or logout).
 */
export type RbacSnapshotSource = RbacSnapshot | null | undefined | (() => RbacSnapshot | null | undefined)

export type RbacStateOptions = RbacCheckerOptions

/**
 * The reactive RBAC state of `setRbacContext()` / `getRbacContext()`. Every check reads rune state, so calling it in
 * markup, `$derived` or `$effect` re-runs when the snapshot changes.
 *
 * `T` (a names type like `AppRbac`, or `typeof rbac`) types the names; without it, any string. With per-guard
 * names, `G` is the guard the snapshot was made in (the default guard by default).
 *
 * This is for UI only: the server must always enforce authorization.
 */
export interface SvelteRbac<
  T extends RbacTypeConfig | Rbac<RbacTypeConfig> = DefaultRbacTypes,
  G extends string = DefaultGuardName<TypesOf<T>>,
> {
  /** The current snapshot (reactive). A guest's is empty. */
  readonly snapshot: Readonly<RbacSnapshot>
  /** `true` when the snapshot is `null` / `undefined`: no subject (reactive). */
  readonly isGuest: boolean
  /** `true` if the user has the permission (or, for a list, ALL of them). */
  can(permission: NameList<PermissionName<TypesOf<T>, G>>): boolean
  cannot(permission: NameList<PermissionName<TypesOf<T>, G>>): boolean
  canAny(permissions: NameList<PermissionName<TypesOf<T>, G>>): boolean
  canAll(permissions: NameList<PermissionName<TypesOf<T>, G>>): boolean
  /** `true` if the user has the role, or ANY of the roles. Supports `'writer|editor'`. */
  hasRole<const S extends NameList>(roles: S & CheckNames<S, RoleName<TypesOf<T>, G>>): boolean
  hasAnyRole<const S extends NameList>(roles: S & CheckNames<S, RoleName<TypesOf<T>, G>>): boolean
  hasAllRoles<const S extends NameList>(roles: S & CheckNames<S, RoleName<TypesOf<T>, G>>): boolean
  /** `true` if the user has one of the configured `superAdminRoles`. */
  isSuperAdmin(): boolean
}

/** The context key `setRbacContext()` uses. Pass it in a test's `context` map with `createRbacState()`. */
export const RBAC_KEY: unique symbol = Symbol('rbac-evolution')

/**
 * Creates the reactive state without putting it in the context (`setRbacContext()` does both). Useful in tests:
 * `render(Component, { context: new Map([[RBAC_KEY, createRbacState(snapshot)]]) })`.
 */
export function createRbacState<
  T extends RbacTypeConfig | Rbac<RbacTypeConfig> = DefaultRbacTypes,
  G extends string = DefaultGuardName<TypesOf<T>>,
>(snapshot: RbacSnapshotSource, options: RbacStateOptions = {}): SvelteRbac<T, G> {
  const read = typeof snapshot === 'function' ? snapshot : () => snapshot
  // Recomputed (lazily) whenever the getter's dependencies change, e.g. `data.rbac` after `invalidateAll()`.
  const checker = $derived(createRbacChecker(read(), options))

  const state: SvelteRbac = {
    get snapshot() {
      return checker.snapshot
    },
    get isGuest() {
      return checker.isGuest
    },
    can: (permission) => checker.can(permission),
    cannot: (permission) => checker.cannot(permission),
    canAny: (permissions) => checker.canAny(permissions),
    canAll: (permissions) => checker.canAll(permissions),
    hasRole: (roles) => checker.hasRole(roles),
    hasAnyRole: (roles) => checker.hasAnyRole(roles),
    hasAllRoles: (roles) => checker.hasAllRoles(roles),
    isSuperAdmin: () => checker.isSuperAdmin(),
  }
  // `T` only narrows the accepted names; the checks are the same.
  return state as unknown as SvelteRbac<T, G>
}

/**
 * Puts the current user's roles & permissions in the component context, for `getRbacContext()`, `<Can>` and
 * `<HasRole>` below it. Call it in the root `+layout.svelte`, with a getter so it follows the layout data:
 *
 * ```svelte
 * <script lang="ts">
 *   import { setRbacContext } from '@anievo-id/rbac-evolution-sveltekit'
 *   let { data, children } = $props()
 *   setRbacContext(() => data.rbac, { superAdminRoles: ['super-admin'] })
 * </script>
 * ```
 *
 * Must be called during component initialisation (like Svelte's `setContext`).
 */
export function setRbacContext<
  T extends RbacTypeConfig | Rbac<RbacTypeConfig> = DefaultRbacTypes,
  G extends string = DefaultGuardName<TypesOf<T>>,
>(snapshot: RbacSnapshotSource, options: RbacStateOptions = {}): SvelteRbac<T, G> {
  return setContext(RBAC_KEY, createRbacState<T, G>(snapshot, options))
}

/**
 * Returns the state set by `setRbacContext()` in a parent component. Call it in a component's `<script>` (during
 * initialisation), then use it anywhere in the component: `{#if rbac.can('articles.edit')}`.
 *
 * Pass your names type to check names at compile time: `getRbacContext<AppRbac>()`.
 */
export function getRbacContext<
  T extends RbacTypeConfig | Rbac<RbacTypeConfig> = DefaultRbacTypes,
  G extends string = DefaultGuardName<TypesOf<T>>,
>(): SvelteRbac<T, G> {
  if (!hasContext(RBAC_KEY)) {
    throw new Error('[rbac-evolution] No RBAC context found. Call `setRbacContext(() => data.rbac)` in your root +layout.svelte.')
  }
  return getContext<SvelteRbac<T, G>>(RBAC_KEY)
}
