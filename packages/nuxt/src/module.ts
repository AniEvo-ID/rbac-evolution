/**
 * @anievo-id/rbac-evolution-nuxt
 *
 * Nuxt 3/4 module: installs `@anievo-id/rbac-evolution-vue`, hydrates the snapshot from SSR,
 * auto-imports `useRbac()` / `useCan()` & co. and registers the `rbac` route middleware.
 */

import { addImports, addPlugin, addRouteMiddleware, createResolver, defineNuxtModule } from '@nuxt/kit'
import type { RbacRouteRule } from './runtime/rule.js'
import type { RbacPublicConfig } from './runtime/types.js'

export type { RbacRouteRule, RouteRuleResult } from './runtime/rule.js'
export type { NuxtRbac, RbacPublicConfig } from './runtime/types.js'

export interface ModuleOptions {
  /** Match permissions with wildcard semantics — must mirror `createRbac({ wildcard })`. Default: `false`. */
  wildcard?: boolean
  /** Roles that pass every permission check on the client. Default: `[]`. */
  superAdminRoles?: string[]
  /** Register `v-can` / `v-role`. Default: `true`. */
  directives?: boolean
  /** Register `<Can>` / `<HasRole>`. Default: `true`. */
  components?: boolean
  /** Add `$can`, `$hasRole`, … to templates. Default: `true`. */
  globalProperties?: boolean
  /** Register the global `rbac` route middleware for `definePageMeta({ rbac })`. Default: `true`. */
  middleware?: boolean
  /** Where the middleware sends guests. Default: `''` (show a 401 error). */
  unauthenticatedRedirect?: string
  /** Where the middleware sends users without access. Default: `''` (show a 403 error). */
  forbiddenRedirect?: string
}

/** Auto-imported composables. */
export const COMPOSABLES = [
  'useRbac',
  'useCan',
  'useCannot',
  'useCanAny',
  'useCanAll',
  'useHasRole',
  'useHasAnyRole',
  'useHasAllRoles',
] as const

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: '@anievo-id/rbac-evolution-nuxt',
    configKey: 'rbac',
    compatibility: { nuxt: '>=3.0.0' },
  },
  defaults: {
    wildcard: false,
    superAdminRoles: [],
    directives: true,
    components: true,
    globalProperties: true,
    middleware: true,
    unauthenticatedRedirect: '',
    forbiddenRedirect: '',
  },
  setup(options, nuxt) {
    const resolver = createResolver(import.meta.url)

    const config: RbacPublicConfig = {
      wildcard: options.wildcard ?? false,
      superAdminRoles: [...(options.superAdminRoles ?? [])],
      directives: options.directives ?? true,
      components: options.components ?? true,
      globalProperties: options.globalProperties ?? true,
      unauthenticatedRedirect: options.unauthenticatedRedirect ?? '',
      forbiddenRedirect: options.forbiddenRedirect ?? '',
    }
    const publicConfig = nuxt.options.runtimeConfig.public as Record<string, unknown>
    publicConfig['rbac'] = { ...config, ...(publicConfig['rbac'] as Partial<RbacPublicConfig> | undefined) }

    const runtimeDir = resolver.resolve('./runtime')
    nuxt.options.build.transpile.push(runtimeDir)

    addPlugin(resolver.resolve('./runtime/plugin'))
    addImports(COMPOSABLES.map((name) => ({ name, from: resolver.resolve('./runtime/composables') })))

    if (options.middleware ?? true) {
      addRouteMiddleware({ name: 'rbac', path: resolver.resolve('./runtime/middleware'), global: true })
    }
  },
})

declare module '#app' {
  interface PageMeta {
    /** Access rule enforced by the `rbac` route middleware of `@anievo-id/rbac-evolution-nuxt`. */
    rbac?: RbacRouteRule
  }
}
