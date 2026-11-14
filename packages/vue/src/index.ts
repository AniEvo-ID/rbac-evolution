/**
 * @anievo-id/rbac-evolution-vue
 *
 * Vue 3 bindings for rbac-evolution. Client-side checks are for UI only —
 * always enforce authorization on the server.
 */

export { createRbacPlugin } from './plugin'
export type { RbacPlugin, RbacPluginOptions } from './plugin'

export { createRbacState, RBAC_KEY } from './state'
export type { NameList, RbacStateOptions, VueRbac } from './state'

export {
  useCan,
  useCanAll,
  useCanAny,
  useCannot,
  useHasAllRoles,
  useHasAnyRole,
  useHasRole,
  useRbac,
} from './composables'

export { createCanDirective, createRoleDirective } from './directives'
export { Can, HasRole } from './components'

export type { RbacSnapshot } from '@anievo-id/rbac-evolution'
