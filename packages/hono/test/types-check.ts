import { createRbac, MemoryAdapter } from '@anievo-id/rbac-evolution'
import { Hono } from 'hono'
import { rbacMiddleware, requireRole, type RbacVariables } from '../src'

type User = { id: number }
type AppEnv = { Variables: RbacVariables & { user: User | undefined } }
const rbac = createRbac({ adapter: new MemoryAdapter() })
const app = new Hono<AppEnv>()
app.use(rbacMiddleware<AppEnv>({ rbac, getSubject: (c) => (c.var.user ? { type: 'user', id: c.var.user.id } : null) }))
app.get('/x', requireRole('admin'), async (c) => c.json(await c.var.rbac?.can('a')))

const chained = new Hono<{ Variables: { user: User } }>()
  .use(rbacMiddleware<{ Variables: { user: User } }>({ rbac, getSubject: (c) => ({ type: 'user', id: c.var.user.id }) }))
  .get('/y', requireRole('admin'), async (c) => c.json(await c.var.rbac?.can('a')))
export { chained }
