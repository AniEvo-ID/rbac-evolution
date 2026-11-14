import type { Rbac, Subject, SubjectRbac, TeamId } from '@anievo-id/rbac-evolution'
import type { Context, Env, MiddlewareHandler } from 'hono'

type MaybePromise<T> = T | Promise<T>

/** Context variables set by `rbacMiddleware()`. */
export type RbacVariables = {
  /** Roles & permissions of the current subject. `null` for guests. */
  rbac: SubjectRbac | null
}

/**
 * Hono env for apps using `rbacMiddleware()`: `new Hono<RbacEnv>()` types `c.var.rbac`.
 * Combine it with your own variables: `new Hono<{ Variables: RbacVariables & { user: User } }>()`.
 */
export type RbacEnv = {
  Variables: RbacVariables
}

export interface RbacMiddlewareOptions<E extends Env = Env> {
  /** The RBAC engine created with `createRbac(...)`. */
  rbac: Rbac
  /**
   * Resolves the authenticated subject for this request (e.g. from `c.var.user` or a JWT payload).
   * Return `null` / `undefined` for guests.
   */
  getSubject: (c: Context<E>) => MaybePromise<Subject | null | undefined>
  /** Guard name (e.g. `web` or `api`). Defaults to the engine's `defaultGuard`. */
  guard?: string
  /** Resolves the current team (only when the engine was created with `teams: true`). */
  team?: (c: Context<E>) => MaybePromise<TeamId | undefined>
}

/**
 * Resolves the current subject and sets `c.var.rbac` (a `SubjectRbac`, or `null` for guests).
 *
 * ```ts
 * app.use(rbacMiddleware({ rbac, getSubject: (c) => (c.var.user ? { type: 'user', id: c.var.user.id } : null) }))
 * ```
 */
export function rbacMiddleware<E extends Env = Env>(options: RbacMiddlewareOptions<E>): MiddlewareHandler<E & RbacEnv> {
  const { rbac, getSubject, guard, team } = options

  return async (c, next) => {
    const ctx = c as unknown as Context<E>
    const subject = await getSubject(ctx)
    let value: SubjectRbac | null = null
    if (subject) {
      const teamId = team ? await team(ctx) : undefined
      value = rbac.for(subject, {
        ...(guard !== undefined && { guard }),
        ...(teamId !== undefined && { team: teamId }),
      })
    }
    ;(c as unknown as Context<RbacEnv>).set('rbac', value)
    await next()
  }
}
