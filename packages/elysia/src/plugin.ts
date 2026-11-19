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
import { Elysia } from 'elysia'

type MaybePromise<T> = T | Promise<T>

/** The type configuration of `T`: `T` itself, or the `X` of an `Rbac<X>` engine. */
export type TypesOf<T> = T extends Rbac<infer X> ? X : T extends RbacTypeConfig ? T : never

/**
 * The request context `rbacPlugin()` reads the subject from. Elysia's full context type depends on the app, so the
 * plugin types only what every request has; read your own derived values (e.g. `user`) with a cast or from
 * `request`, or resolve them before the plugin.
 */
export interface RbacRequestContext {
  request: Request
  headers: Record<string, string | undefined>
  [key: string]: unknown
}

/**
 * What `rbacPlugin()` adds to the context of every route after it. `T` (a names type like `AppRbac`, or
 * `typeof rbac`) types the names `rbac` accepts; with per-guard names, `G` is the guard of the subject.
 */
export type RbacContext<
  T extends RbacTypeConfig | Rbac<RbacTypeConfig> = DefaultRbacTypes,
  G extends string = DefaultGuardName<TypesOf<T>>,
> = {
  /** Roles & permissions of the current subject. `null` for guests. */
  rbac: SubjectRbac<TypesOf<T>, ScopedGuardName<TypesOf<T>, G>> | null
}

export interface RbacPluginOptions<T extends RbacTypeConfig = DefaultRbacTypes, G extends string = DefaultGuardName<T>> {
  /** The RBAC engine created with `createRbac(...)`. Its typed names flow into the `rbac` context value. */
  rbac: Rbac<T>
  /**
   * Resolves the authenticated subject for this request (e.g. from a session cookie or a JWT payload).
   * Return `null` / `undefined` for guests.
   */
  getSubject: (ctx: RbacRequestContext) => MaybePromise<Subject | null | undefined>
  /**
   * Guard name (e.g. `web` or `api`). Defaults to the engine's `defaultGuard`. With per-guard names, it must be one
   * of the typed guards, and the `rbac` context value gets its names.
   */
  guard?: G | undefined
  /** Resolves the current team (only when the engine was created with `teams: true`). */
  team?: (ctx: RbacRequestContext) => MaybePromise<TeamId | undefined>
  /**
   * Plugin name, used by Elysia to register it once. Default: `'rbac-evolution'`. Give each instance its own name
   * when you register two (e.g. a `web` and an `api` guard).
   */
  name?: string | undefined
}

/**
 * Resolves the current subject and adds `rbac` (a `SubjectRbac`, or `null` for guests) to the context of every
 * route registered after it.
 *
 * ```ts
 * const app = new Elysia()
 *   .use(rbacPlugin({ rbac, getSubject: ({ headers }) => (headers['x-user'] ? { type: 'user', id: headers['x-user'] } : null) }))
 *   .get('/me', ({ rbac }) => rbac?.getRoleNames() ?? [])
 * ```
 */
export function rbacPlugin<T extends RbacTypeConfig = DefaultRbacTypes, G extends string = DefaultGuardName<T>>(
  options: RbacPluginOptions<T, G> & (T extends { guards: object } ? GuardOptions<CheckGuard<T, G>> : unknown),
) {
  const { getSubject, team } = options
  const guard: string | undefined = options.guard
  // `T` only narrows the names on `rbac`; the subject is the same object either way.
  const rbac = options.rbac as unknown as Rbac

  return new Elysia({ name: options.name ?? 'rbac-evolution', seed: guard }).resolve(
    { as: 'global' },
    async (ctx): Promise<RbacContext<T, ScopedGuardName<T, G>>> => {
      // Pass `ctx` itself: Elysia reads this function's source to decide which context fields to parse, and a
      // context handed to another function makes it parse them all (an alias would hide `headers` & co).
      const subject = await getSubject(ctx as unknown as RbacRequestContext)
      if (!subject) return { rbac: null }
      const teamId = team ? await team(ctx as unknown as RbacRequestContext) : undefined
      const value = rbac.for(subject, {
        ...(guard !== undefined && { guard }),
        ...(teamId !== undefined && { team: teamId }),
      })
      return { rbac: value } as unknown as RbacContext<T, ScopedGuardName<T, G>>
    },
  )
}
