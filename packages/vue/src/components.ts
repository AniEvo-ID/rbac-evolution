import { defineComponent, type PropType, type SlotsType, type VNode } from 'vue'
import { useRbac } from './composables'
import type { NameList } from './state'

type Slots = SlotsType<{ default?: () => VNode[]; fallback?: () => VNode[] }>

const nameList = { type: [String, Array] as PropType<NameList>, default: undefined }

/**
 * Renders the default slot when the user has the permission(s), otherwise the `#fallback` slot.
 *
 * ```vue
 * <Can permission="edit articles">...</Can>
 * <Can :any-of="['edit articles', 'delete articles']">...<template #fallback>No access</template></Can>
 * <Can :all-of="['a', 'b']">...</Can>
 * ```
 */
export const Can = defineComponent({
  name: 'Can',
  props: {
    permission: nameList,
    anyOf: nameList,
    allOf: nameList,
    not: { type: Boolean, default: false },
  },
  slots: Object as Slots,
  setup(props, { slots }) {
    const rbac = useRbac()
    return () => {
      if (rbac.loading.value) return null
      let allowed = true
      let checked = false
      if (props.permission !== undefined) {
        checked = true
        allowed &&= rbac.canAll(props.permission)
      }
      if (props.allOf !== undefined) {
        checked = true
        allowed &&= rbac.canAll(props.allOf)
      }
      if (props.anyOf !== undefined) {
        checked = true
        allowed &&= rbac.canAny(props.anyOf)
      }
      const pass = checked && allowed !== props.not
      return (pass ? slots.default?.() : slots.fallback?.()) ?? null
    }
  },
})

/**
 * Renders the default slot when the user has the role(s), otherwise the `#fallback` slot.
 *
 * ```vue
 * <HasRole role="admin">...</HasRole>
 * <HasRole role="writer|editor">...</HasRole>
 * <HasRole :all-of="['writer', 'editor']">...</HasRole>
 * ```
 */
export const HasRole = defineComponent({
  name: 'HasRole',
  props: {
    role: nameList,
    anyOf: nameList,
    allOf: nameList,
    not: { type: Boolean, default: false },
  },
  slots: Object as Slots,
  setup(props, { slots }) {
    const rbac = useRbac()
    return () => {
      if (rbac.loading.value) return null
      let allowed = true
      let checked = false
      if (props.role !== undefined) {
        checked = true
        allowed &&= rbac.hasAnyRole(props.role)
      }
      if (props.anyOf !== undefined) {
        checked = true
        allowed &&= rbac.hasAnyRole(props.anyOf)
      }
      if (props.allOf !== undefined) {
        checked = true
        allowed &&= rbac.hasAllRoles(props.allOf)
      }
      const pass = checked && allowed !== props.not
      return (pass ? slots.default?.() : slots.fallback?.()) ?? null
    }
  },
})
