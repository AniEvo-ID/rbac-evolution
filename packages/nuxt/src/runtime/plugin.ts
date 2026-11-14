import type { RbacSnapshot } from '@anievo-id/rbac-evolution'
import { createRbacPlugin, type RbacPluginOptions } from '@anievo-id/rbac-evolution-vue'
import { defineNuxtPlugin, useRuntimeConfig, useState } from '#app'
import { type NuxtRbac, type RbacPublicConfig, STATE_KEY } from './types'

interface SnapshotSource {
  snapshot(): Promise<RbacSnapshot>
}

const isSnapshotSource = (value: unknown): value is SnapshotSource =>
  typeof value === 'object' && value !== null && typeof (value as Partial<SnapshotSource>).snapshot === 'function'

/**
 * Installs the Vue integration and hydrates the snapshot:
 * on the server from `event.context.rbac` (set by `createRbacServer().resolve(event)`),
 * on the client from the `useState` payload.
 */
export default defineNuxtPlugin({
  name: 'rbac-evolution',
  async setup(nuxtApp) {
    const config = (useRuntimeConfig().public['rbac'] ?? {}) as Partial<RbacPublicConfig>
    const state = useState<RbacSnapshot | null>(STATE_KEY, () => null)

    const event = nuxtApp.ssrContext?.event as { context?: Record<string, unknown> } | undefined
    if (event?.context) {
      const source = event.context['rbac']
      state.value = isSnapshotSource(source) ? await source.snapshot() : null
    }

    const options: RbacPluginOptions = {
      snapshot: state.value,
      wildcard: config.wildcard ?? false,
      superAdminRoles: config.superAdminRoles ?? [],
      directives: config.directives ?? true,
      components: config.components ?? true,
      globalProperties: config.globalProperties ?? true,
    }
    const plugin = createRbacPlugin(options)
    nuxtApp.vueApp.use(plugin)

    const { install: _install, ...vueRbac } = plugin
    const rbac: NuxtRbac = {
      ...vueRbac,
      setSnapshot(snapshot) {
        state.value = snapshot
        plugin.setSnapshot(snapshot)
      },
      isGuest: () => state.value === null,
    }

    return { provide: { rbac } }
  },
})
