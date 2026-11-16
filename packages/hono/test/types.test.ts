/**
 * Type tests: the public types are part of the API. Enforced by `tsc --noEmit` (`pnpm typecheck`),
 * which includes `test/`; `expectTypeOf` and `@ts-expect-error` lines fail the typecheck when a type drifts.
 * Calls that would do real work live in functions that are never invoked.
 * Complements `types-check.ts` (custom env + chained app compile checks).
 */
import { createRbac, MemoryAdapter, type Rbac, type Subject, type SubjectRbac, type TeamId } from '@anievo-id/rbac-evolution'
import { type Context, type Env, Hono, type MiddlewareHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { describe, expectTypeOf, it } from 'vitest'
import {
  canAll,
  canAny,
  createGuards,
  type GuardContext,
  type GuardHandler,
  type GuardHandlers,
  type GuardKind,
  type GuardNames,
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
    expectTypeOf(rbacMiddleware).returns.toEqualTypeOf<MiddlewareHandler<Env & RbacEnv>>()
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

describe('hono types: misc exports', () => {
  it('RbacMiddlewareMissingError has a literal code', () => {
    expectTypeOf<RbacMiddlewareMissingError>().toMatchTypeOf<Error>()
    expectTypeOf<RbacMiddlewareMissingError['code']>().toEqualTypeOf<'RBAC_MIDDLEWARE_MISSING'>()
  })
})
