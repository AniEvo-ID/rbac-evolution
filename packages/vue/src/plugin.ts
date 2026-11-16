import type { App, Plugin } from 'vue'
import { Can, HasRole } from './components'
import { createCanDirective, createRoleDirective } from './directives'
import { createRbacState, type NameList, RBAC_KEY, type RbacStateOptions, type VueRbac } from './state'

export interface RbacPluginOptions extends RbacStateOptions {
  /** Register `v-can` and `v-role` globally. Default: `true`. */
  directives?: boolean | undefined
  /** Register `<Can>` and `<HasRole>` globally. Default: `true`. */
  components?: boolean | undefined
  /** Add `$can`, `$canAny`, `$canAll`, `$hasRole`, `$hasAnyRole`, `$hasAllRoles`, `$rbac` to templates. Default: `true`. */
  globalProperties?: boolean | undefined
}

export type RbacPlugin = VueRbac & Plugin

/**
 * Creates the Vue plugin. The returned object is also the RBAC instance, so it can be used
 * outside components (router guards, stores):
 *
 * ```ts
 * export const rbac = createRbacPlugin({ snapshot: window.__RBAC__, wildcard: true })
 * app.use(rbac)
 * // later, after login:
 * rbac.setSnapshot(await api.get('/me/permissions'))
 * ```
 */
export function createRbacPlugin(options: RbacPluginOptions = {}): RbacPlugin {
  const rbac = createRbacState(options)

  return {
    ...rbac,
    install(app: App) {
      app.provide(RBAC_KEY, rbac)

      if (options.directives ?? true) {
        app.directive('can', createCanDirective(rbac))
        app.directive('role', createRoleDirective(rbac))
      }

      if (options.components ?? true) {
        app.component('Can', Can)
        app.component('HasRole', HasRole)
      }

      if (options.globalProperties ?? true) {
        const props = app.config.globalProperties
        props.$rbac = rbac
        props.$can = rbac.can
        props.$cannot = rbac.cannot
        props.$canAny = rbac.canAny
        props.$canAll = rbac.canAll
        props.$hasRole = rbac.hasRole
        props.$hasAnyRole = rbac.hasAnyRole
        props.$hasAllRoles = rbac.hasAllRoles
      }
    },
  }
}

declare module 'vue' {
  interface ComponentCustomProperties {
    $rbac: VueRbac
    $can: (permission: NameList) => boolean
    $cannot: (permission: NameList) => boolean
    $canAny: (permissions: NameList) => boolean
    $canAll: (permissions: NameList) => boolean
    $hasRole: (roles: NameList) => boolean
    $hasAnyRole: (roles: NameList) => boolean
    $hasAllRoles: (roles: NameList) => boolean
  }

  interface GlobalComponents {
    Can: typeof Can
    HasRole: typeof HasRole
  }

  interface GlobalDirectives {
    vCan: ReturnType<typeof createCanDirective>
    vRole: ReturnType<typeof createRoleDirective>
  }
}
