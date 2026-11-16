// Type tests: the public types are part of the API. `pnpm typecheck` (svelte-check, which type-checks the `.ts`
// files too) enforces the `expectTypeOf` assertions and every `@ts-expect-error` below; vitest only runs the shells.
// Calls that only need type-checking live in functions that are never invoked.
import { createRbac, MemoryAdapter } from '@anievo-id/rbac-evolution'
import type { RbacSnapshot, SubjectRbac } from '@anievo-id/rbac-evolution'
import type { RequestEvent, ServerLoadEvent } from '@sveltejs/kit'
import type { sequence } from '@sveltejs/kit/hooks'
import { error, redirect } from '@sveltejs/kit'
import type { Component, Snippet } from 'svelte'
import { describe, expectTypeOf, it } from 'vitest'
// `.` entry
import {
  Can,
  type CanProps,
  createRbacChecker,
  createRbacState,
  getRbacContext,
  HasRole,
  type HasRoleProps,
  type NameList,
  type RbacChecker,
  type SvelteRbac,
  setRbacContext,
} from '../src/index.js'
// `/server` entry
import {
  canAny,
  createGuards,
  getRbac,
  getSnapshot,
  type GuardContext,
  type Guards,
  type RbacErrorBody,
  type RbacHandle,
  type RbacLocals,
  rbacHandle,
  requirePermission,
  requireRole,
  type ScopedGuards,
} from '../src/server/index.js'

type AppRbac = {
  permissions: 'articles.edit' | 'articles.publish'
  roles: 'admin' | 'editor'
}

type GuardedRbac = {
  guards: {
    web: { roles: 'admin' | 'editor'; permissions: 'articles.edit' | 'api-keys.manage' }
    api: { roles: 'read-only' | 'full-access'; permissions: 'orders.read' | 'orders.write' }
  }
  defaultGuard: 'web'
}

/** SvelteKit's `Handle` (from `@sveltejs/kit` in SvelteKit 2, `@sveltejs/kit/hooks` in 3). */
type Handle = Parameters<typeof sequence>[0]

const untyped = createRbac({ adapter: new MemoryAdapter() })
const typed = createRbac<AppRbac>({ adapter: new MemoryAdapter() })
const guarded = createRbac<GuardedRbac>({ adapter: new MemoryAdapter() })
// Only `getRbac()` runs; the promise-returning helpers are type-checked inside arrows that never run.
const event = { locals: { rbac: null } } as unknown as RequestEvent

describe('rbacHandle', () => {
  it('returns a SvelteKit Handle and checks the guard of a per-guard engine', () => {
    expectTypeOf(rbacHandle({ rbac: untyped, getSubject: () => null })).toEqualTypeOf<RbacHandle>()
    expectTypeOf<RbacHandle>().toMatchTypeOf<Handle>()
    void function neverCalled() {
      rbacHandle({
        rbac: typed,
        getSubject: (e) => {
          expectTypeOf(e).toEqualTypeOf<RequestEvent>()
          return { type: 'user', id: 1 }
        },
        guard: 'api',
        team: async () => 1,
      })
      rbacHandle({ rbac: guarded, guard: 'api', getSubject: () => null })
      // @ts-expect-error -- not a typed guard
      rbacHandle({ rbac: guarded, guard: 'apii', getSubject: () => null })
      // @ts-expect-error -- getSubject is required
      rbacHandle({ rbac: untyped })
      // @ts-expect-error -- `team` is a resolver function, not a value
      rbacHandle({ rbac: untyped, getSubject: () => null, team: 1 })
    }
  })

  it('RbacLocals types event.locals.rbac (for the App.Locals augmentation)', () => {
    expectTypeOf<RbacLocals['rbac']>().toEqualTypeOf<SubjectRbac | null>()
    expectTypeOf<RbacLocals<AppRbac>['rbac']>().toEqualTypeOf<SubjectRbac<AppRbac> | null>()
    expectTypeOf<RbacLocals<typeof typed>['rbac']>().toEqualTypeOf<SubjectRbac<AppRbac> | null>()
    expectTypeOf<RbacLocals<GuardedRbac, 'api'>['rbac']>().toEqualTypeOf<SubjectRbac<GuardedRbac, 'api'> | null>()
    expectTypeOf(getRbac(event)).toEqualTypeOf<SubjectRbac | null>()
    expectTypeOf(getRbac<AppRbac>(event)).toEqualTypeOf<SubjectRbac<AppRbac> | null>()
  })

  it('getSnapshot returns a snapshot or null, with typed checkBefore', () => {
    expectTypeOf(() => getSnapshot(event)).returns.toEqualTypeOf<Promise<RbacSnapshot | null>>()
    void function neverCalled() {
      void getSnapshot(event, { checkBefore: ['anything'], guard: 'api' })
      void getSnapshot<AppRbac>(event, { checkBefore: ['articles.edit'] })
      // @ts-expect-error -- not a permission of AppRbac
      void getSnapshot<AppRbac>(event, { checkBefore: ['articles.edti'] })
    }
  })
})

describe('guards', () => {
  it('default guards take any name and resolve to the subject', () => {
    expectTypeOf(() => requirePermission(event, 'x')).returns.toEqualTypeOf<Promise<SubjectRbac>>()
    void async function neverCalled() {
      await requirePermission(event, 'a', 'b|c', ['d', 'e'], { any: true, guard: 'api' })
      await requireRole(event, 'a', 'b', { all: true, forbiddenRedirect: '/403', exposeRequirements: true })
      await canAny(event, 'a', 'b', { onForbidden: () => error(404, 'Not found') })
      // @ts-expect-error -- at least one name
      await requirePermission(event)
      // @ts-expect-error -- options must be last
      await requirePermission(event, { any: true }, 'a')
      // @ts-expect-error -- roles take `all`, not `any`
      await requireRole(event, 'a', { any: true })
      // @ts-expect-error -- the event comes first
      await requirePermission('a')
    }
  })

  it('accept the events of server loads, actions and endpoints', () => {
    expectTypeOf<ServerLoadEvent<{ id: string }, Record<string, unknown>, '/articles/[id]'>>().toMatchTypeOf<RequestEvent>()
    expectTypeOf<RequestEvent<{ id: string }, '/api/articles/[id]'>>().toMatchTypeOf<RequestEvent>()
  })

  it('handlers get the event and the failed requirement, and must throw', () => {
    void function neverCalled() {
      createGuards({
        onUnauthenticated: (e, context) => {
          expectTypeOf(e).toEqualTypeOf<RequestEvent>()
          expectTypeOf(context).toEqualTypeOf<GuardContext>()
          return redirect(303, `/login?redirectTo=${e.url.pathname}`)
        },
        onForbidden: async () => {
          throw error(403, 'Forbidden')
        },
        unauthenticatedRedirect: '/login',
        exposeRequirements: undefined,
      })
      // @ts-expect-error -- a handler must throw (redirect() / error()), not return a value
      createGuards({ onForbidden: () => 'nope' })
    }
  })

  it('createGuards<T>() checks names, part by part', () => {
    const guards = createGuards<AppRbac>()
    expectTypeOf(guards).toEqualTypeOf<Guards<AppRbac>>()
    expectTypeOf(createGuards<typeof typed>()).toEqualTypeOf<Guards<AppRbac>>()
    expectTypeOf(() => guards.requireRole(event, 'admin')).returns.toEqualTypeOf<Promise<SubjectRbac<AppRbac>>>()
    void async function neverCalled() {
      await guards.requirePermission(event, 'articles.edit|articles.publish', ['articles.edit'])
      await guards.requireRoleOrPermission(event, 'admin|articles.edit')
      await guards.canAll(event, 'articles.edit', { guard: 'api' })
      // @ts-expect-error -- typo in a permission
      await guards.requirePermission(event, 'articles.edti')
      // @ts-expect-error -- typo in one part of a pipe list
      await guards.requireRole(event, 'admin|edtor')
      // @ts-expect-error -- a role is not a permission
      await guards.canAny(event, 'admin')
      const subject = await guards.requirePermission(event, 'articles.edit')
      // @ts-expect-error -- the subject has the typed names too
      await subject.can('articles.pubish')
    }
  })

  it('createGuards<T, G>() takes the names of the request’s guard, or of a call’s { guard }', () => {
    const web = createGuards<GuardedRbac>()
    const api = createGuards<GuardedRbac, 'api'>()
    expectTypeOf(api).toEqualTypeOf<ScopedGuards<GuardedRbac, 'api'>>()
    expectTypeOf(() => api.requirePermission(event, 'orders.read')).returns.toEqualTypeOf<Promise<SubjectRbac<GuardedRbac, 'api'>>>()
    expectTypeOf(() => api.requireRole(event, 'admin', { guard: 'web' })).returns.toEqualTypeOf<Promise<SubjectRbac<GuardedRbac, 'web'>>>()
    void async function neverCalled() {
      await web.requirePermission(event, 'api-keys.manage')
      await api.requireRole(event, 'read-only|full-access')
      // @ts-expect-error -- a `web` permission in guard `api`
      await api.requirePermission(event, 'api-keys.manage')
      // @ts-expect-error -- an `api` permission in guard `web`
      await web.requirePermission(event, 'orders.read')
      await web.requirePermission(event, 'orders.read', { guard: 'api' })
      // @ts-expect-error -- not a typed guard
      await web.requirePermission(event, 'orders.read', { guard: 'apii' })
      // @ts-expect-error -- not a typed guard
      createGuards<GuardedRbac, 'apii'>()
    }
  })

  it('RbacErrorBody is the Express body', () => {
    expectTypeOf<RbacErrorBody>().toEqualTypeOf<
      | { error: 'UNAUTHENTICATED'; message: string }
      | { error: 'FORBIDDEN'; reason: 'permission' | 'role' | 'role_or_permission'; message: string; required?: string[][] }
    >()
  })
})

describe('client', () => {
  it('exports the components and the context API', () => {
    expectTypeOf(Can).toEqualTypeOf<Component<CanProps>>()
    expectTypeOf(HasRole).toEqualTypeOf<Component<HasRoleProps>>()
    expectTypeOf<CanProps['permission']>().toEqualTypeOf<NameList | undefined>()
    expectTypeOf<HasRoleProps['role']>().toEqualTypeOf<NameList | undefined>()
    expectTypeOf<CanProps['fallback']>().toEqualTypeOf<Snippet | undefined>()
    expectTypeOf(createRbacChecker(null)).toEqualTypeOf<RbacChecker>()
    expectTypeOf(setRbacContext).parameter(0).toEqualTypeOf<
      RbacSnapshot | null | undefined | (() => RbacSnapshot | null | undefined)
    >()
    expectTypeOf(createRbacState(null)).toEqualTypeOf<SvelteRbac>()
  })

  it('getRbacContext<T>() checks names; any string without T', () => {
    void function neverCalled() {
      const rbac = getRbacContext()
      rbac.can('anything')
      rbac.hasRole('a|b')
      const app = getRbacContext<AppRbac>()
      app.can('articles.edit')
      app.canAll(['articles.edit', 'articles.publish'])
      app.hasRole('admin|editor')
      app.hasAllRoles(['admin', 'editor'])
      // @ts-expect-error -- typo in a permission
      app.can('articles.edti')
      // @ts-expect-error -- typo in one part of a pipe list
      app.hasRole('admin|edtor')
      // @ts-expect-error -- a role is not a permission
      app.canAny(['admin'])
      const api = getRbacContext<GuardedRbac, 'api'>()
      api.can('orders.read')
      // @ts-expect-error -- a `web` permission in guard `api`
      api.can('api-keys.manage')
      expectTypeOf(setRbacContext<typeof typed>(null)).toEqualTypeOf<SvelteRbac<typeof typed>>()
    }
  })
})
