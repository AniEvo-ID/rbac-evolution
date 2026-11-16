import type {
  CheckGuard,
  DefaultGuardName,
  DefaultRbacTypes,
  GuardOptions,
  Rbac,
  RbacTypeConfig,
  ScopedGuardName,
  Subject,
  SubjectRbac,
  TeamId,
} from '@anievo-id/rbac-evolution'
import type { Context, Env, MiddlewareHandler } from 'hono'

type MaybePromise<T> = T | Promise<T>

/** The type configuration of `T`: `T` itself, or the `X` of an `Rbac<X>` engine. */
export type TypesOf<T> = T extends Rbac<infer X> ? X : T extends RbacTypeConfig ? T : never

/**
 * Context variables set by `rbacMiddleware()`. `T` (a names type like `AppRbac`, or `typeof rbac`) types the
 * names `c.var.rbac` accepts; without it, any name. With per-guard names, `G` is the guard of the subject (the
 * middleware's `guard`): the default guard's names by default.
 */
export type RbacVariables<
  T extends RbacTypeConfig | Rbac<RbacTypeConfig> = DefaultRbacTypes,
  G extends string = DefaultGuardName<TypesOf<T>>,
> = {
  /** Roles & permissions of the current subject. `null` for guests. */
  rbac: SubjectRbac<TypesOf<T>, ScopedGuardName<TypesOf<T>, G>> | null
}

/**
 * Hono env for apps using `rbacMiddleware()`: `new Hono<RbacEnv>()` types `c.var.rbac`, and
 * `new Hono<RbacEnv<typeof rbac>>()` types it with the names of a typed engine.
 * Combine it with your own variables: `new Hono<{ Variables: RbacVariables<AppRbac> & { user: User } }>()`.
 * With per-guard names, `RbacEnv<typeof rbac, 'api'>` types `c.var.rbac` with the names of guard `api`.
 */
export type RbacEnv<
  T extends RbacTypeConfig | Rbac<RbacTypeConfig> = DefaultRbacTypes,
  G extends string = DefaultGuardName<TypesOf<T>>,
> = {
  Variables: RbacVariables<TypesOf<T>, G>
}

export interface RbacMiddlewareOptions<
  E extends Env = Env,
  T extends RbacTypeConfig = DefaultRbacTypes,
  G extends string = DefaultGuardName<T>,
> {
  /** The RBAC engine created with `createRbac(...)`. Its typed names flow into `c.var.rbac`. */
  rbac: Rbac<T>
  /**
   * Resolves the authenticated subject for this request (e.g. from `c.var.user` or a JWT payload).
   * Return `null` / `undefined` for guests.
   */
  getSubject: (c: Context<E>) => MaybePromise<Subject | null | undefined>
  /**
   * Guard name (e.g. `web` or `api`). Defaults to the engine's `defaultGuard`. With per-guard names, it must be one
   * of the typed guards (checked by `rbacMiddleware()`), and `c.var.rbac` gets its names.
   */
  guard?: G | undefined
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
 * your env explicitly, pass the engine's names too: `rbacMiddleware<AppEnv, AppRbac>(...)`. With per-guard names,
 * the `guard` option picks the names of `c.var.rbac` (`rbacMiddleware<AppEnv, AppRbac, 'api'>` when explicit).
 */
export function rbacMiddleware<
  E extends Env = Env,
  T extends RbacTypeConfig = DefaultRbacTypes,
  G extends string = DefaultGuardName<T>,
>(
  options: RbacMiddlewareOptions<E, T, G> & (T extends { guards: object } ? GuardOptions<CheckGuard<T, G>> : unknown),
): MiddlewareHandler<E & RbacEnv<T, ScopedGuardName<T, G>>> {
  const { getSubject, team } = options
  const guard: string | undefined = options.guard
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
