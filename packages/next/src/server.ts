import { notFound, redirect } from 'next/navigation'
import type {
  CheckGuard,
  CheckRequirementGuard,
  CheckRequirementName,
  DefaultGuardName,
  DefaultRbacTypes,
  GuardOptions,
  Many,
  PermissionName,
  Rbac,
  RbacSnapshot,
  RbacTypeConfig,
  RoleName,
  ScopedGuardName,
  ScopeOptions,
  Subject,
  TeamId,
} from '@anievo-id/rbac-evolution'
import { RbacUnauthorizedError } from './errors'
import { forbiddenResponse, unauthenticatedResponse } from './responses'
import { checkRequirement, type FailureReason, type MaybePromise, type Requirement } from './types'

/** `G` is the type of `guard`: any string by default; `createNextRbac()` infers it to type the helpers. */
export interface NextRbacOptions<T extends RbacTypeConfig = DefaultRbacTypes, G extends string = string> {
  /** Your `createRbac(...)` instance. Its typed names (`createRbac<{ permissions: ...; roles: ... }>`) flow into every helper. */
  rbac: Rbac<T>
  /** Resolves the current user (e.g. from Auth.js `auth()`). Return `null` for guests. */
  getSubject: () => MaybePromise<Subject | null | undefined>
  /**
   * Default guard for every check. Default: the rbac instance's `defaultGuard`. With per-guard names, it must be
   * one of the typed guards (checked by `createNextRbac()`), and the helpers take its names.
   */
  guard?: G | undefined
  /** Default team for every check — a value, or a function (e.g. reading the current tenant). */
  team?: TeamId | (() => MaybePromise<TeamId | undefined>)
  /** Where `require*()` redirects guests. Without it, guests get `notFound()`. */
  loginUrl?: string | undefined
  /** Replaces the default guest handling of `require*()` (must throw, e.g. `() => redirect('/login')`). */
  onUnauthenticated?: (() => never) | undefined
  /** Replaces the default `notFound()` of `require*()` (must throw, e.g. `() => forbidden()`). */
  onUnauthorized?: (() => never) | undefined
}

/** Per-call options for `require*()`. `G` is the type of `guard` (see `ScopeOptions`). */
export interface RequireOptions<G extends string = string> extends ScopeOptions<G> {
  /** `requirePermission` / `requireRole`: require EVERY listed name instead of any (spatie v8.5 `canAll()`). */
  all?: boolean | undefined
  loginUrl?: string | undefined
  onUnauthenticated?: (() => never) | undefined
  onUnauthorized?: (() => never) | undefined
}

export type AuthorizeResult =
  | { ok: true; subject: Subject }
  | { ok: false; reason: 'unauthenticated'; subject: null }
  | { ok: false; reason: 'unauthorized'; subject: Subject }

export type WithRbacOptions = Requirement & ScopeOptions

/**
 * Checks a name, a `'a|b'` pipe list or an array of them against the names `N`.
 * Any name passes when `N` is `string` (an untyped engine).
 */
export type CheckNames<S, N extends string> = S extends string
  ? CheckRequirementName<S, N>
  : S extends readonly string[]
    ? { [K in keyof S]: S[K] extends string ? CheckRequirementName<S[K], N> : S[K] }
    : S

/**
 * Checks the `permission` / `role` / `roleOrPermission` names of a requirement object `Q` against the names of
 * `T`: with per-guard names, those of guard `G`. A `guard` key in `Q` must be one of the typed guards.
 */
export type CheckRequirement<Q, T extends RbacTypeConfig, G extends string = DefaultGuardName<T>> = {
  [K in keyof Q]: K extends 'permission'
    ? CheckNames<Q[K], PermissionName<T, G>>
    : K extends 'role'
      ? CheckNames<Q[K], RoleName<T, G>>
      : K extends 'roleOrPermission'
        ? CheckNames<Q[K], PermissionName<T, G> | RoleName<T, G>>
        : K extends 'guard'
          ? Q[K] extends string
            ? CheckRequirementGuard<T, Q[K]>
            : Q[K]
          : Q[K]
}

/** The guard a `withRbac()` options object `O` checks in: its `guard`, or `G`. */
export type OptionsGuard<O, G extends string> = O extends { readonly guard: infer X extends string } ? X : G

/**
 * The helpers returned by `createNextRbac()`. `T` comes from the `rbac` instance: with typed names,
 * every name (including each part of a `'a|b'` list) must be one of them; untyped, any string is accepted.
 */
export interface NextRbac<T extends RbacTypeConfig = DefaultRbacTypes> {
  rbac: Rbac<T>
  getSubject(): Promise<Subject | null>
  /** Non-throwing check: who is the user and do they meet the requirement? */
  authorize<const Q extends Requirement>(
    requirement: Q & CheckRequirement<Q, T>,
    scope?: ScopeOptions,
  ): Promise<AuthorizeResult>
  /** Roles & permissions of the current user — pass to `<RbacProvider snapshot={...}>`. Guests get an empty snapshot. */
  getSnapshot(scope?: ScopeOptions): Promise<RbacSnapshot>
  can(permission: PermissionName<T>, scope?: ScopeOptions): Promise<boolean>
  canAny(permissions: Many<PermissionName<T>>, scope?: ScopeOptions): Promise<boolean>
  canAll(permissions: Many<PermissionName<T>>, scope?: ScopeOptions): Promise<boolean>
  /** `true` if the user has the role — or ANY of the roles when given an array. */
  hasRole(role: Many<RoleName<T>>, scope?: ScopeOptions): Promise<boolean>
  hasAllRoles(roles: Many<RoleName<T>>, scope?: ScopeOptions): Promise<boolean>
  /**
   * Ensures the user has the permission (or ANY of the permissions). Returns the subject.
   * Guests: `redirect(loginUrl)` or `notFound()`. Missing permission: `notFound()`. Both configurable.
   */
  requirePermission<const S extends Many<string>>(
    permission: S & CheckNames<S, PermissionName<T>>,
    opts?: RequireOptions,
  ): Promise<Subject>
  /** Ensures the user has the role (or ANY of the roles). Returns the subject. */
  requireRole<const S extends Many<string>>(role: S & CheckNames<S, RoleName<T>>, opts?: RequireOptions): Promise<Subject>
  /** Ensures the user has ANY of the given roles or permissions. Returns the subject. */
  requireRoleOrPermission<const S extends Many<string>>(
    items: S & CheckNames<S, PermissionName<T> | RoleName<T>>,
    opts?: RequireOptions,
  ): Promise<Subject>
  /** Wraps a server action; throws `RbacUnauthorizedError` unless the user has the permission (or ANY of them). */
  withPermission<const S extends Many<string>, Args extends unknown[], R>(
    permission: S & CheckNames<S, PermissionName<T>>,
    action: (...args: Args) => MaybePromise<R>,
    scope?: ScopeOptions | undefined,
  ): (...args: Args) => Promise<R>
  /** Wraps a server action; throws `RbacUnauthorizedError` unless the user has the role (or ANY of them). */
  withRole<const S extends Many<string>, Args extends unknown[], R>(
    role: S & CheckNames<S, RoleName<T>>,
    action: (...args: Args) => MaybePromise<R>,
    scope?: ScopeOptions | undefined,
  ): (...args: Args) => Promise<R>
  /**
   * Wraps a route handler. Responds `401` (guest) or `403` (missing role/permission) with a JSON body.
   * Mirrors spatie's `permission`, `role` and `role_or_permission` middleware.
   */
  withRbac<Args extends unknown[], const O extends WithRbacOptions>(
    handler: (...args: Args) => MaybePromise<Response>,
    options: O & CheckRequirement<O, T>,
  ): (...args: Args) => Promise<Response>
}

/**
 * The helpers of `createNextRbac()` when the engine has per-guard names (`RbacTypeConfig['guards']`): like
 * {@link NextRbac}, but `G` is the guard of the checks (the `guard` option of `createNextRbac()`, else the default
 * guard), and a call's `{ guard }` takes the names of that guard instead: `can('orders.read', { guard: 'api' })`.
 */
export interface ScopedNextRbac<T extends RbacTypeConfig, G extends string = DefaultGuardName<T>> {
  rbac: Rbac<T>
  getSubject(): Promise<Subject | null>
  /** Non-throwing check: who is the user and do they meet the requirement? */
  authorize<const Q extends Requirement, G2 extends string = G>(
    requirement: Q & CheckRequirement<Q, T, G2>,
    scope?: ScopeOptions<CheckGuard<T, G2>>,
  ): Promise<AuthorizeResult>
  /** Roles & permissions of the current user — pass to `<RbacProvider snapshot={...}>`. Guests get an empty snapshot. */
  getSnapshot(scope?: ScopeOptions): Promise<RbacSnapshot>
  can<G2 extends string = G>(permission: PermissionName<T, G2>, scope?: ScopeOptions<CheckGuard<T, G2>>): Promise<boolean>
  canAny<G2 extends string = G>(permissions: Many<PermissionName<T, G2>>, scope?: ScopeOptions<CheckGuard<T, G2>>): Promise<boolean>
  canAll<G2 extends string = G>(permissions: Many<PermissionName<T, G2>>, scope?: ScopeOptions<CheckGuard<T, G2>>): Promise<boolean>
  /** `true` if the user has the role — or ANY of the roles when given an array. */
  hasRole<G2 extends string = G>(role: Many<RoleName<T, G2>>, scope?: ScopeOptions<CheckGuard<T, G2>>): Promise<boolean>
  hasAllRoles<G2 extends string = G>(roles: Many<RoleName<T, G2>>, scope?: ScopeOptions<CheckGuard<T, G2>>): Promise<boolean>
  /**
   * Ensures the user has the permission (or ANY of the permissions). Returns the subject.
   * Guests: `redirect(loginUrl)` or `notFound()`. Missing permission: `notFound()`. Both configurable.
   */
  requirePermission<const S extends Many<string>, G2 extends string = G>(
    permission: S & CheckNames<S, PermissionName<T, G2>>,
    opts?: RequireOptions<CheckGuard<T, G2>>,
  ): Promise<Subject>
  /** Ensures the user has the role (or ANY of the roles). Returns the subject. */
  requireRole<const S extends Many<string>, G2 extends string = G>(
    role: S & CheckNames<S, RoleName<T, G2>>,
    opts?: RequireOptions<CheckGuard<T, G2>>,
  ): Promise<Subject>
  /** Ensures the user has ANY of the given roles or permissions. Returns the subject. */
  requireRoleOrPermission<const S extends Many<string>, G2 extends string = G>(
    items: S & CheckNames<S, PermissionName<T, G2> | RoleName<T, G2>>,
    opts?: RequireOptions<CheckGuard<T, G2>>,
  ): Promise<Subject>
  /** Wraps a server action; throws `RbacUnauthorizedError` unless the user has the permission (or ANY of them). */
  withPermission<const S extends Many<string>, Args extends unknown[], R, G2 extends string = G>(
    permission: S & CheckNames<S, PermissionName<T, G2>>,
    action: (...args: Args) => MaybePromise<R>,
    scope?: ScopeOptions<CheckGuard<T, G2>> | undefined,
  ): (...args: Args) => Promise<R>
  /** Wraps a server action; throws `RbacUnauthorizedError` unless the user has the role (or ANY of them). */
  withRole<const S extends Many<string>, Args extends unknown[], R, G2 extends string = G>(
    role: S & CheckNames<S, RoleName<T, G2>>,
    action: (...args: Args) => MaybePromise<R>,
    scope?: ScopeOptions<CheckGuard<T, G2>> | undefined,
  ): (...args: Args) => Promise<R>
  /**
   * Wraps a route handler. Responds `401` (guest) or `403` (missing role/permission) with a JSON body.
   * Mirrors spatie's `permission`, `role` and `role_or_permission` middleware.
   */
  withRbac<Args extends unknown[], const O extends WithRbacOptions>(
    handler: (...args: Args) => MaybePromise<Response>,
    options: O & CheckRequirement<O, T, OptionsGuard<O, G>>,
  ): (...args: Args) => Promise<Response>
}

/**
 * What `createNextRbac()` returns: {@link NextRbac} for an engine without per-guard names (as in 1.1), and
 * {@link ScopedNextRbac} for one with `guards`.
 */
export type NextRbacFor<T extends RbacTypeConfig = DefaultRbacTypes, G extends string = DefaultGuardName<T>> = T extends {
  guards: object
}
  ? ScopedNextRbac<T, G>
  : NextRbac<T>

export { forbiddenMessage } from './responses'

const EMPTY_SNAPSHOT: RbacSnapshot = { roles: [], permissions: [] }



/**
 * Server-side helpers for the Next.js App Router (server components, server actions, route handlers).
 *
 * ```ts
 * // lib/rbac.ts
 * export const { getSnapshot, can, requirePermission, withPermission, withRbac } = createNextRbac({
 *   rbac,
 *   getSubject: async () => {
 *     const session = await auth()
 *     return session?.user ? { type: 'user', id: session.user.id } : null
 *   },
 * })
 * ```
 *
 * With a typed engine (`createRbac<AppTypes>(...)`), names are checked: `requirePermission('typo')` is a type error.
 * With per-guard names, the helpers take the names of the `guard` option (the default guard's without it).
 */
export function createNextRbac<T extends RbacTypeConfig = DefaultRbacTypes, G extends string = DefaultGuardName<T>>(
  options: NextRbacOptions<T, G> & (T extends { guards: object } ? GuardOptions<CheckGuard<T, G>> : unknown),
): NextRbacFor<T, ScopedGuardName<T, G>> {
  // The implementation is untyped (plain `string` names); `NextRbac<T>` adds the typed signatures.
  const helpers = buildNextRbac(options as unknown as NextRbacOptions) satisfies Record<keyof NextRbac, unknown>
  return helpers as unknown as NextRbacFor<T, ScopedGuardName<T, G>>
}

function buildNextRbac(options: NextRbacOptions) {
  const { rbac } = options

  async function getSubject(): Promise<Subject | null> {
    return (await options.getSubject()) ?? null
  }

  async function resolveScope(scope: ScopeOptions = {}): Promise<ScopeOptions> {
    const guard = scope.guard ?? options.guard
    let team: TeamId | undefined = scope.team
    if (team === undefined) {
      team = typeof options.team === 'function' ? await options.team() : options.team
    }
    const out: ScopeOptions = {}
    if (guard !== undefined) out.guard = guard
    if (team !== undefined && team !== null) out.team = team
    return out
  }

  async function forSubject(subject: Subject, scope?: ScopeOptions) {
    return rbac.for(subject, await resolveScope(scope))
  }

  async function satisfies(subject: Subject, requirement: Requirement, scope?: ScopeOptions): Promise<boolean> {
    const s = await forSubject(subject, scope)
    return checkRequirement(requirement, (n) => s.can(n), (n) => s.hasRole(n))
  }

  /** Non-throwing check: who is the user and do they meet the requirement? */
  async function authorize(requirement: Requirement, scope?: ScopeOptions): Promise<AuthorizeResult> {
    const subject = await getSubject()
    if (!subject) return { ok: false, reason: 'unauthenticated', subject: null }
    if (!(await satisfies(subject, requirement, scope))) return { ok: false, reason: 'unauthorized', subject }
    return { ok: true, subject }
  }

  function fail(reason: FailureReason, opts: RequireOptions): never {
    if (reason === 'unauthenticated') {
      const handler = opts.onUnauthenticated ?? options.onUnauthenticated
      if (handler) handler()
      else {
        const loginUrl = opts.loginUrl ?? options.loginUrl
        if (loginUrl !== undefined) redirect(loginUrl)
        notFound()
      }
    } else {
      const handler = opts.onUnauthorized ?? options.onUnauthorized
      if (handler) handler()
      else notFound()
    }
    // Safety net in case a custom handler returned instead of throwing.
    throw new RbacUnauthorizedError(reason)
  }

  async function enforce(requirement: Requirement, opts: RequireOptions = {}): Promise<Subject> {
    const result = await authorize(requirement, opts)
    if (!result.ok) fail(result.reason, opts)
    return result.subject
  }

  function guardAction<Args extends unknown[], R>(
    requirement: Requirement,
    action: (...args: Args) => MaybePromise<R>,
    scope?: ScopeOptions | undefined,
  ): (...args: Args) => Promise<R> {
    return async (...args: Args): Promise<R> => {
      const result = await authorize(requirement, scope)
      if (!result.ok) throw new RbacUnauthorizedError(result.reason)
      return action(...args)
    }
  }

  return {
    rbac,
    getSubject,
    authorize,

    /** Roles & permissions of the current user — pass to `<RbacProvider snapshot={...}>`. Guests get an empty snapshot. */
    async getSnapshot(scope?: ScopeOptions): Promise<RbacSnapshot> {
      const subject = await getSubject()
      if (!subject) return { roles: [...EMPTY_SNAPSHOT.roles], permissions: [...EMPTY_SNAPSHOT.permissions] }
      return (await forSubject(subject, scope)).snapshot()
    },

    async can(permission: string, scope?: ScopeOptions): Promise<boolean> {
      const subject = await getSubject()
      return subject ? (await forSubject(subject, scope)).can(permission) : false
    },

    async canAny(permissions: Many<string>, scope?: ScopeOptions): Promise<boolean> {
      const subject = await getSubject()
      return subject ? (await forSubject(subject, scope)).canAny(permissions) : false
    },

    async canAll(permissions: Many<string>, scope?: ScopeOptions): Promise<boolean> {
      const subject = await getSubject()
      return subject ? (await forSubject(subject, scope)).canAll(permissions) : false
    },

    /** `true` if the user has the role — or ANY of the roles when given an array. */
    async hasRole(role: Many<string>, scope?: ScopeOptions): Promise<boolean> {
      const subject = await getSubject()
      return subject ? (await forSubject(subject, scope)).hasAnyRole(role) : false
    },

    async hasAllRoles(roles: Many<string>, scope?: ScopeOptions): Promise<boolean> {
      const subject = await getSubject()
      return subject ? (await forSubject(subject, scope)).hasAllRoles(roles) : false
    },

    /**
     * Ensures the user has the permission (or ANY of the permissions). Returns the subject.
     * Guests: `redirect(loginUrl)` or `notFound()`. Missing permission: `notFound()`. Both configurable.
     */
    requirePermission(permission: Many<string>, opts?: RequireOptions): Promise<Subject> {
      return enforce({ permission, ...(opts?.all && { all: true }) }, opts)
    },

    /** Ensures the user has the role (or ANY of the roles). Returns the subject. */
    requireRole(role: Many<string>, opts?: RequireOptions): Promise<Subject> {
      return enforce({ role, ...(opts?.all && { all: true }) }, opts)
    },

    /** Ensures the user has ANY of the given roles or permissions. Returns the subject. */
    requireRoleOrPermission(items: Many<string>, opts?: RequireOptions): Promise<Subject> {
      return enforce({ roleOrPermission: items }, opts)
    },

    /** Wraps a server action; throws `RbacUnauthorizedError` unless the user has the permission (or ANY of them). */
    withPermission<Args extends unknown[], R>(
      permission: Many<string>,
      action: (...args: Args) => MaybePromise<R>,
      scope?: ScopeOptions | undefined,
    ): (...args: Args) => Promise<R> {
      return guardAction({ permission }, action, scope)
    },

    /** Wraps a server action; throws `RbacUnauthorizedError` unless the user has the role (or ANY of them). */
    withRole<Args extends unknown[], R>(
      role: Many<string>,
      action: (...args: Args) => MaybePromise<R>,
      scope?: ScopeOptions | undefined,
    ): (...args: Args) => Promise<R> {
      return guardAction({ role }, action, scope)
    },

    /**
     * Wraps a route handler. Responds `401` (guest) or `403` (missing role/permission) with a JSON body.
     * Mirrors spatie's `permission`, `role` and `role_or_permission` middleware.
     */
    withRbac<Args extends unknown[]>(
      handler: (...args: Args) => MaybePromise<Response>,
      options: WithRbacOptions,
    ): (...args: Args) => Promise<Response> {
      const { guard, team, ...requirement } = options
      const scope: ScopeOptions = {}
      if (guard !== undefined) scope.guard = guard
      if (team !== undefined) scope.team = team
      return async (...args: Args): Promise<Response> => {
        const result = await authorize(requirement as Requirement, scope)
        if (result.ok) return handler(...args)
        return result.reason === 'unauthenticated'
          ? unauthenticatedResponse()
          : forbiddenResponse(requirement as Requirement)
      }
    },
  }
}
