// Type tests: the public types are part of the API. `pnpm typecheck` (tsc) enforces the
// `expectTypeOf` assertions and every `@ts-expect-error` below; vitest only runs the shells.
// Calls that only need type-checking live in functions that are never invoked.
import type { NuxtModule } from '@nuxt/schema'
import { createRbac, MemoryAdapter } from '@anievo-id/rbac-evolution'
import type { RbacSnapshot, SubjectRbac } from '@anievo-id/rbac-evolution'
import type { NameList, VueRbac } from '@anievo-id/rbac-evolution-vue'
import { createRbacState } from '@anievo-id/rbac-evolution-vue'
import type { H3Event } from 'h3'
import { describe, expectTypeOf, it } from 'vitest'
import type { ComputedRef, MaybeRefOrGetter } from 'vue'
import type { PageMeta } from '#app'
// `.` entry
import type {
  ModuleOptions,
  NuxtRbac,
  RbacPublicConfig,
  RbacRouteRule as RootRbacRouteRule,
  RouteRuleResult as RootRouteRuleResult,
} from '../src/module'
// `/rule` entry
import { evaluateRouteRule } from '../src/runtime/rule'
import type { RbacRouteRule, RouteRuleResult } from '../src/runtime/rule'
// `/server` entry
import { createRbacServer, RbacHttpError } from '../src/server'
import type {
  PermissionRequirementOptions,
  RbacErrorBody,
  RbacEvent,
  RbacServer,
  RbacServerOptions,
  RequirementKind,
  RequirementNames,
  RoleRequirementOptions,
} from '../src/server'
// auto-imported composables
import type * as composables from '../src/runtime/composables'

type ModuleDefault = (typeof import('../src/module'))['default']

describe('module options (`.`)', () => {
  it('the default export is a Nuxt module typed with ModuleOptions', () => {
    expectTypeOf<ModuleDefault>().toEqualTypeOf<NuxtModule<ModuleOptions>>()
    expectTypeOf<ModuleOptions>().not.toBeAny()
    expectTypeOf<Required<ModuleOptions>>().toEqualTypeOf<{
      wildcard: boolean
      superAdminRoles: string[]
      directives: boolean
      components: boolean
      globalProperties: boolean
      middleware: boolean
      unauthenticatedRedirect: string
      forbiddenRedirect: string
    }>()
    expectTypeOf<RbacPublicConfig>().toEqualTypeOf<Required<Omit<ModuleOptions, 'middleware'>>>()

    const options = (o: ModuleOptions) => o
    void function neverCalled() {
      options({})
      options({ wildcard: true, superAdminRoles: ['super-admin'], forbiddenRedirect: '/403' })
      // @ts-expect-error -- unknown option
      options({ wildCard: true })
      // @ts-expect-error -- exactOptionalPropertyTypes: options do not accept an explicit undefined
      options({ wildcard: undefined })
      // @ts-expect-error -- superAdminRoles is a list
      options({ superAdminRoles: 'super-admin' })
    }
  })
})

describe('route rules (`/rule`, re-exported from `.`)', () => {
  it('are real types, never `any` (they once silently became `any`, see the 0.7.0 changelog)', () => {
    expectTypeOf<RbacRouteRule>().not.toBeAny()
    expectTypeOf<RouteRuleResult>().not.toBeAny()
    expectTypeOf<RootRbacRouteRule>().not.toBeAny()
    expectTypeOf<RootRouteRuleResult>().not.toBeAny()
    expectTypeOf<NuxtRbac>().not.toBeAny()
    expectTypeOf<RbacPublicConfig>().not.toBeAny()
    expectTypeOf<RootRbacRouteRule>().toEqualTypeOf<RbacRouteRule>()
    expectTypeOf<RootRouteRuleResult>().toEqualTypeOf<RouteRuleResult>()
  })

  it('RbacRouteRule accepts names, pipes and arrays and rejects unknown keys', () => {
    expectTypeOf<RbacRouteRule['permission']>().toEqualTypeOf<string | readonly string[] | undefined>()
    expectTypeOf<RbacRouteRule['role']>().toEqualTypeOf<RequirementNames | undefined>()

    const rule = (r: RbacRouteRule) => r
    const rootRule = (r: RootRbacRouteRule) => r
    void function neverCalled() {
      rule({})
      rule({ permission: 'edit articles' })
      rule({ permission: 'edit articles|publish articles', role: ['writer', 'editor'], all: true })
      rule({ permission: ['a', 'b'] as const, any: true, redirect: '/403', guestRedirect: '/login' })
      rule({ roleOrPermission: 'admin' })
      // Requirement keys explicitly accept `undefined` (a missing config value fails closed at runtime).
      rule({ permission: undefined, role: undefined, roleOrPermission: undefined })

      // @ts-expect-error -- unknown property: a typo must not silently open the page
      rule({ permissions: 'edit articles' })
      // @ts-expect-error -- unknown property through the `.` entry too
      rootRule({ roles: 'admin' })
      // @ts-expect-error -- names are strings
      rule({ permission: 1 })
      // @ts-expect-error -- exactOptionalPropertyTypes: `any` does not accept an explicit undefined
      rule({ permission: 'a', any: undefined })
      // @ts-expect-error -- exactOptionalPropertyTypes: `redirect` does not accept an explicit undefined
      rule({ role: 'a', redirect: undefined })
    }
  })

  it('definePageMeta({ rbac }) is typed through the `#app` PageMeta augmentation', () => {
    expectTypeOf<PageMeta['rbac']>().toEqualTypeOf<RbacRouteRule | undefined>()
    const meta = (m: PageMeta) => m
    void function neverCalled() {
      meta({ rbac: { role: 'admin' } })
      // @ts-expect-error -- unknown key inside the page rule
      meta({ rbac: { roles: 'admin' } })
    }
  })

  it('evaluateRouteRule signature and its discriminated result', () => {
    expectTypeOf(evaluateRouteRule).parameters.toEqualTypeOf<[rbac: VueRbac, rule: RbacRouteRule, isGuest: boolean]>()
    expectTypeOf(evaluateRouteRule).returns.toEqualTypeOf<RouteRuleResult>()

    const result = evaluateRouteRule(createRbacState(), { permission: 'a' }, true)
    if (!result.ok) {
      expectTypeOf(result.status).toEqualTypeOf<401 | 403>()
      if (result.status === 403) {
        expectTypeOf(result.reason).toEqualTypeOf<RequirementKind>()
        expectTypeOf(result.message).toEqualTypeOf<string>()
      } else {
        expectTypeOf(result.error).toEqualTypeOf<'UNAUTHENTICATED'>()
        // @ts-expect-error -- a 401 result has no `reason`
        void result.reason
      }
    }
  })
})

describe('server helpers (`/server`)', () => {
  const rbac = createRbac({ adapter: new MemoryAdapter() })

  it('options: the event type flows from the generic into the callbacks', () => {
    type MyEvent = { context: Record<string, unknown>; userId?: number }
    const server = createRbacServer<MyEvent>({
      rbac,
      getSubject: (event) => {
        expectTypeOf(event).toEqualTypeOf<MyEvent>()
        return event.userId === undefined ? null : { type: 'user', id: event.userId }
      },
      guard: 'api',
      team: async () => 1,
      exposeRequirements: true,
    })
    expectTypeOf(server).toEqualTypeOf<RbacServer<MyEvent>>()
    expectTypeOf(server.resolve).parameter(0).toEqualTypeOf<MyEvent>()

    // Defaults to any `{ context }` object; a real h3 event fits.
    const h3Server = createRbacServer({ rbac, getSubject: () => null })
    expectTypeOf(h3Server).toEqualTypeOf<RbacServer<RbacEvent>>()
    expectTypeOf<H3Event>().toMatchTypeOf<RbacEvent>()

    const options = (o: RbacServerOptions) => o
    void function neverCalled() {
      // @ts-expect-error -- getSubject is required
      options({ rbac })
      // @ts-expect-error -- exactOptionalPropertyTypes: `guard` does not accept an explicit undefined
      options({ rbac, getSubject: () => null, guard: undefined })
      // @ts-expect-error -- `team` is a resolver function, not a value
      options({ rbac, getSubject: () => null, team: 1 })
      // @ts-expect-error -- the event must carry a context
      createRbacServer<{ path: string }>({ rbac, getSubject: () => null })
    }
  })

  it('require*(): names, pipes and arrays, then trailing options; resolves to SubjectRbac', () => {
    const server = createRbacServer({ rbac, getSubject: () => null })
    expectTypeOf(server.requirePermission).parameters.toEqualTypeOf<
      [event: RbacEvent, ...args: (RequirementNames | PermissionRequirementOptions)[]]
    >()
    expectTypeOf(server.requireRole).parameters.toEqualTypeOf<
      [event: RbacEvent, ...args: (RequirementNames | RoleRequirementOptions)[]]
    >()
    expectTypeOf(server.requireRoleOrPermission).parameters.toEqualTypeOf<
      [event: RbacEvent, ...names: RequirementNames[]]
    >()
    expectTypeOf(server.requirePermission).returns.toEqualTypeOf<Promise<SubjectRbac>>()
    expectTypeOf(server.canAny).returns.toEqualTypeOf<Promise<SubjectRbac>>()
    expectTypeOf(server.resolve).returns.toEqualTypeOf<Promise<SubjectRbac | null>>()
    expectTypeOf(server.snapshot).returns.toEqualTypeOf<Promise<RbacSnapshot | null>>()

    const event = { context: {} }
    void async function neverCalled() {
      await server.requirePermission(event, 'a', 'b|c', ['d', 'e'])
      await server.requirePermission(event, 'a', 'b', { any: true })
      // PermissionRequirementOptions / RoleRequirementOptions declare `| undefined`, so this is fine:
      await server.requirePermission(event, 'a', { any: undefined })
      await server.requireRole(event, 'writer', 'editor', { all: true })
      await server.canAll(event, ['a', 'b'] as const)

      // @ts-expect-error -- `all` is a role option, not a permission option
      await server.requirePermission(event, 'a', { all: true })
      // @ts-expect-error -- `any` is a permission option, not a role option
      await server.requireRole(event, 'a', { any: true })
      // @ts-expect-error -- requireRoleOrPermission takes no options
      await server.requireRoleOrPermission(event, 'a', { any: true })
      // @ts-expect-error -- the event comes first
      await server.requirePermission('a')
    }
  })

  it('RbacHttpError carries a typed status and body', () => {
    expectTypeOf<RbacHttpError['statusCode']>().toEqualTypeOf<401 | 403>()
    expectTypeOf<RbacHttpError['status']>().toEqualTypeOf<401 | 403>()
    expectTypeOf<RbacHttpError['data']>().toEqualTypeOf<RbacErrorBody>()
    expectTypeOf(RbacHttpError).constructorParameters.toEqualTypeOf<[data: RbacErrorBody]>()

    const body = (b: RbacErrorBody) => b
    void function neverCalled() {
      body({ error: 'UNAUTHENTICATED', message: 'x' })
      body({ error: 'FORBIDDEN', reason: 'role', message: 'x', required: [['a']] })
      // @ts-expect-error -- a FORBIDDEN body needs its reason
      body({ error: 'FORBIDDEN', message: 'x' })
      // @ts-expect-error -- reason is a RequirementKind
      body({ error: 'FORBIDDEN', reason: 'roles', message: 'x' })
    }
  })
})

describe('client runtime: useRbac() and auto-imported composables', () => {
  it('useRbac() returns the NuxtRbac instance (a VueRbac plus setSnapshot / isGuest)', () => {
    expectTypeOf<ReturnType<typeof composables.useRbac>>().toEqualTypeOf<NuxtRbac>()
    expectTypeOf<NuxtRbac>().toMatchTypeOf<VueRbac>()
    expectTypeOf<NuxtRbac['isGuest']>().toEqualTypeOf<() => boolean>()
    expectTypeOf<NuxtRbac['setSnapshot']>().parameter(0).toEqualTypeOf<RbacSnapshot | null>()
  })

  it('check composables accept a value, ref or getter and return ComputedRef<boolean>', () => {
    type Check = (names: MaybeRefOrGetter<NameList>) => ComputedRef<boolean>
    expectTypeOf<typeof composables.useCan>().toEqualTypeOf<Check>()
    expectTypeOf<typeof composables.useCannot>().toEqualTypeOf<Check>()
    expectTypeOf<typeof composables.useCanAny>().toEqualTypeOf<Check>()
    expectTypeOf<typeof composables.useCanAll>().toEqualTypeOf<Check>()
    expectTypeOf<typeof composables.useHasRole>().toEqualTypeOf<Check>()
    expectTypeOf<typeof composables.useHasAnyRole>().toEqualTypeOf<Check>()
    expectTypeOf<typeof composables.useHasAllRoles>().toEqualTypeOf<Check>()

    const useCan = (() => undefined) as unknown as typeof composables.useCan
    void function neverCalled() {
      useCan('a')
      useCan(['a', 'b'] as const)
      useCan(() => 'a')
      // @ts-expect-error -- names are strings
      useCan(1)
    }
  })
})
