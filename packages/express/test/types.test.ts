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
  type GuardContext,
  type GuardHandler,
  type GuardHandlers,
  type GuardKind,
  type GuardNames,
  type PermissionGuardOptions,
  rbacMiddleware,
  type RbacMiddlewareOptions,
  RbacMiddlewareMissingError,
  requirePermission,
  requireRole,
  requireRoleOrPermission,
  type RoleGuardOptions,
  type RoleOrPermissionGuardOptions,
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
      // @ts-expect-error -- exactOptionalPropertyTypes: `guard` is `?: string`, explicit `undefined` is rejected
      rbacMiddleware({ rbac, getSubject: guest, guard: undefined })
      // @ts-expect-error -- exactOptionalPropertyTypes: `team` does not accept explicit `undefined`
      rbacMiddleware({ rbac, getSubject: guest, team: undefined })
    }
    expectTypeOf(invalid).toBeFunction()
  })

  it('accepts an engine with narrowed names (the integration itself is not generic)', () => {
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
      // @ts-expect-error -- exactOptionalPropertyTypes: `any?: boolean` does not accept explicit `undefined`
      requirePermission('a', { any: undefined })
      // @ts-expect-error -- exactOptionalPropertyTypes: `onForbidden` does not accept explicit `undefined`
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
      any?: boolean
    }>()
    expectTypeOf<RoleGuardOptions>().toEqualTypeOf<{
      onUnauthenticated?: GuardHandler
      onForbidden?: GuardHandler
      exposeRequirements?: boolean
      all?: boolean
    }>()
    expectTypeOf<RoleOrPermissionGuardOptions>().toEqualTypeOf<GuardHandlers>()
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
