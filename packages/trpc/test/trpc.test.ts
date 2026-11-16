import { createRbac, MemoryAdapter, type Rbac, type Subject } from '@anievo-id/rbac-evolution'
import { createTRPCClient, httpLink, TRPCClientError } from '@trpc/client'
import { initTRPC, TRPCError } from '@trpc/server'
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  canAll,
  canAny,
  createGuards,
  createRbacContext,
  getRbacErrorBody,
  RbacAccessError,
  RbacContextMissingError,
  type RbacContext,
  rbacErrorFormatter,
  requirePermission,
  requireRole,
  requireRoleOrPermission,
} from '../src'

async function seed(rbac: Rbac): Promise<void> {
  for (const p of ['edit articles', 'delete articles', 'publish articles']) await rbac.createPermission(p)
  await rbac.createRole('writer')
  await rbac.createRole('editor')
  await rbac.createRole('admin')
  await rbac.createRole('super-admin')
  await rbac.role('writer').givePermissionTo('edit articles')
  await rbac.role('editor').givePermissionTo('edit articles', 'publish articles')
  await rbac.for({ type: 'user', id: 1 }).assignRole('writer') // writer
  await rbac.for({ type: 'user', id: 2 }).assignRole('writer', 'editor') // writer + editor
  await rbac.for({ type: 'user', id: 3 }).assignRole('admin')
  await rbac.for({ type: 'user', id: 3 }).givePermissionTo('delete articles')
  await rbac.for({ type: 'user', id: 4 }).assignRole('super-admin')
  await rbac.for({ type: 'user', id: 6 }).assignRole('writer') // denied by the before hook all the same
  // api guard: user 3 is an api admin, user 1 can read orders through the api guard
  await rbac.createPermission('orders.read', { guard: 'api' })
  await rbac.createRole('admin', { guard: 'api' })
  await rbac.for({ type: 'user', id: 3 }, { guard: 'api' }).assignRole('admin')
  await rbac.for({ type: 'user', id: 1 }, { guard: 'api' }).givePermissionTo('orders.read')
}

type User = { id: number }
type Context = RbacContext & { user: User | null }

const userSubject = (user: User | null): Subject | null => (user ? { type: 'user', id: user.id } : null)

const rbac = createRbac({
  adapter: new MemoryAdapter(),
  superAdminRoles: ['super-admin'],
  // user 5 is allowed everything by the before hook, user 6 is denied everything
  before: ({ subject }) => (subject.subject.id === 5 ? true : subject.subject.id === 6 ? false : undefined),
})
const rbacContext = createRbacContext({ rbac, getSubject: userSubject })
const createContext = async (user: User | null): Promise<Context> => ({ user, ...(await rbacContext(user)) })

const t = initTRPC.context<Context>().create({ errorFormatter: rbacErrorFormatter })
const ok = () => 'ok'

const custom = createGuards({ onForbidden: () => new TRPCError({ code: 'NOT_FOUND' }) })

const router = t.router({
  me: t.procedure.query(async ({ ctx }) => (ctx.rbac ? await ctx.rbac.snapshot() : null)),
  edit: t.procedure.use(requirePermission('edit articles')).query(ok),
  editAndPublish: t.procedure.use(requirePermission('edit articles', 'publish articles')).query(ok),
  editAndPublishArray: t.procedure.use(requirePermission(['edit articles', 'publish articles'])).query(ok),
  publishOrDelete: t.procedure.use(requirePermission('publish articles|delete articles')).query(ok),
  publishOrDeleteAny: t.procedure.use(requirePermission('publish articles', 'delete articles', { any: true })).query(ok),
  unknownPermission: t.procedure.use(requirePermission('fly')).query(ok),
  exposed: t.procedure.use(requirePermission('delete articles', { exposeRequirements: true })).query(ok),
  admin: t.procedure.use(requireRole('admin')).query(ok),
  staff: t.procedure.use(requireRole('admin|editor')).query(ok),
  staffArgs: t.procedure.use(requireRole('admin', 'editor')).query(ok),
  writerAndEditor: t.procedure.use(requireRole('writer', 'editor', { all: true })).query(ok),
  adminOrPublish: t.procedure.use(requireRoleOrPermission('admin|publish articles')).query(ok),
  anyOf: t.procedure.use(canAny('publish articles', 'delete articles')).query(ok),
  allOf: t.procedure.use(canAll('edit articles', 'publish articles|delete articles')).query(ok),
  apiOrders: t.procedure.use(requirePermission('orders.read', { guard: 'api' })).query(ok),
  apiAdmin: t.procedure.use(requireRole('admin', { guard: 'api' })).query(ok),
  chained: t.procedure
    .use(requireRole('writer'))
    .use(requirePermission('publish articles'))
    .mutation(async ({ ctx }) => ctx.rbac.getRoleNames()),
  custom: t.procedure
    .use(
      requirePermission('delete articles', {
        onUnauthenticated: ({ path }) => new TRPCError({ code: 'BAD_REQUEST', message: `login for ${path}` }),
        onForbidden: async ({ rbac: subject, type }, { kind }) => {
          throw new TRPCError({ code: 'CONFLICT', message: `${kind} ${type} ${(await subject?.getRoleNames())?.join()}` })
        },
      }),
    )
    .query(ok),
  hidden: t.procedure.use(custom.requireRole('admin')).query(ok),
  hiddenUndefined: t.procedure.use(custom.requireRole('admin', { onForbidden: undefined })).query(ok),
  plainError: t.procedure.use(requireRole('admin', { onForbidden: () => new Error('plain') })).query(ok),
  failing: t.procedure.query(() => {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'not rbac' })
  }),
})

const caller = t.createCallerFactory(router)
const as = async (id?: number) => caller(await createContext(id === undefined ? null : { id }))

/** The error a call throws (fails the test when it does not throw). */
async function failure(call: Promise<unknown>): Promise<TRPCError> {
  try {
    await call
  } catch (error) {
    expect(error).toBeInstanceOf(TRPCError)
    return error as TRPCError
  }
  throw new Error('expected the call to throw')
}

const code = async (call: Promise<unknown>) => (await failure(call)).code

describe('rbac-evolution-trpc', () => {
  beforeAll(async () => {
    await seed(rbac)
  })

  it('createRbacContext() gives ctx.rbac (null for guests)', async () => {
    expect(await (await as()).me()).toBeNull()
    expect(await (await as(2)).me()).toEqual({ roles: ['writer', 'editor'], permissions: ['edit articles', 'publish articles'] })
  })

  it('throws UNAUTHORIZED for guests, with the 401 body as the cause', async () => {
    const error = await failure((await as()).edit())
    expect(error.code).toBe('UNAUTHORIZED')
    expect(error.message).toBe('User is not logged in.')
    expect(error.cause).toBeInstanceOf(RbacAccessError)
    expect((error.cause as RbacAccessError).status).toBe(401)
    expect(getRbacErrorBody(error)).toEqual({ error: 'UNAUTHENTICATED', message: 'User is not logged in.' })
  })

  it('requirePermission: single, all-of args, pipe = any-of, any option', async () => {
    expect(await (await as(1)).edit()).toBe('ok')
    expect(await code((await as(3)).edit())).toBe('FORBIDDEN')

    expect(await code((await as(1)).editAndPublish())).toBe('FORBIDDEN')
    expect(await (await as(2)).editAndPublish()).toBe('ok')
    expect(await code((await as(1)).editAndPublishArray())).toBe('FORBIDDEN')
    expect(await (await as(2)).editAndPublishArray()).toBe('ok')

    expect(await code((await as(1)).publishOrDelete())).toBe('FORBIDDEN')
    expect(await (await as(2)).publishOrDelete()).toBe('ok')
    expect(await (await as(3)).publishOrDelete()).toBe('ok')
    expect(await (await as(3)).publishOrDeleteAny()).toBe('ok')
    expect(await code((await as(1)).publishOrDeleteAny())).toBe('FORBIDDEN')

    expect(await code((await as(3)).unknownPermission())).toBe('FORBIDDEN')
  })

  it('throws FORBIDDEN without leaking requirements by default', async () => {
    const error = await failure((await as(3)).edit())
    expect(error.message).toBe('User does not have the right permissions.')
    expect((error.cause as RbacAccessError).status).toBe(403)
    expect(getRbacErrorBody(error)).toEqual({
      error: 'FORBIDDEN',
      reason: 'permission',
      message: 'User does not have the right permissions.',
    })
    expect(getRbacErrorBody(await failure((await as(1)).exposed()))).toEqual({
      error: 'FORBIDDEN',
      reason: 'permission',
      message: 'User does not have the right permissions.',
      required: [['delete articles']],
    })
  })

  it('requireRole: any by default (pipes or args), all option', async () => {
    expect(await (await as(3)).admin()).toBe('ok')
    expect(await code((await as(1)).admin())).toBe('FORBIDDEN')
    expect(await (await as(2)).staff()).toBe('ok')
    expect(await code((await as(1)).staff())).toBe('FORBIDDEN')
    expect(await (await as(3)).staffArgs()).toBe('ok')
    expect(await (await as(2)).writerAndEditor()).toBe('ok')
    expect(await code((await as(1)).writerAndEditor())).toBe('FORBIDDEN')
    expect(getRbacErrorBody(await failure((await as(1)).admin()))).toEqual({
      error: 'FORBIDDEN',
      reason: 'role',
      message: 'User does not have the right roles.',
    })
  })

  it('requireRoleOrPermission', async () => {
    expect(await (await as(3)).adminOrPublish()).toBe('ok') // role
    expect(await (await as(2)).adminOrPublish()).toBe('ok') // permission
    expect(await code((await as(1)).adminOrPublish())).toBe('FORBIDDEN')
    expect(await code((await as()).adminOrPublish())).toBe('UNAUTHORIZED')
    expect(getRbacErrorBody(await failure((await as(1)).adminOrPublish()))).toEqual({
      error: 'FORBIDDEN',
      reason: 'role_or_permission',
      message: 'User does not have any of the necessary access rights.',
    })
  })

  it('canAny / canAll', async () => {
    expect(await (await as(3)).anyOf()).toBe('ok')
    expect(await (await as(2)).anyOf()).toBe('ok')
    expect(await code((await as(1)).anyOf())).toBe('FORBIDDEN')
    expect(await (await as(2)).allOf()).toBe('ok')
    expect(await code((await as(1)).allOf())).toBe('FORBIDDEN')
    expect(await code((await as(3)).allOf())).toBe('FORBIDDEN')
  })

  it('checks in another guard with { guard }', async () => {
    expect(await (await as(1)).apiOrders()).toBe('ok')
    expect(await code((await as(2)).apiOrders())).toBe('FORBIDDEN')
    expect(await (await as(3)).apiAdmin()).toBe('ok')
    expect(await code((await as(1)).apiAdmin())).toBe('FORBIDDEN') // `admin` in `web` only
    expect(await code((await as()).apiAdmin())).toBe('UNAUTHORIZED')
  })

  it('lets super-admins through permission guards (checks go through can*)', async () => {
    expect(await (await as(4)).edit()).toBe('ok')
    expect(await (await as(4)).editAndPublish()).toBe('ok')
    expect(await (await as(4)).unknownPermission()).toBe('ok')
  })

  it('applies the engine before() hook', async () => {
    expect(await (await as(5)).edit()).toBe('ok')
    expect(await (await as(5)).unknownPermission()).toBe('ok')
    expect(await code((await as(6)).edit())).toBe('FORBIDDEN')
  })

  it('passes the narrowed ctx.rbac on, through chained guards', async () => {
    expect(await (await as(2)).chained()).toEqual(['writer', 'editor'])
    expect(await code((await as(1)).chained())).toBe('FORBIDDEN')
    expect(await code((await as(3)).chained())).toBe('FORBIDDEN')
  })

  it('supports custom handlers per guard and via createGuards', async () => {
    const guest = await failure((await as()).custom())
    expect([guest.code, guest.message]).toEqual(['BAD_REQUEST', 'login for custom'])
    expect(getRbacErrorBody(guest)).toBeNull()

    const forbidden = await failure((await as(1)).custom())
    expect([forbidden.code, forbidden.message]).toEqual(['CONFLICT', 'permission query writer'])

    expect(await code((await as(1)).hidden())).toBe('NOT_FOUND')
    expect(await (await as(3)).hidden()).toBe('ok')
    expect(await code((await as()).hidden())).toBe('UNAUTHORIZED')
    // An option set to `undefined` keeps the createGuards() default instead of resetting it.
    expect(await code((await as(1)).hiddenUndefined())).toBe('NOT_FOUND')
    // A plain Error reaches the client as INTERNAL_SERVER_ERROR.
    const plain = await failure((await as(1)).plainError())
    expect([plain.code, plain.message]).toEqual(['INTERNAL_SERVER_ERROR', 'plain'])
  })

  it('throws RbacContextMissingError when ctx.rbac is not set', async () => {
    const bare = initTRPC.create()
    const r = bare.router({ edit: bare.procedure.use(requirePermission('edit articles') as never).query(ok) })
    const error = await failure(bare.createCallerFactory(r)({}).edit())
    expect(error.code).toBe('INTERNAL_SERVER_ERROR')
    expect(error.cause).toBeInstanceOf(RbacContextMissingError)
    expect((error.cause as RbacContextMissingError).code).toBe('RBAC_CONTEXT_MISSING')
  })

  it('createGuards({ resolve }) reads the subject from the call instead of ctx.rbac', async () => {
    const plain = initTRPC.context<{ user: User | null }>().create()
    const seen: string[] = []
    const guards = createGuards({
      resolve: ({ ctx, path, type }) => {
        seen.push(`${type} ${path}`)
        const user = (ctx as { user: User | null }).user
        return user ? rbac.for({ type: 'user', id: user.id }) : undefined
      },
    })
    const r = plain.router({
      edit: plain.procedure.use(guards.requirePermission('edit articles')).query(async ({ ctx }) => ctx.rbac.getRoleNames()),
    })
    const call = plain.createCallerFactory(r)
    expect(await call({ user: { id: 1 } }).edit()).toEqual(['writer'])
    expect(await code(call({ user: { id: 3 } }).edit())).toBe('FORBIDDEN')
    expect(await code(call({ user: null }).edit())).toBe('UNAUTHORIZED')
    expect(seen).toEqual(['query edit', 'query edit', 'query edit'])
  })

  it('createRbacContext() takes guard and team', async () => {
    const teams = createRbac({ adapter: new MemoryAdapter(), teams: true })
    await teams.createRole('owner', { guard: 'api' })
    await teams.for({ type: 'user', id: 1 }, { guard: 'api', team: 7 }).assignRole('owner')
    const context = createRbacContext({
      rbac: teams,
      guard: 'api',
      getSubject: (input: { user: User; team?: number }) => ({ type: 'user', id: input.user.id }),
      team: (input) => input.team,
    })
    const tt = initTRPC.context<RbacContext>().create()
    const r = tt.router({ owner: tt.procedure.use(requireRole('owner')).query(ok) })
    const call = tt.createCallerFactory(r)
    expect(await call(await context({ user: { id: 1 }, team: 7 })).owner()).toBe('ok')
    expect(await code(call(await context({ user: { id: 1 }, team: 8 })).owner())).toBe('FORBIDDEN')
    // Without a team, the subject is checked outside any team.
    expect(await code(call(await context({ user: { id: 1 } })).owner())).toBe('FORBIDDEN')
  })

  it('rbacErrorFormatter() leaves other errors alone', async () => {
    expect(getRbacErrorBody(new Error('x'))).toBeNull()
    expect(getRbacErrorBody('x')).toBeNull()
    expect(getRbacErrorBody(new RbacAccessError({ error: 'UNAUTHENTICATED', message: 'm' }))).toEqual({
      error: 'UNAUTHENTICATED',
      message: 'm',
    })
    const shape = { code: -1, message: 'm', data: { code: 'BAD_REQUEST' } }
    expect(rbacErrorFormatter({ shape, error: new TRPCError({ code: 'BAD_REQUEST' }) })).toEqual({
      ...shape,
      data: { code: 'BAD_REQUEST', rbac: null },
    })
  })
})

describe('rbac-evolution-trpc over HTTP (fetch adapter)', () => {
  const handle = (path: string, user?: number, method: 'GET' | 'POST' = 'GET') =>
    fetchRequestHandler({
      endpoint: '/trpc',
      router,
      req: new Request(`http://localhost/trpc/${path}`, {
        method,
        headers: {
          ...(method === 'POST' && { 'content-type': 'application/json' }),
          ...(user !== undefined && { 'x-user': String(user) }),
        },
        ...(method === 'POST' && { body: '{}' }),
      }),
      createContext: ({ req }) => {
        const id = req.headers.get('x-user')
        return createContext(id ? { id: Number(id) } : null)
      },
    })

  it('answers 401 / 403 with the reason in error.data.rbac', async () => {
    const guest = await handle('edit')
    expect(guest.status).toBe(401)
    expect(await guest.json()).toMatchObject({
      error: {
        message: 'User is not logged in.',
        data: { code: 'UNAUTHORIZED', httpStatus: 401, path: 'edit', rbac: { error: 'UNAUTHENTICATED', message: 'User is not logged in.' } },
      },
    })

    const forbidden = await handle('admin', 1)
    expect(forbidden.status).toBe(403)
    const body = (await forbidden.json()) as { error: { data: { rbac: unknown } } }
    expect(body.error.data.rbac).toEqual({ error: 'FORBIDDEN', reason: 'role', message: 'User does not have the right roles.' })

    const exposed = await handle('exposed', 1)
    expect(((await exposed.json()) as { error: { data: { rbac: { required: unknown } } } }).error.data.rbac.required).toEqual([
      ['delete articles'],
    ])
  })

  it('allows, and sets data.rbac to null for other errors', async () => {
    const allowed = await handle('edit', 1)
    expect(allowed.status).toBe(200)
    expect(await allowed.json()).toEqual({ result: { data: 'ok' } })

    const mutation = await handle('chained', 2, 'POST')
    expect(await mutation.json()).toEqual({ result: { data: ['writer', 'editor'] } })

    const other = await handle('failing', 1)
    expect(other.status).toBe(400)
    expect(await other.json()).toMatchObject({ error: { message: 'not rbac', data: { code: 'BAD_REQUEST', rbac: null } } })
  })
})

describe('rbac-evolution-trpc with @trpc/client', () => {
  const client = (user?: number) =>
    createTRPCClient<typeof router>({
      links: [
        httpLink({
          url: 'http://localhost/trpc',
          headers: user === undefined ? {} : { 'x-user': String(user) },
          fetch: (input, init) =>
            fetchRequestHandler({
              endpoint: '/trpc',
              router,
              req: new Request(input as string, init as RequestInit),
              createContext: ({ req }) => {
                const id = req.headers.get('x-user')
                return createContext(id ? { id: Number(id) } : null)
              },
            }),
        }),
      ],
    })

  /** The client error a call rejects with. */
  async function clientFailure(call: Promise<unknown>) {
    try {
      await call
    } catch (error) {
      if (error instanceof TRPCClientError) return error as TRPCClientError<typeof router>
      throw error
    }
    throw new Error('expected the call to throw')
  }

  it('reads the reason from error.data.rbac', async () => {
    expect(await client(2).editAndPublish.query()).toBe('ok')
    expect(await client(2).chained.mutate()).toEqual(['writer', 'editor'])

    const guest = await clientFailure(client().edit.query())
    expect(guest.data?.httpStatus).toBe(401)
    expect(guest.data?.rbac).toEqual({ error: 'UNAUTHENTICATED', message: 'User is not logged in.' })

    const forbidden = await clientFailure(client(1).adminOrPublish.query())
    expect(forbidden.message).toBe('User does not have any of the necessary access rights.')
    expect(forbidden.data?.code).toBe('FORBIDDEN')
    expect(forbidden.data?.rbac?.error === 'FORBIDDEN' && forbidden.data.rbac.reason).toBe('role_or_permission')
  })
})
