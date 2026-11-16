/**
 * Type tests: the public types are part of the API. Enforced by `tsc --noEmit` (`pnpm typecheck`),
 * which includes `test/`; `expectTypeOf` and `@ts-expect-error` lines fail the typecheck when a type drifts.
 * Calls that would do real work live in functions that are never invoked.
 * Complements `types-check.ts` (custom env + chained app compile checks).
 */
import {
  createRbac,
  type DefaultRbacTypes,
  MemoryAdapter,
  type Rbac,
  type Subject,
  type SubjectRbac,
  type TeamId,
} from '@anievo-id/rbac-evolution'
import { type Context, type Env, Hono, type MiddlewareHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { describe, expectTypeOf, it } from 'vitest'
import {
  canAll,
  canAny,
  createGuards,
  type Guard,
  type GuardContext,
  type GuardHandler,
  type GuardHandlerContext,
  type GuardHandlers,
  type GuardKind,
  type GuardNames,
  type Guards,
  type GuardsFor,
  type PermissionGuardOptions,
  type RbacEnv,
  rbacMiddleware,
  type RbacMiddlewareOptions,
  RbacMiddlewareMissingError,
  type RbacVariables,
  requirePermission,
  requireRole,
  requireRoleOrPermission,
  type RoleGuardOptions,
  type RoleOrPermissionGuardOptions,
  type RouteGuardOptions,
  type ScopedGuard,
  type ScopedGuards,
} from '../src'

const rbac = createRbac({ adapter: new MemoryAdapter() })
const guest = () => null

type User = { id: number }
type UserEnv = { Variables: { user: User | undefined } }

describe('hono types: env & variables', () => {
  it('declares c.var.rbac as SubjectRbac | null', () => {
    expectTypeOf<RbacVariables>().toEqualTypeOf<{ rbac: SubjectRbac | null }>()
    expectTypeOf<RbacEnv>().toEqualTypeOf<{ Variables: RbacVariables }>()
    expectTypeOf<Context<RbacEnv>['var']['rbac']>().toEqualTypeOf<SubjectRbac | null>()
  })

  it('types c.var.rbac in apps typed with RbacEnv', () => {
    function routes() {
      new Hono<RbacEnv>().get('/', async (c) => {
        expectTypeOf(c.var.rbac).toEqualTypeOf<SubjectRbac | null>()
        expectTypeOf(c.get('rbac')).toEqualTypeOf<SubjectRbac | null>()
        return c.json(c.var.rbac ? c.var.rbac.snapshot() : null)
      })
    }
    expectTypeOf(routes).toBeFunction()
  })

  it('adds c.var.rbac after .use(rbacMiddleware()) and after a guard, even on an untyped app', () => {
    function routes() {
      new Hono().use(rbacMiddleware({ rbac, getSubject: guest })).get('/', (c) => {
        expectTypeOf(c.var.rbac).toEqualTypeOf<SubjectRbac | null>()
        return c.text('ok')
      })
      new Hono().get('/guarded', requireRole('admin'), (c) => {
        expectTypeOf(c.var.rbac).toEqualTypeOf<SubjectRbac | null>()
        return c.text('ok')
      })
    }
    expectTypeOf(routes).toBeFunction()
  })
})

describe('hono types: rbacMiddleware()', () => {
  it('returns a middleware that adds RbacEnv to the given env', () => {
    expectTypeOf(rbacMiddleware<UserEnv>).parameter(0).toEqualTypeOf<RbacMiddlewareOptions<UserEnv>>()
    expectTypeOf(rbacMiddleware<UserEnv>).returns.toEqualTypeOf<MiddlewareHandler<UserEnv & RbacEnv>>()
    expectTypeOf(rbacMiddleware<Env, DefaultRbacTypes>).returns.toEqualTypeOf<MiddlewareHandler<Env & RbacEnv>>()
  })

  it('types the options', () => {
    type O = RbacMiddlewareOptions<UserEnv>
    expectTypeOf<O['rbac']>().toEqualTypeOf<Rbac>()
    expectTypeOf<O['getSubject']>().parameters.toEqualTypeOf<[Context<UserEnv>]>()
    expectTypeOf<O['getSubject']>().returns.toEqualTypeOf<Subject | null | undefined | Promise<Subject | null | undefined>>()
    expectTypeOf<O['team']>().toEqualTypeOf<
      ((c: Context<UserEnv>) => TeamId | undefined | Promise<TeamId | undefined>) | undefined
    >()
    expectTypeOf<O>().toHaveProperty('guard').toEqualTypeOf<string | undefined>()
  })

  it('accepts sync and async getSubject returning a subject, null or undefined', () => {
    rbacMiddleware({ rbac, getSubject: () => ({ type: 'user', id: 1 }) })
    rbacMiddleware({ rbac, getSubject: guest, guard: 'api', team: () => 1 })
    rbacMiddleware({ rbac, getSubject: () => undefined, team: async () => null })
    rbacMiddleware<UserEnv>({
      rbac,
      getSubject: async (c) => {
        expectTypeOf(c.var.user).toEqualTypeOf<User | undefined>()
        return c.var.user ? { type: 'user', id: c.var.user.id } : null
      },
      team: (c) => c.req.header('x-team'),
    })
    const typed = createRbac<{ permissions: 'edit articles'; roles: 'writer' }>({ adapter: new MemoryAdapter() })
    rbacMiddleware({ rbac: typed, getSubject: guest })
  })

  it('rejects invalid options', () => {
    function invalid() {
      // @ts-expect-error -- `rbac` is required
      rbacMiddleware({ getSubject: guest })
      // @ts-expect-error -- `getSubject` is required
      rbacMiddleware({ rbac })
      // @ts-expect-error -- a subject needs `type` and `id`
      rbacMiddleware({ rbac, getSubject: () => ({ type: 'user' }) })
      // @ts-expect-error -- unknown variable on the typed env
      rbacMiddleware<UserEnv>({ rbac, getSubject: (c) => c.var.nope })
      // @ts-expect-error -- team ids are string | number | null
      rbacMiddleware({ rbac, getSubject: guest, team: () => ({}) })
      // exactOptionalPropertyTypes: an explicit `undefined` is accepted, same as leaving the option out
      rbacMiddleware({ rbac, getSubject: guest, guard: undefined })
    }
    expectTypeOf(invalid).toBeFunction()
  })
})

describe('hono types: guards', () => {
  it('return MiddlewareHandler<RbacEnv>', () => {
    for (const guard of [requirePermission, requireRole, requireRoleOrPermission, canAny, canAll]) {
      expectTypeOf(guard).returns.toEqualTypeOf<MiddlewareHandler<RbacEnv>>()
    }
  })

  it('accept names, pipe strings, arrays and a trailing options object', () => {
    function valid() {
      requirePermission('edit articles')
      requirePermission('edit articles|delete articles')
      requirePermission('edit articles', 'publish articles')
      requirePermission(['edit articles', 'publish articles'] as const)
      requirePermission(['edit articles'], 'publish articles', { any: true })
      requirePermission('edit articles', { any: false, exposeRequirements: true })
      requireRole('admin')
      requireRole('admin|editor')
      requireRole('admin', 'editor', { all: true })
      requireRole(['admin', 'editor'], { onForbidden: (c) => c.notFound() })
      requireRoleOrPermission('admin|edit articles')
      requireRoleOrPermission(['admin', 'edit articles'], { exposeRequirements: true })
      canAny('edit articles', 'publish articles')
      canAny(['edit articles'], { onUnauthenticated: (c) => c.redirect('/login') })
      canAll('edit articles', 'publish|review')
      const names: GuardNames[] = ['a', ['b', 'c']]
      requirePermission(...names)
    }
    expectTypeOf(valid).toBeFunction()
  })

  it('compose with apps that have their own env', () => {
    function routes() {
      new Hono<{ Variables: RbacVariables & { user: User } }>().get('/', canAll('a', 'b'), (c) => {
        expectTypeOf(c.var.user).toEqualTypeOf<User>()
        expectTypeOf(c.var.rbac).toEqualTypeOf<SubjectRbac | null>()
        return c.text('ok')
      })
      new Hono<{ Bindings: { DB: string } }>().use('/admin/*', requireRole('admin'))
    }
    expectTypeOf(routes).toBeFunction()
  })

  it('rejects wrong arguments', () => {
    function invalid() {
      // @ts-expect-error -- names are strings
      requirePermission(1)
      // @ts-expect-error -- `all` is a role option
      requirePermission('edit articles', { all: true })
      // @ts-expect-error -- `any` is a permission option
      requireRole('admin', { any: true })
      // @ts-expect-error -- role-or-permission has no any/all option
      requireRoleOrPermission('admin', { any: true })
      // exactOptionalPropertyTypes: an explicit `undefined` is accepted, same as leaving the option out
      requirePermission('a', { any: undefined })
      // exactOptionalPropertyTypes: an explicit `undefined` is accepted, same as leaving the option out
      requireRole('a', { onForbidden: undefined })
      // @ts-expect-error -- hooks must return a Response (unlike Express/Fastify)
      requireRole('a', { onForbidden: () => 'forbidden' })
      // @ts-expect-error -- hooks must return a Response, not void
      canAny('a', { onUnauthenticated: () => {} })
    }
    expectTypeOf(invalid).toBeFunction()
  })
})

describe('hono types: hooks & failure details', () => {
  it('types GuardContext and GuardHandler', () => {
    expectTypeOf<GuardKind>().toEqualTypeOf<'permission' | 'role' | 'role_or_permission'>()
    expectTypeOf<GuardContext>().toEqualTypeOf<{ kind: GuardKind; requirements: string[][] }>()
    expectTypeOf<GuardHandler>().parameters.toEqualTypeOf<[Context, GuardContext]>()
    expectTypeOf<GuardHandler>().returns.toEqualTypeOf<Response | Promise<Response>>()
  })

  it('types the handler options', () => {
    expectTypeOf<GuardHandlers>().toEqualTypeOf<{
      onUnauthenticated?: GuardHandler
      onForbidden?: GuardHandler
      exposeRequirements?: boolean
    }>()
    expectTypeOf<PermissionGuardOptions>().toEqualTypeOf<{
      onUnauthenticated?: GuardHandler
      onForbidden?: GuardHandler
      exposeRequirements?: boolean
      guard?: string
      any?: boolean
    }>()
    expectTypeOf<RoleGuardOptions>().toEqualTypeOf<{
      onUnauthenticated?: GuardHandler
      onForbidden?: GuardHandler
      exposeRequirements?: boolean
      guard?: string
      all?: boolean
    }>()
    expectTypeOf<RouteGuardOptions>().toEqualTypeOf<{
      onUnauthenticated?: GuardHandler
      onForbidden?: GuardHandler
      exposeRequirements?: boolean
      guard?: string
    }>()
    expectTypeOf<RoleOrPermissionGuardOptions>().toEqualTypeOf<RouteGuardOptions>()
  })

  it('infers hook arguments contextually (return a Response or throw)', () => {
    createGuards({
      onUnauthenticated: (c, context) => {
        expectTypeOf(c).toEqualTypeOf<Context>()
        expectTypeOf(context.kind).toEqualTypeOf<GuardKind>()
        return c.json({ error: 'login' }, 401)
      },
      onForbidden: async (_c, { requirements }) => {
        expectTypeOf(requirements).toEqualTypeOf<string[][]>()
        throw new HTTPException(403)
      },
      exposeRequirements: true,
    })
    // @ts-expect-error -- `exposeRequirements` is a boolean
    createGuards({ exposeRequirements: 'yes' })
  })

  it('createGuards() returns the same guard set', () => {
    const guards = createGuards()
    expectTypeOf(guards.requirePermission).toEqualTypeOf(requirePermission)
    expectTypeOf(guards.requireRole).toEqualTypeOf(requireRole)
    expectTypeOf(guards.requireRoleOrPermission).toEqualTypeOf(requireRoleOrPermission)
    expectTypeOf(guards.canAny).toEqualTypeOf(canAny)
    expectTypeOf(guards.canAll).toEqualTypeOf(canAll)
  })
})

type AppTypes = { permissions: 'edit articles' | 'delete articles' | 'publish articles'; roles: 'admin' | 'editor' }
type AppPermission = 'edit articles' | 'delete articles' | 'publish articles'
type AppRole = 'admin' | 'editor'

describe('hono types: typed names (createGuards<T>())', () => {
  const typed = createGuards<AppTypes>()

  it('types the guards with the names of T', () => {
    expectTypeOf(typed).toEqualTypeOf<Guards<AppTypes>>()
    type C = GuardHandlerContext<AppTypes>
    type E = RbacEnv<AppTypes>
    expectTypeOf(typed.requirePermission).toEqualTypeOf<Guard<AppPermission, PermissionGuardOptions<C>, E>>()
    expectTypeOf(typed.requireRole).toEqualTypeOf<Guard<AppRole, RoleGuardOptions<C>, E>>()
    expectTypeOf(typed.requireRoleOrPermission).toEqualTypeOf<
      Guard<AppPermission | AppRole, RoleOrPermissionGuardOptions<C>, E>
    >()
    expectTypeOf(typed.canAny).toEqualTypeOf<Guard<AppPermission, RouteGuardOptions<C>, E>>()
    expectTypeOf(typed.canAll).toEqualTypeOf<Guard<AppPermission, RouteGuardOptions<C>, E>>()
    // The defaults (and `createGuards()`) accept any string.
    expectTypeOf(createGuards()).toEqualTypeOf<Guards>()
    expectTypeOf(requirePermission).toEqualTypeOf<Guard<string, PermissionGuardOptions>>()
  })

  it('also takes the engine type: createGuards<typeof rbac>()', () => {
    const engine = createRbac<AppTypes>({ adapter: new MemoryAdapter() })
    expectTypeOf(createGuards<typeof engine>()).toEqualTypeOf<Guards<AppTypes>>()
    expectTypeOf(createGuards<typeof rbac>()).toEqualTypeOf<Guards>()
    // A config with only roles keeps permissions untyped.
    type RolesOnly = { roles: AppRole }
    expectTypeOf(createGuards<RolesOnly>().requirePermission).toEqualTypeOf<
      Guard<string, PermissionGuardOptions<GuardHandlerContext<RolesOnly>>, RbacEnv<RolesOnly>>
    >()
    function invalid() {
      // @ts-expect-error -- not a type config
      createGuards<{ permissions: 1 }>()
    }
    expectTypeOf(invalid).toBeFunction()
  })

  it('accept typed names, pipe lists, arrays and a trailing options object', () => {
    function valid() {
      typed.requirePermission('edit articles')
      typed.requirePermission('edit articles|delete articles', 'publish articles')
      typed.requirePermission('edit articles | delete articles')
      typed.requirePermission(['edit articles', 'delete articles'], { any: true })
      typed.requireRole('admin|editor', { all: true })
      typed.requireRole(['admin'], { onForbidden: (c) => c.notFound() })
      typed.requireRoleOrPermission('admin|edit articles', { exposeRequirements: true })
      typed.canAny('edit articles', 'publish articles')
      typed.canAny(['edit articles'], { onUnauthenticated: (c) => c.redirect('/login') })
      typed.canAll(['edit articles', 'publish articles|delete articles'])
      // Spread `string[]` arguments are not checked.
      const spread: string[] = ['anything']
      typed.requirePermission(...spread)
    }
    expectTypeOf(valid).toBeFunction()
  })

  it('reject unknown names, calls without names and options that are not last', () => {
    function invalid() {
      // @ts-expect-error -- typo
      typed.requirePermission('edit artciles')
      // @ts-expect-error -- typo inside a pipe list
      typed.requirePermission('edit articles|delte articles')
      // @ts-expect-error -- typo inside an array
      typed.requirePermission(['edit articles', 'nope'], { any: true })
      // @ts-expect-error -- a role is not a permission
      typed.requirePermission('admin')
      // @ts-expect-error -- a permission is not a role
      typed.requireRole('edit articles')
      // @ts-expect-error -- unknown role or permission
      typed.requireRoleOrPermission('admin|ghost')
      // @ts-expect-error -- canAny/canAll take permissions
      typed.canAny('admin')
      // @ts-expect-error -- typo
      typed.canAll('edit articles', 'publsh articles')
      // @ts-expect-error -- no names
      typed.requireRole()
      // @ts-expect-error -- options before a name
      typed.requirePermission({ any: true }, 'edit articles')
    }
    expectTypeOf(invalid).toBeFunction()
  })

  it('the default guards accept any string, but still need names and trailing options', () => {
    function check() {
      requirePermission('anything at all', 'x|y', ['z'], { any: true })
      requireRole('whatever')
      requireRoleOrPermission('who|knows')
      canAny('a', 'b')
      canAll(['a'])
      // @ts-expect-error -- no names
      requirePermission()
      // @ts-expect-error -- no names
      canAny()
      // @ts-expect-error -- options before a name
      requireRole({ all: true }, 'admin')
    }
    expectTypeOf(check).toBeFunction()
  })
})

describe('hono types: typed request helpers', () => {
  const engine = createRbac<AppTypes>({ adapter: new MemoryAdapter() })
  type AppEnv = { Variables: RbacVariables<typeof engine> & { user: User | undefined } }

  it('RbacVariables<T> / RbacEnv<T> take a names type or typeof rbac; untyped by default', () => {
    expectTypeOf<RbacVariables<AppTypes>>().toEqualTypeOf<{ rbac: SubjectRbac<AppTypes> | null }>()
    expectTypeOf<RbacVariables<typeof engine>>().toEqualTypeOf<{ rbac: SubjectRbac<AppTypes> | null }>()
    expectTypeOf<RbacEnv<typeof engine>>().toEqualTypeOf<{ Variables: RbacVariables<AppTypes> }>()
    expectTypeOf<RbacEnv<typeof rbac>['Variables']['rbac']>().toEqualTypeOf<SubjectRbac | null>()
    // @ts-expect-error -- not a type config
    expectTypeOf<RbacEnv<{ roles: 1 }>>()
  })

  it('rbacMiddleware() infers the names from `rbac` and adds a typed c.var.rbac', () => {
    expectTypeOf(rbacMiddleware({ rbac: engine, getSubject: guest })).toEqualTypeOf<
      MiddlewareHandler<Env & RbacEnv<AppTypes>>
    >()
    expectTypeOf<RbacMiddlewareOptions<UserEnv, AppTypes>['rbac']>().toEqualTypeOf<Rbac<AppTypes>>()
    // A typed engine still fits the untyped options, as in 1.0.
    expectTypeOf<RbacMiddlewareOptions<UserEnv, AppTypes>>().toMatchTypeOf<RbacMiddlewareOptions<UserEnv>>()
    function routes() {
      new Hono().use(rbacMiddleware({ rbac: engine, getSubject: guest })).get('/', async (c) => {
        expectTypeOf(c.var.rbac).toEqualTypeOf<SubjectRbac<AppTypes> | null>()
        await c.var.rbac?.can('edit articles')
        // @ts-expect-error -- typo
        await c.var.rbac?.can('edit artcles')
        return c.text('ok')
      })
      new Hono<UserEnv>()
        .use(rbacMiddleware<UserEnv, AppTypes>({ rbac: engine, getSubject: (c) => (c.var.user ? { type: 'user', id: c.var.user.id } : null) }))
        .get('/', async (c) => {
          // @ts-expect-error -- unknown role
          await c.var.rbac?.hasRole('ghost')
          return c.text(String(c.var.user?.id))
        })
    }
    expectTypeOf(routes).toBeFunction()
  })

  it('a typed app keeps a typed c.var.rbac after the typed guards', () => {
    const { requireRole: typedRole } = createGuards<typeof engine>()
    function routes() {
      const app = new Hono<AppEnv>()
      app.use(rbacMiddleware<AppEnv, AppTypes>({ rbac: engine, getSubject: guest }))
      app.get('/', async (c) => {
        // @ts-expect-error -- typo
        await c.var.rbac?.can('edit artcles')
        return c.text('ok')
      })
      app.get('/guarded', typedRole('admin'), async (c) => {
        expectTypeOf(c.var.user).toEqualTypeOf<User | undefined>()
        await c.var.rbac?.can('edit articles')
        // @ts-expect-error -- typo
        await c.var.rbac?.can('edit artcles')
        return c.text('ok')
      })
    }
    expectTypeOf(routes).toBeFunction()
  })

  it('the handlers of createGuards<T>() get a typed c.var.rbac; untyped ones keep Context', () => {
    expectTypeOf<GuardHandlerContext>().toEqualTypeOf<Context>()
    expectTypeOf<GuardHandlerContext<AppTypes>>().toEqualTypeOf<Context<RbacEnv<AppTypes>>>()
    expectTypeOf<GuardHandler>().parameters.toEqualTypeOf<[Context, GuardContext]>()
    createGuards<typeof engine>({
      onForbidden: async (c) => {
        // @ts-expect-error -- typo
        await c.var.rbac?.can('edit artcles')
        return c.text('nope', 403)
      },
    })
  })

  it('the typed guards still fit the 1.0 types', () => {
    const typed = createGuards<AppTypes>()
    const asBefore: Guard<AppPermission, PermissionGuardOptions> = typed.requirePermission
    const middleware: MiddlewareHandler<RbacEnv> = typed.requireRole('admin')
    const untyped: GuardHandlers = { onForbidden: (c) => c.text('nope', 403) }
    createGuards<AppTypes>(untyped)
    typed.requireRole('admin', {} as RoleGuardOptions)
    expectTypeOf(asBefore).toBeFunction()
    expectTypeOf(middleware).toBeFunction()
  })
})

describe('hono types: misc exports', () => {
  it('RbacMiddlewareMissingError has a literal code', () => {
    expectTypeOf<RbacMiddlewareMissingError>().toMatchTypeOf<Error>()
    expectTypeOf<RbacMiddlewareMissingError['code']>().toEqualTypeOf<'RBAC_MIDDLEWARE_MISSING'>()
  })
})

describe('hono types: per-route guard option', () => {
  it('every guard takes `{ guard: string }`, typed names included; a non-string guard is rejected', () => {
    function check() {
      const typed = createGuards<AppTypes>()
      requirePermission('edit articles', { guard: 'api' })
      requireRole('admin', { guard: 'api', all: true })
      requireRoleOrPermission('admin|edit articles', { guard: 'api' })
      canAny('a', 'b', { guard: 'api' })
      canAll(['a'], { guard: undefined })
      typed.requireRole('admin', { guard: 'api' })
      typed.canAll('edit articles', 'publish articles', { guard: 'api' })
      // @ts-expect-error -- `guard` is a string
      requireRole('admin', { guard: 1 })
      // @ts-expect-error -- `guard` is a string
      canAny('a', { guard: 1 })
      // @ts-expect-error -- `guard` is a string
      typed.requirePermission('edit articles', { guard: 1 })
      // @ts-expect-error -- `guard` is per guard, not a `createGuards()` default
      createGuards({ guard: 'api' })
    }
    expectTypeOf(check).toBeFunction()
    expectTypeOf<RouteGuardOptions['guard']>().toEqualTypeOf<string | undefined>()
  })
})

// ------------------------------------------------------------------------------------- per-guard names (1.2)

type GuardedRbac = {
  guards: {
    web: { roles: 'admin' | 'editor'; permissions: 'articles.edit' | 'api-keys.manage' }
    api: { roles: 'read-only' | 'full-access'; permissions: 'orders.read' | 'orders.write' }
  }
  defaultGuard: 'web'
}

describe('hono types: per-guard names', () => {
  const guarded = createRbac<GuardedRbac>({ adapter: new MemoryAdapter() })
  const engine = createRbac<AppTypes>({ adapter: new MemoryAdapter() })

  it('returns ScopedGuards for a per-guard config, and the 1.1 Guards otherwise', () => {
    expectTypeOf(createGuards<GuardedRbac>()).toEqualTypeOf<ScopedGuards<GuardedRbac, 'web'>>()
    expectTypeOf(createGuards<typeof guarded, 'api'>()).toEqualTypeOf<ScopedGuards<GuardedRbac, 'api'>>()
    expectTypeOf(createGuards<AppTypes>()).toEqualTypeOf<Guards<AppTypes>>()
    expectTypeOf(createGuards<AppTypes, 'api'>()).toEqualTypeOf<Guards<AppTypes>>()
    expectTypeOf<GuardsFor<AppTypes>>().toEqualTypeOf<Guards<AppTypes>>()
    expectTypeOf<GuardsFor>().toEqualTypeOf<Guards>()
    expectTypeOf(createGuards<GuardedRbac>().canAny).toEqualTypeOf<
      ScopedGuard<GuardedRbac, 'web', 'permission', RouteGuardOptions<GuardHandlerContext<GuardedRbac, 'web'>>>
    >()
  })

  it("checks names against the request's guard, or the route's `guard` option", () => {
    function routes() {
      const web = createGuards<GuardedRbac>()
      const api = createGuards<GuardedRbac, 'api'>()
      const anyGuard: string = 'api'

      web.requirePermission('articles.edit|api-keys.manage')
      web.requirePermission('orders.read', { guard: 'api' })
      web.requireRole('read-only', { guard: 'api', all: true })
      web.requireRoleOrPermission('full-access|orders.write', { guard: 'api' })
      api.requirePermission('orders.read', 'orders.write', { any: true })
      api.canAll('orders.read')
      api.requirePermission('api-keys.manage', { guard: 'web' })
      web.requirePermission('orders.read', { guard: anyGuard })

      // @ts-expect-error -- `api-keys.manage` is a `web` permission
      api.requirePermission('api-keys.manage')
      // @ts-expect-error -- `api-keys.manage` is a `web` permission
      web.requirePermission('api-keys.manage', { guard: 'api' })
      // @ts-expect-error -- `admin` is a `web` role
      api.requireRole('admin')
      // @ts-expect-error -- not a typed guard
      web.requirePermission('orders.read', { guard: 'apii' })
      // @ts-expect-error -- not a typed guard
      createGuards<GuardedRbac, 'apii'>()
    }
    expectTypeOf(routes).toBeFunction()
  })

  it("types c.var.rbac with the middleware's guard", () => {
    expectTypeOf(rbacMiddleware({ rbac: guarded, getSubject: guest })).toEqualTypeOf<
      MiddlewareHandler<Env & RbacEnv<GuardedRbac, 'web'>>
    >()
    expectTypeOf(rbacMiddleware({ rbac: guarded, guard: 'api', getSubject: guest })).toEqualTypeOf<
      MiddlewareHandler<Env & RbacEnv<GuardedRbac, 'api'>>
    >()
    expectTypeOf<RbacVariables<GuardedRbac, 'api'>['rbac']>().toEqualTypeOf<SubjectRbac<GuardedRbac, 'api'> | null>()
    expectTypeOf<RbacVariables<GuardedRbac>['rbac']>().toEqualTypeOf<SubjectRbac<GuardedRbac, 'web'> | null>()
    // Flat configs: unchanged, whatever the guard.
    expectTypeOf<RbacVariables<AppTypes, 'api'>['rbac']>().toEqualTypeOf<SubjectRbac<AppTypes> | null>()
    expectTypeOf(rbacMiddleware({ rbac: engine, guard: 'api', getSubject: guest })).toEqualTypeOf<
      MiddlewareHandler<Env & RbacEnv<AppTypes>>
    >()

    function routes() {
      new Hono()
        .use(rbacMiddleware({ rbac: guarded, guard: 'api', getSubject: guest }))
        .get('/orders', createGuards<GuardedRbac, 'api'>().requirePermission('orders.read'), async (c) => {
          await c.var.rbac?.can('orders.write')
          // @ts-expect-error -- `c.var.rbac` is in guard `api`
          await c.var.rbac?.can('articles.edit')
          return c.json({})
        })
      // @ts-expect-error -- not a typed guard
      rbacMiddleware({ rbac: guarded, guard: 'apii', getSubject: guest })
      createGuards<GuardedRbac, 'api'>({
        onForbidden: async (c) => {
          await c.var.rbac?.hasRole('read-only')
          // @ts-expect-error -- the request is in guard `api`
          await c.var.rbac?.hasRole('admin')
          return c.text('nope', 403)
        },
      })
    }
    expectTypeOf(routes).toBeFunction()
  })
})
