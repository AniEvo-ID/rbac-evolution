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

type MaybePromise<T> = T | Promise<T>

/** The type configuration of `T`: `T` itself, or the `X` of an `Rbac<X>` engine. */
export type TypesOf<T> = T extends Rbac<infer X> ? X : T extends RbacTypeConfig ? T : never

/**
 * The subject the guards of `createGuards<T, G>()` work with: a `SubjectRbac` with the names of `T` (of guard `G`
 * with per-guard names), or an untyped `SubjectRbac` without `T`.
 */
export type GuardSubject<
  T extends RbacTypeConfig | Rbac<RbacTypeConfig> = DefaultRbacTypes,
  G extends string = DefaultGuardName<TypesOf<T>>,
> = SubjectRbac<TypesOf<T>, ScopedGuardName<TypesOf<T>, G>>

/**
 * The part of the tRPC context this package reads and writes: `ctx.rbac`, a `SubjectRbac` for the current subject
 * or `null` for guests. Spread it into what `createContext` returns (see `createRbacContext()`), or type your
 * context with it: `type Context = RbacContext<typeof rbac> & { user: User | null }`.
 *
 * `T` (a names type like `AppRbac`, or `typeof rbac`) types the names `ctx.rbac` accepts; without it, any name.
 * With per-guard names, `G` is the guard of the subject: the default guard's names by default.
 */
export type RbacContext<
  T extends RbacTypeConfig | Rbac<RbacTypeConfig> = DefaultRbacTypes,
  G extends string = DefaultGuardName<TypesOf<T>>,
> = {
  /** Roles & permissions of the current subject. `null` for guests. */
  rbac: GuardSubject<T, G> | null
}

export interface RbacContextOptions<
  I = unknown,
  T extends RbacTypeConfig = DefaultRbacTypes,
  G extends string = DefaultGuardName<T>,
> {
  /** The RBAC engine created with `createRbac(...)`. Its typed names flow into `ctx.rbac`. */
  rbac: Rbac<T>
  /**
   * Resolves the authenticated subject from what you pass to the returned function (your user, the request, the
   * `createContext` options, ...). Return `null` / `undefined` for guests.
   */
  getSubject: (input: I) => MaybePromise<Subject | null | undefined>
  /**
   * Guard name (e.g. `web` or `api`). Defaults to the engine's `defaultGuard`. With per-guard names, it must be one
   * of the typed guards, and `ctx.rbac` gets its names.
   */
  guard?: G | undefined
  /** Resolves the current team (only when the engine was created with `teams: true`). */
  team?: ((input: I) => MaybePromise<TeamId | undefined>) | undefined
}

/**
 * Builds the `rbac` part of your tRPC context: returns a function that resolves the subject from its argument and
 * gives `{ rbac }` (a `SubjectRbac`, or `null` for guests). Spread it into what `createContext` returns.
 *
 * ```ts
 * const rbacContext = createRbacContext({
 *   rbac,
 *   getSubject: (user: User | null) => (user ? { type: 'user', id: user.id } : null),
 * })
 *
 * export async function createContext({ req }: FetchCreateContextFnOptions) {
 *   const user = await getUser(req)
 *   return { user, ...(await rbacContext(user)) }
 * }
 * ```
 *
 * With a typed engine (`createRbac<AppRbac>()`), `ctx.rbac` is typed with its names. With per-guard names, the
 * `guard` option picks the names of `ctx.rbac`.
 */
export function createRbacContext<
  I = unknown,
  T extends RbacTypeConfig = DefaultRbacTypes,
  G extends string = DefaultGuardName<T>,
>(
  options: RbacContextOptions<I, T, G> & (T extends { guards: object } ? GuardOptions<CheckGuard<T, G>> : unknown),
): (input: I) => Promise<RbacContext<T, G>> {
  const { getSubject, team } = options
  const guard: string | undefined = options.guard
  // `T` only narrows the names on `ctx.rbac`; the subject is the same object either way.
  const rbac = options.rbac as unknown as Rbac

  return async (input) => {
    const subject = await getSubject(input)
    let value: SubjectRbac | null = null
    if (subject) {
      const teamId = team ? await team(input) : undefined
      value = rbac.for(subject, {
        ...(guard !== undefined && { guard }),
        ...(teamId !== undefined && { team: teamId }),
      })
    }
    return { rbac: value } as unknown as RbacContext<T, G>
  }
}
