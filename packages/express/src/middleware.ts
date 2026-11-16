import type { DefaultRbacTypes, Rbac, RbacTypeConfig, Subject, SubjectRbac, TeamId } from '@anievo-id/rbac-evolution'
import type { NextFunction, Request, RequestHandler, Response } from 'express'

type MaybePromise<T> = T | Promise<T>

/** The type configuration of `T`: `T` itself, or the `X` of an `Rbac<X>` engine. */
export type TypesOf<T> = T extends Rbac<infer X> ? X : T extends RbacTypeConfig ? T : never

/**
 * Register your engine here to type `req.rbac` in every handler of the app:
 *
 * ```ts
 * declare module '@anievo-id/rbac-evolution-express' {
 *   interface RbacRegister {
 *     rbac: typeof rbac // or the names type: AppRbac
 *   }
 * }
 * ```
 *
 * `req` is typed globally by Express (`Express.Request`), so the engine passed to `rbacMiddleware()` can't
 * flow there on its own. Without a registration, `req.rbac` is an untyped `SubjectRbac`.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface, @typescript-eslint/no-empty-object-type
export interface RbacRegister {}

/** The type configuration registered in {@link RbacRegister}, or `DefaultRbacTypes` (any name) without one. */
export type RegisteredRbacTypes = RbacRegister extends { rbac: infer R } ? TypesOf<R> : DefaultRbacTypes

/**
 * An Express request whose `rbac` has the names of `T` (a names type like `AppRbac`, or `typeof rbac`).
 * For typing a handler without a global {@link RbacRegister}, e.g. when two routers use different engines:
 *
 * ```ts
 * app.get('/articles', (req: RbacRequest<typeof rbac>, res) => { ... })
 * ```
 */
export type RbacRequest<T extends RbacTypeConfig | Rbac<RbacTypeConfig> = DefaultRbacTypes, Req = Request> = Omit<
  Req,
  'rbac'
> & {
  /**
   * Roles & permissions of the current subject, set by `rbacMiddleware()`.
   * `null` for guests, `undefined` when the middleware did not run.
   */
  rbac?: SubjectRbac<TypesOf<T>> | null | undefined
}

export interface RbacMiddlewareOptions<T extends RbacTypeConfig = DefaultRbacTypes> {
  /** The RBAC engine created with `createRbac(...)`. */
  rbac: Rbac<T>
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
       * Typed with the names of the engine registered in `RbacRegister` (any name without one).
       */
      rbac?: SubjectRbac<RegisteredRbacTypes> | null | undefined
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
 *
 * To type `req.rbac` with the names of a typed engine, register it in {@link RbacRegister}
 * (or type a handler's `req` as {@link RbacRequest}).
 */
export function rbacMiddleware<T extends RbacTypeConfig = DefaultRbacTypes>(
  options: RbacMiddlewareOptions<T>,
): RequestHandler {
  const { getSubject, guard, team } = options
  // The request's subject is typed by `RbacRegister`, not by `T`: store it untyped.
  const rbac = options.rbac as unknown as Rbac

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
