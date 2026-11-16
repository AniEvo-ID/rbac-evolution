/**
 * Type tests: the public types are part of the API. Enforced by `tsc --noEmit` (`pnpm typecheck`),
 * which includes `test/`; `expectTypeOf` and `@ts-expect-error` lines fail the typecheck when a type drifts.
 * Calls that would do real work live in functions that are never invoked.
 */
import { createRbac, MemoryAdapter, type Rbac, type Subject, type SubjectRbac, type TeamId } from '@anievo-id/rbac-evolution'
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
  type Guards,
  type PermissionGuardOptions,
  rbacMiddleware,
  type RbacMiddlewareOptions,
  RbacMiddlewareMissingError,
  requirePermission,
  requireRole,
  requireRoleOrPermission,
  type RoleGuardOptions,
  type RoleOrPermissionGuardOptions,
  type RouteGuardOptions,
} from '../src'

const rbac = createRbac({ adapter: new MemoryAdapter() })
const guest = () => null

describe('express types: rbacMiddleware()', () => {
  it('takes RbacMiddlewareOptions and returns a RequestHandler', () => {
    expectTypeOf(rbacMiddleware).parameter(0).toEqualTypeOf<RbacMiddlewareOptions>()
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

  it('accepts an engine with narrowed names (the middleware itself is not generic; see `createGuards<T>()`)', () => {
    const typed = createRbac<{ permissions: 'edit articles'; roles: 'writer' }>({ adapter: new MemoryAdapter() })
    rbacMiddleware({ rbac: typed, getSubject: guest })
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
