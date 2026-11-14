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
import type { FastifyReply, FastifyRequest, preHandlerAsyncHookHandler } from 'fastify'

export type GuardKind = RequirementKind

/** Details about a failed check, passed to `onUnauthenticated` / `onForbidden`. */
export interface GuardContext {
  kind: GuardKind
  /** Groups of names: every group must pass, a group passes when ANY of its names matches. */
  requirements: string[][]
}

/** Must send a reply (e.g. `reply.code(403).send(...)`) or throw (e.g. an `httpErrors` error). */
export type GuardHandler = (request: FastifyRequest, reply: FastifyReply, context: GuardContext) => unknown

/** A `preHandler` hook, usable in `preHandler: [...]` route options or with `addHook('preHandler', ...)`. */
export type GuardHook = preHandlerAsyncHookHandler

export interface GuardHandlers {
  /** Called when there is no subject (`request.rbac` is `null`). Default: 401 JSON. */
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
  readonly statusCode = 500

  constructor() {
    super('`request.rbac` is not set. Register the `rbacPlugin` before using RBAC guards.')
    this.name = 'RbacMiddlewareMissingError'
  }
}

const defaultUnauthenticated: GuardHandler = (_request, reply) =>
  reply.code(401).send({ error: 'UNAUTHENTICATED', message: UNAUTHENTICATED_MESSAGE })

const defaultForbidden =
  (expose: boolean): GuardHandler =>
  (_request, reply, context) =>
    reply.code(403).send({
      error: 'FORBIDDEN',
      reason: context.kind,
      message: REQUIREMENT_MESSAGES[context.kind],
      ...(expose && { required: context.requirements }),
    })

function createGuard(requirement: RbacRequirement, handlers: GuardHandlers): GuardHook {
  const onUnauthenticated = handlers.onUnauthenticated ?? defaultUnauthenticated
  const onForbidden = handlers.onForbidden ?? defaultForbidden(handlers.exposeRequirements ?? false)
  const context: GuardContext = { kind: requirement.kind, requirements: requirement.requirements }

  return async function rbacGuard(request, reply) {
    const { rbac } = request
    if (rbac === undefined) throw new RbacMiddlewareMissingError()
    if (rbac === null) {
      await respond(onUnauthenticated, request, reply, context)
      return reply
    }
    if (await satisfiesRequirement(rbac, requirement)) return
    await respond(onForbidden, request, reply, context)
    return reply
  }
}

/** Runs a handler without awaiting the (thenable) reply itself when the handler returns it. */
async function respond(
  handler: GuardHandler,
  request: FastifyRequest,
  reply: FastifyReply,
  context: GuardContext,
): Promise<void> {
  const result = handler(request, reply, context)
  if (result !== reply && result instanceof Promise) await result
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
  function requirePermission(...args: (GuardNames | PermissionGuardOptions)[]): GuardHook {
    const { names, options = {} } = splitRequirementArgs<PermissionGuardOptions>(args)
    return createGuard(permissionRequirement(names, options), { ...defaults, ...options })
  }

  /**
   * Requires roles, like spatie's `role:` middleware.
   *
   * - `requireRole('admin')`, `requireRole('admin|editor')`, `requireRole('admin', 'editor')` — any of them
   * - `requireRole('admin', 'editor', { all: true })` — all of them
   */
  function requireRole(...args: (GuardNames | RoleGuardOptions)[]): GuardHook {
    const { names, options = {} } = splitRequirementArgs<RoleGuardOptions>(args)
    return createGuard(roleRequirement(names, options), { ...defaults, ...options })
  }

  /**
   * Passes when the subject has ANY of the names as a role OR as a permission,
   * like spatie's `role_or_permission:` middleware.
   *
   * - `requireRoleOrPermission('admin|edit articles')`
   */
  function requireRoleOrPermission(...args: (GuardNames | RoleOrPermissionGuardOptions)[]): GuardHook {
    const { names, options = {} } = splitRequirementArgs<RoleOrPermissionGuardOptions>(args)
    return createGuard(roleOrPermissionRequirement(names), { ...defaults, ...options })
  }

  /**
   * spatie v8.5 `canAny()`: passes with ANY of the listed permissions.
   *
   * - `canAny('edit articles', 'publish articles')`, `canAny(['edit articles', 'publish articles'])`
   */
  function canAny(...args: (GuardNames | GuardHandlers)[]): GuardHook {
    const { names, options } = splitRequirementArgs<GuardHandlers>(args)
    return requirePermission(...names, { ...options, any: true })
  }

  /**
   * spatie v8.5 `canAll()`: requires EVERY listed entry. A `'a|b'` entry still means "a or b".
   *
   * - `canAll('edit articles', 'publish articles')`, `canAll(['edit articles', 'publish|review'])`
   */
  function canAll(...args: (GuardNames | GuardHandlers)[]): GuardHook {
    const { names, options } = splitRequirementArgs<GuardHandlers>(args)
    return requirePermission(...names, { ...options, any: false })
  }

  return { requirePermission, requireRole, requireRoleOrPermission, canAny, canAll }
}

export const { requirePermission, requireRole, requireRoleOrPermission, canAny, canAll } = createGuards()
