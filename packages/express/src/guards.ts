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
import { asyncHandler } from './middleware'

export type GuardKind = RequirementKind

/** Details about a failed check, passed to `onUnauthenticated` / `onForbidden`. */
export interface GuardContext {
  kind: GuardKind
  /** Groups of names: every group must pass, a group passes when ANY of its names matches. */
  requirements: string[][]
}

export type GuardHandler = (req: Request, res: Response, next: NextFunction, context: GuardContext) => unknown

export interface GuardHandlers {
  /** Called when there is no subject (`req.rbac` is `null`). Default: 401 JSON. */
  onUnauthenticated?: GuardHandler | undefined
  /** Called when the subject lacks access. Default: 403 JSON. */
  onForbidden?: GuardHandler | undefined
  /**
   * Include the required roles/permissions in the default 403 body.
   * Default: `false` (like spatie's `display_permission_in_exception`).
   */
  exposeRequirements?: boolean | undefined
}

export interface PermissionGuardOptions extends GuardHandlers {
  /** Pass when the subject has ANY of the permissions (instead of all). Default: `false`. */
  any?: boolean | undefined
}

export interface RoleGuardOptions extends GuardHandlers {
  /** Require ALL of the roles (instead of any). Default: `false`. */
  all?: boolean | undefined
}

export type RoleOrPermissionGuardOptions = GuardHandlers

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

function createGuard(requirement: RbacRequirement, handlers: GuardHandlers): RequestHandler {
  const onUnauthenticated = handlers.onUnauthenticated ?? defaultUnauthenticated
  const onForbidden = handlers.onForbidden ?? defaultForbidden(handlers.exposeRequirements ?? false)
  const context: GuardContext = { kind: requirement.kind, requirements: requirement.requirements }

  return asyncHandler(async (req, res, next) => {
    const { rbac } = req
    if (rbac === undefined) throw new RbacMiddlewareMissingError()
    if (rbac === null) {
      await onUnauthenticated(req, res, next, context)
      return
    }
    if (await satisfiesRequirement(rbac, requirement)) {
      next()
      return
    }
    await onForbidden(req, res, next, context)
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
  requirePermission: Guard<PermissionName<T>, PermissionGuardOptions>
  requireRole: Guard<RoleName<T>, RoleGuardOptions>
  requireRoleOrPermission: Guard<PermissionName<T> | RoleName<T>, RoleOrPermissionGuardOptions>
  canAny: Guard<PermissionName<T>, GuardHandlers>
  canAll: Guard<PermissionName<T>, GuardHandlers>
}

/** The type configuration of `T`: `T` itself, or the `X` of an `Rbac<X>` engine. */
type TypesOf<T> = T extends Rbac<infer X> ? X : T extends RbacTypeConfig ? T : never

/**
 * Builds the guards with shared defaults (e.g. a custom `onForbidden` that renders an HTML page).
 *
 * Pass the same type argument as `createRbac<AppTypes>()` (or `typeof rbac`) to check names at compile time:
 * `const { requirePermission } = createGuards<AppTypes>()`.
 */
export function createGuards<T extends RbacTypeConfig | Rbac<RbacTypeConfig> = DefaultRbacTypes>(
  defaults: GuardHandlers = {},
): Guards<TypesOf<T>> {
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
    return createGuard(permissionRequirement(names, options), withDefaults(defaults, options))
  }

  /**
   * Requires roles, like spatie's `role:` middleware.
   *
   * - `requireRole('admin')`, `requireRole('admin|editor')`, `requireRole('admin', 'editor')` — any of them
   * - `requireRole('admin', 'editor', { all: true })` — all of them
   */
  function requireRole(...args: readonly (GuardNames | RoleGuardOptions)[]): RequestHandler {
    const { names, options = {} } = splitRequirementArgs<RoleGuardOptions>(args)
    return createGuard(roleRequirement(names, options), withDefaults(defaults, options))
  }

  /**
   * Passes when the subject has ANY of the names as a role OR as a permission,
   * like spatie's `role_or_permission:` middleware.
   *
   * - `requireRoleOrPermission('admin|edit articles')`
   */
  function requireRoleOrPermission(...args: readonly (GuardNames | RoleOrPermissionGuardOptions)[]): RequestHandler {
    const { names, options = {} } = splitRequirementArgs<RoleOrPermissionGuardOptions>(args)
    return createGuard(roleOrPermissionRequirement(names), withDefaults(defaults, options))
  }

  /**
   * spatie v8.5 `canAny()`: passes with ANY of the listed permissions.
   *
   * - `canAny('edit articles', 'publish articles')`, `canAny(['edit articles', 'publish articles'])`
   */
  function canAny(...args: readonly (GuardNames | GuardHandlers)[]): RequestHandler {
    const { names, options } = splitRequirementArgs<GuardHandlers>(args)
    return requirePermission(...names, { ...options, any: true })
  }

  /**
   * spatie v8.5 `canAll()`: requires EVERY listed entry. A `'a|b'` entry still means "a or b".
   *
   * - `canAll('edit articles', 'publish articles')`, `canAll(['edit articles', 'publish|review'])`
   */
  function canAll(...args: readonly (GuardNames | GuardHandlers)[]): RequestHandler {
    const { names, options } = splitRequirementArgs<GuardHandlers>(args)
    return requirePermission(...names, { ...options, any: false })
  }

  // The untyped functions above take any spread of names (`canAny` passes `...names` on); the typed signature
  // is only the public face, so a cast is enough. No runtime change.
  return { requirePermission, requireRole, requireRoleOrPermission, canAny, canAll } as Guards<TypesOf<T>>
}

export const { requirePermission, requireRole, requireRoleOrPermission, canAny, canAll } = createGuards()
