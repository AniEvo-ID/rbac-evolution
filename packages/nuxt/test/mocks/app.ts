// Minimal stand-in for Nuxt's `#app`, aliased in vitest.config.ts.
import { type App, createApp, type Ref, ref } from 'vue'

interface FakeNuxtApp {
  vueApp: App
  ssrContext?: { event: { context: Record<string, unknown> } }
  payload: { state: Record<string, unknown> }
  [key: `$${string}`]: unknown
}

let current: FakeNuxtApp | undefined
let runtimeConfig: { public: Record<string, unknown> } = { public: {} }

export function createFakeNuxtApp(options: { event?: { context: Record<string, unknown> }; state?: Record<string, unknown> } = {}): FakeNuxtApp {
  current = {
    vueApp: createApp({ render: () => null }),
    payload: { state: { ...options.state } },
    ...(options.event && { ssrContext: { event: options.event } }),
  }
  return current
}

export function setRuntimeConfig(config: { public: Record<string, unknown> }): void {
  runtimeConfig = config
}

export const useNuxtApp = (): FakeNuxtApp => {
  if (!current) throw new Error('no nuxt app')
  return current
}

export const useRuntimeConfig = () => runtimeConfig

const refs = new WeakMap<FakeNuxtApp, Map<string, Ref<unknown>>>()

export function useState<T>(key: string, init: () => T): Ref<T> {
  const app = useNuxtApp()
  const map = refs.get(app) ?? new Map<string, Ref<unknown>>()
  refs.set(app, map)
  let state = map.get(key)
  if (!state) {
    state = ref(key in app.payload.state ? app.payload.state[key] : init())
    map.set(key, state)
  }
  return state as Ref<T>
}

interface PluginDefinition {
  setup: (nuxtApp: FakeNuxtApp) => Promise<{ provide?: Record<string, unknown> } | void>
}

export const defineNuxtPlugin = (plugin: PluginDefinition) => plugin

/** Runs a plugin like Nuxt does: `provide` entries become `$name` on the app. */
export async function applyPlugin(plugin: PluginDefinition, app: FakeNuxtApp): Promise<void> {
  const result = await plugin.setup(app)
  for (const [name, value] of Object.entries(result?.provide ?? {})) app[`$${name}`] = value
}

export const defineNuxtRouteMiddleware = <T>(middleware: T) => middleware

export const navigateTo = (to: string) => ({ navigateTo: to })

export const abortNavigation = (error: unknown) => ({ abort: error })

export const createError = (input: Record<string, unknown>) => ({ ...input, isError: true })
