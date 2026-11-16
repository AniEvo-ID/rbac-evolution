import {
  type DefaultGuardName,
  type DefaultRbacTypes,
  type GuardName,
  type GuardRequirementArgs,
  type PermissionName,
  permissionRequirement,
  type Rbac,
  type RbacRequirement,
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
  type SubjectRbac,
  UNAUTHENTICATED_MESSAGE,
} from '@anievo-id/rbac-evolution'
import { error, isHttpError, redirect, type RequestEvent } from '@sveltejs/kit'
import type { TypesOf } from '../types.js'
import { getRbac } from './handle.js'

export type GuardKind = RequirementKind

/** A name, a pipe-separated list (`'edit|delete'` = any of), or an array of names. */
export type GuardNames = RequirementNames

/** Details about a failed check, passed to `onUnauthenticated` / `onForbidden`. */
export interface GuardContext {
  kind: GuardKind
  /** Groups of names: every group must pass, a group passes when ANY of its names matches. */
  requirements: string[][]
}

/** The body of a failed check: the same as the Express, Hono, Fastify and NestJS packages send. */
export type RbacErrorBody =
  | { error: 'UNAUTHENTICATED'; message: string }
  | { error: 'FORBIDDEN'; reason: RequirementKind; message: string; required?: string[][] }

/**
 * Handles a failed check. It must throw, with SvelteKit's `redirect()` or `error()`:
 * `(event) => redirect(303, `/login?redirectTo=${event.url.pathname}`)`.
 */
export type GuardHandler = (event: RequestEvent, context: GuardContext) => never | Promise<never>

export interface GuardHandlers {
  /**
   * Called when there is no subject (`event.locals.rbac` is `null`). Wins over `unauthenticatedRedirect`.
   * Default: `error(401, { error: 'UNAUTHENTICATED', message })`.
   */
  onUnauthenticated?: GuardHandler | undefined
  /**
   * Called when the subject lacks access. Wins over `forbiddenRedirect`.
   * Default: `error(403, { error: 'FORBIDDEN', reason, message })`.
   */
  onForbidden?: GuardHandler | undefined
  /** Redirect guests here (`redirect(303, url)`) instead of the 401 error. Handy for page loads: `'/login'`. */
  unauthenticatedRedirect?: string | undefined
  /** Redirect users without access here (`redirect(303, url)`) instead of the 403 error. */
  forbiddenRedirect?: string | undefined
  /**
   * Include the required roles/permissions in the default 403 body (`required`).
   * Default: `false` (like spatie's `display_permission_in_exception`).
   */
  exposeRequirements?: boolean | undefined
}

/**
 * The options every guard takes as its last argument: the handlers plus `guard`. A guard's own handlers win over
 * the defaults of `createGuards()`.
 */
export interface RouteGuardOptions extends GuardHandlers {
  /**
   * Check in this guard instead of the request's (`subject.withScope({ guard })`), like spatie's
   * `role:admin,api`. Default: the guard of `rbacHandle()`.
   */
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
 * A guard typed with the names `N` it accepts and its options `O`: `(event, ...names, options?)`. It resolves to the
 * subject (`R`) when the check passes, and throws (SvelteKit's `error()` / `redirect()`, or your handler) when it
 * does not. Every name (each part of a `'a|b'` list, each array item) must be one of `N`; with `N = string`, any name
 * is. A call without names, or with options that are not the last argument, is a type error.
 */
export type Guard<N extends string, O, R = SubjectRbac> = <const A extends readonly (GuardNames | O)[]>(
  event: RequestEvent,
  ...args: A & RequirementArgs<A, N, O>
) => Promise<R>

/** The guards returned by `createGuards<T>()`, with names narrowed by `T` (see `RbacTypeConfig`). */
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

/**
 * A guard of `createGuards<T, G>()` when `T` has per-guard names (`RbacTypeConfig['guards']`): like {@link Guard},
 * but the names are those of the guard the call checks in, its `{ guard }` option or else `G` (the guard of
 * `rbacHandle()`), and the subject it returns is typed for that guard.
 */
export type ScopedGuard<T extends RbacTypeConfig, G extends string, K extends GuardKind, O> = <
  const A extends readonly (GuardNames | O)[],
>(
  event: RequestEvent,
  ...args: A & GuardRequirementArgs<A, T, K, G, O>
) => Promise<SubjectRbac<T, ScopedGuardName<T, RequirementGuard<A, G>>>>

/** The guards returned by `createGuards<T, G>()` when `T` has per-guard names (see {@link ScopedGuard}). */
export interface ScopedGuards<T extends RbacTypeConfig, G extends string = DefaultGuardName<T>> {
  requirePermission: ScopedGuard<T, G, 'permission', PermissionGuardOptions>
  requireRole: ScopedGuard<T, G, 'role', RoleGuardOptions>
  requireRoleOrPermission: ScopedGuard<T, G, 'role_or_permission', RoleOrPermissionGuardOptions>
  canAny: ScopedGuard<T, G, 'permission', RouteGuardOptions>
  canAll: ScopedGuard<T, G, 'permission', RouteGuardOptions>
}

/**
 * What `createGuards<T, G>()` returns: {@link Guards} for a config without per-guard names, and
 * {@link ScopedGuards} for one with `guards`.
 */
export type GuardsFor<T extends RbacTypeConfig = DefaultRbacTypes, G extends string = DefaultGuardName<T>> = T extends {
  guards: object
}
  ? ScopedGuards<T, G>
  : Guards<T>

/** SvelteKit 3's `error(status, message, properties)`. */
type ErrorWithProperties = (status: number, message: string, properties: object) => never

/**
 * Throws SvelteKit's `error()` with `body`. SvelteKit 3 takes `error(status, message, properties)` (and deprecates
 * the body form); SvelteKit 2 only `error(status, body)`, and would drop the properties of the 3-argument form. So
 * try that form first, and keep its error only when the properties made it into the body.
 */
function fail(status: 401 | 403, body: RbacErrorBody): never {
  const { message, ...properties } = body
  try {
    ;(error as unknown as ErrorWithProperties)(status, message, properties)
  } catch (thrown) {
    if (isHttpError(thrown) && (thrown.body as { error?: unknown }).error === body.error) throw thrown
  }
  // `App.Error` may be extended by the app with required fields; the body is ours.
  return error(status, body as never)
}

/** The first layer (a guard's own options, then the defaults) that handles the failure decides. */
async function handleFailure(
  event: RequestEvent,
  context: GuardContext,
  layers: readonly GuardHandlers[],
  unauthenticated: boolean,
): Promise<never> {
  for (const layer of layers) {
    const handler = unauthenticated ? layer.onUnauthenticated : layer.onForbidden
    if (handler) {
      await handler(event, context)
      break // A handler that returned instead of throwing: fall back to the error below.
    }
    const location = unauthenticated ? layer.unauthenticatedRedirect : layer.forbiddenRedirect
    if (location !== undefined) redirect(303, location)
  }
  if (unauthenticated) return fail(401, { error: 'UNAUTHENTICATED', message: UNAUTHENTICATED_MESSAGE })
  const expose = layers.map((layer) => layer.exposeRequirements).find((value) => value !== undefined) ?? false
  return fail(403, {
    error: 'FORBIDDEN',
    reason: context.kind,
    message: REQUIREMENT_MESSAGES[context.kind],
    ...(expose && { required: context.requirements }),
  })
}

/**
 * Builds the guards with shared defaults, e.g. redirects for page loads:
 *
 * ```ts
 * // src/lib/server/guards.ts
 * export const { requirePermission, requireRole } = createGuards<AppRbac>({ unauthenticatedRedirect: '/login' })
 *
 * // src/routes/admin/+page.server.ts
 * export const load = async (event) => {
 *   await requireRole(event, 'admin')
 * }
 * ```
 *
 * Pass the same type argument as `createRbac<AppRbac>()` (or `typeof rbac`) to check names at compile time. With
 * per-guard names, `G` is the guard of `rbacHandle()` (default: the default guard): `createGuards<AppRbac, 'api'>()`.
 * It is a type only; the hook's `guard` still decides at runtime.
 */
export function createGuards<
  T extends RbacTypeConfig | Rbac<RbacTypeConfig> = DefaultRbacTypes,
  G extends GuardName<TypesOf<T>> = DefaultGuardName<TypesOf<T>> & GuardName<TypesOf<T>>,
>(defaults: GuardHandlers = {}): GuardsFor<TypesOf<T>, G> {
  // Async, so an empty requirement (TypeError) rejects the returned promise instead of throwing synchronously.
  async function enforce(event: RequestEvent, build: () => RbacRequirement, options: RouteGuardOptions = {}): Promise<SubjectRbac> {
    const requirement = build()
    const context: GuardContext = { kind: requirement.kind, requirements: requirement.requirements }
    const layers = [options, defaults]
    const subject = getRbac(event)
    if (subject === null) return handleFailure(event, context, layers, true)
    const scoped = options.guard === undefined ? subject : subject.withScope({ guard: options.guard })
    if (await satisfiesRequirement(scoped, requirement)) return scoped
    return handleFailure(event, context, layers, false)
  }

  type Args<O> = readonly (GuardNames | O)[]

  /**
   * Requires permissions, like spatie's `permission:` middleware.
   *
   * - `requirePermission(event, 'articles.edit')`
   * - `requirePermission(event, 'articles.edit|articles.delete')` — any of them
   * - `requirePermission(event, 'articles.edit', 'articles.publish')` — all of them
   * - `requirePermission(event, 'a', 'b', { any: true })` — any of them
   */
  function requirePermission(event: RequestEvent, ...args: Args<PermissionGuardOptions>): Promise<SubjectRbac> {
    const { names, options } = splitRequirementArgs<PermissionGuardOptions>(args)
    return enforce(event, () => permissionRequirement(names, options), options)
  }

  /**
   * Requires roles, like spatie's `role:` middleware.
   *
   * - `requireRole(event, 'admin')`, `requireRole(event, 'admin|editor')`, `requireRole(event, 'admin', 'editor')` — any
   * - `requireRole(event, 'admin', 'editor', { all: true })` — all of them
   */
  function requireRole(event: RequestEvent, ...args: Args<RoleGuardOptions>): Promise<SubjectRbac> {
    const { names, options } = splitRequirementArgs<RoleGuardOptions>(args)
    return enforce(event, () => roleRequirement(names, options), options)
  }

  /** Passes with ANY of the names as a role OR a permission, like spatie's `role_or_permission:` middleware. */
  function requireRoleOrPermission(event: RequestEvent, ...args: Args<RoleOrPermissionGuardOptions>): Promise<SubjectRbac> {
    const { names, options } = splitRequirementArgs<RoleOrPermissionGuardOptions>(args)
    return enforce(event, () => roleOrPermissionRequirement(names), options)
  }

  /** spatie v8.5 `canAny()`: passes with ANY of the listed permissions. */
  function canAny(event: RequestEvent, ...args: Args<RouteGuardOptions>): Promise<SubjectRbac> {
    const { names, options } = splitRequirementArgs<RouteGuardOptions>(args)
    return enforce(event, () => permissionRequirement(names, { any: true }), options)
  }

  /** spatie v8.5 `canAll()`: requires EVERY listed entry. A `'a|b'` entry still means "a or b". */
  function canAll(event: RequestEvent, ...args: Args<RouteGuardOptions>): Promise<SubjectRbac> {
    const { names, options } = splitRequirementArgs<RouteGuardOptions>(args)
    return enforce(event, () => permissionRequirement(names), options)
  }

  // The untyped functions above take any spread of names; the typed signature is only the public face.
  return { requirePermission, requireRole, requireRoleOrPermission, canAny, canAll } as unknown as GuardsFor<TypesOf<T>, G>
}

const defaultGuards: Guards = createGuards()

/** {@link Guards.requirePermission} with the default handlers (401 / 403 errors). Any name. */
export const requirePermission: Guard<string, PermissionGuardOptions> = defaultGuards.requirePermission
/** {@link Guards.requireRole} with the default handlers (401 / 403 errors). Any name. */
export const requireRole: Guard<string, RoleGuardOptions> = defaultGuards.requireRole
/** {@link Guards.requireRoleOrPermission} with the default handlers (401 / 403 errors). Any name. */
export const requireRoleOrPermission: Guard<string, RoleOrPermissionGuardOptions> = defaultGuards.requireRoleOrPermission
/** {@link Guards.canAny} with the default handlers (401 / 403 errors). Any name. */
export const canAny: Guard<string, RouteGuardOptions> = defaultGuards.canAny
/** {@link Guards.canAll} with the default handlers (401 / 403 errors). Any name. */
export const canAll: Guard<string, RouteGuardOptions> = defaultGuards.canAll
