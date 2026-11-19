import { createRbac, MemoryAdapter } from '@anievo-id/rbac-evolution'
import { betterAuth } from 'better-auth'
import { memoryAdapter } from 'better-auth/adapters/memory'
import { createAuthClient } from 'better-auth/client'
import { beforeEach, describe, expect, it } from 'vitest'
import { rbacPlugin, subjectFromSession, userSubject } from '../src'
import { rbacClient } from '../src/client'

const BASE = 'http://localhost:3000'

async function setup(options: Partial<Parameters<typeof rbacPlugin>[0]> = {}) {
  const rbac = createRbac({ adapter: new MemoryAdapter(), cache: false, teams: true })
  await rbac.createPermission('articles.edit')
  await rbac.createRole('member')
  await rbac.createRole('writer')
  await rbac.role('writer').givePermissionTo('articles.edit')
  const auth = betterAuth({
    baseURL: BASE,
    secret: 'test-secret-test-secret-test-secret-123',
    database: memoryAdapter({ user: [], session: [], account: [], verification: [] }),
    emailAndPassword: { enabled: true },
    user: { deleteUser: { enabled: true } },
    plugins: [rbacPlugin({ rbac, ...options })],
  })
  const signUp = async (email: string) => {
    const { headers, response } = await auth.api.signUpEmail({
      body: { email, password: 'password-1234', name: email },
      returnHeaders: true,
    })
    const cookie = (headers.getSetCookie?.() ?? [headers.get('set-cookie') ?? ''])
      .map((c) => c.split(';')[0])
      .join('; ')
    return { id: response.user.id, headers: new Headers({ cookie }) }
  }
  return { rbac, auth, signUp }
}

describe('rbacPlugin', () => {
  let ctx: Awaited<ReturnType<typeof setup>>
  beforeEach(async () => {
    ctx = await setup({ defaultRoles: ['member'] })
  })

  it('gives new users the default roles', async () => {
    const ana = await ctx.signUp('ana@example.com')
    expect(await ctx.rbac.for(userSubject(ana.id)).getRoleNames()).toEqual(['member'])
  })

  it('serves the snapshot of the signed-in user', async () => {
    const ana = await ctx.signUp('ana@example.com')
    await ctx.rbac.for(userSubject(ana.id)).assignRole('writer')
    const snapshot = await ctx.auth.api.getRbacSnapshot({ headers: ana.headers })
    expect(snapshot.roles.sort()).toEqual(['member', 'writer'])
    expect(snapshot.permissions).toEqual(['articles.edit'])
  })

  it('rejects the snapshot endpoint without a session', async () => {
    await expect(ctx.auth.api.getRbacSnapshot({ headers: new Headers() })).rejects.toMatchObject({ status: 'UNAUTHORIZED' })
  })

  it('revokes every role and permission when the user is deleted', async () => {
    const ana = await ctx.signUp('ana@example.com')
    await ctx.rbac.for(userSubject(ana.id)).assignRole('writer')
    await ctx.rbac.for(userSubject(ana.id), { team: 'acme' }).givePermissionTo('articles.edit')
    await ctx.auth.api.deleteUser({ body: { password: 'password-1234' }, headers: ana.headers })
    expect(await ctx.rbac.for(userSubject(ana.id)).getRoleNames()).toEqual([])
    expect(await ctx.rbac.for(userSubject(ana.id), { team: 'acme' }).getDirectPermissions()).toEqual([])
  })

  it('subjectFromSession maps a session to a subject, and a guest to null', async () => {
    const ana = await ctx.signUp('ana@example.com')
    expect(await subjectFromSession(ctx.auth, ana.headers)).toEqual({ type: 'user', id: ana.id })
    expect(await subjectFromSession(ctx.auth, ana.headers, 'member')).toEqual({ type: 'member', id: ana.id })
    expect(await subjectFromSession(ctx.auth, new Headers())).toBeNull()
  })
})

describe('rbacPlugin options', () => {
  it('assigns nothing without defaultRoles, keeps links with revokeOnDelete: false, and uses subjectType and guard', async () => {
    const { rbac, auth, signUp } = await setup({ revokeOnDelete: false, subjectType: 'account', guard: 'web' })
    const ana = await signUp('ana@example.com')
    const subject = userSubject(ana.id, 'account')
    expect(await rbac.for(subject).getRoleNames()).toEqual([])
    await rbac.for(subject).assignRole('writer')
    expect((await auth.api.getRbacSnapshot({ headers: ana.headers })).roles).toEqual(['writer'])
    await auth.api.deleteUser({ body: { password: 'password-1234' }, headers: ana.headers })
    expect(await rbac.for(subject).getRoleNames()).toEqual(['writer'])
  })
})

describe('rbacClient', () => {
  it('fetches the snapshot as authClient.rbac.snapshot()', async () => {
    const { rbac, auth, signUp } = await setup()
    const ana = await signUp('ana@example.com')
    await rbac.for(userSubject(ana.id)).assignRole('writer')
    const client = createAuthClient({
      baseURL: BASE,
      plugins: [rbacClient()],
      fetchOptions: {
        customFetchImpl: (input, init) => {
          const request = new Request(input, init)
          ana.headers.forEach((value, key) => request.headers.set(key, value))
          return auth.handler(request)
        },
      },
    })
    const { data, error } = await client.rbac.snapshot()
    expect(error).toBeNull()
    expect(data?.roles).toEqual(['writer'])
  })
})
