/**
 * Type tests: the public types are part of the API. Enforced by `tsc --noEmit` (`pnpm typecheck`),
 * which includes `test/`; `expectTypeOf` and `@ts-expect-error` lines fail the typecheck when a type drifts.
 * Calls that would do real work live in functions that are never invoked.
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
import type { NextFunction, Request, RequestHandler, Response } from 'express'
import { describe, expectTypeOf, it } from 'vitest'
import {
  asyncHandler,
  canAll,
  canAny,
  createGuards,
  type Guard,
  type GuardContext,
  type GuardHandler,
  type GuardHandlers,
  type GuardKind,
  type GuardNames,
  type GuardRequest,
  type Guards,
  type GuardsFor,
  type PermissionGuardOptions,
  rbacMiddleware,
  type RbacMiddlewareOptions,
  RbacMiddlewareMissingError,
  type RbacRegister,
  type RbacRequest,
  type RegisteredRbacTypes,
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

describe('express types: rbacMiddleware()', () => {
  it('takes RbacMiddlewareOptions and returns a RequestHandler', () => {
    expectTypeOf(rbacMiddleware<DefaultRbacTypes>).parameter(0).toEqualTypeOf<RbacMiddlewareOptions>()
    expectTypeOf(rbacMiddleware).returns.toEqualTypeOf<RequestHandler>()
  })

  it('types the options', () => {
    expectTypeOf<RbacMiddlewareOptions['rbac']>().toEqualTypeOf<Rbac>()
    expectTypeOf<RbacMiddlewareOptions['getSubject']>().parameters.toEqualTypeOf<[Request]>()
    expectTypeOf<RbacMiddlewareOptions['getSubject']>().returns.toEqualTypeOf<
      Subject | null | undefined | Promise<Subject | null | undefined>
    >()
    expectTypeOf<RbacMiddlewareOptions['team']>().toEqualTypeOf<
      ((req: Request) => TeamId | undefined | Promise<TeamId | undefined>) | undefined
    >()
    expectTypeOf<RbacMiddlewareOptions>().toHaveProperty('guard').toEqualTypeOf<string | undefined>()
  })

  it('accepts sync and async getSubject returning a subject, null or undefined', () => {
    rbacMiddleware({ rbac, getSubject: () => ({ type: 'user', id: 1 }) })
    rbacMiddleware({ rbac, getSubject: () => ({ type: 'user', id: 'uuid' }) })
    rbacMiddleware({ rbac, getSubject: guest })
    rbacMiddleware({ rbac, getSubject: () => undefined })
    rbacMiddleware({ rbac, getSubject: async (req) => (req.header('x-user') ? { type: 'user', id: 1 } : null) })
    rbacMiddleware({ rbac, getSubject: guest, guard: 'api', team: () => 1 })
    rbacMiddleware({ rbac, getSubject: guest, team: async () => null })
    rbacMiddleware({ rbac, getSubject: guest, team: () => undefined })
  })

  it('rejects invalid options', () => {
    function invalid() {
      // @ts-expect-error -- `rbac` is required
      rbacMiddleware({ getSubject: guest })
      // @ts-expect-error -- `getSubject` is required
      rbacMiddleware({ rbac })
      // @ts-expect-error -- a subject needs `type` and `id`
      rbacMiddleware({ rbac, getSubject: () => ({ id: 1 }) })
      // @ts-expect-error -- ids are strings or numbers
      rbacMiddleware({ rbac, getSubject: () => ({ type: 'user', id: true }) })
      // @ts-expect-error -- `getSubject` must not return a bare id
      rbacMiddleware({ rbac, getSubject: () => 1 })
      // @ts-expect-error -- not an Rbac engine
      rbacMiddleware({ rbac: {}, getSubject: guest })
      // @ts-expect-error -- team ids are string | number | null
      rbacMiddleware({ rbac, getSubject: guest, team: () => true })
      // exactOptionalPropertyTypes: an explicit `undefined` is accepted, same as leaving the option out
      rbacMiddleware({ rbac, getSubject: guest, guard: undefined })
      // @ts-expect-error -- exactOptionalPropertyTypes: `team` does not accept explicit `undefined`
      rbacMiddleware({ rbac, getSubject: guest, team: undefined })
    }
    expectTypeOf(invalid).toBeFunction()
  })

  it('accepts an engine with narrowed names; the options are generic over it', () => {
    type Names = { permissions: 'edit articles'; roles: 'writer' }
    const typed = createRbac<Names>({ adapter: new MemoryAdapter() })
    rbacMiddleware({ rbac: typed, getSubject: guest })
    rbacMiddleware<Names>({ rbac: typed, getSubject: guest })
    expectTypeOf<RbacMiddlewareOptions<Names>['rbac']>().toEqualTypeOf<Rbac<Names>>()
    // A typed engine still fits the untyped options, as in 1.0.
    expectTypeOf<RbacMiddlewareOptions<Names>>().toMatchTypeOf<RbacMiddlewareOptions>()
    expectTypeOf(rbacMiddleware<Names>).returns.toEqualTypeOf<RequestHandler>()
  })
})

describe('express types: request augmentation', () => {
  it('types req.rbac as SubjectRbac | null | undefined', () => {
    expectTypeOf<Request['rbac']>().toEqualTypeOf<SubjectRbac | null | undefined>()
    const handler: RequestHandler = async (req, res) => {
      if (req.rbac) {
        expectTypeOf(req.rbac).toEqualTypeOf<SubjectRbac>()
        expectTypeOf(req.rbac.can).returns.resolves.toBeBoolean()
        res.json(req.rbac.snapshot())
      }
    }
    expectTypeOf(handler).toEqualTypeOf<RequestHandler>()
  })
})

describe('express types: guards', () => {
  it('return a RequestHandler', () => {
    for (const guard of [requirePermission, requireRole, requireRoleOrPermission, canAny, canAll]) {
      expectTypeOf(guard).returns.toEqualTypeOf<RequestHandler>()
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
      requireRole(['admin', 'editor'], { onForbidden: (_req, res) => res.sendStatus(404) })
      requireRoleOrPermission('admin|edit articles')
      requireRoleOrPermission(['admin', 'edit articles'], { exposeRequirements: true })
      canAny('edit articles', 'publish articles')
      canAny(['edit articles', 'publish articles'], { onUnauthenticated: (_req, res) => res.redirect('/login') })
      canAll('edit articles', 'publish|review')
      const names: GuardNames[] = ['a', ['b', 'c']]
      requirePermission(...names)
    }
    expectTypeOf(valid).toBeFunction()
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
      // @ts-expect-error -- canAny is always "any"
      canAny('a', { any: false })
      // @ts-expect-error -- options are booleans
      requirePermission('a', { any: 'yes' })
      // exactOptionalPropertyTypes: an explicit `undefined` is accepted, same as leaving the option out
      requirePermission('a', { any: undefined })
      // exactOptionalPropertyTypes: an explicit `undefined` is accepted, same as leaving the option out
      requireRole('a', { onForbidden: undefined })
      // @ts-expect-error -- arrays of non-strings
      requireRole([1, 2])
      // @ts-expect-error -- a guard is a middleware, not a factory of one
      requirePermission('a')('b')
    }
    expectTypeOf(invalid).toBeFunction()
  })
})

describe('express types: hooks & failure details', () => {
  it('types GuardContext and GuardHandler', () => {
    expectTypeOf<GuardKind>().toEqualTypeOf<'permission' | 'role' | 'role_or_permission'>()
    expectTypeOf<GuardContext>().toEqualTypeOf<{ kind: GuardKind; requirements: string[][] }>()
    expectTypeOf<GuardHandler>().parameters.toEqualTypeOf<[Request, Response, NextFunction, GuardContext]>()
    expectTypeOf<GuardHandler>().returns.toBeUnknown()
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

  it('infers hook arguments contextually', () => {
    createGuards({
      onUnauthenticated: (req, res, next, context) => {
        expectTypeOf(req).toEqualTypeOf<Request>()
        expectTypeOf(res).toEqualTypeOf<Response>()
        expectTypeOf(next).toEqualTypeOf<NextFunction>()
        expectTypeOf(context.kind).toEqualTypeOf<GuardKind>()
        next()
      },
      onForbidden: async (_req, res, _next, { requirements }) => {
        expectTypeOf(requirements).toEqualTypeOf<string[][]>()
        res.status(403).send('nope')
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

describe('express types: typed names (createGuards<T>())', () => {
  const typed = createGuards<AppTypes>()

  it('types the guards with the names of T', () => {
    expectTypeOf(typed).toEqualTypeOf<Guards<AppTypes>>()
    expectTypeOf(typed.requirePermission).toEqualTypeOf<Guard<AppPermission, PermissionGuardOptions>>()
    expectTypeOf(typed.requireRole).toEqualTypeOf<Guard<AppRole, RoleGuardOptions>>()
    expectTypeOf(typed.requireRoleOrPermission).toEqualTypeOf<
      Guard<AppPermission | AppRole, RoleOrPermissionGuardOptions>
    >()
    expectTypeOf(typed.canAny).toEqualTypeOf<Guard<AppPermission, RouteGuardOptions>>()
    expectTypeOf(typed.canAll).toEqualTypeOf<Guard<AppPermission, RouteGuardOptions>>()
    // The defaults (and `createGuards()`) accept any string.
    expectTypeOf(createGuards()).toEqualTypeOf<Guards>()
    expectTypeOf(requirePermission).toEqualTypeOf<Guard<string, PermissionGuardOptions>>()
  })

  it('also takes the engine type: createGuards<typeof rbac>()', () => {
    const engine = createRbac<AppTypes>({ adapter: new MemoryAdapter() })
    expectTypeOf(createGuards<typeof engine>()).toEqualTypeOf<Guards<AppTypes>>()
    expectTypeOf(createGuards<typeof rbac>()).toEqualTypeOf<Guards>()
    // A config with only roles keeps permissions untyped.
    expectTypeOf(createGuards<{ roles: AppRole }>().requirePermission).toEqualTypeOf<
      Guard<string, PermissionGuardOptions>
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
      typed.requireRole(['admin'], { onForbidden: (_req, res) => res.sendStatus(404) })
      typed.requireRoleOrPermission('admin|edit articles', { exposeRequirements: true })
      typed.canAny('edit articles', 'publish articles')
      typed.canAny(['edit articles'], { onUnauthenticated: (_req, res) => res.redirect('/login') })
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

describe('express types: typed request helpers', () => {
  const engine = createRbac<AppTypes>({ adapter: new MemoryAdapter() })

  it('without a registration, req.rbac stays untyped', () => {
    expectTypeOf<RbacRegister>().toEqualTypeOf<{}>()
    expectTypeOf<RegisteredRbacTypes>().toEqualTypeOf<DefaultRbacTypes>()
    expectTypeOf<NonNullable<Request['rbac']>>().toEqualTypeOf<SubjectRbac>()
  })

  it('RbacRequest<T> types req.rbac with the names of T (a names type or typeof rbac)', () => {
    expectTypeOf<RbacRequest<AppTypes>['rbac']>().toEqualTypeOf<SubjectRbac<AppTypes> | null | undefined>()
    expectTypeOf<RbacRequest<typeof engine>['rbac']>().toEqualTypeOf<SubjectRbac<AppTypes> | null | undefined>()
    expectTypeOf<RbacRequest['rbac']>().toEqualTypeOf<SubjectRbac | null | undefined>()
    expectTypeOf<RbacRequest<AppTypes>['params']>().toEqualTypeOf<Request['params']>()
    // @ts-expect-error -- not a type config
    expectTypeOf<RbacRequest<{ roles: 1 }>>()
  })

  it('a handler can take an RbacRequest, and req.rbac.can() checks the names', () => {
    function routes(app: import('express').Express) {
      app.get('/articles/:id', async (req: RbacRequest<typeof engine>, res) => {
        expectTypeOf(req.params).toEqualTypeOf<Request['params']>()
        if (!req.rbac) return
        await req.rbac.can('edit articles')
        // @ts-expect-error -- typo
        await req.rbac.can('edit artcles')
        // @ts-expect-error -- unknown role
        await req.rbac.hasRole('ghost')
        res.json(await req.rbac.snapshot())
      })
      app.use(
        asyncHandler(async (req) => {
          // An untyped req.rbac accepts any name.
          await req.rbac?.can('anything')
        }),
      )
    }
    expectTypeOf(routes).toBeFunction()
  })

  it('the handlers of createGuards<T>() get a typed req.rbac; untyped ones keep Request', () => {
    expectTypeOf<GuardRequest>().toEqualTypeOf<Request>()
    expectTypeOf<GuardRequest<{}>>().toEqualTypeOf<Request>()
    expectTypeOf<GuardRequest<AppTypes>>().toEqualTypeOf<RbacRequest<AppTypes>>()
    expectTypeOf<GuardRequest<typeof engine>>().toEqualTypeOf<RbacRequest<AppTypes>>()
    expectTypeOf<GuardHandler>().parameters.toEqualTypeOf<[Request, Response, NextFunction, GuardContext]>()

    const typed = createGuards<typeof engine>({
      onForbidden: async (req, res) => {
        expectTypeOf(req.rbac).toEqualTypeOf<SubjectRbac<AppTypes> | null | undefined>()
        // @ts-expect-error -- typo
        await req.rbac?.can('edit artcles')
        res.sendStatus(403)
      },
    })
    typed.requireRole('admin', {
      onForbidden: async (req, res) => {
        await req.rbac?.hasRole('editor')
        // @ts-expect-error -- typo
        await req.rbac?.hasRole('edtor')
        res.sendStatus(404)
      },
    })
  })

  it('the typed guards still fit the 1.0 types', () => {
    const typed = createGuards<AppTypes>()
    const asBefore: Guard<AppPermission, PermissionGuardOptions> = typed.requirePermission
    const handlers: GuardHandlers = {} as GuardHandlers<GuardRequest<AppTypes>>
    const options: RouteGuardOptions<GuardRequest<AppTypes>> = {} as RouteGuardOptions
    // Handlers written for the untyped types still fit createGuards<T>().
    const untyped: GuardHandlers = { onForbidden: (_req, res) => res.sendStatus(403) }
    createGuards<AppTypes>(untyped)
    typed.requireRole('admin', {} as RoleGuardOptions)
    expectTypeOf(asBefore).toBeFunction()
    expectTypeOf(handlers).toBeObject()
    expectTypeOf(options).toBeObject()
  })
})

describe('express types: misc exports', () => {
  it('asyncHandler wraps an async handler into a RequestHandler', () => {
    expectTypeOf(asyncHandler).parameter(0).toEqualTypeOf<(req: Request, res: Response, next: NextFunction) => Promise<void>>()
    expectTypeOf(asyncHandler).returns.toEqualTypeOf<RequestHandler>()
  })

  it('RbacMiddlewareMissingError has a literal code', () => {
    expectTypeOf<RbacMiddlewareMissingError>().toMatchTypeOf<Error>()
    expectTypeOf<RbacMiddlewareMissingError['code']>().toEqualTypeOf<'RBAC_MIDDLEWARE_MISSING'>()
  })
})

describe('express types: per-route guard option', () => {
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

describe('express types: per-guard names (createGuards<T, G>())', () => {
  const guarded = createRbac<GuardedRbac>({ adapter: new MemoryAdapter() })

  it('returns ScopedGuards for a per-guard config, and the 1.1 Guards otherwise', () => {
    expectTypeOf(createGuards<GuardedRbac>()).toEqualTypeOf<ScopedGuards<GuardedRbac, 'web'>>()
    expectTypeOf(createGuards<typeof guarded, 'api'>()).toEqualTypeOf<ScopedGuards<GuardedRbac, 'api'>>()
    expectTypeOf(createGuards<AppTypes>()).toEqualTypeOf<Guards<AppTypes>>()
    expectTypeOf(createGuards<AppTypes, 'api'>()).toEqualTypeOf<Guards<AppTypes>>()
    expectTypeOf<GuardsFor<AppTypes>>().toEqualTypeOf<Guards<AppTypes>>()
    expectTypeOf<GuardsFor>().toEqualTypeOf<Guards>()
    expectTypeOf(createGuards<GuardedRbac>().requirePermission).toEqualTypeOf<
      ScopedGuard<GuardedRbac, 'web', 'permission', PermissionGuardOptions<GuardRequest<GuardedRbac, 'web'>>>
    >()
  })

  it("checks names against the request's guard, or the route's `guard` option", () => {
    function routes() {
      const web = createGuards<GuardedRbac>()
      const api = createGuards<GuardedRbac, 'api'>()
      const anyGuard: string = 'api'

      web.requirePermission('articles.edit|api-keys.manage')
      web.requireRole('admin', 'editor', { all: true })
      web.requirePermission('orders.read', { guard: 'api' })
      web.requireRole('read-only', { guard: 'api', all: true })
      web.requireRoleOrPermission('full-access|orders.write', { guard: 'api' })
      api.requirePermission('orders.read', 'orders.write', { any: true })
      api.canAny(['orders.read', 'orders.write'])
      api.canAll('orders.read')
      api.requirePermission('api-keys.manage', { guard: 'web' })
      // A non-literal guard: the names of every guard.
      web.requirePermission('orders.read', { guard: anyGuard })

      // @ts-expect-error -- `api-keys.manage` is a `web` permission
      api.requirePermission('api-keys.manage')
      // @ts-expect-error -- `api-keys.manage` is a `web` permission
      web.requirePermission('api-keys.manage', { guard: 'api' })
      // @ts-expect-error -- each part of a pipe list is checked in the route's guard
      web.requirePermission('orders.read|articles.edit', { guard: 'api' })
      // @ts-expect-error -- `admin` is a `web` role
      api.requireRole('admin')
      // @ts-expect-error -- `orders.read` is an `api` permission
      web.canAny('orders.read', 'articles.edit')
      // @ts-expect-error -- not a typed guard
      web.requirePermission('orders.read', { guard: 'apii' })
      // @ts-expect-error -- not a typed guard
      createGuards<GuardedRbac, 'apii'>()
      // @ts-expect-error -- not a name of any guard
      web.requirePermission('orders.delete', { guard: anyGuard })
    }
    expectTypeOf(routes).toBeFunction()
  })

  it("types the handlers' request with the request's guard", () => {
    expectTypeOf<GuardRequest<GuardedRbac>>().toEqualTypeOf<RbacRequest<GuardedRbac, Request, 'web'>>()
    expectTypeOf<RbacRequest<GuardedRbac, Request, 'api'>['rbac']>().toEqualTypeOf<
      SubjectRbac<GuardedRbac, 'api'> | null | undefined
    >()
    expectTypeOf<RbacRequest<GuardedRbac>['rbac']>().toEqualTypeOf<SubjectRbac<GuardedRbac, 'web'> | null | undefined>()
    // Flat configs: unchanged, whatever the guard.
    expectTypeOf<RbacRequest<AppTypes, Request, 'api'>['rbac']>().toEqualTypeOf<
      SubjectRbac<AppTypes> | null | undefined
    >()

    createGuards<GuardedRbac, 'api'>({
      onForbidden: async (req, res) => {
        await req.rbac?.can('orders.read')
        // @ts-expect-error -- the request is in guard `api`
        await req.rbac?.can('articles.edit')
        res.sendStatus(403)
      },
    })
  })
})
