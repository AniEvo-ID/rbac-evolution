import type { NameList } from '@anievo-id/rbac-evolution-vue'
import { type ComputedRef, computed, type MaybeRefOrGetter, toValue } from 'vue'
import { useNuxtApp } from '#app'
import type { NuxtRbac } from './types'

/**
 * Returns the RBAC instance (`$rbac`). Works in components, plugins and route middleware.
 * Client-side checks only decide what the UI shows — enforce on the server too.
 */
export function useRbac(): NuxtRbac {
  const rbac = (useNuxtApp() as unknown as { $rbac?: NuxtRbac }).$rbac
  if (!rbac) {
    throw new Error('[rbac-evolution] `$rbac` is missing. Is `@anievo-id/rbac-evolution-nuxt` in `modules`?')
  }
  return rbac
}

const check =
  (pick: (rbac: NuxtRbac) => (names: NameList) => boolean) =>
  (names: MaybeRefOrGetter<NameList>): ComputedRef<boolean> => {
    const fn = pick(useRbac())
    return computed(() => fn(toValue(names)))
  }

/** Reactive permission check. A list means ALL of them. Accepts a ref or getter. */
export const useCan = check((rbac) => rbac.can)
export const useCannot = check((rbac) => rbac.cannot)
export const useCanAny = check((rbac) => rbac.canAny)
export const useCanAll = check((rbac) => rbac.canAll)
/** Reactive role check. A list or `'a|b'` means ANY of them. */
export const useHasRole = check((rbac) => rbac.hasRole)
export const useHasAnyRole = check((rbac) => rbac.hasAnyRole)
export const useHasAllRoles = check((rbac) => rbac.hasAllRoles)
