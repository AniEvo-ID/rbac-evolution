// What `nuxi prepare` generates for the module: its `rbac` key in nuxt.config.
import type { ModuleOptions } from '@anievo-id/rbac-evolution-nuxt'

declare module 'nuxt/schema' {
  interface NuxtConfig {
    rbac?: Partial<ModuleOptions>
  }
}
