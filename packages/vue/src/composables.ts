import { type ComputedRef, computed, inject, type MaybeRefOrGetter, toValue } from 'vue'
import { type NameList, RBAC_KEY, type VueRbac } from './state'

/** Returns the RBAC instance installed with `app.use(createRbacPlugin(...))`. */
export function useRbac(): VueRbac {
  const rbac = inject(RBAC_KEY, null)
  if (!rbac) {
    throw new Error('[rbac-evolution] No RBAC instance found. Did you call `app.use(createRbacPlugin(...))`?')
  }
  return rbac
}

const check =
  (pick: (rbac: VueRbac) => (names: NameList) => boolean) =>
  (names: MaybeRefOrGetter<NameList>): ComputedRef<boolean> => {
    const rbac = useRbac()
    const fn = pick(rbac)
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
