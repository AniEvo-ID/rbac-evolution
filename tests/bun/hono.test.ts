import { afterAll, describe, expect, it } from 'bun:test'
import { Hono } from 'hono'

const { createRbac, MemoryAdapter } = await import('@anievo-id/rbac-evolution')
const { rbacMiddleware, requirePermission } = await import('@anievo-id/rbac-evolution-hono')

const rbac = createRbac({ adapter: new MemoryAdapter() })
await rbac.sync({ permissions: ['edit articles'], roles: { writer: ['edit articles'] } })
await rbac.for({ type: 'user', id: 1 }).assignRole('writer')

const app = new Hono()
app.use(
  rbacMiddleware({
    rbac,
    getSubject: (c) => {
      const id = c.req.header('x-user')
      return id ? { type: 'user', id: Number(id) } : null
    },
  }),
)
app.post('/articles', requirePermission('edit articles'), (c) => c.json({ ok: true }))

// A real HTTP server on Bun's native runtime.
const server = Bun.serve({ port: 0, fetch: app.fetch })
afterAll(() => server.stop(true))
const url = `http://localhost:${server.port}/articles`

describe('Hono on Bun.serve', () => {
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
