import {
  type CheckGuard,
  type DefaultGuardName,
  type DefaultRbacTypes,
  type GuardName,
  type GuardOptions,
  type GuardRequirementArgs,
  type PermissionName,
  permissionRequirement,
  type Rbac,
  type RbacRequirement,
  type RbacSnapshot,
  type RbacTypeConfig,
  type RequirementArgs,
  type RequirementGuard,
  type RequirementKind,
  type RequirementNames,
  REQUIREMENT_MESSAGES,
  type RoleName,
  roleOrPermissionRequirement,
  roleRequirement,
  satisfiesRequirement,
  type ScopedGuardName,
  splitRequirementArgs,
  type Subject,
  type SubjectRbac,
  type TeamId,
  UNAUTHENTICATED_MESSAGE,
} from '@anievo-id/rbac-evolution'

type MaybePromise<T> = T | Promise<T>

/** The type configuration of `T`: `T` itself, or the `X` of an `Rbac<X>` engine. */
export type TypesOf<T> = T extends Rbac<infer X> ? X : T extends RbacTypeConfig ? T : never

export type GuardKind = RequirementKind

/** A name, a pipe-separated list (`'edit|delete'` = any of), or an array of names. */
export type GuardNames = RequirementNames

/** Details about a failed check, passed to `onUnauthenticated` / `onForbidden`. */
export interface GuardContext {
  kind: GuardKind
  /** Groups of names: every group must pass, a group passes when ANY of its names matches. */
  requirements: string[][]
}

/** The JSON body of a failed check: the same as the Express, Hono, Fastify and NestJS packages send. */
export type RbacErrorBody =
  | { error: 'UNAUTHENTICATED'; message: string }
  | { error: 'FORBIDDEN'; reason: RequirementKind; message: string; required?: string[][] }

/**
 * Handles a failed check. It returns the `Response` the guard then throws, such as TanStack Router's
 * `redirect({ to: '/login' })`, or throws itself (`throw notFound()`).
 */
export type GuardHandler = (request: Request, context: GuardContext) => MaybePromise<Response>

export interface GuardHandlers {
  /**
   * Called when there is no subject. Default: a 401 JSON `Response`. For a page, return TanStack Router's
   * `redirect({ to: '/login' })`: a plain 302 `Response` from a server function is followed by `fetch`, not the router.
   */
  onUnauthenticated?: GuardHandler | undefined
  /** Called when the subject lacks access. Default: a 403 JSON `Response`. */
  onForbidden?: GuardHandler | undefined
  /**
   * Include the required roles/permissions in the default 403 body (`required`).
   * Default: `false` (like spatie's `display_permission_in_exception`).
   */
  exposeRequirements?: boolean | undefined
}

/** The options every guard takes as its last argument: the handlers plus `guard`. They win over the defaults. */
export interface RouteGuardOptions extends GuardHandlers {
  /** Check in this guard instead of the server's (`subject.withScope({ guard })`), like spatie's `role:admin,api`. */
  guard?: string | undefined
}

export interface PermissionGuardOptions extends RouteGuardOptions {
  /** Pass when the subject has ANY of the permissions (instead of all). Default: `false`. */
  any?: boolean | undefined
}

export interface RoleGuardOptions extends RouteGuardOptions {
  /** Require ALL of the roles (instead of any). Default: `false`. */
  all?: boolean | undefined
}

export type RoleOrPermissionGuardOptions = RouteGuardOptions

/**
 * A guard typed with the names `N` it accepts and its options `O`: `(request, ...names, options?)`. It resolves to
 * the subject (`R`) when the check passes, and throws a `Response` (401, 403, or a handler's) when it does not.
 */
export type Guard<N extends string, O, R = SubjectRbac> = <
  const X extends readonly (GuardNames | O)[],
>(
  request: Request,
  ...rest: X & RequirementArgs<X, N, O>
) => Promise<R>

/** A guard when the engine has per-guard names: the names (and the subject) follow the guard the call checks in. */
export type ScopedGuard<T extends RbacTypeConfig, G extends string, K extends GuardKind, O> = <
  const X extends readonly (GuardNames | O)[],
>(
  request: Request,
  ...rest: X & GuardRequirementArgs<X, T, K, G, O>
) => Promise<SubjectRbac<T, ScopedGuardName<T, RequirementGuard<X, G>>>>

export interface Guards<T extends RbacTypeConfig = DefaultRbacTypes> {
  /** All arguments are required, pipes mean any, `{ any: true }` means any of them. */
  requirePermission: Guard<PermissionName<T>, PermissionGuardOptions, SubjectRbac<T>>
  /** Any of the roles, `{ all: true }` for all of them. */
  requireRole: Guard<RoleName<T>, RoleGuardOptions, SubjectRbac<T>>
  /** Any of the names, as a role OR a permission. */
  requireRoleOrPermission: Guard<PermissionName<T> | RoleName<T>, RoleOrPermissionGuardOptions, SubjectRbac<T>>
  /** spatie v8.5 `canAny()`: requires ANY of the listed permissions. */
  canAny: Guard<PermissionName<T>, RouteGuardOptions, SubjectRbac<T>>
  /** spatie v8.5 `canAll()`: requires EVERY listed entry; a `'a|b'` entry still means "a or b". */
  canAll: Guard<PermissionName<T>, RouteGuardOptions, SubjectRbac<T>>
}

export interface ScopedGuards<T extends RbacTypeConfig, G extends string = DefaultGuardName<T>> {
  requirePermission: ScopedGuard<T, G, 'permission', PermissionGuardOptions>
  requireRole: ScopedGuard<T, G, 'role', RoleGuardOptions>
  requireRoleOrPermission: ScopedGuard<T, G, 'role_or_permission', RoleOrPermissionGuardOptions>
  canAny: ScopedGuard<T, G, 'permission', RouteGuardOptions>
  canAll: ScopedGuard<T, G, 'permission', RouteGuardOptions>
}

/** {@link Guards}, or {@link ScopedGuards} for an engine with per-guard names. */
export type GuardsFor<T extends RbacTypeConfig, G extends string> = T extends { guards: object }
  ? ScopedGuards<T, G>
  : Guards<T>

export interface GetSnapshotOptions<N extends string = string> {
  /**
   * Permissions to run the `before` hook for: those it denies are listed in the snapshot's `denied`, which the React
   * package honours. See `SubjectRbac.snapshot()`.
   */
  checkBefore?: readonly N[] | undefined
  /** Make the snapshot in this guard instead of the server's. */
  guard?: string | undefined
}

/** What `createRbacServer()` returns: the subject of a request, its snapshot, and the guards. */
export type RbacServer<
  T extends RbacTypeConfig = DefaultRbacTypes,
  G extends string = DefaultGuardName<T>,
> = GuardsFor<T, G> & {
  /**
   * The subject of this request (`SubjectRbac`), or `null` for guests. Resolved once per `Request` object: several
   * guards in one server function call `getSubject` once.
   */
  getRbac(request: Request): Promise<SubjectRbac<T, ScopedGuardName<T, G>> | null>
  /**
   * The subject's roles and permissions for the client (`<RbacProvider snapshot>` of
   * `@anievo-id/rbac-evolution-react`), or `null` for guests. Return it from a server function the root route loads.
   */
  getSnapshot(request: Request, options?: GetSnapshotOptions<PermissionName<T>>): Promise<RbacSnapshot | null>
}

export interface RbacServerOptions<
  T extends RbacTypeConfig = DefaultRbacTypes,
  G extends string = DefaultGuardName<T>,
> extends GuardHandlers {
  /** The RBAC engine created with `createRbac(...)`. Its typed names flow into the guards. */
  rbac: Rbac<T>
  /**
   * Resolves the authenticated subject of the request (a session cookie, a JWT, your auth library's session...).
   * Return `null` / `undefined` for guests.
   */
  getSubject: (request: Request) => MaybePromise<Subject | null | undefined>
  /** Guard name (e.g. `web` or `api`). Defaults to the engine's `defaultGuard`. */
  guard?: G | undefined
  /** Resolves the current team (only when the engine was created with `teams: true`). */
  team?: ((request: Request) => MaybePromise<TeamId | undefined>) | undefined
}

const json = (body: RbacErrorBody, status: 401 | 403): Response => Response.json(body, { status })

/**
 * Creates the server side of the integration: `getRbac(request)`, `getSnapshot(request)` and the guards, for server
 * functions, middleware and server routes. Guards resolve to the subject when the check passes, and throw a
 * `Response` otherwise: a 401 or 403 JSON response, or what `onUnauthenticated` / `onForbidden` return.
 *
 * ```ts
 * // src/rbac.ts
 * export const rbacServer = createRbacServer({
 *   rbac,
 *   getSubject: async (request) => {
 *     const user = await getUser(request)
 *     return user ? { type: 'user', id: user.id } : null
 *   },
 * })
 *
 * // a server function
 * export const getStats = createServerFn().handler(async () => {
 *   await rbacServer.requireRole(getRequest(), 'admin')
 *   return loadStats()
 * })
 * ```
 */
export function createRbacServer<
  T extends RbacTypeConfig = DefaultRbacTypes,
  G extends GuardName<T> = DefaultGuardName<T> & GuardName<T>,
>(
  options: RbacServerOptions<T, G> & (T extends { guards: object } ? GuardOptions<CheckGuard<T, G>> : unknown),
): RbacServer<T, G> {
  const { getSubject, team } = options
  const guard: string | undefined = options.guard
  // `T` only narrows the names; the subject is the same object either way.
  const rbac = options.rbac as unknown as Rbac
  const defaults = options as GuardHandlers
  // One subject per request, so several guards (or a guard and getSnapshot) resolve it once.
  const cache = new WeakMap<Request, Promise<SubjectRbac | null>>()

  async function resolve(request: Request): Promise<SubjectRbac | null> {
    const subject = await getSubject(request)
    if (!subject) return null
    const teamId = team ? await team(request) : undefined
    return rbac.for(subject, {
      ...(guard !== undefined && { guard }),
      ...(teamId !== undefined && { team: teamId }),
    })
  }

  function getRbac(request: Request): Promise<SubjectRbac | null> {
    let pending = cache.get(request)
    if (!pending) {
      pending = resolve(request)
      cache.set(request, pending)
    }
    return pending
  }

  async function getSnapshot(request: Request, snapshotOptions: GetSnapshotOptions = {}): Promise<RbacSnapshot | null> {
    const subject = await getRbac(request)
    if (!subject) return null
    const scoped = snapshotOptions.guard === undefined ? subject : subject.withScope({ guard: snapshotOptions.guard })
    return scoped.snapshot(snapshotOptions.checkBefore === undefined ? {} : { checkBefore: snapshotOptions.checkBefore })
  }

  /** The first layer (a guard's own options, then the defaults) that handles the failure decides. */
  async function failure(request: Request, context: GuardContext, layers: readonly GuardHandlers[], unauthenticated: boolean): Promise<never> {
    for (const layer of layers) {
      const handler = unauthenticated ? layer.onUnauthenticated : layer.onForbidden
      if (handler) throw await handler(request, context)
    }
    if (unauthenticated) throw json({ error: 'UNAUTHENTICATED', message: UNAUTHENTICATED_MESSAGE }, 401)
    const expose = layers.map((layer) => layer.exposeRequirements).find((value) => value !== undefined) ?? false
    throw json(
      {
        error: 'FORBIDDEN',
        reason: context.kind,
        message: REQUIREMENT_MESSAGES[context.kind],
        ...(expose && { required: context.requirements }),
      },
      403,
    )
  }

  // Async, so an empty requirement (TypeError) rejects the returned promise instead of throwing synchronously.
  async function enforce(request: Request, build: () => RbacRequirement, guardOptions: RouteGuardOptions = {}): Promise<SubjectRbac> {
    const requirement = build()
    const context: GuardContext = { kind: requirement.kind, requirements: requirement.requirements }
    const layers = [guardOptions, defaults]
    const subject = await getRbac(request)
    if (subject === null) return failure(request, context, layers, true)
    const scoped = guardOptions.guard === undefined ? subject : subject.withScope({ guard: guardOptions.guard })
    if (await satisfiesRequirement(scoped, requirement)) return scoped
    return failure(request, context, layers, false)
  }

  type Rest<O> = readonly (GuardNames | O)[]

  function requirePermission(request: Request, ...rest: Rest<PermissionGuardOptions>): Promise<SubjectRbac> {
    const { names, options: o } = splitRequirementArgs<PermissionGuardOptions>(rest)
    return enforce(request, () => permissionRequirement(names, o), o)
  }

  function requireRole(request: Request, ...rest: Rest<RoleGuardOptions>): Promise<SubjectRbac> {
    const { names, options: o } = splitRequirementArgs<RoleGuardOptions>(rest)
    return enforce(request, () => roleRequirement(names, o), o)
  }

  function requireRoleOrPermission(request: Request, ...rest: Rest<RoleOrPermissionGuardOptions>): Promise<SubjectRbac> {
    const { names, options: o } = splitRequirementArgs<RoleOrPermissionGuardOptions>(rest)
    return enforce(request, () => roleOrPermissionRequirement(names), o)
  }

  function canAny(request: Request, ...rest: Rest<RouteGuardOptions>): Promise<SubjectRbac> {
    const { names, options: o } = splitRequirementArgs<RouteGuardOptions>(rest)
    return enforce(request, () => permissionRequirement(names, { any: true }), o)
  }

  function canAll(request: Request, ...rest: Rest<RouteGuardOptions>): Promise<SubjectRbac> {
    const { names, options: o } = splitRequirementArgs<RouteGuardOptions>(rest)
    return enforce(request, () => permissionRequirement(names), o)
  }

  // The untyped functions above take any spread of names; the typed signature is only the public face.
  return { getRbac, getSnapshot, requirePermission, requireRole, requireRoleOrPermission, canAny, canAll } as unknown as RbacServer<T, G>
}
