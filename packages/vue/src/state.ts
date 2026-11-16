import { wildcardImplies, type RbacSnapshot } from '@anievo-id/rbac-evolution'
import { type DeepReadonly, type InjectionKey, type Ref, readonly, shallowRef } from 'vue'

/** A permission or role name, or a list of them. */
export type NameList = string | readonly string[]

export interface RbacStateOptions {
  /** Initial snapshot, usually `await rbac.for(user).snapshot()` sent by the server. `null` = guest. */
  snapshot?: RbacSnapshot | null | undefined
  /**
   * Start in the loading state (snapshot still being fetched): `<Can>`, `<HasRole>`, `v-can` and
   * `v-role` render nothing, not even the fallback or a `not` branch, until `setSnapshot()` is called.
   * Every check (`can`, `cannot`, `hasRole`, ...) returns `false` meanwhile. Default: `false`.
   */
  loading?: boolean | undefined
  /** Match permissions with wildcard semantics (`articles.*` covers `articles.edit`). Default: `false`. */
  wildcard?: boolean | undefined
  /** Roles that pass every permission check, like a `Gate::before` super-admin rule. Default: `[]`. */
  superAdminRoles?: readonly string[] | undefined
}

/**
 * Client-side, reactive view of the current user's roles & permissions.
 *
 * Every check reads reactive state, so calling it inside `computed`, a template
 * or a render function re-runs when {@link VueRbac.setSnapshot} is called.
 *
 * This is for UI only: the server must always enforce authorization.
 */
export interface VueRbac {
  /** Current snapshot (read-only, reactive). */
  readonly snapshot: Readonly<Ref<DeepReadonly<RbacSnapshot>>>
  /** `true` until the first `setSnapshot()` when created with `loading: true` (reactive). */
  readonly loading: Readonly<Ref<boolean>>
  /** Replaces the snapshot, e.g. after login (`snapshot`) or logout (`null`). Ends the loading state. */
  setSnapshot(snapshot: RbacSnapshot | null): void
  /** `true` if the user has the permission (or, for a list, ALL of them). */
  can(permission: NameList): boolean
  cannot(permission: NameList): boolean
  canAny(permissions: NameList): boolean
  canAll(permissions: NameList): boolean
  /** `true` if the user has the role, or ANY of the roles. Supports `'writer|editor'`. */
  hasRole(roles: NameList): boolean
  hasAnyRole(roles: NameList): boolean
  hasAllRoles(roles: NameList): boolean
  /** `true` if the user has one of the configured `superAdminRoles`. */
  isSuperAdmin(): boolean
}

export const RBAC_KEY: InjectionKey<VueRbac> = Symbol('rbac-evolution')

const EMPTY: Readonly<RbacSnapshot> = Object.freeze({ roles: [], permissions: [] })

function normalizeSnapshot(snapshot: RbacSnapshot | null | undefined): Readonly<RbacSnapshot> {
  if (!snapshot) return EMPTY
  return Object.freeze({
    roles: snapshot.roles.map((r) => r.trim()),
    permissions: snapshot.permissions.map((p) => p.trim()),
    // Names the server's `before` hook denies (`snapshot({ checkBefore })`). Kept absent for older snapshots.
    ...(snapshot.denied ? { denied: snapshot.denied.map((d) => d.trim()) } : {}),
  })
}

// `null` / `undefined` (e.g. a typo in a template binding) is an empty list, so every check fails.
const toList = (value: NameList | null | undefined): string[] =>
  (value == null ? [] : typeof value === 'string' ? [value] : [...value]).map((v) => v.trim()).filter((v) => v !== '')

/** Like {@link toList}, but also splits spatie-style pipes: `'writer|editor'`. */
const toRoleList = (value: NameList): string[] => toList(value).flatMap((v) => toList(v.split('|')))

/** Creates the reactive RBAC state without installing it (used by `createRbacPlugin`). */
export function createRbacState(options: RbacStateOptions = {}): VueRbac {
  const state = shallowRef<Readonly<RbacSnapshot>>(normalizeSnapshot(options.snapshot))
  const loading = shallowRef(options.loading ?? false)
  const wildcard = options.wildcard ?? false
  const superAdminRoles = toList(options.superAdminRoles ?? [])

  const matches = (granted: readonly string[], required: string): boolean => {
    if (!wildcard) return granted.includes(required)
    return granted.some((pattern) => {
      try {
        return wildcardImplies(pattern, required)
      } catch {
        return false
      }
    })
  }

  // While loading, every check (`cannot` too) is false: neither a stale grant nor "no access" UI shows.
  const isSuperAdmin = (): boolean => !loading.value && superAdminRoles.some((r) => state.value.roles.includes(r))

  /** One permission. Like the server, a `before` denial wins over super-admin and stored grants. */
  const allows = (permission: string): boolean => {
    const { permissions: granted, denied } = state.value
    if (denied?.includes(permission)) return false
    return isSuperAdmin() || matches(granted, permission)
  }

  const canAny = (permissions: NameList): boolean => {
    if (loading.value) return false
    return toList(permissions).some(allows)
  }

  const canAll = (permissions: NameList): boolean => {
    if (loading.value) return false
    const wanted = toList(permissions)
    return wanted.length > 0 && wanted.every(allows)
  }

  const hasAnyRole = (roles: NameList): boolean => {
    if (loading.value) return false
    const mine = state.value.roles
    return toRoleList(roles).some((r) => mine.includes(r))
  }

  const hasAllRoles = (roles: NameList): boolean => {
    if (loading.value) return false
    const mine = state.value.roles
    const wanted = toRoleList(roles)
    return wanted.length > 0 && wanted.every((r) => mine.includes(r))
  }

  return {
    snapshot: readonly(state),
    loading: readonly(loading),
    setSnapshot(snapshot) {
      state.value = normalizeSnapshot(snapshot)
      loading.value = false
    },
    can: canAll,
    cannot: (permission) => !loading.value && !canAll(permission),
    canAny,
    canAll,
    hasRole: hasAnyRole,
    hasAnyRole,
    hasAllRoles,
    isSuperAdmin,
  }
}
