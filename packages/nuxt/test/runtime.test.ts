import type { Rbac } from '@anievo-id/rbac-evolution'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useCan, useHasRole, useRbac } from '../src/runtime/composables'
import middleware from '../src/runtime/middleware'
import plugin from '../src/runtime/plugin'
import { STATE_KEY } from '../src/runtime/types'
import { createRbacServer } from '../src/server'
import { seededRbac } from './fixtures'
import { applyPlugin, createFakeNuxtApp, setRuntimeConfig, useState } from './mocks/app'

type FakePlugin = Parameters<typeof applyPlugin>[0]
type Middleware = (to: { path: string; meta: Record<string, unknown> }) => unknown
const run = middleware as unknown as Middleware

const baseConfig = {
  wildcard: false,
  superAdminRoles: [],
  directives: true,
  components: true,
  globalProperties: true,
  unauthenticatedRedirect: '',
  forbiddenRedirect: '',
}

describe('Nuxt runtime', () => {
  let rbac: Rbac

  beforeAll(async () => {
    rbac = await seededRbac()
  })

  beforeEach(() => {
    setRuntimeConfig({ public: { rbac: { ...baseConfig } } })
  })

  async function serverRender(user?: number) {
    const rbacServer = createRbacServer<{ context: Record<string, unknown>; user?: number | undefined }>({
      rbac,
      getSubject: (event) => (event.user === undefined ? null : { type: 'user', id: event.user }),
    })
    const event = { context: {} as Record<string, unknown>, user }
    await rbacServer.resolve(event) // what a Nitro server middleware does
    const app = createFakeNuxtApp({ event })
    await applyPlugin(plugin as unknown as FakePlugin, app)
    return app
  }

  it('hydrates the snapshot on the server from event.context.rbac', async () => {
    await serverRender(2)
    expect(useState(STATE_KEY, () => null).value).toEqual({
      roles: ['writer', 'editor'],
      permissions: ['edit articles', 'publish articles'],
    })
    expect(useRbac().can('publish articles')).toBe(true)
    expect(useRbac().isGuest()).toBe(false)
  })

  it('stores null for guests', async () => {
    await serverRender()
    expect(useState(STATE_KEY, () => 'unset').value).toBeNull()
    expect(useRbac().isGuest()).toBe(true)
  })

  it('hydrates the client from the useState payload and installs the Vue plugin', async () => {
    const app = createFakeNuxtApp({
      state: { [STATE_KEY]: { roles: ['writer'], permissions: ['edit articles'] } },
    })
    await applyPlugin(plugin as unknown as FakePlugin, app)

    expect(useRbac().can('edit articles')).toBe(true)
    expect(app.vueApp.directive('can')).toBeDefined()
    expect(app.vueApp.component('Can')).toBeDefined()
    expect(app.vueApp.config.globalProperties.$can('edit articles')).toBe(true)
  })

  it('reactive composables follow setSnapshot, which also updates the SSR state', async () => {
    await applyPlugin(plugin as unknown as FakePlugin, createFakeNuxtApp())
    const name = ref('edit articles')
    const can = useCan(name)
    const isAdmin = useHasRole('admin')
    expect(can.value).toBe(false)

    useRbac().setSnapshot({ roles: ['admin'], permissions: ['edit articles'] })
    expect(can.value).toBe(true)
    expect(isAdmin.value).toBe(true)
    expect(useState(STATE_KEY, () => null).value).toEqual({ roles: ['admin'], permissions: ['edit articles'] })

    name.value = 'delete articles'
    expect(can.value).toBe(false)

    useRbac().setSnapshot(null)
    expect(useRbac().isGuest()).toBe(true)
  })

  it('passes module options to the Vue plugin', async () => {
    setRuntimeConfig({ public: { rbac: { ...baseConfig, wildcard: true, superAdminRoles: ['boss'], directives: false } } })
    const app = createFakeNuxtApp({ state: { [STATE_KEY]: { roles: [], permissions: ['articles.*'] } } })
    await applyPlugin(plugin as unknown as FakePlugin, app)
    expect(useRbac().can('articles.edit')).toBe(true)
    expect(app.vueApp.directive('can')).toBeUndefined()
    useRbac().setSnapshot({ roles: ['boss'], permissions: [] })
    expect(useRbac().can('anything')).toBe(true)
  })

  describe('route middleware', () => {
    const to = (rbacRule?: Record<string, unknown>) => ({ path: '/page', meta: rbacRule ? { rbac: rbacRule } : {} })

    it('ignores routes without a rule', async () => {
      await serverRender()
      expect(run(to())).toBeUndefined()
    })

    it('aborts with 401 / 403 errors carrying the Express bodies', async () => {
      await serverRender()
      expect(run(to({ permission: 'edit articles' }))).toEqual({
        abort: {
          statusCode: 401,
          statusMessage: 'Unauthorized',
          data: { error: 'UNAUTHENTICATED', message: 'User is not logged in.' },
          isError: true,
        },
      })

      await serverRender(1)
      expect(run(to({ permission: 'edit articles' }))).toBeUndefined()
      expect(run(to({ role: 'admin' }))).toEqual({
        abort: {
          statusCode: 403,
          statusMessage: 'Forbidden',
          data: { error: 'FORBIDDEN', reason: 'role', message: 'User does not have the right roles.' },
          isError: true,
        },
      })
    })

    it('redirects with per-route or module-level targets', async () => {
      setRuntimeConfig({
        public: { rbac: { ...baseConfig, unauthenticatedRedirect: '/login', forbiddenRedirect: '/403' } },
      })
      await serverRender()
      expect(run(to({ role: 'admin' }))).toEqual({ navigateTo: '/login' })
      expect(run(to({ role: 'admin', guestRedirect: '/signin' }))).toEqual({ navigateTo: '/signin' })

      await serverRender(1)
      expect(run(to({ role: 'admin' }))).toEqual({ navigateTo: '/403' })
      expect(run(to({ role: 'admin', redirect: '/home' }))).toEqual({ navigateTo: '/home' })
      // no redirect loop onto the same page
      expect(run({ path: '/403', meta: { rbac: { role: 'admin' } } })).toMatchObject({ abort: { statusCode: 403 } })
    })
  })
})
