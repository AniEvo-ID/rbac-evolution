import type { DefaultRbacTypes, Rbac, RbacTypeConfig, Subject, SubjectRbac, TeamId } from '@anievo-id/rbac-evolution'
import type { Context, Env, MiddlewareHandler } from 'hono'

type MaybePromise<T> = T | Promise<T>

/** The type configuration of `T`: `T` itself, or the `X` of an `Rbac<X>` engine. */
export type TypesOf<T> = T extends Rbac<infer X> ? X : T extends RbacTypeConfig ? T : never

/**
 * Context variables set by `rbacMiddleware()`. `T` (a names type like `AppRbac`, or `typeof rbac`) types the
 * names `c.var.rbac` accepts; without it, any name.
 */
export type RbacVariables<T extends RbacTypeConfig | Rbac<RbacTypeConfig> = DefaultRbacTypes> = {
  /** Roles & permissions of the current subject. `null` for guests. */
  rbac: SubjectRbac<TypesOf<T>> | null
}

/**
 * Hono env for apps using `rbacMiddleware()`: `new Hono<RbacEnv>()` types `c.var.rbac`, and
 * `new Hono<RbacEnv<typeof rbac>>()` types it with the names of a typed engine.
 * Combine it with your own variables: `new Hono<{ Variables: RbacVariables<AppRbac> & { user: User } }>()`.
 */
export type RbacEnv<T extends RbacTypeConfig | Rbac<RbacTypeConfig> = DefaultRbacTypes> = {
  Variables: RbacVariables<TypesOf<T>>
}

export interface RbacMiddlewareOptions<E extends Env = Env, T extends RbacTypeConfig = DefaultRbacTypes> {
  /** The RBAC engine created with `createRbac(...)`. Its typed names flow into `c.var.rbac`. */
  rbac: Rbac<T>
  /**
   * Resolves the authenticated subject for this request (e.g. from `c.var.user` or a JWT payload).
   * Return `null` / `undefined` for guests.
   */
  getSubject: (c: Context<E>) => MaybePromise<Subject | null | undefined>
  /** Guard name (e.g. `web` or `api`). Defaults to the engine's `defaultGuard`. */
  guard?: string | undefined
  /** Resolves the current team (only when the engine was created with `teams: true`). */
  team?: (c: Context<E>) => MaybePromise<TeamId | undefined>
}

/**
 * Resolves the current subject and sets `c.var.rbac` (a `SubjectRbac`, or `null` for guests).
 *
 * ```ts
 * app.use(rbacMiddleware({ rbac, getSubject: (c) => (c.var.user ? { type: 'user', id: c.var.user.id } : null) }))
 * ```
 *
 * With a typed engine (`createRbac<AppRbac>()`), the returned middleware sets a typed `c.var.rbac`. When you pass
 * your env explicitly, pass the engine's names too: `rbacMiddleware<AppEnv, AppRbac>(...)`.
 */
export function rbacMiddleware<E extends Env = Env, T extends RbacTypeConfig = DefaultRbacTypes>(
  options: RbacMiddlewareOptions<E, T>,
): MiddlewareHandler<E & RbacEnv<T>> {
  const { getSubject, guard, team } = options
  // `T` only narrows the names on `c.var.rbac`; the subject is the same object either way.
  const rbac = options.rbac as unknown as Rbac

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
