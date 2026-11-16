/**
 * Type tests: the public types are part of the API. Enforced by `tsc --noEmit` (`pnpm typecheck`),
 * which includes `test/`; `expectTypeOf` and `@ts-expect-error` lines fail the typecheck when a type drifts.
 * Calls that would do real work live in functions that are never invoked.
 */
import { createRbac, MemoryAdapter, type Rbac, type Subject, type SubjectRbac, type TeamId } from '@anievo-id/rbac-evolution'
import Fastify, {
  type FastifyPluginAsync,
  type FastifyReply,
  type FastifyRequest,
  type preHandlerAsyncHookHandler,
} from 'fastify'
import { describe, expectTypeOf, it } from 'vitest'
import {
  canAll,
  canAny,
  createGuards,
  type GuardContext,
  type GuardHandler,
  type GuardHandlers,
  type GuardHook,
  type GuardKind,
  type GuardNames,
  type PermissionGuardOptions,
  type RbacHook,
  RbacMiddlewareMissingError,
  rbacPlugin,
  type RbacPluginOptions,
  requirePermission,
  requireRole,
  requireRoleOrPermission,
  type RoleGuardOptions,
  type RoleOrPermissionGuardOptions,
} from '../src'

const rbac = createRbac({ adapter: new MemoryAdapter() })
const guest = () => null
const ok = async () => ({ ok: true })

describe('fastify types: rbacPlugin', () => {
  it('is an async plugin taking RbacPluginOptions', () => {
    expectTypeOf(rbacPlugin).toEqualTypeOf<FastifyPluginAsync<RbacPluginOptions>>()
  })

  it('types the options', () => {
    expectTypeOf<RbacPluginOptions['rbac']>().toEqualTypeOf<Rbac>()
    expectTypeOf<RbacPluginOptions['getSubject']>().parameters.toEqualTypeOf<[FastifyRequest]>()
    expectTypeOf<RbacPluginOptions['getSubject']>().returns.toEqualTypeOf<
      Subject | null | undefined | Promise<Subject | null | undefined>
    >()
    expectTypeOf<RbacPluginOptions['team']>().toEqualTypeOf<
      ((request: FastifyRequest) => TeamId | undefined | Promise<TeamId | undefined>) | undefined
    >()
    expectTypeOf<RbacPluginOptions>().toHaveProperty('guard').toEqualTypeOf<string | undefined>()
    expectTypeOf<RbacPluginOptions>().toHaveProperty('hook').toEqualTypeOf<RbacHook | undefined>()
    expectTypeOf<RbacHook>().toEqualTypeOf<'onRequest' | 'preValidation' | 'preHandler'>()
  })

  it('accepts valid options through app.register()', () => {
    async function valid() {
      const app = Fastify()
      await app.register(rbacPlugin, { rbac, getSubject: () => ({ type: 'user', id: 1 }) })
      await app.register(rbacPlugin, { rbac, getSubject: guest, guard: 'api', hook: 'onRequest' })
      await app.register(rbacPlugin, { rbac, getSubject: () => undefined, team: () => 'team-1' })
      await app.register(rbacPlugin, {
        rbac,
        getSubject: async (request) => {
          expectTypeOf(request).toEqualTypeOf<FastifyRequest>()
          return typeof request.headers['x-user'] === 'string' ? { type: 'user', id: request.headers['x-user'] } : null
        },
        team: async () => null,
      })
      const typed = createRbac<{ permissions: 'edit articles'; roles: 'writer' }>({ adapter: new MemoryAdapter() })
      await app.register(rbacPlugin, { rbac: typed, getSubject: guest })
    }
    expectTypeOf(valid).toBeFunction()
  })

  it('rejects invalid options', () => {
    async function invalid() {
      const app = Fastify()
      // @ts-expect-error -- `rbac` is required
      await app.register(rbacPlugin, { getSubject: guest })
      // @ts-expect-error -- `getSubject` is required
      await app.register(rbacPlugin, { rbac })
      // @ts-expect-error -- a subject needs `type` and `id`
      await app.register(rbacPlugin, { rbac, getSubject: () => ({ type: 'user' }) })
      // @ts-expect-error -- unknown hook
      await app.register(rbacPlugin, { rbac, getSubject: guest, hook: 'onSend' })
      // @ts-expect-error -- exactOptionalPropertyTypes: `hook` does not accept explicit `undefined`
      await app.register(rbacPlugin, { rbac, getSubject: guest, hook: undefined })
      // @ts-expect-error -- exactOptionalPropertyTypes: `guard` does not accept explicit `undefined`
      await app.register(rbacPlugin, { rbac, getSubject: guest, guard: undefined })
    }
    expectTypeOf(invalid).toBeFunction()
  })
})

describe('fastify types: request augmentation', () => {
  it('types request.rbac as SubjectRbac | null | undefined', () => {
    expectTypeOf<FastifyRequest['rbac']>().toEqualTypeOf<SubjectRbac | null | undefined>()
    function route() {
      Fastify().get<{ Params: { id: string } }>('/x', async (request) => {
        expectTypeOf(request.rbac).toEqualTypeOf<SubjectRbac | null | undefined>()
        expectTypeOf(request.params.id).toBeString()
        return request.rbac ? request.rbac.snapshot() : null
      })
    }
    expectTypeOf(route).toBeFunction()
  })
})

describe('fastify types: guards', () => {
  it('return a preHandler hook', () => {
    expectTypeOf<GuardHook>().toEqualTypeOf<preHandlerAsyncHookHandler>()
    for (const guard of [requirePermission, requireRole, requireRoleOrPermission, canAny, canAll]) {
      expectTypeOf(guard).returns.toEqualTypeOf<GuardHook>()
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
      requireRole(['admin', 'editor'], { onForbidden: (_request, reply) => reply.code(404).send() })
      requireRoleOrPermission('admin|edit articles')
      requireRoleOrPermission(['admin', 'edit articles'], { exposeRequirements: true })
      canAny('edit articles', 'publish articles')
      canAny(['edit articles'], { onUnauthenticated: (_request, reply) => reply.redirect('/login') })
      canAll('edit articles', 'publish|review')
      const names: GuardNames[] = ['a', ['b', 'c']]
      requirePermission(...names)
    }
    expectTypeOf(valid).toBeFunction()
  })

  it('plug into route options and addHook(), including routes with typed generics', () => {
    function wiring() {
      const app = Fastify()
      app.get('/a', { preHandler: requirePermission('edit articles') }, ok)
      app.get('/b', { preHandler: [requireRole('admin'), canAny('a', 'b')] }, ok)
      app.post<{ Body: { title: string }; Params: { id: string } }>(
        '/c/:id',
        { preHandler: requireRoleOrPermission('admin|edit articles') },
        async (request) => request.body.title,
      )
      app.addHook('preHandler', canAll('a', 'b'))
      app.route({ method: 'GET', url: '/d', preHandler: requireRole('admin'), handler: ok })
    }
    expectTypeOf(wiring).toBeFunction()
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
      requireRoleOrPermission('admin', { all: true })
      // @ts-expect-error -- canAll is always "all"
      canAll('a', { any: true })
      // @ts-expect-error -- exactOptionalPropertyTypes: `all?: boolean` does not accept explicit `undefined`
      requireRole('a', { all: undefined })
      // @ts-expect-error -- exactOptionalPropertyTypes: `onUnauthenticated` does not accept explicit `undefined`
      requirePermission('a', { onUnauthenticated: undefined })
      // @ts-expect-error -- arrays of non-strings
      requireRole([1, 2])
    }
    expectTypeOf(invalid).toBeFunction()
  })
})

describe('fastify types: hooks & failure details', () => {
  it('types GuardContext and GuardHandler', () => {
    expectTypeOf<GuardKind>().toEqualTypeOf<'permission' | 'role' | 'role_or_permission'>()
    expectTypeOf<GuardContext>().toEqualTypeOf<{ kind: GuardKind; requirements: string[][] }>()
    expectTypeOf<GuardHandler>().parameters.toEqualTypeOf<[FastifyRequest, FastifyReply, GuardContext]>()
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

  it('infers hook arguments contextually (send a reply, return it, or throw)', () => {
    createGuards({
      onUnauthenticated: (request, reply, context) => {
        expectTypeOf(request).toEqualTypeOf<FastifyRequest>()
        expectTypeOf(reply).toEqualTypeOf<FastifyReply>()
        expectTypeOf(context.kind).toEqualTypeOf<GuardKind>()
        return reply.code(401).send('login')
      },
      onForbidden: async (_request, _reply, { requirements }) => {
        expectTypeOf(requirements).toEqualTypeOf<string[][]>()
        throw new Error('forbidden')
      },
      exposeRequirements: true,
    })
    // @ts-expect-error -- `exposeRequirements` is a boolean
    createGuards({ exposeRequirements: 1 })
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

describe('fastify types: misc exports', () => {
  it('RbacMiddlewareMissingError has literal code and statusCode', () => {
    expectTypeOf<RbacMiddlewareMissingError>().toMatchTypeOf<Error>()
    expectTypeOf<RbacMiddlewareMissingError['code']>().toEqualTypeOf<'RBAC_MIDDLEWARE_MISSING'>()
    expectTypeOf<RbacMiddlewareMissingError['statusCode']>().toEqualTypeOf<500>()
  })
})
