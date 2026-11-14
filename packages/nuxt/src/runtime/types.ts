import type { RbacSnapshot } from '@anievo-id/rbac-evolution'
import type { VueRbac } from '@anievo-id/rbac-evolution-vue'

/** Module options as exposed in `runtimeConfig.public.rbac`. */
export interface RbacPublicConfig {
  wildcard: boolean
  superAdminRoles: string[]
  directives: boolean
  components: boolean
  globalProperties: boolean
  unauthenticatedRedirect: string
  forbiddenRedirect: string
}

/** The RBAC instance provided as `$rbac` / returned by `useRbac()`. */
export interface NuxtRbac extends VueRbac {
  /** Replaces the snapshot (and the SSR state), e.g. after login (`snapshot`) or logout (`null`). */
  setSnapshot(snapshot: RbacSnapshot | null): void
  /** `true` when there is no subject (the server resolved a guest, or `setSnapshot(null)`). */
  isGuest(): boolean
}

/** `useState` key holding the snapshot serialized from SSR. */
export const STATE_KEY = 'rbac-evolution:snapshot'
