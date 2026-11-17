import { afterAll, describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'

const { createRbac, MemoryAdapter } = await import('@anievo-id/rbac-evolution')
const { rbacPlugin, requirePermission } = await import('@anievo-id/rbac-evolution-elysia')

const rbac = createRbac({ adapter: new MemoryAdapter() })
await rbac.sync({ permissions: ['edit articles'], roles: { writer: ['edit articles'] } })
await rbac.for({ type: 'user', id: 1 }).assignRole('writer')

// A real HTTP server on Bun's native runtime (Elysia's own `listen`).
const app = new Elysia()
  .use(rbacPlugin({ rbac, getSubject: ({ headers }) => (headers['x-user'] ? { type: 'user', id: Number(headers['x-user']) } : null) }))
  .post('/articles', () => ({ ok: true }), { beforeHandle: requirePermission('edit articles') })
  .listen(0)
afterAll(() => app.stop(true))
const url = `http://localhost:${app.server!.port}/articles`

describe('Elysia on Bun', () => {
  it('401 for guests', async () => {
    const res = await fetch(url, { method: 'POST' })
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ error: 'UNAUTHENTICATED' })
  })

  it('403 without the permission', async () => {
    const res = await fetch(url, { method: 'POST', headers: { 'x-user': '2' } })
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ error: 'FORBIDDEN', reason: 'permission' })
  })

  it('200 with the permission', async () => {
    const res = await fetch(url, { method: 'POST', headers: { 'x-user': '1' } })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })
})
