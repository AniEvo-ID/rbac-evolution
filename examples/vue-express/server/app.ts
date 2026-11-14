import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { rbacMiddleware, requirePermission, requireRole } from '@anievo-id/rbac-evolution-express'
import { eq } from 'drizzle-orm'
import express, { type NextFunction, type Request, type Response } from 'express'
import { db } from './db'
import { ROLE_NAMES, rbac } from './rbac'
import { type User, articles, users } from './schema'

declare global {
  namespace Express {
    interface Request {
      /** The demo user from the session cookie, or null for guests. */
      user: User | null
    }
  }
}

// Fake authentication: the "session" is a cookie holding a demo user id.
// Swap this for express-session + passport, Auth.js, Lucia, ... in a real app.
const SESSION_COOKIE = 'demo_user'

function readCookie(req: Request, name: string): string | undefined {
  for (const part of req.headers.cookie?.split(';') ?? []) {
    const [key, ...value] = part.trim().split('=')
    if (key === name) return decodeURIComponent(value.join('='))
  }
  return undefined
}

async function findUser(id: unknown) {
  const n = Number(id)
  if (!Number.isInteger(n) || n <= 0) return null
  const [user] = await db.select().from(users).where(eq(users.id, n))
  return user ?? null
}

export function createApp() {
  const app = express()
  app.use(express.json())

  // 1. Authentication (yours): who is the user?
  app.use(async (req, _res, next) => {
    req.user = await findUser(readCookie(req, SESSION_COOKIE))
    next()
  })

  // 2. rbac-evolution: attaches req.rbac (SubjectRbac, or null for guests)
  app.use(
    rbacMiddleware({
      rbac,
      getSubject: (req) => (req.user ? { type: 'user', id: req.user.id } : null),
    }),
  )

  // ------------------------------------------------------------------ session

  /** Public: the demo users, for the login screen. */
  app.get('/api/users', async (_req, res) => {
    const all = await db.select().from(users).orderBy(users.id)
    res.json(
      await Promise.all(all.map(async (u) => ({ ...u, roles: await rbac.for({ type: 'user', id: u.id }).getRoleNames() }))),
    )
  })

  app.post('/api/login', async (req, res) => {
    const user = await findUser(req.body?.userId)
    if (!user) return void res.status(422).json({ error: 'UNKNOWN_USER' })
    res.cookie(SESSION_COOKIE, String(user.id), { httpOnly: true, sameSite: 'lax', path: '/' })
    res.json({ user })
  })

  app.post('/api/logout', (_req, res) => {
    res.clearCookie(SESSION_COOKIE, { path: '/' })
    res.status(204).end()
  })

  /** The current user and their snapshot — the Vue app feeds it to createRbacPlugin().setSnapshot(). */
  app.get('/api/me', async (req, res) => {
    res.json({ user: req.user, snapshot: req.rbac ? await req.rbac.snapshot() : null })
  })

  // ------------------------------------------------------------------ articles

  app.get('/api/articles', requirePermission('view articles'), async (req, res) => {
    // Only users who can publish see drafts.
    const showDrafts = await req.rbac!.can('publish articles')
    const rows = await db.select().from(articles).orderBy(articles.id)
    res.json(showDrafts ? rows : rows.filter((a) => a.published))
  })

  app.post('/api/articles', requirePermission('create articles'), async (req, res) => {
    const title = String(req.body?.title ?? '').trim()
    if (!title) return void res.status(422).json({ error: 'TITLE_REQUIRED' })
    const [article] = await db
      .insert(articles)
      .values({ title, body: String(req.body?.body ?? ''), authorId: req.user!.id })
      .returning()
    res.status(201).json(article)
  })

  app.post('/api/articles/:id/publish', requirePermission('publish articles'), async (req, res) => {
    const [article] = await db
      .update(articles)
      .set({ published: true })
      .where(eq(articles.id, Number(req.params.id)))
      .returning()
    if (!article) return void res.status(404).json({ error: 'NOT_FOUND' })
    res.json(article)
  })

  app.delete('/api/articles/:id', requirePermission('delete articles'), async (req, res) => {
    const deleted = await db
      .delete(articles)
      .where(eq(articles.id, Number(req.params.id)))
      .returning()
    if (deleted.length === 0) return void res.status(404).json({ error: 'NOT_FOUND' })
    res.json({ deleted: Number(req.params.id) })
  })

  // ------------------------------------------------------------------ admin

  app.get('/api/admin/users', requireRole('admin'), async (_req, res) => {
    const all = await db.select().from(users).orderBy(users.id)
    res.json(
      await Promise.all(all.map(async (u) => ({ ...u, roles: await rbac.for({ type: 'user', id: u.id }).getRoleNames() }))),
    )
  })

  app.put('/api/admin/users/:id/role', requireRole('admin'), async (req, res) => {
    const user = await findUser(req.params.id)
    if (!user) return void res.status(404).json({ error: 'NOT_FOUND' })
    const role = ROLE_NAMES.find((name) => name === req.body?.role)
    await rbac.for({ type: 'user', id: user.id }).syncRoles(role ? [role] : [])
    res.json({ id: user.id, roles: role ? [role] : [] })
  })

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'NOT_FOUND' })
  })

  // ------------------------------------------------------------------ SPA (after `pnpm build`)

  const clientDir = join(process.cwd(), 'dist', 'client')
  if (existsSync(clientDir)) {
    app.use(express.static(clientDir))
    app.get('/{*path}', (_req, res) => res.sendFile('index.html', { root: clientDir }))
  }

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(error)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  })

  return app
}
