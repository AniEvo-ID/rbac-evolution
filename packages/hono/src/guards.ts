import {
  permissionRequirement,
  type RbacRequirement,
  type RequirementKind,
  type RequirementNames,
  REQUIREMENT_MESSAGES,
  roleOrPermissionRequirement,
  roleRequirement,
  satisfiesRequirement,
  splitRequirementArgs,
  type SubjectRbac,
  UNAUTHENTICATED_MESSAGE,
} from '@anievo-id/rbac-evolution'
import type { Context, MiddlewareHandler } from 'hono'
import type { RbacEnv } from './middleware'

export type GuardKind = RequirementKind

/** Details about a failed check, passed to `onUnauthenticated` / `onForbidden`. */
export interface GuardContext {
  kind: GuardKind
  /** Groups of names: every group must pass, a group passes when ANY of its names matches. */
  requirements: string[][]
}

/** Returns the response to send (or throws, e.g. an `HTTPException`). */
export type GuardHandler = (c: Context, context: GuardContext) => Response | Promise<Response>

export interface GuardHandlers {
  /** Called when there is no subject (`c.var.rbac` is `null`). Default: 401 JSON. */
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

function createGuard(requirement: RbacRequirement, handlers: GuardHandlers): MiddlewareHandler<RbacEnv> {
  const onUnauthenticated = handlers.onUnauthenticated ?? defaultUnauthenticated
  const onForbidden = handlers.onForbidden ?? defaultForbidden(handlers.exposeRequirements ?? false)
  const context: GuardContext = { kind: requirement.kind, requirements: requirement.requirements }

  return async (c, next) => {
    const rbac = c.get('rbac') as SubjectRbac | null | undefined
    if (rbac === undefined) throw new RbacMiddlewareMissingError()
    if (rbac === null) return onUnauthenticated(c, context)
    if (await satisfiesRequirement(rbac, requirement)) {
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

/** Builds the guards with shared defaults (e.g. a custom `onForbidden` that renders an HTML page). */
export function createGuards(defaults: GuardHandlers = {}) {
  /**
   * Requires permissions, like spatie's `permission:` middleware.
   *
   * - `requirePermission('edit articles')`
   * - `requirePermission('edit articles|delete articles')` — any of them
   * - `requirePermission('edit articles', 'publish articles')` — all of them
   * - `requirePermission('a', 'b', { any: true })` — any of them
   */
  function requirePermission(...args: (GuardNames | PermissionGuardOptions)[]): MiddlewareHandler<RbacEnv> {
    const { names, options = {} } = splitRequirementArgs<PermissionGuardOptions>(args)
    return createGuard(permissionRequirement(names, options), withDefaults(defaults, options))
  }

  /**
   * Requires roles, like spatie's `role:` middleware.
   *
   * - `requireRole('admin')`, `requireRole('admin|editor')`, `requireRole('admin', 'editor')` — any of them
   * - `requireRole('admin', 'editor', { all: true })` — all of them
   */
  function requireRole(...args: (GuardNames | RoleGuardOptions)[]): MiddlewareHandler<RbacEnv> {
    const { names, options = {} } = splitRequirementArgs<RoleGuardOptions>(args)
    return createGuard(roleRequirement(names, options), withDefaults(defaults, options))
  }

  /**
   * Passes when the subject has ANY of the names as a role OR as a permission,
   * like spatie's `role_or_permission:` middleware.
   *
   * - `requireRoleOrPermission('admin|edit articles')`
   */
  function requireRoleOrPermission(...args: (GuardNames | RoleOrPermissionGuardOptions)[]): MiddlewareHandler<RbacEnv> {
    const { names, options = {} } = splitRequirementArgs<RoleOrPermissionGuardOptions>(args)
    return createGuard(roleOrPermissionRequirement(names), withDefaults(defaults, options))
  }

  /**
   * spatie v8.5 `canAny()`: passes with ANY of the listed permissions.
   *
   * - `canAny('edit articles', 'publish articles')`, `canAny(['edit articles', 'publish articles'])`
   */
  function canAny(...args: (GuardNames | GuardHandlers)[]): MiddlewareHandler<RbacEnv> {
    const { names, options } = splitRequirementArgs<GuardHandlers>(args)
    return requirePermission(...names, { ...options, any: true })
  }

  /**
   * spatie v8.5 `canAll()`: requires EVERY listed entry. A `'a|b'` entry still means "a or b".
   *
   * - `canAll('edit articles', 'publish articles')`, `canAll(['edit articles', 'publish|review'])`
   */
  function canAll(...args: (GuardNames | GuardHandlers)[]): MiddlewareHandler<RbacEnv> {
    const { names, options } = splitRequirementArgs<GuardHandlers>(args)
    return requirePermission(...names, { ...options, any: false })
  }

  return { requirePermission, requireRole, requireRoleOrPermission, canAny, canAll }
}

export const { requirePermission, requireRole, requireRoleOrPermission, canAny, canAll } = createGuards()
