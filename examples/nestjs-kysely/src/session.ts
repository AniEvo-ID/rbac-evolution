import type { NextFunction, Request, Response } from 'express'
import { db } from './db'

export type User = { id: number; name: string; email: string }

declare module 'express' {
  interface Request {
    /** The demo user from the session cookie, or null for guests. */
    user?: User | null
  }
}

// Fake authentication: the "session" is a cookie holding a demo user id.
// Swap this for @nestjs/passport, Auth.js, Lucia, ... in a real app.
export const SESSION_COOKIE = 'demo_user'

function readCookie(req: Request, name: string): string | undefined {
  for (const part of req.headers.cookie?.split(';') ?? []) {
    const [key, ...value] = part.trim().split('=')
    if (key === name) return decodeURIComponent(value.join('='))
  }
  return undefined
}

export async function findUser(id: unknown): Promise<User | null> {
  const n = Number(id)
  if (!Number.isInteger(n) || n <= 0) return null
  return (await db.selectFrom('users').select(['id', 'name', 'email']).where('id', '=', n).executeTakeFirst()) ?? null
}

/** Express middleware, registered in main.ts before Nest's guards run: sets `req.user`. */
export async function session(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    req.user = await findUser(readCookie(req, SESSION_COOKIE))
    next()
  } catch (error) {
    next(error)
  }
}
