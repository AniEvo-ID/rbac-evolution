import type { Rbac, Subject, SubjectRbac, TeamId } from '@anievo-id/rbac-evolution'
import type { NextFunction, Request, RequestHandler, Response } from 'express'

type MaybePromise<T> = T | Promise<T>

export interface RbacMiddlewareOptions {
  /** The RBAC engine created with `createRbac(...)`. */
  rbac: Rbac
  /**
   * Resolves the authenticated subject for this request (e.g. from `req.user` or a session).
   * Return `null` / `undefined` for guests.
   */
  getSubject: (req: Request) => MaybePromise<Subject | null | undefined>
  /** Guard name (e.g. `web` or `api`). Defaults to the engine's `defaultGuard`. */
  guard?: string | undefined
  /** Resolves the current team (only when the engine was created with `teams: true`). */
  team?: (req: Request) => MaybePromise<TeamId | undefined>
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /**
       * Roles & permissions of the current subject, set by `rbacMiddleware()`.
       * `null` for guests, `undefined` when the middleware did not run.
       */
      rbac?: SubjectRbac | null | undefined
    }
  }
}

/**
 * Wraps an async handler so it works on Express 4 (which ignores rejected promises)
 * as well as Express 5: errors are always forwarded to `next(err)`.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next)
  }
}

/**
 * Resolves the current subject and attaches `req.rbac` (a `SubjectRbac`, or `null` for guests).
 *
 * ```ts
 * app.use(rbacMiddleware({ rbac, getSubject: (req) => req.user ? { type: 'user', id: req.user.id } : null }))
 * ```
 */
export function rbacMiddleware(options: RbacMiddlewareOptions): RequestHandler {
  const { rbac, getSubject, guard, team } = options

  return asyncHandler(async (req, _res, next) => {
    const subject = await getSubject(req)
    if (!subject) {
      req.rbac = null
    } else {
      const teamId = team ? await team(req) : undefined
      req.rbac = rbac.for(subject, {
        ...(guard !== undefined && { guard }),
        ...(teamId !== undefined && { team: teamId }),
      })
    }
    next()
  })
}
