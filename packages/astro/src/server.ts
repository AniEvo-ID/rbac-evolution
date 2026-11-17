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

declare global {
  // Astro declares `App.Locals` (in `src/env.d.ts` you add your fields); this keeps the package's types valid without it.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace App {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface Locals {}
  }
}

type MaybePromise<T> = T | Promise<T>

/** The type configuration of `T`: `T` itself, or the `X` of an `Rbac<X>` engine. */
export type TypesOf<T> = T extends Rbac<infer X> ? X : T extends RbacTypeConfig ? T : never

/**
 * The part of Astro's context this package uses. `Astro` in a page, the `context` of an endpoint (`APIContext`) and
 * the `context` of a middleware all have it. Only `request` is read by the guards; `getSubject` and `team` get the
 * whole object.
 */
export interface AstroContext {
  request: Request
  url: URL
  /** The route params: `params.teamId` on `src/pages/teams/[teamId]/...`. */
  params: Readonly<Record<string, string | undefined>>
  /** `App.Locals`: what your auth middleware put there (`locals.user`). */
  locals: App.Locals
  cookies: { get(key: string): { value: string } | undefined }
}

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

/** Handles a failed check: returns the `Response` the guard then resolves to (a page, `Astro.rewrite('/404')`...). */
export type GuardHandler<A extends AstroContext = AstroContext> = (context: A, guard: GuardContext) => MaybePromise<Response>

export interface GuardHandlers<A extends AstroContext = AstroContext> {
  /** Called when there is no subject. Wins over `unauthenticatedRedirect`. Default: a 401 JSON `Response`. */
  onUnauthenticated?: GuardHandler<A> | undefined
  /** Called when the subject lacks access. Wins over `forbiddenRedirect`. Default: a 403 JSON `Response`. */
  onForbidden?: GuardHandler<A> | undefined
  /**
   * Redirect guests here (302) instead of the 401. Handy for pages: `'/login'`. A function gets the context, e.g. to
   * keep the page: `({ url }) => `/login?redirectTo=${url.pathname}``.
   */
  unauthenticatedRedirect?: string | ((context: A) => string) | undefined
  /** Redirect users without access here (302) instead of the 403. */
  forbiddenRedirect?: string | ((context: A) => string) | undefined
  /**
   * Include the required roles/permissions in the default 403 body (`required`).
   * Default: `false` (like spatie's `display_permission_in_exception`).
   */
  exposeRequirements?: boolean | undefined
}

/** The options every guard takes as its last argument: the handlers plus `guard`. They win over the defaults. */
export interface RouteGuardOptions<A extends AstroContext = AstroContext> extends GuardHandlers<A> {
  /** Check in this guard instead of the server's (`subject.withScope({ guard })`), like spatie's `role:admin,api`. */
  guard?: string | undefined
}

export interface PermissionGuardOptions<A extends AstroContext = AstroContext> extends RouteGuardOptions<A> {
  /** Pass when the subject has ANY of the permissions (instead of all). Default: `false`. */
  any?: boolean | undefined
}

export interface RoleGuardOptions<A extends AstroContext = AstroContext> extends RouteGuardOptions<A> {
  /** Require ALL of the roles (instead of any). Default: `false`. */
  all?: boolean | undefined
}

export type RoleOrPermissionGuardOptions<A extends AstroContext = AstroContext> = RouteGuardOptions<A>

/**
 * A guard typed with the names `N` it accepts and its options `O`: `(context, ...names, options?)`. It resolves to
 * `undefined` when the check passes, and to the `Response` to return (401, 403 or a redirect) when it does not.
 */
export type Guard<N extends string, O, A extends AstroContext = AstroContext> = <const X extends readonly (GuardNames | O)[]>(
  context: A,
  ...rest: X & RequirementArgs<X, N, O>
) => Promise<Response | undefined>

/** A guard when the engine has per-guard names: the names follow the guard the call checks in. */
export type ScopedGuard<T extends RbacTypeConfig, G extends string, K extends GuardKind, O, A extends AstroContext = AstroContext> = <
  const X extends readonly (GuardNames | O)[],
>(
  context: A,
  ...rest: X & GuardRequirementArgs<X, T, K, G, O>
) => Promise<Response | undefined>

export interface Guards<T extends RbacTypeConfig = DefaultRbacTypes, A extends AstroContext = AstroContext> {
  /** All arguments are required, pipes mean any, `{ any: true }` means any of them. */
  requirePermission: Guard<PermissionName<T>, PermissionGuardOptions<A>, A>
  /** Any of the roles, `{ all: true }` for all of them. */
  requireRole: Guard<RoleName<T>, RoleGuardOptions<A>, A>
  /** Any of the names, as a role OR a permission. */
  requireRoleOrPermission: Guard<PermissionName<T> | RoleName<T>, RoleOrPermissionGuardOptions<A>, A>
  /** spatie v8.5 `canAny()`: requires ANY of the listed permissions. */
  canAny: Guard<PermissionName<T>, RouteGuardOptions<A>, A>
  /** spatie v8.5 `canAll()`: requires EVERY listed entry; a `'a|b'` entry still means "a or b". */
  canAll: Guard<PermissionName<T>, RouteGuardOptions<A>, A>
}

export interface ScopedGuards<T extends RbacTypeConfig, G extends string = DefaultGuardName<T>, A extends AstroContext = AstroContext> {
  requirePermission: ScopedGuard<T, G, 'permission', PermissionGuardOptions<A>, A>
  requireRole: ScopedGuard<T, G, 'role', RoleGuardOptions<A>, A>
  requireRoleOrPermission: ScopedGuard<T, G, 'role_or_permission', RoleOrPermissionGuardOptions<A>, A>
  canAny: ScopedGuard<T, G, 'permission', RouteGuardOptions<A>, A>
  canAll: ScopedGuard<T, G, 'permission', RouteGuardOptions<A>, A>
}

/** {@link Guards}, or {@link ScopedGuards} for an engine with per-guard names. */
export type GuardsFor<T extends RbacTypeConfig, G extends string, A extends AstroContext> = T extends { guards: object }
  ? ScopedGuards<T, G, A>
  : Guards<T, A>

export interface GetSnapshotOptions<N extends string = string> {
  /**
   * Permissions to run the `before` hook for: those it denies are listed in the snapshot's `denied`, which the React,
   * Vue and Svelte packages honour. See `SubjectRbac.snapshot()`.
   */
  checkBefore?: readonly N[] | undefined
  /** Make the snapshot in this guard instead of the server's. */
  guard?: string | undefined
}

/** What `createRbacServer()` returns: the subject of a request, its snapshot, and the guards. */
export type RbacServer<
  T extends RbacTypeConfig = DefaultRbacTypes,
  G extends string = DefaultGuardName<T>,
  A extends AstroContext = AstroContext,
> = GuardsFor<T, G, A> & {
  /**
   * The subject of this request (`SubjectRbac`), or `null` for guests. Resolved once per request: a middleware, a
   * page and its guards call `getSubject` once.
   */
  getRbac(context: A): Promise<SubjectRbac<T, ScopedGuardName<T, G>> | null>
  /**
   * The subject's roles and permissions for a client island (`<RbacProvider snapshot>` of
   * `@anievo-id/rbac-evolution-react`, or the Vue and Svelte packages), or `null` for guests.
   */
  getSnapshot(context: A, options?: GetSnapshotOptions<PermissionName<T>>): Promise<RbacSnapshot | null>
}

export interface RbacServerOptions<
  T extends RbacTypeConfig = DefaultRbacTypes,
  G extends string = DefaultGuardName<T>,
  A extends AstroContext = AstroContext,
> extends GuardHandlers<A> {
  /** The RBAC engine created with `createRbac(...)`. Its typed names flow into the guards. */
  rbac: Rbac<T>
  /**
   * Resolves the authenticated subject of the request (`locals.user` set by your auth middleware, a session
   * cookie...). Return `null` / `undefined` for guests.
   */
  getSubject: (context: A) => MaybePromise<Subject | null | undefined>
  /** Guard name (e.g. `web` or `api`). Defaults to the engine's `defaultGuard`. */
  guard?: G | undefined
  /** Resolves the current team (only when the engine was created with `teams: true`). */
  team?: ((context: A) => MaybePromise<TeamId | undefined>) | undefined
}

const json = (body: RbacErrorBody, status: 401 | 403): Response => Response.json(body, { status })

const redirectTo = (location: string): Response => new Response(null, { status: 302, headers: { Location: location } })

/**
 * Creates the server side of the integration: `getRbac(context)`, `getSnapshot(context)` and the guards, for pages,
 * endpoints and middleware. A guard resolves to `undefined` when the check passes, and to a `Response` to return
 * otherwise: a 401 or 403 JSON response, or a redirect.
 *
 * ```ts
 * // src/rbac.ts
 * export const rbacServer = createRbacServer({
 *   rbac,
 *   getSubject: ({ locals }) => (locals.user ? { type: 'user', id: locals.user.id } : null),
 *   unauthenticatedRedirect: '/login',
 * })
 * ```
 *
 * ```astro
 * ---
 * // src/pages/admin.astro
 * const denied = await rbacServer.requireRole(Astro, 'admin')
 * if (denied) return denied
 * ---
 * ```
 */
export function createRbacServer<
  T extends RbacTypeConfig = DefaultRbacTypes,
  G extends GuardName<T> = DefaultGuardName<T> & GuardName<T>,
  A extends AstroContext = AstroContext,
>(
  options: RbacServerOptions<T, G, A> & (T extends { guards: object } ? GuardOptions<CheckGuard<T, G>> : unknown),
): RbacServer<T, G, A> {
  const { getSubject, team } = options
  const guard: string | undefined = options.guard
  // `T` only narrows the names; the subject is the same object either way.
  const rbac = options.rbac as unknown as Rbac
  const defaults = options as GuardHandlers<A>
  // One subject per request, so a middleware and a page (or several guards) resolve it once.
  const cache = new WeakMap<Request, Promise<SubjectRbac | null>>()

  async function resolve(context: A): Promise<SubjectRbac | null> {
    const subject = await getSubject(context)
    if (!subject) return null
    const teamId = team ? await team(context) : undefined
    return rbac.for(subject, {
      ...(guard !== undefined && { guard }),
      ...(teamId !== undefined && { team: teamId }),
    })
  }

  function getRbac(context: A): Promise<SubjectRbac | null> {
    let pending = cache.get(context.request)
    if (!pending) {
      pending = resolve(context)
      cache.set(context.request, pending)
    }
    return pending
  }

  async function getSnapshot(context: A, snapshotOptions: GetSnapshotOptions = {}): Promise<RbacSnapshot | null> {
    const subject = await getRbac(context)
    if (!subject) return null
    const scoped = snapshotOptions.guard === undefined ? subject : subject.withScope({ guard: snapshotOptions.guard })
    return scoped.snapshot(snapshotOptions.checkBefore === undefined ? {} : { checkBefore: snapshotOptions.checkBefore })
  }

  /** The first layer (a guard's own options, then the defaults) that handles the failure decides. */
  async function failure(context: A, guardContext: GuardContext, layers: readonly GuardHandlers<A>[], unauthenticated: boolean): Promise<Response> {
    for (const layer of layers) {
      const handler = unauthenticated ? layer.onUnauthenticated : layer.onForbidden
      if (handler) return handler(context, guardContext)
      const location = unauthenticated ? layer.unauthenticatedRedirect : layer.forbiddenRedirect
      if (location !== undefined) return redirectTo(typeof location === 'function' ? location(context) : location)
    }
    if (unauthenticated) return json({ error: 'UNAUTHENTICATED', message: UNAUTHENTICATED_MESSAGE }, 401)
    const expose = layers.map((layer) => layer.exposeRequirements).find((value) => value !== undefined) ?? false
    return json(
      {
        error: 'FORBIDDEN',
        reason: guardContext.kind,
        message: REQUIREMENT_MESSAGES[guardContext.kind],
        ...(expose && { required: guardContext.requirements }),
      },
      403,
    )
  }

  // Async, so an empty requirement (TypeError) rejects the returned promise instead of throwing synchronously.
  async function enforce(context: A, build: () => RbacRequirement, guardOptions: RouteGuardOptions<A> = {}): Promise<Response | undefined> {
    const requirement = build()
    const guardContext: GuardContext = { kind: requirement.kind, requirements: requirement.requirements }
    const layers = [guardOptions, defaults]
    const subject = await getRbac(context)
    if (subject === null) return failure(context, guardContext, layers, true)
    const scoped = guardOptions.guard === undefined ? subject : subject.withScope({ guard: guardOptions.guard })
    if (await satisfiesRequirement(scoped, requirement)) return undefined
    return failure(context, guardContext, layers, false)
  }

  type Rest<O> = readonly (GuardNames | O)[]

  function requirePermission(context: A, ...rest: Rest<PermissionGuardOptions<A>>): Promise<Response | undefined> {
    const { names, options: o } = splitRequirementArgs<PermissionGuardOptions<A>>(rest)
    return enforce(context, () => permissionRequirement(names, o), o)
  }

  function requireRole(context: A, ...rest: Rest<RoleGuardOptions<A>>): Promise<Response | undefined> {
    const { names, options: o } = splitRequirementArgs<RoleGuardOptions<A>>(rest)
    return enforce(context, () => roleRequirement(names, o), o)
  }

  function requireRoleOrPermission(context: A, ...rest: Rest<RoleOrPermissionGuardOptions<A>>): Promise<Response | undefined> {
    const { names, options: o } = splitRequirementArgs<RoleOrPermissionGuardOptions<A>>(rest)
    return enforce(context, () => roleOrPermissionRequirement(names), o)
  }

  function canAny(context: A, ...rest: Rest<RouteGuardOptions<A>>): Promise<Response | undefined> {
    const { names, options: o } = splitRequirementArgs<RouteGuardOptions<A>>(rest)
    return enforce(context, () => permissionRequirement(names, { any: true }), o)
  }

  function canAll(context: A, ...rest: Rest<RouteGuardOptions<A>>): Promise<Response | undefined> {
    const { names, options: o } = splitRequirementArgs<RouteGuardOptions<A>>(rest)
    return enforce(context, () => permissionRequirement(names), o)
  }

  // The untyped functions above take any spread of names; the typed signature is only the public face.
  return { getRbac, getSnapshot, requirePermission, requireRole, requireRoleOrPermission, canAny, canAll } as unknown as RbacServer<
    T,
    G,
    A
  >
}
