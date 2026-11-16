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
  UNAUTHENTICATED_MESSAGE,
} from '@anievo-id/rbac-evolution'
import type { NextFunction, Request, RequestHandler, Response } from 'express'
import { asyncHandler, type RbacRequest, type TypesOf } from './middleware'

export type GuardKind = RequirementKind

/** Details about a failed check, passed to `onUnauthenticated` / `onForbidden`. */
export interface GuardContext {
  kind: GuardKind
  /** Groups of names: every group must pass, a group passes when ANY of its names matches. */
  requirements: string[][]
}

/**
 * The request the handlers of `createGuards<T>()` get: Express's `Request` for an untyped `T` (any name), or an
 * {@link RbacRequest} whose `req.rbac` has the names of `T`.
 */
export type GuardRequest<T extends RbacTypeConfig | Rbac<RbacTypeConfig> = DefaultRbacTypes> =
  DefaultRbacTypes extends TypesOf<T> ? Request : RbacRequest<T>

/**
 * `onUnauthenticated` / `onForbidden`. `Req` is the request it gets: `GuardRequest<T>` in `createGuards<T>()`,
 * so `req.rbac` has the names of `T` there.
 */
export type GuardHandler<Req = Request> = (req: Req, res: Response, next: NextFunction, context: GuardContext) => unknown

export interface GuardHandlers<Req = Request> {
  /** Called when there is no subject (`req.rbac` is `null`). Default: 401 JSON. */
  onUnauthenticated?: GuardHandler<Req> | undefined
  /** Called when the subject lacks access. Default: 403 JSON. */
  onForbidden?: GuardHandler<Req> | undefined
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
export interface RouteGuardOptions<Req = Request> extends GuardHandlers<Req> {
  /**
   * Check in this guard instead of the request's (`subject.withScope({ guard })`), like spatie's
   * `role:admin,api`. Default: the guard of the request's subject.
   */
  guard?: string | undefined
}

export interface PermissionGuardOptions<Req = Request> extends RouteGuardOptions<Req> {
  /** Pass when the subject has ANY of the permissions (instead of all). Default: `false`. */
  any?: boolean | undefined
}

export interface RoleGuardOptions<Req = Request> extends RouteGuardOptions<Req> {
  /** Require ALL of the roles (instead of any). Default: `false`. */
  all?: boolean | undefined
}

export type RoleOrPermissionGuardOptions<Req = Request> = RouteGuardOptions<Req>

/** A name, a pipe-separated list (`'edit|delete'` = any of), or an array of names. */
export type GuardNames = RequirementNames

export class RbacMiddlewareMissingError extends Error {
  readonly code = 'RBAC_MIDDLEWARE_MISSING'

  constructor() {
    super('`req.rbac` is not set. Register `rbacMiddleware()` before using RBAC guards.')
    this.name = 'RbacMiddlewareMissingError'
  }
}

const defaultUnauthenticated: GuardHandler = (_req, res) => {
  res.status(401).json({ error: 'UNAUTHENTICATED', message: UNAUTHENTICATED_MESSAGE })
}

const defaultForbidden =
  (expose: boolean): GuardHandler =>
  (_req, res, _next, context) => {
    res.status(403).json({
      error: 'FORBIDDEN',
      reason: context.kind,
      message: REQUIREMENT_MESSAGES[context.kind],
      ...(expose && { required: context.requirements }),
    })
  }

function createGuard(requirement: RbacRequirement, handlers: GuardHandlers, guard: string | undefined): RequestHandler {
  const onUnauthenticated = handlers.onUnauthenticated ?? defaultUnauthenticated
  const onForbidden = handlers.onForbidden ?? defaultForbidden(handlers.exposeRequirements ?? false)
  const context: GuardContext = { kind: requirement.kind, requirements: requirement.requirements }

  return asyncHandler(async (req, res, next) => {
    const { rbac } = req
    if (rbac === undefined) throw new RbacMiddlewareMissingError()
    if (rbac === null) {
      // The handlers are typed by `createGuards<T>()`; at runtime `req` is the same object either way.
      await onUnauthenticated(req as never, res, next, context)
      return
    }
    if (await satisfiesRequirement(guard === undefined ? rbac : rbac.withScope({ guard }), requirement)) {
      next()
      return
    }
    await onForbidden(req as never, res, next, context)
  })
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
 */
export type Guard<N extends string, O> = <const A extends readonly (GuardNames | O)[]>(
  ...args: A & RequirementArgs<A, N, O>
) => RequestHandler

/** The guards returned by `createGuards<T>()`, with names narrowed by `T` (see `RbacTypeConfig`). */
export interface Guards<T extends RbacTypeConfig = DefaultRbacTypes> {
  requirePermission: Guard<PermissionName<T>, PermissionGuardOptions<GuardRequest<T>>>
  requireRole: Guard<RoleName<T>, RoleGuardOptions<GuardRequest<T>>>
  requireRoleOrPermission: Guard<PermissionName<T> | RoleName<T>, RoleOrPermissionGuardOptions<GuardRequest<T>>>
  canAny: Guard<PermissionName<T>, RouteGuardOptions<GuardRequest<T>>>
  canAll: Guard<PermissionName<T>, RouteGuardOptions<GuardRequest<T>>>
}

/**
 * Builds the guards with shared defaults (e.g. a custom `onForbidden` that renders an HTML page).
 *
 * Pass the same type argument as `createRbac<AppTypes>()` (or `typeof rbac`) to check names at compile time:
 * `const { requirePermission } = createGuards<AppTypes>()`. The handlers (`defaults` and per-guard options)
 * then get a `req` whose `req.rbac` has the same names.
 */
export function createGuards<T extends RbacTypeConfig | Rbac<RbacTypeConfig> = DefaultRbacTypes>(
  defaults: GuardHandlers<GuardRequest<TypesOf<T>>> = {},
): Guards<TypesOf<T>> {
  // The typed handlers only narrow `req.rbac`; the implementation below works on any request.
  const shared = defaults as unknown as GuardHandlers
  /**
   * Requires permissions, like spatie's `permission:` middleware.
   *
   * - `requirePermission('edit articles')`
   * - `requirePermission('edit articles|delete articles')` — any of them
   * - `requirePermission('edit articles', 'publish articles')` — all of them
   * - `requirePermission('a', 'b', { any: true })` — any of them
   */
  function requirePermission(...args: readonly (GuardNames | PermissionGuardOptions)[]): RequestHandler {
    const { names, options = {} } = splitRequirementArgs<PermissionGuardOptions>(args)
    return createGuard(permissionRequirement(names, options), withDefaults(shared, options), options.guard)
  }

  /**
   * Requires roles, like spatie's `role:` middleware.
   *
   * - `requireRole('admin')`, `requireRole('admin|editor')`, `requireRole('admin', 'editor')` — any of them
   * - `requireRole('admin', 'editor', { all: true })` — all of them
   */
  function requireRole(...args: readonly (GuardNames | RoleGuardOptions)[]): RequestHandler {
    const { names, options = {} } = splitRequirementArgs<RoleGuardOptions>(args)
    return createGuard(roleRequirement(names, options), withDefaults(shared, options), options.guard)
  }

  /**
   * Passes when the subject has ANY of the names as a role OR as a permission,
   * like spatie's `role_or_permission:` middleware.
   *
   * - `requireRoleOrPermission('admin|edit articles')`
   */
  function requireRoleOrPermission(...args: readonly (GuardNames | RoleOrPermissionGuardOptions)[]): RequestHandler {
    const { names, options = {} } = splitRequirementArgs<RoleOrPermissionGuardOptions>(args)
    return createGuard(roleOrPermissionRequirement(names), withDefaults(shared, options), options.guard)
  }

  /**
   * spatie v8.5 `canAny()`: passes with ANY of the listed permissions.
   *
   * - `canAny('edit articles', 'publish articles')`, `canAny(['edit articles', 'publish articles'])`
   */
  function canAny(...args: readonly (GuardNames | RouteGuardOptions)[]): RequestHandler {
    const { names, options } = splitRequirementArgs<RouteGuardOptions>(args)
    return requirePermission(...names, { ...options, any: true })
  }

  /**
   * spatie v8.5 `canAll()`: requires EVERY listed entry. A `'a|b'` entry still means "a or b".
   *
   * - `canAll('edit articles', 'publish articles')`, `canAll(['edit articles', 'publish|review'])`
   */
  function canAll(...args: readonly (GuardNames | RouteGuardOptions)[]): RequestHandler {
    const { names, options } = splitRequirementArgs<RouteGuardOptions>(args)
    return requirePermission(...names, { ...options, any: false })
  }

  // The untyped functions above take any spread of names (`canAny` passes `...names` on); the typed signature
  // is only the public face, so a cast is enough. No runtime change.
  return { requirePermission, requireRole, requireRoleOrPermission, canAny, canAll } as Guards<TypesOf<T>>
}

const defaultGuards: Guards = createGuards()

// Spelled out, so the declarations keep the 1.0 types (`Guard<string, PermissionGuardOptions>`, ...).
export const requirePermission: Guard<string, PermissionGuardOptions> = defaultGuards.requirePermission
export const requireRole: Guard<string, RoleGuardOptions> = defaultGuards.requireRole
export const requireRoleOrPermission: Guard<string, RouteGuardOptions> = defaultGuards.requireRoleOrPermission
export const canAny: Guard<string, RouteGuardOptions> = defaultGuards.canAny
export const canAll: Guard<string, RouteGuardOptions> = defaultGuards.canAll
