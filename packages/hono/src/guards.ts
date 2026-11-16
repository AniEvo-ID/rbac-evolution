import {
  type DefaultRbacTypes,
  type PermissionName,
  permissionRequirement,
  type Rbac,
  type RbacTypeConfig,
  type RbacRequirement,
  type RequirementKind,
  type RequirementArgs,
  type RequirementNames,
  REQUIREMENT_MESSAGES,
  type RoleName,
  roleOrPermissionRequirement,
  roleRequirement,
  satisfiesRequirement,
  splitRequirementArgs,
  type SubjectRbac,
  UNAUTHENTICATED_MESSAGE,
} from '@anievo-id/rbac-evolution'
import type { Context, Env, MiddlewareHandler } from 'hono'
import type { RbacEnv, TypesOf } from './middleware'

export type GuardKind = RequirementKind

/** Details about a failed check, passed to `onUnauthenticated` / `onForbidden`. */
export interface GuardContext {
  kind: GuardKind
  /** Groups of names: every group must pass, a group passes when ANY of its names matches. */
  requirements: string[][]
}

/**
 * The context the handlers of `createGuards<T>()` get: Hono's `Context` for an untyped `T` (any name), or a
 * `Context<RbacEnv<T>>` whose `c.var.rbac` has the names of `T`.
 */
export type GuardHandlerContext<T extends RbacTypeConfig | Rbac<RbacTypeConfig> = DefaultRbacTypes> =
  DefaultRbacTypes extends TypesOf<T> ? Context : Context<RbacEnv<T>>

/**
 * Returns the response to send (or throws, e.g. an `HTTPException`).
 * `C` is the context it gets: `GuardHandlerContext<T>` in `createGuards<T>()`, so `c.var.rbac` has the names of
 * `T` there.
 */
export type GuardHandler<C = Context> = (c: C, context: GuardContext) => Response | Promise<Response>

export interface GuardHandlers<C = Context> {
  /** Called when there is no subject (`c.var.rbac` is `null`). Default: 401 JSON. */
  onUnauthenticated?: GuardHandler<C> | undefined
  /** Called when the subject lacks access. Default: 403 JSON. */
  onForbidden?: GuardHandler<C> | undefined
  /**
   * Include the required roles/permissions in the default 403 body.
   * Default: `false` (like spatie's `display_permission_in_exception`).
   */
  exposeRequirements?: boolean | undefined
}

/**
 * The options every guard takes: the handlers plus `guard`.
 *
 * `guard` is per guard only (like spatie's `role:admin,api`), not a `createGuards()` default:
 * the defaults are about handlers, and the request's guard is set on the middleware.
 */
export interface RouteGuardOptions<C = Context> extends GuardHandlers<C> {
  /**
   * Check in this guard instead of the request's (`subject.withScope({ guard })`), like spatie's
   * `role:admin,api`. Default: the guard of the request's subject.
   */
  guard?: string | undefined
}

export interface PermissionGuardOptions<C = Context> extends RouteGuardOptions<C> {
  /** Pass when the subject has ANY of the permissions (instead of all). Default: `false`. */
  any?: boolean | undefined
}

export interface RoleGuardOptions<C = Context> extends RouteGuardOptions<C> {
  /** Require ALL of the roles (instead of any). Default: `false`. */
  all?: boolean | undefined
}

export type RoleOrPermissionGuardOptions<C = Context> = RouteGuardOptions<C>

/** A name, a pipe-separated list (`'edit|delete'` = any of), or an array of names. */
export type GuardNames = RequirementNames

export class RbacMiddlewareMissingError extends Error {
  readonly code = 'RBAC_MIDDLEWARE_MISSING'

  constructor() {
    super('`c.var.rbac` is not set. Register `rbacMiddleware()` before using RBAC guards.')
    this.name = 'RbacMiddlewareMissingError'
  }
}

const defaultUnauthenticated: GuardHandler = (c) =>
  c.json({ error: 'UNAUTHENTICATED', message: UNAUTHENTICATED_MESSAGE }, 401)

const defaultForbidden =
  (expose: boolean): GuardHandler =>
  (c, context) =>
    c.json(
      {
        error: 'FORBIDDEN',
        reason: context.kind,
        message: REQUIREMENT_MESSAGES[context.kind],
        ...(expose && { required: context.requirements }),
      },
      403,
    )

function createGuard(requirement: RbacRequirement, handlers: GuardHandlers, guard: string | undefined): MiddlewareHandler<RbacEnv> {
  const onUnauthenticated = handlers.onUnauthenticated ?? defaultUnauthenticated
  const onForbidden = handlers.onForbidden ?? defaultForbidden(handlers.exposeRequirements ?? false)
  const context: GuardContext = { kind: requirement.kind, requirements: requirement.requirements }

  return async (c, next) => {
    const rbac = c.get('rbac') as SubjectRbac | null | undefined
    if (rbac === undefined) throw new RbacMiddlewareMissingError()
    if (rbac === null) return onUnauthenticated(c, context)
    if (await satisfiesRequirement(guard === undefined ? rbac : rbac.withScope({ guard }), requirement)) {
      await next()
      return
    }
    return onForbidden(c, context)
  }
}

/** `options` over `defaults`, where an option set to `undefined` keeps the default (as if left out). */
function withDefaults(defaults: GuardHandlers, options: GuardHandlers): GuardHandlers {
  const merged: Record<string, unknown> = { ...defaults }
  for (const [key, value] of Object.entries(options)) if (value !== undefined) merged[key] = value
  return merged as GuardHandlers
}

/**
 * A guard typed with the names `N` it accepts and its options `O`: `(...names, options?)`.
 * Every name (each part of a `'a|b'` list, each array item) must be one of `N`; with `N = string`, any name is.
 * A call without names, or with options that are not the last argument, is a type error.
 * `E` is the env the returned middleware adds: `RbacEnv<T>` for the guards of `createGuards<T>()`, so a route
 * after a typed guard keeps a typed `c.var.rbac`. The middleware is still a `MiddlewareHandler<RbacEnv>` too.
 */
export type Guard<N extends string, O, E extends Env = RbacEnv> = <const A extends readonly (GuardNames | O)[]>(
  ...args: A & RequirementArgs<A, N, O>
) => MiddlewareHandler<RbacEnv> & MiddlewareHandler<E>

/** The guards returned by `createGuards<T>()`, with names narrowed by `T` (see `RbacTypeConfig`). */
/**
 * The guards returned by `createGuards<T>()`, with names narrowed by `T` (see `RbacTypeConfig`). Their middleware
 * env is `RbacEnv<T>`, so a typed app (`new Hono<RbacEnv<T>>()`) keeps a typed `c.var.rbac` after them.
 */
export interface Guards<T extends RbacTypeConfig = DefaultRbacTypes> {
  requirePermission: Guard<PermissionName<T>, PermissionGuardOptions<GuardHandlerContext<T>>, RbacEnv<T>>
  requireRole: Guard<RoleName<T>, RoleGuardOptions<GuardHandlerContext<T>>, RbacEnv<T>>
  requireRoleOrPermission: Guard<PermissionName<T> | RoleName<T>, RoleOrPermissionGuardOptions<GuardHandlerContext<T>>, RbacEnv<T>>
  canAny: Guard<PermissionName<T>, RouteGuardOptions<GuardHandlerContext<T>>, RbacEnv<T>>
  canAll: Guard<PermissionName<T>, RouteGuardOptions<GuardHandlerContext<T>>, RbacEnv<T>>
}

/**
 * Builds the guards with shared defaults (e.g. a custom `onForbidden` that renders an HTML page).
 *
 * Pass the same type argument as `createRbac<AppTypes>()` (or `typeof rbac`) to check names at compile time:
 * `const { requirePermission } = createGuards<AppTypes>()`. The handlers (`defaults` and per-guard options)
 * then get a `c` whose `c.var.rbac` has the same names.
 */
export function createGuards<T extends RbacTypeConfig | Rbac<RbacTypeConfig> = DefaultRbacTypes>(
  defaults: GuardHandlers<GuardHandlerContext<TypesOf<T>>> = {},
): Guards<TypesOf<T>> {
  // The typed handlers only narrow `c.var.rbac`; the implementation below works on any context.
  const shared = defaults as unknown as GuardHandlers
  /**
   * Requires permissions, like spatie's `permission:` middleware.
   *
   * - `requirePermission('edit articles')`
   * - `requirePermission('edit articles|delete articles')` — any of them
   * - `requirePermission('edit articles', 'publish articles')` — all of them
   * - `requirePermission('a', 'b', { any: true })` — any of them
   */
  function requirePermission(...args: readonly (GuardNames | PermissionGuardOptions)[]): MiddlewareHandler<RbacEnv> {
    const { names, options = {} } = splitRequirementArgs<PermissionGuardOptions>(args)
    return createGuard(permissionRequirement(names, options), withDefaults(shared, options), options.guard)
  }

  /**
   * Requires roles, like spatie's `role:` middleware.
   *
   * - `requireRole('admin')`, `requireRole('admin|editor')`, `requireRole('admin', 'editor')` — any of them
   * - `requireRole('admin', 'editor', { all: true })` — all of them
   */
  function requireRole(...args: readonly (GuardNames | RoleGuardOptions)[]): MiddlewareHandler<RbacEnv> {
    const { names, options = {} } = splitRequirementArgs<RoleGuardOptions>(args)
    return createGuard(roleRequirement(names, options), withDefaults(shared, options), options.guard)
  }

  /**
   * Passes when the subject has ANY of the names as a role OR as a permission,
   * like spatie's `role_or_permission:` middleware.
   *
   * - `requireRoleOrPermission('admin|edit articles')`
   */
  function requireRoleOrPermission(...args: readonly (GuardNames | RoleOrPermissionGuardOptions)[]): MiddlewareHandler<RbacEnv> {
    const { names, options = {} } = splitRequirementArgs<RoleOrPermissionGuardOptions>(args)
    return createGuard(roleOrPermissionRequirement(names), withDefaults(shared, options), options.guard)
  }

  /**
   * spatie v8.5 `canAny()`: passes with ANY of the listed permissions.
   *
   * - `canAny('edit articles', 'publish articles')`, `canAny(['edit articles', 'publish articles'])`
   */
  function canAny(...args: readonly (GuardNames | RouteGuardOptions)[]): MiddlewareHandler<RbacEnv> {
    const { names, options } = splitRequirementArgs<RouteGuardOptions>(args)
    return requirePermission(...names, { ...options, any: true })
  }

  /**
   * spatie v8.5 `canAll()`: requires EVERY listed entry. A `'a|b'` entry still means "a or b".
   *
   * - `canAll('edit articles', 'publish articles')`, `canAll(['edit articles', 'publish|review'])`
   */
  function canAll(...args: readonly (GuardNames | RouteGuardOptions)[]): MiddlewareHandler<RbacEnv> {
    const { names, options } = splitRequirementArgs<RouteGuardOptions>(args)
    return requirePermission(...names, { ...options, any: false })
  }

  // The untyped functions above take any spread of names (`canAny` passes `...names` on); the typed signature
  // is only the public face, so a cast is enough. No runtime change.
  return { requirePermission, requireRole, requireRoleOrPermission, canAny, canAll } as unknown as Guards<TypesOf<T>>
}

const defaultGuards: Guards = createGuards()

// Spelled out, so the declarations keep the 1.0 types (`Guard<string, PermissionGuardOptions>`, ...).
export const requirePermission: Guard<string, PermissionGuardOptions> = defaultGuards.requirePermission
export const requireRole: Guard<string, RoleGuardOptions> = defaultGuards.requireRole
export const requireRoleOrPermission: Guard<string, RouteGuardOptions> = defaultGuards.requireRoleOrPermission
export const canAny: Guard<string, RouteGuardOptions> = defaultGuards.canAny
export const canAll: Guard<string, RouteGuardOptions> = defaultGuards.canAll
