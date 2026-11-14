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
  onUnauthenticated?: GuardHandler
  /** Called when the subject lacks access. Default: 403 JSON. */
  onForbidden?: GuardHandler
  /**
   * Include the required roles/permissions in the default 403 body.
   * Default: `false` (like spatie's `display_permission_in_exception`).
   */
  exposeRequirements?: boolean
}

export interface PermissionGuardOptions extends GuardHandlers {
  /** Pass when the subject has ANY of the permissions (instead of all). Default: `false`. */
  any?: boolean
}

export interface RoleGuardOptions extends GuardHandlers {
  /** Require ALL of the roles (instead of any). Default: `false`. */
  all?: boolean
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
  function requirePermission(...args: (GuardNames | PermissionGuardOptions)[]): RequestHandler {
    const { names, options = {} } = splitRequirementArgs<PermissionGuardOptions>(args)
    return createGuard(permissionRequirement(names, options), { ...defaults, ...options })
  }

  /**
   * Requires roles, like spatie's `role:` middleware.
   *
   * - `requireRole('admin')`, `requireRole('admin|editor')`, `requireRole('admin', 'editor')` — any of them
   * - `requireRole('admin', 'editor', { all: true })` — all of them
   */
  function requireRole(...args: (GuardNames | RoleGuardOptions)[]): RequestHandler {
    const { names, options = {} } = splitRequirementArgs<RoleGuardOptions>(args)
    return createGuard(roleRequirement(names, options), { ...defaults, ...options })
  }

  /**
   * Passes when the subject has ANY of the names as a role OR as a permission,
   * like spatie's `role_or_permission:` middleware.
   *
   * - `requireRoleOrPermission('admin|edit articles')`
   */
  function requireRoleOrPermission(...args: (GuardNames | RoleOrPermissionGuardOptions)[]): RequestHandler {
    const { names, options = {} } = splitRequirementArgs<RoleOrPermissionGuardOptions>(args)
    return createGuard(roleOrPermissionRequirement(names), { ...defaults, ...options })
  }

  /**
   * spatie v8.5 `canAny()`: passes with ANY of the listed permissions.
   *
   * - `canAny('edit articles', 'publish articles')`, `canAny(['edit articles', 'publish articles'])`
   */
  function canAny(...args: (GuardNames | GuardHandlers)[]): RequestHandler {
    const { names, options } = splitRequirementArgs<GuardHandlers>(args)
    return requirePermission(...names, { ...options, any: true })
  }

  /**
   * spatie v8.5 `canAll()`: requires EVERY listed entry. A `'a|b'` entry still means "a or b".
   *
   * - `canAll('edit articles', 'publish articles')`, `canAll(['edit articles', 'publish|review'])`
   */
  function canAll(...args: (GuardNames | GuardHandlers)[]): RequestHandler {
    const { names, options } = splitRequirementArgs<GuardHandlers>(args)
    return requirePermission(...names, { ...options, any: false })
  }

  return { requirePermission, requireRole, requireRoleOrPermission, canAny, canAll }
}

export const { requirePermission, requireRole, requireRoleOrPermission, canAny, canAll } = createGuards()
