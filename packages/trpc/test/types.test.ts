/**
 * Type tests: the public types are part of the API. Enforced by `tsc --noEmit` (`pnpm typecheck`),
 * which includes `test/`; `expectTypeOf` and `@ts-expect-error` lines fail the typecheck when a type drifts.
 * Calls that would do real work live in functions that are never invoked.
 */
import { createRbac, MemoryAdapter, type Subject, type SubjectRbac } from '@anievo-id/rbac-evolution'
import { type inferRouterError, initTRPC, TRPCError, type TRPCProcedureType } from '@trpc/server'
import { describe, expectTypeOf, it } from 'vitest'
import {
  canAll,
  canAny,
  createGuards,
  type CreateGuardsOptions,
  createRbacContext,
  getRbacErrorBody,
  type Guard,
  type GuardCallOptions,
  type GuardContext,
  type GuardHandler,
  type GuardHandlerOptions,
  type GuardHandlers,
  type GuardKind,
  type Guards,
  type GuardsFor,
  type GuardSubject,
  type PermissionGuardOptions,
  RbacAccessError,
  type RbacContext,
  RbacContextMissingError,
  type RbacErrorBody,
  rbacErrorFormatter,
  type RbacMiddleware,
  type RbacProcedureContext,
  type RbacResolver,
  requirePermission,
  requireRole,
  requireRoleOrPermission,
  type RoleGuardOptions,
  type RoleOrPermissionGuardOptions,
  type RouteGuardOptions,
  type ScopedGuard,
  type ScopedGuards,
} from '../src'

type User = { id: number }
type AppRbac = { permissions: 'edit articles' | 'delete articles' | 'publish articles'; roles: 'admin' | 'editor' }
type AppPermission = 'edit articles' | 'delete articles' | 'publish articles'
type AppRole = 'admin' | 'editor'

const rbac = createRbac({ adapter: new MemoryAdapter() })
const engine = createRbac<AppRbac>({ adapter: new MemoryAdapter() })
const guest = (): Subject | null => null

describe('trpc types: context', () => {
  it('RbacContext<T> types ctx.rbac with the names of T (or typeof rbac); untyped by default', () => {
    expectTypeOf<RbacContext>().toEqualTypeOf<{ rbac: SubjectRbac | null }>()
    expectTypeOf<RbacContext<AppRbac>>().toEqualTypeOf<{ rbac: SubjectRbac<AppRbac> | null }>()
    expectTypeOf<RbacContext<typeof engine>>().toEqualTypeOf<{ rbac: SubjectRbac<AppRbac> | null }>()
    expectTypeOf<GuardSubject>().toEqualTypeOf<SubjectRbac>()
    expectTypeOf<GuardSubject<typeof engine>>().toEqualTypeOf<SubjectRbac<AppRbac>>()
    // @ts-expect-error -- not a type config
    expectTypeOf<RbacContext<{ roles: 1 }>>()
  })

  it('createRbacContext() infers its input from getSubject and the names from rbac', () => {
    const untyped = createRbacContext({ rbac, getSubject: (user: User | null) => (user ? { type: 'user', id: user.id } : null) })
    expectTypeOf(untyped).toEqualTypeOf<(input: User | null) => Promise<RbacContext>>()
    const typed = createRbacContext({ rbac: engine, getSubject: guest })
    expectTypeOf(typed).toEqualTypeOf<(input: unknown) => Promise<RbacContext<AppRbac>>>()
    createRbacContext({ rbac, getSubject: async (req: Request) => ({ type: 'user', id: req.url }), team: (req) => req.url, guard: 'api' })
    function invalid() {
      // @ts-expect-error -- `rbac` is required
      createRbacContext({ getSubject: guest })
      // @ts-expect-error -- a subject needs `type` and `id`
      createRbacContext({ rbac, getSubject: () => ({ type: 'user' }) })
      // @ts-expect-error -- team ids are string | number | null
      createRbacContext({ rbac, getSubject: guest, team: () => ({}) })
      // exactOptionalPropertyTypes: an explicit `undefined` is accepted, same as leaving the option out
      createRbacContext({ rbac, getSubject: guest, guard: undefined, team: undefined })
    }
    expectTypeOf(invalid).toBeFunction()
  })
})

describe('trpc types: guards narrow ctx.rbac', () => {
  type Context = RbacContext<typeof engine> & { user: User | null }
  const t = initTRPC.context<Context>().create()
  const typed = createGuards<typeof engine>()

  it('return a middleware that needs ctx.rbac and narrows it to a non-null subject', () => {
    for (const guard of [requirePermission, requireRole, requireRoleOrPermission, canAny, canAll]) {
      expectTypeOf(guard).returns.toEqualTypeOf<RbacMiddleware>()
    }
    expectTypeOf(typed.requireRole).returns.toEqualTypeOf<RbacMiddleware<SubjectRbac<AppRbac>>>()
    expectTypeOf<RbacProcedureContext>().toEqualTypeOf<{ rbac: SubjectRbac<any, any> | null }>()
  })

  it('after a typed guard, ctx.rbac is a typed SubjectRbac, never null; the rest of ctx is kept', () => {
    function routes() {
      t.procedure.query(({ ctx }) => {
        expectTypeOf(ctx.rbac).toEqualTypeOf<SubjectRbac<AppRbac> | null>()
      })
      t.procedure.use(typed.requirePermission('edit articles')).query(async ({ ctx }) => {
        expectTypeOf(ctx.rbac).toEqualTypeOf<SubjectRbac<AppRbac>>()
        expectTypeOf(ctx.user).toEqualTypeOf<User | null>()
        await ctx.rbac.can('publish articles')
        // @ts-expect-error -- typo
        await ctx.rbac.can('publish artciles')
      })
      const extra = t.middleware(({ next }) => next({ ctx: { tenant: 'acme' } }))
      t.procedure
        .use(extra)
        .input((value) => value as { id: string })
        .use(typed.requireRole('admin'))
        .use(typed.canAny('edit articles', 'delete articles'))
        .mutation(({ ctx, input }) => {
          expectTypeOf(ctx.tenant).toEqualTypeOf<string>()
          expectTypeOf(ctx.rbac).toEqualTypeOf<SubjectRbac<AppRbac>>()
          expectTypeOf(input).toEqualTypeOf<{ id: string }>()
        })
      // The guards exported by the package narrow to an untyped SubjectRbac.
      t.procedure.use(requirePermission('anything')).query(({ ctx }) => {
        expectTypeOf(ctx.rbac).toEqualTypeOf<SubjectRbac>()
      })
    }
    expectTypeOf(routes).toBeFunction()
  })

  it('a procedure whose context has no rbac cannot use a guard, unless the guards have a resolve', () => {
    function routes() {
      const plain = initTRPC.context<{ user: User | null }>().create()
      // @ts-expect-error -- no `rbac` in the context
      plain.procedure.use(requirePermission('edit articles'))
      // An earlier middleware can add it.
      plain.procedure
        .use(plain.middleware(({ next }) => next({ ctx: { rbac: null as SubjectRbac | null } })))
        .use(requirePermission('edit articles'))
        .query(({ ctx }) => expectTypeOf(ctx.rbac).toEqualTypeOf<SubjectRbac>())

      const resolved = createGuards<typeof engine>({
        resolve: ({ ctx }: { ctx: { user: User | null } }) => (ctx.user ? engine.for({ type: 'user', id: ctx.user.id }) : null),
      })
      expectTypeOf(resolved).toEqualTypeOf<Guards<AppRbac, any>>()
      plain.procedure.use(resolved.requireRole('admin')).query(async ({ ctx }) => {
        expectTypeOf(ctx.rbac).toEqualTypeOf<SubjectRbac<AppRbac>>()
        expectTypeOf(ctx.user).toEqualTypeOf<User | null>()
      })
    }
    expectTypeOf(routes).toBeFunction()
  })

  it('works with meta and a typed root', () => {
    function routes() {
      const withMeta = initTRPC.context<RbacContext>().meta<{ audit: boolean }>().create()
      withMeta.procedure.meta({ audit: true }).use(requireRole('admin')).query(() => 'ok')
    }
    expectTypeOf(routes).toBeFunction()
  })
})

describe('trpc types: guard arguments', () => {
  const typed = createGuards<AppRbac>()

  it('accept names, pipe strings, arrays and a trailing options object', () => {
    function valid() {
      requirePermission('edit articles')
      requirePermission('edit articles|delete articles')
      requirePermission('edit articles', 'publish articles')
      requirePermission(['edit articles', 'publish articles'] as const)
      requirePermission(['edit articles'], 'publish articles', { any: true })
      requirePermission('edit articles', { any: false, exposeRequirements: true })
      requireRole('admin', 'editor', { all: true })
      requireRole(['admin', 'editor'], { onForbidden: () => new TRPCError({ code: 'NOT_FOUND' }) })
      requireRoleOrPermission(['admin', 'edit articles'], { exposeRequirements: true })
      canAny('edit articles', 'publish articles')
      canAll('edit articles', 'publish|review', { guard: 'api' })
    }
    expectTypeOf(valid).toBeFunction()
  })

  it('reject wrong arguments', () => {
    function invalid() {
      // @ts-expect-error -- names are strings
      requirePermission(1)
      // @ts-expect-error -- `all` is a role option
      requirePermission('edit articles', { all: true })
      // @ts-expect-error -- `any` is a permission option
      requireRole('admin', { any: true })
      // @ts-expect-error -- role-or-permission has no any/all option
      requireRoleOrPermission('admin', { any: true })
      // @ts-expect-error -- no names
      requirePermission()
      // @ts-expect-error -- options before a name
      requireRole({ all: true }, 'admin')
      // @ts-expect-error -- handlers return (or throw) an Error
      requireRole('a', { onForbidden: () => 'forbidden' })
      // @ts-expect-error -- `guard` is a string
      requireRole('admin', { guard: 1 })
      // @ts-expect-error -- `guard` is per guard, not a `createGuards()` default
      createGuards({ guard: 'api' })
      // exactOptionalPropertyTypes: an explicit `undefined` is accepted, same as leaving the option out
      requirePermission('a', { any: undefined, onForbidden: undefined })
    }
    expectTypeOf(invalid).toBeFunction()
  })

  it('types the guards of createGuards<T>() with the names of T', () => {
    type R = SubjectRbac<AppRbac>
    expectTypeOf(typed).toEqualTypeOf<Guards<AppRbac>>()
    expectTypeOf(createGuards<typeof engine>()).toEqualTypeOf<Guards<AppRbac>>()
    expectTypeOf(typed.requirePermission).toEqualTypeOf<Guard<AppPermission, PermissionGuardOptions<R>, R>>()
    expectTypeOf(typed.requireRole).toEqualTypeOf<Guard<AppRole, RoleGuardOptions<R>, R>>()
    expectTypeOf(typed.requireRoleOrPermission).toEqualTypeOf<
      Guard<AppPermission | AppRole, RoleOrPermissionGuardOptions<R>, R>
    >()
    expectTypeOf(typed.canAny).toEqualTypeOf<Guard<AppPermission, RouteGuardOptions<R>, R>>()
    expectTypeOf(typed.canAll).toEqualTypeOf<Guard<AppPermission, RouteGuardOptions<R>, R>>()
    expectTypeOf(createGuards()).toEqualTypeOf<Guards>()
    expectTypeOf(requirePermission).toEqualTypeOf<Guard<string, PermissionGuardOptions>>()
    expectTypeOf<GuardsFor<AppRbac>>().toEqualTypeOf<Guards<AppRbac>>()
  })

  it('reject unknown names, calls without names and options that are not last', () => {
    function invalid() {
      typed.requirePermission('edit articles|delete articles', 'publish articles', { any: true })
      typed.requireRole('admin|editor', { all: true })
      typed.canAll(['edit articles', 'publish articles|delete articles'])
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
      // @ts-expect-error -- no names
      typed.requireRole()
      // @ts-expect-error -- options before a name
      typed.requirePermission({ any: true }, 'edit articles')
    }
    expectTypeOf(invalid).toBeFunction()
  })
})

describe('trpc types: handlers and options', () => {
  it('types GuardContext, GuardHandler and the options', () => {
    expectTypeOf<GuardKind>().toEqualTypeOf<'permission' | 'role' | 'role_or_permission'>()
    expectTypeOf<GuardContext>().toEqualTypeOf<{ kind: GuardKind; requirements: string[][] }>()
    expectTypeOf<GuardCallOptions>().toEqualTypeOf<{ ctx: any; path: string; type: TRPCProcedureType }>()
    expectTypeOf<GuardHandlerOptions>().toEqualTypeOf<{ ctx: any; path: string; type: TRPCProcedureType; rbac: SubjectRbac | null }>()
    expectTypeOf<GuardHandler>().parameters.toEqualTypeOf<[GuardHandlerOptions, GuardContext]>()
    expectTypeOf<GuardHandler>().returns.toEqualTypeOf<Error | Promise<Error>>()
    expectTypeOf<GuardHandlers>().toEqualTypeOf<{
      onUnauthenticated?: GuardHandler
      onForbidden?: GuardHandler
      exposeRequirements?: boolean
    }>()
    expectTypeOf<CreateGuardsOptions>().toEqualTypeOf<{
      onUnauthenticated?: GuardHandler
      onForbidden?: GuardHandler
      exposeRequirements?: boolean
      resolve?: RbacResolver
    }>()
    expectTypeOf<RbacResolver>().returns.toEqualTypeOf<
      SubjectRbac | null | undefined | Promise<SubjectRbac | null | undefined>
    >()
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
    expectTypeOf<RoleOrPermissionGuardOptions>().toEqualTypeOf<RouteGuardOptions>()
  })

  it('the handlers of createGuards<T>() get a typed subject; they return or throw an Error', () => {
    createGuards<typeof engine>({
      onUnauthenticated: ({ rbac: subject, path }) => {
        expectTypeOf(subject).toEqualTypeOf<SubjectRbac<AppRbac> | null>()
        return new TRPCError({ code: 'UNAUTHORIZED', message: `login for ${path}` })
      },
      onForbidden: async ({ rbac: subject }, { kind, requirements }) => {
        expectTypeOf(kind).toEqualTypeOf<GuardKind>()
        expectTypeOf(requirements).toEqualTypeOf<string[][]>()
        // @ts-expect-error -- typo
        await subject?.can('edit artcles')
        throw new TRPCError({ code: 'NOT_FOUND' })
      },
      exposeRequirements: true,
    })
    // @ts-expect-error -- `exposeRequirements` is a boolean
    createGuards({ exposeRequirements: 'yes' })
  })
})

describe('trpc types: errors', () => {
  it('rbacErrorFormatter adds data.rbac to the error shape clients infer', () => {
    const t = initTRPC.context<RbacContext>().create({ errorFormatter: rbacErrorFormatter })
    const router = t.router({ a: t.procedure.use(requireRole('admin')).query(() => 'ok') })
    expectTypeOf<inferRouterError<typeof router>['data']['rbac']>().toEqualTypeOf<RbacErrorBody | null>()
    expectTypeOf<inferRouterError<typeof router>['data']['httpStatus']>().toEqualTypeOf<number>()

    const combined = initTRPC.create({
      errorFormatter: (opts) => {
        const shape = rbacErrorFormatter(opts)
        return { ...shape, data: { ...shape.data, extra: true } }
      },
    })
    const other = combined.router({ a: combined.procedure.query(() => 'ok') })
    expectTypeOf<inferRouterError<typeof other>['data']['rbac']>().toEqualTypeOf<RbacErrorBody | null>()
    expectTypeOf<inferRouterError<typeof other>['data']['extra']>().toEqualTypeOf<boolean>()
  })

  it('types the error body and classes', () => {
    expectTypeOf<RbacErrorBody>().toEqualTypeOf<
      | { error: 'UNAUTHENTICATED'; message: string }
      | { error: 'FORBIDDEN'; reason: GuardKind; message: string; required?: string[][] }
    >()
    expectTypeOf(getRbacErrorBody).returns.toEqualTypeOf<RbacErrorBody | null>()
    expectTypeOf<RbacAccessError['body']>().toEqualTypeOf<RbacErrorBody>()
    expectTypeOf<RbacAccessError['status']>().toEqualTypeOf<401 | 403>()
    expectTypeOf<RbacAccessError['code']>().toEqualTypeOf<'RBAC_ACCESS_DENIED'>()
    expectTypeOf<RbacContextMissingError['code']>().toEqualTypeOf<'RBAC_CONTEXT_MISSING'>()
  })
})

// ------------------------------------------------------------------------------------- per-guard names

type GuardedRbac = {
  guards: {
    web: { roles: 'admin' | 'editor'; permissions: 'articles.edit' | 'api-keys.manage' }
    api: { roles: 'read-only' | 'full-access'; permissions: 'orders.read' | 'orders.write' }
  }
  defaultGuard: 'web'
}

describe('trpc types: per-guard names', () => {
  const guarded = createRbac<GuardedRbac>({ adapter: new MemoryAdapter() })

  it('returns ScopedGuards for a per-guard config, and Guards otherwise', () => {
    expectTypeOf(createGuards<GuardedRbac>()).toEqualTypeOf<ScopedGuards<GuardedRbac, 'web'>>()
    expectTypeOf(createGuards<typeof guarded, 'api'>()).toEqualTypeOf<ScopedGuards<GuardedRbac, 'api'>>()
    expectTypeOf(createGuards<AppRbac, 'api'>()).toEqualTypeOf<Guards<AppRbac>>()
    expectTypeOf(createGuards<GuardedRbac>().canAny).toEqualTypeOf<
      ScopedGuard<GuardedRbac, 'web', 'permission', RouteGuardOptions<SubjectRbac<GuardedRbac, 'web'>>>
    >()
  })

  it("checks names against the subject's guard, or the procedure's `guard` option", () => {
    function routes() {
      const web = createGuards<GuardedRbac>()
      const api = createGuards<GuardedRbac, 'api'>()
      web.requirePermission('articles.edit|api-keys.manage')
      web.requirePermission('orders.read', { guard: 'api' })
      web.requireRole('read-only', { guard: 'api', all: true })
      api.requirePermission('orders.read', 'orders.write', { any: true })
      api.requirePermission('api-keys.manage', { guard: 'web' })
      // @ts-expect-error -- `api-keys.manage` is a `web` permission
      api.requirePermission('api-keys.manage')
      // @ts-expect-error -- `admin` is a `web` role
      api.requireRole('admin')
      // @ts-expect-error -- not a typed guard
      web.requirePermission('orders.read', { guard: 'apii' })
      // @ts-expect-error -- not a typed guard
      createGuards<GuardedRbac, 'apii'>()
    }
    expectTypeOf(routes).toBeFunction()
  })

  it("types ctx.rbac with createRbacContext()'s guard", () => {
    const apiContext = createRbacContext({ rbac: guarded, guard: 'api', getSubject: guest })
    expectTypeOf(apiContext).returns.resolves.toEqualTypeOf<RbacContext<GuardedRbac, 'api'>>()
    expectTypeOf<RbacContext<GuardedRbac, 'api'>['rbac']>().toEqualTypeOf<SubjectRbac<GuardedRbac, 'api'> | null>()
    expectTypeOf(createRbacContext({ rbac: guarded, getSubject: guest })).returns.resolves.toEqualTypeOf<
      RbacContext<GuardedRbac, 'web'>
    >()
    function routes() {
      const t = initTRPC.context<RbacContext<GuardedRbac, 'api'>>().create()
      t.procedure.use(createGuards<GuardedRbac, 'api'>().requirePermission('orders.read')).query(async ({ ctx }) => {
        expectTypeOf(ctx.rbac).toEqualTypeOf<SubjectRbac<GuardedRbac, 'api'>>()
        await ctx.rbac.can('orders.write')
        // @ts-expect-error -- `ctx.rbac` is in guard `api`
        await ctx.rbac.can('articles.edit')
      })
      // @ts-expect-error -- not a typed guard
      createRbacContext({ rbac: guarded, guard: 'apii', getSubject: guest })
    }
    expectTypeOf(routes).toBeFunction()
  })
})
