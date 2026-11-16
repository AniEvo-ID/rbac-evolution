// Type tests: the public types are part of the API. `pnpm typecheck` (tsc) enforces the
// `expectTypeOf` assertions and every `@ts-expect-error` below; vitest only runs the shells.
// Calls that would need a real Next.js runtime live in functions that are never invoked.
import { describe, expectTypeOf, it } from 'vitest'
import { createRbac, MemoryAdapter } from '@anievo-id/rbac-evolution'
import type { DefaultRbacTypes, Rbac, RbacSnapshot, ScopeOptions, Subject } from '@anievo-id/rbac-evolution'
import type {
  AuthorizeResult,
  FailureReason,
  ForbiddenReason,
  NextRbac,
  NextRbacOptions,
  NextRbacFor,
  ScopedNextRbac,
  RequireOptions,
  WithRbacOptions,
} from '../src'
import { createNextRbac, RbacUnauthorizedError } from '../src'
import type {
  MaybePromise,
  MiddlewareRequest,
  PathMatcher,
  RbacMiddlewareOptions,
  RbacMiddlewareRule,
  Requirement,
  SnapshotCheckOptions,
} from '../src/middleware-entry'
import { createRbacMiddleware, matchPath, snapshotSatisfies } from '../src/middleware-entry'

const rbac: Rbac = createRbac({ adapter: new MemoryAdapter() })
const nextRbac = createNextRbac({ rbac, getSubject: () => null })
type AppTypes = { permissions: 'articles.edit' | 'articles.delete'; roles: 'writer' | 'admin' }
const typedRbac = createNextRbac({
  rbac: createRbac<AppTypes>({ adapter: new MemoryAdapter() }),
  getSubject: () => null,
})
const snapshot: RbacSnapshot = { roles: [], permissions: [] }

describe('createNextRbac options', () => {
  it('accepts the documented shapes', () => {
    expectTypeOf(createNextRbac<DefaultRbacTypes>).parameter(0).toEqualTypeOf<NextRbacOptions>()
    expectTypeOf(createNextRbac<DefaultRbacTypes>).returns.toEqualTypeOf<NextRbac>()
    expectTypeOf(nextRbac).toEqualTypeOf<NextRbac>()

    expectTypeOf({ rbac, getSubject: () => null }).toMatchTypeOf<NextRbacOptions>()
    expectTypeOf({
      rbac,
      getSubject: async (): Promise<Subject | undefined> => undefined,
      guard: 'web',
      team: async () => 1,
      loginUrl: '/login',
      onUnauthenticated: (): never => {
        throw new Error('x')
      },
    }).toMatchTypeOf<NextRbacOptions>()
    expectTypeOf<NextRbacOptions['team']>().toEqualTypeOf<
      string | number | null | (() => MaybePromise<string | number | null | undefined>) | undefined
    >()

    const options = (o: NextRbacOptions) => o
    void function neverCalled() {
      // @ts-expect-error -- `getSubject` is required
      options({ rbac })
      // @ts-expect-error -- `getSubject` returns a Subject, not a user id
      options({ rbac, getSubject: () => 1 })
      // exactOptionalPropertyTypes: an explicit `undefined` is accepted, same as leaving the option out
      options({ rbac, getSubject: () => null, guard: undefined })
      // @ts-expect-error -- `onUnauthorized` must throw (return `never`)
      options({ rbac, getSubject: () => null, onUnauthorized: () => 'nope' })
    }
  })

  it('infers the typed names of the rbac instance', () => {
    expectTypeOf<NextRbacOptions['rbac']>().toEqualTypeOf<Rbac>()
    expectTypeOf<NextRbacOptions<AppTypes>['rbac']>().toEqualTypeOf<Rbac<AppTypes>>()
    expectTypeOf(typedRbac).toEqualTypeOf<NextRbac<AppTypes>>()
    expectTypeOf(typedRbac.rbac).toEqualTypeOf<Rbac<AppTypes>>()
    expectTypeOf<Parameters<NextRbac['can']>[0]>().toEqualTypeOf<string>()
    expectTypeOf<Parameters<NextRbac<AppTypes>['can']>[0]>().toEqualTypeOf<'articles.edit' | 'articles.delete'>()
    expectTypeOf<Parameters<NextRbac<AppTypes>['hasRole']>[0]>().toEqualTypeOf<
      'writer' | 'admin' | readonly ('writer' | 'admin')[]
    >()
  })
})

describe('typed names', () => {
  it('accepts typed names, pipe lists and arrays', () => {
    void async function neverCalled() {
      await typedRbac.requirePermission('articles.edit')
      await typedRbac.requirePermission('articles.edit|articles.delete', { all: true })
      await typedRbac.requirePermission(['articles.edit', 'articles.delete'])
      await typedRbac.requireRole('writer | admin')
      await typedRbac.requireRoleOrPermission(['admin', 'articles.edit'])
      await typedRbac.can('articles.delete')
      await typedRbac.canAny(['articles.edit', 'articles.delete'])
      await typedRbac.canAll('articles.edit')
      await typedRbac.hasRole(['writer', 'admin'])
      await typedRbac.hasAllRoles('admin')
      await typedRbac.authorize({ permission: 'articles.edit|articles.delete' })
      await typedRbac.authorize({ roleOrPermission: ['writer', 'articles.edit'] })
      typedRbac.withPermission('articles.edit', async () => 1)
      typedRbac.withRole(['admin'], async () => 1)
      typedRbac.withRbac(() => new Response(), { role: 'admin|writer', guard: 'api' })
      // A `string` (or `string[]`) value is not checked.
      const dynamic: string = 'articles.edit'
      await typedRbac.requirePermission(dynamic)
      await typedRbac.requireRole([dynamic])
    }
  })

  it('rejects typos, also inside pipe lists and arrays', () => {
    void async function neverCalled() {
      // @ts-expect-error -- typo
      await typedRbac.requirePermission('articles.edti')
      // @ts-expect-error -- typo inside a pipe list
      await typedRbac.requirePermission('articles.edit|articles.delte')
      // @ts-expect-error -- typo inside an array
      await typedRbac.requirePermission(['articles.edit', 'nope'], { all: true })
      // @ts-expect-error -- a role is not a permission
      await typedRbac.requirePermission('admin')
      // @ts-expect-error -- a permission is not a role
      await typedRbac.requireRole('articles.edit')
      // @ts-expect-error -- neither a role nor a permission
      await typedRbac.requireRoleOrPermission('admin|nope')
      // @ts-expect-error -- typo
      await typedRbac.can('articles.edti')
      // @ts-expect-error -- typo inside an array
      await typedRbac.canAny(['articles.edit', 'nope'])
      // @ts-expect-error -- typo
      await typedRbac.canAll('nope')
      // @ts-expect-error -- typo
      await typedRbac.hasRole('admn')
      // @ts-expect-error -- typo
      await typedRbac.hasAllRoles(['admin', 'nope'])
      // @ts-expect-error -- typo inside a pipe list
      await typedRbac.authorize({ permission: 'articles.edit|nope' })
      // @ts-expect-error -- typo
      await typedRbac.authorize({ role: 'nope' })
      // @ts-expect-error -- typo
      typedRbac.withPermission('nope', async () => 1)
      // @ts-expect-error -- typo inside a pipe list
      typedRbac.withRole('admin|nope', async () => 1)
      // @ts-expect-error -- typo inside a pipe list
      typedRbac.withRbac(() => new Response(), { permission: 'articles.edit|nope' })
      // @ts-expect-error -- typo
      typedRbac.withRbac(() => new Response(), { roleOrPermission: ['nope'] })
    }
  })

  it('an untyped engine still accepts any string', () => {
    void async function neverCalled() {
      await nextRbac.requirePermission('anything|else')
      await nextRbac.requireRole(['whatever'])
      await nextRbac.requireRoleOrPermission('x')
      await nextRbac.can('anything')
      await nextRbac.hasRole(['x', 'y'])
      await nextRbac.authorize({ permission: 'a|b', all: true })
      nextRbac.withRbac(() => new Response(), { roleOrPermission: 'anything' })
      // Requirement values typed as the (untyped) unions are accepted too.
      const options: WithRbacOptions = { permission: ['a', 'b'], guard: 'api' }
      nextRbac.withRbac(() => new Response(), options)
      typedRbac.withRbac(() => new Response(), options)
      const requirement: Requirement = { role: 'x' }
      await typedRbac.authorize(requirement)
      const names: readonly string[] = ['x']
      await typedRbac.requirePermission(names)
    }
  })

  it('wrapped server actions keep their parameter and return types', () => {
    const save = typedRbac.withPermission('articles.edit', (id: number, data: { title: string }) => ({ id, ...data }))
    expectTypeOf(save).toEqualTypeOf<(id: number, data: { title: string }) => Promise<{ title: string; id: number }>>()
    const remove = typedRbac.withRole(['admin', 'writer'], async (id: string, ...rest: boolean[]) => id.length + rest.length)
    expectTypeOf(remove).toEqualTypeOf<(id: string, ...rest: boolean[]) => Promise<number>>()
    type Ctx = { params: Promise<{ id: string }> }
    const GET = typedRbac.withRbac(async (_req: Request, _ctx: Ctx) => new Response(), { permission: 'articles.delete' })
    expectTypeOf(GET).toEqualTypeOf<(req: Request, ctx: Ctx) => Promise<Response>>()
  })
})

describe('server components & pages: require*()', () => {
  it('takes a name, a pipe string or an array, plus trailing options, and resolves to the subject', () => {
    // Generic over the names (so they can be checked); the options stay `RequireOptions`.
    expectTypeOf<Parameters<NextRbac['requirePermission']>[1]>().toEqualTypeOf<RequireOptions | undefined>()
    expectTypeOf<Parameters<NextRbac['requireRole']>[1]>().toEqualTypeOf<RequireOptions | undefined>()
    expectTypeOf<Parameters<NextRbac['requireRoleOrPermission']>[1]>().toEqualTypeOf<RequireOptions | undefined>()
    expectTypeOf(nextRbac.requirePermission).returns.toEqualTypeOf<Promise<Subject>>()
    expectTypeOf(nextRbac.requireRole).returns.toEqualTypeOf<Promise<Subject>>()

    expectTypeOf<RequireOptions>().toMatchTypeOf<ScopeOptions>()
    expectTypeOf({ all: true, guard: 'api', team: 7, loginUrl: '/login' }).toMatchTypeOf<RequireOptions>()

    void async function neverCalled() {
      await nextRbac.requirePermission('articles.edit')
      await nextRbac.requirePermission('articles.edit|articles.delete')
      await nextRbac.requirePermission(['articles.edit', 'articles.delete'] as const, { all: true })
      await nextRbac.requireRole('admin', { guard: 'api', team: null })
      await nextRbac.requireRoleOrPermission(['admin', 'articles.edit'])
      // @ts-expect-error -- names are not variadic: extra names go in an array
      await nextRbac.requirePermission('a', 'b')
      // @ts-expect-error -- unknown option
      await nextRbac.requireRole('admin', { any: true })
      // exactOptionalPropertyTypes: an explicit `undefined` is accepted, same as leaving the option out
      await nextRbac.requirePermission('a', { all: undefined })
      // @ts-expect-error -- team is an id or null, not an object
      await nextRbac.requireRole('admin', { team: { id: 1 } })
    }
  })

  it('per-call guard option: `{ guard: string }` on every require*(), typed names included', () => {
    expectTypeOf<RequireOptions['guard']>().toEqualTypeOf<string | undefined>()
    void async function neverCalled() {
      await nextRbac.requireRole('admin', { guard: 'api' })
      await nextRbac.requirePermission('articles.edit', { guard: 'api', all: true })
      await nextRbac.requireRoleOrPermission('admin|articles.edit', { guard: 'api' })
      await typedRbac.requireRole('admin', { guard: 'api' })
      await typedRbac.requirePermission(['articles.edit'], { guard: undefined })
      // @ts-expect-error -- `guard` is a string
      await nextRbac.requireRole('admin', { guard: 1 })
      // @ts-expect-error -- `guard` is a string
      await typedRbac.requirePermission('articles.edit', { guard: 1 })
      // @ts-expect-error -- `guard` is a string
      await nextRbac.requireRoleOrPermission('admin', { guard: 1 })
    }
  })

  it('non-throwing checks return booleans, snapshots and an authorize() union', () => {
    expectTypeOf(nextRbac.can).returns.toEqualTypeOf<Promise<boolean>>()
    expectTypeOf(nextRbac.canAny).parameter(0).toEqualTypeOf<string | readonly string[]>()
    expectTypeOf(nextRbac.hasRole).parameter(0).toEqualTypeOf<string | readonly string[]>()
    expectTypeOf(nextRbac.getSnapshot).returns.toEqualTypeOf<Promise<RbacSnapshot>>()
    expectTypeOf(nextRbac.getSubject).returns.toEqualTypeOf<Promise<Subject | null>>()
    expectTypeOf(nextRbac.authorize).returns.toEqualTypeOf<Promise<AuthorizeResult>>()

    const narrow = (result: AuthorizeResult) => {
      if (result.ok) {
        expectTypeOf(result.subject).toEqualTypeOf<Subject>()
      } else if (result.reason === 'unauthenticated') {
        expectTypeOf(result.subject).toEqualTypeOf<null>()
      } else {
        expectTypeOf(result.reason).toEqualTypeOf<'unauthorized'>()
        expectTypeOf(result.subject).toEqualTypeOf<Subject>()
      }
    }
    expectTypeOf(narrow).parameter(0).toEqualTypeOf<AuthorizeResult>()
  })
})

describe('server actions: withPermission() / withRole()', () => {
  it('keeps the parameter types and promisifies the return type', () => {
    const save = withNames((id: number, data: { title: string }) => ({ id, title: data.title }))
    expectTypeOf(save).parameters.toEqualTypeOf<[id: number, data: { title: string }]>()
    expectTypeOf(save).returns.toEqualTypeOf<Promise<{ id: number; title: string }>>()

    // An async action is not double-wrapped.
    const remove = nextRbac.withRole('admin', async (id: string) => id.length)
    expectTypeOf(remove).toEqualTypeOf<(id: string) => Promise<number>>()

    // FormData actions (`<form action={...}>`) and zero-argument actions.
    const fromForm = nextRbac.withPermission(['a', 'b'], async (form: FormData) => form.get('x'))
    expectTypeOf(fromForm).toEqualTypeOf<(form: FormData) => Promise<FormDataEntryValue | null>>()
    const noArgs = nextRbac.withPermission('a', () => undefined, { guard: 'web' })
    expectTypeOf(noArgs).toEqualTypeOf<() => Promise<undefined>>()

    // Optional and rest parameters survive.
    const opt = nextRbac.withPermission('a', (a: string, b?: number, ...rest: boolean[]) => [a, b, rest] as const)
    expectTypeOf(opt).parameters.toEqualTypeOf<[a: string, b?: number, ...rest: boolean[]]>()

    void async function neverCalled() {
      // @ts-expect-error -- wrapped action keeps its parameter types
      await save('1', { title: 'x' })
      // @ts-expect-error -- and its arity
      await save(1)
      // @ts-expect-error -- the third argument is ScopeOptions, not a requirement
      nextRbac.withPermission('a', () => 1, { all: true })
      // exactOptionalPropertyTypes: an explicit `undefined` is accepted, same as leaving the option out
      nextRbac.withRole('a', () => 1, { guard: undefined })
    }
  })

  it('denials throw a typed RbacUnauthorizedError', () => {
    expectTypeOf<RbacUnauthorizedError['reason']>().toEqualTypeOf<FailureReason>()
    expectTypeOf<FailureReason>().toEqualTypeOf<'unauthenticated' | 'unauthorized'>()
    expectTypeOf<RbacUnauthorizedError['status']>().toEqualTypeOf<401 | 403>()
    expectTypeOf(RbacUnauthorizedError).constructorParameters.toEqualTypeOf<[reason: FailureReason, message?: string]>()
  })
})

describe('route handlers: withRbac()', () => {
  it('keeps the handler parameters and requires a Response', () => {
    type Ctx = { params: Promise<{ id: string }> }
    const GET = nextRbac.withRbac(async (req: Request, ctx: Ctx) => Response.json({ url: req.url, ctx }), {
      permission: 'articles.view',
    })
    expectTypeOf(GET).toEqualTypeOf<(req: Request, ctx: Ctx) => Promise<Response>>()

    expectTypeOf({ permission: 'a|b', all: true, guard: 'api' }).toMatchTypeOf<WithRbacOptions>()
    expectTypeOf({ role: ['admin', 'editor'] as const, team: 1 }).toMatchTypeOf<WithRbacOptions>()
    expectTypeOf({ roleOrPermission: 'admin' }).toMatchTypeOf<WithRbacOptions>()

    const handler = () => new Response()
    void function neverCalled() {
      // @ts-expect-error -- a route handler must return a Response
      nextRbac.withRbac(() => 'text', { permission: 'a' })
      // @ts-expect-error -- exactly one of permission / role / roleOrPermission
      nextRbac.withRbac(handler, { permission: 'a', role: 'b' })
      // @ts-expect-error -- a requirement is needed
      nextRbac.withRbac(handler, { guard: 'web' })
      // @ts-expect-error -- `all` does not apply to roleOrPermission
      nextRbac.withRbac(handler, { roleOrPermission: 'a', all: true })
      // @ts-expect-error -- options are required
      nextRbac.withRbac(handler)
      // @ts-expect-error -- handler first, options second
      nextRbac.withRbac({ permission: 'a' }, handler)
    }
  })
})

describe('/middleware entry: createRbacMiddleware()', () => {
  it('accepts snapshot mode or rbac mode, not a mix', () => {
    const mw = createRbacMiddleware({
      rules: [{ matcher: '/admin/:path*', role: 'admin' }],
      getSnapshot: async () => snapshot,
      wildcard: true,
      superAdminRoles: ['super-admin'] as const,
      loginUrl: (req) => new URL('/login', req.url),
    })
    expectTypeOf(mw).toEqualTypeOf<(req: MiddlewareRequest) => Promise<Response | undefined>>()

    const withRbac = createRbacMiddleware({
      rules: [{ matcher: /^\/api\//, permission: ['a', 'b'], all: true }],
      rbac,
      getSubject: () => ({ type: 'user', id: 1 }),
      guard: 'api',
      team: async () => undefined,
      onUnauthorized: (_req, rule) => Response.json({ rule: rule.matcher }, { status: 403 }),
    })
    expectTypeOf(withRbac).parameter(0).toEqualTypeOf<MiddlewareRequest>()

    // A custom request type flows into every callback.
    type MyRequest = Request & { nextUrl: { pathname: string }; auth: RbacSnapshot | null }
    const custom = createRbacMiddleware<MyRequest>({
      rules: [],
      getSnapshot: (req) => {
        expectTypeOf(req).toEqualTypeOf<MyRequest>()
        return req.auth
      },
    })
    expectTypeOf(custom).parameter(0).toEqualTypeOf<MyRequest>()
    expectTypeOf<NextRequestLike>().toMatchTypeOf<MiddlewareRequest>()

    const options = (o: RbacMiddlewareOptions) => o
    void function neverCalled() {
      // @ts-expect-error -- needs either getSnapshot or rbac + getSubject
      options({ rules: [] })
      // @ts-expect-error -- rbac mode needs getSubject
      options({ rules: [], rbac })
      // @ts-expect-error -- snapshot mode and rbac mode are exclusive
      options({ rules: [], rbac, getSubject: () => null, getSnapshot: () => null })
      // @ts-expect-error -- `wildcard` only applies to snapshot mode
      options({ rules: [], rbac, getSubject: () => null, wildcard: true })
      // exactOptionalPropertyTypes: an explicit `undefined` is accepted, same as leaving the option out
      options({ rules: [], getSnapshot: () => null, loginUrl: undefined })
    }
  })

  it('route rules: matcher patterns and name shapes', () => {
    expectTypeOf<RbacMiddlewareRule['matcher']>().toEqualTypeOf<PathMatcher>()
    expectTypeOf<PathMatcher>().toEqualTypeOf<string | RegExp | readonly (string | RegExp)[]>()
    expectTypeOf<RbacMiddlewareRule['permission']>().toEqualTypeOf<string | readonly string[] | undefined>()

    const rules = [
      { matcher: '/admin' },
      { matcher: ['/a/:id', /^\/b/], permission: 'a|b' },
      { matcher: '/c', role: ['x', 'y'], all: true },
      { matcher: '/d', roleOrPermission: 'admin' },
    ] as const satisfies readonly RbacMiddlewareRule[]
    expectTypeOf(rules).toMatchTypeOf<readonly RbacMiddlewareRule[]>()

    const rule = (r: RbacMiddlewareRule) => r
    void function neverCalled() {
      // @ts-expect-error -- matcher is required
      rule({ permission: 'a' })
      // @ts-expect-error -- unknown keys are rejected (typo of `permission`)
      rule({ matcher: '/a', permissions: 'a' })
      // @ts-expect-error -- matcher is a pattern, not a function
      rule({ matcher: (p: string) => p.startsWith('/a') })
      // exactOptionalPropertyTypes: an explicit `undefined` is accepted, same as leaving the option out
      rule({ matcher: '/a', role: 'x', all: undefined })
    }
  })

  it('snapshotSatisfies / matchPath', () => {
    expectTypeOf(snapshotSatisfies).parameters.toEqualTypeOf<
      [snapshot: RbacSnapshot, requirement: Requirement, options?: SnapshotCheckOptions]
    >()
    expectTypeOf(snapshotSatisfies).returns.toEqualTypeOf<boolean>()
    expectTypeOf(matchPath).parameters.toEqualTypeOf<[matcher: PathMatcher, pathname: string]>()
    expectTypeOf<ForbiddenReason>().toEqualTypeOf<'permission' | 'role' | 'role_or_permission'>()

    void function neverCalled() {
      snapshotSatisfies(snapshot, { permission: ['a', 'b'], all: true })
      // @ts-expect-error -- an empty requirement is not a Requirement
      snapshotSatisfies(snapshot, {})
      // @ts-expect-error -- `all` is not allowed with roleOrPermission
      snapshotSatisfies(snapshot, { roleOrPermission: 'a', all: false })
    }
  })
})

/** Structural stand-in for `NextRequest` (keeps this file free of a `next/server` import). */
type NextRequestLike = Request & { nextUrl: URL; cookies: { get(name: string): unknown } }

function withNames<Args extends unknown[], R>(action: (...args: Args) => MaybePromise<R>) {
  return nextRbac.withPermission('articles.edit', action)
}

// ------------------------------------------------------------------------------------- per-guard names (1.2)

describe('per-guard names', () => {
  type GuardedRbac = {
    guards: {
      web: { roles: 'admin' | 'editor'; permissions: 'articles.edit' | 'api-keys.manage' }
      api: { roles: 'read-only' | 'full-access'; permissions: 'orders.read' | 'orders.write' }
    }
    defaultGuard: 'web'
  }
  const guarded = createRbac<GuardedRbac>({ adapter: new MemoryAdapter() })
  const web = createNextRbac({ rbac: guarded, getSubject: () => null })
  const api = createNextRbac({ rbac: guarded, guard: 'api', getSubject: () => null })

  it('takes the guard of the helpers from the `guard` option', () => {
    expectTypeOf(web).toEqualTypeOf<ScopedNextRbac<GuardedRbac, 'web'>>()
    expectTypeOf(api).toEqualTypeOf<ScopedNextRbac<GuardedRbac, 'api'>>()
    // Flat configs: unchanged, whatever the guard.
    expectTypeOf(
      createNextRbac({ rbac: createRbac<AppTypes>({ adapter: new MemoryAdapter() }), guard: 'api', getSubject: () => null }),
    ).toEqualTypeOf<NextRbac<AppTypes>>()
    expectTypeOf<NextRbacFor<AppTypes>>().toEqualTypeOf<NextRbac<AppTypes>>()
    expectTypeOf<NextRbacFor>().toEqualTypeOf<NextRbac>()
    // @ts-expect-error -- not a typed guard
    createNextRbac({ rbac: guarded, guard: 'apii', getSubject: () => null })
  })

  it('checks names against the guard of the call', () => {
    async function check() {
      await web.can('articles.edit')
      await web.can('orders.read', { guard: 'api' })
      await api.can('orders.read')
      await api.hasRole(['read-only', 'full-access'])
      await web.hasAllRoles('full-access', { guard: 'api' })
      await api.requirePermission('orders.write')
      await web.requirePermission('orders.read|orders.write', { guard: 'api', all: true })
      await web.requireRoleOrPermission('admin|articles.edit')
      await web.authorize({ role: 'read-only' }, { guard: 'api' })
      web.withPermission('orders.read', async () => 1, { guard: 'api' })
      web.withRole('admin', async () => 1)
      web.withRbac(async () => new Response(), { permission: 'orders.read', guard: 'api' })
      api.withRbac(async () => new Response(), { role: 'admin', guard: 'web' })
      const anyGuard: string = 'api'
      await web.can('orders.read', { guard: anyGuard })

      // @ts-expect-error -- `api-keys.manage` is a `web` permission
      await api.can('api-keys.manage')
      // @ts-expect-error -- `api-keys.manage` is a `web` permission
      await web.can('api-keys.manage', { guard: 'api' })
      // @ts-expect-error -- `admin` is a `web` role
      await web.requireRole('admin', { guard: 'api' })
      // @ts-expect-error -- `orders.read` is an `api` permission
      await web.authorize({ permission: 'orders.read' })
      // @ts-expect-error -- `orders.read` is an `api` permission
      web.withRbac(async () => new Response(), { permission: 'orders.read' })
      // @ts-expect-error -- not a typed guard
      web.withRbac(async () => new Response(), { permission: 'orders.read', guard: 'apii' })
      // @ts-expect-error -- not a typed guard
      await web.can('orders.read', { guard: 'apii' })
    }
    expectTypeOf(check).toBeFunction()
  })
})
