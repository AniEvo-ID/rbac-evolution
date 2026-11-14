import { type Directive, type DirectiveBinding, type ShallowRef, shallowRef, watchEffect, type WatchStopHandle } from 'vue'
import type { NameList, VueRbac } from './state'

type Check = (rbac: VueRbac, binding: DirectiveBinding<NameList>) => boolean

interface ElementState {
  binding: ShallowRef<DirectiveBinding<NameList>>
  display: string
  stop: WatchStopHandle
}

/**
 * Builds a directive that hides its element (`display: none`, like `v-show`) when the check fails.
 * Each element gets its own effect, so it re-evaluates when the snapshot or the bound value changes.
 */
function createVisibilityDirective(rbac: VueRbac, check: Check): Directive<HTMLElement, NameList> {
  const states = new WeakMap<HTMLElement, ElementState>()

  return {
    beforeMount(el, binding) {
      const current = shallowRef(binding)
      const display = el.style.display === 'none' ? '' : el.style.display
      const stop = watchEffect(
        () => {
          el.style.display = check(rbac, current.value) ? display : 'none'
        },
        { flush: 'sync' },
      )
      states.set(el, { binding: current, display, stop })
    },
    updated(el, binding) {
      const state = states.get(el)
      if (state) state.binding.value = binding
    },
    unmounted(el) {
      states.get(el)?.stop()
      states.delete(el)
    },
    getSSRProps(binding) {
      return check(rbac, binding) ? {} : { style: { display: 'none' } }
    },
  }
}

/**
 * `v-can="'edit articles'"` — single permission.
 * `v-can="['a', 'b']"` / `v-can.all="[...]"` — all of them.
 * `v-can.any="[...]"` — any of them.
 * `v-can.not="'x'"` — shown only when the user does NOT have it.
 */
export function createCanDirective(rbac: VueRbac): Directive<HTMLElement, NameList> {
  return createVisibilityDirective(rbac, (r, { value, modifiers }) => {
    const allowed = modifiers['any'] ? r.canAny(value) : r.canAll(value)
    return modifiers['not'] ? !allowed : allowed
  })
}

/**
 * `v-role="'admin'"`, `v-role="'writer|editor'"`, `v-role="['a', 'b']"` — any of the roles.
 * `v-role.all="[...]"` — all of them. `v-role.not="'banned'"` — negated.
 */
export function createRoleDirective(rbac: VueRbac): Directive<HTMLElement, NameList> {
  return createVisibilityDirective(rbac, (r, { value, modifiers }) => {
    const allowed = modifiers['all'] ? r.hasAllRoles(value) : r.hasAnyRole(value)
    return modifiers['not'] ? !allowed : allowed
  })
}
