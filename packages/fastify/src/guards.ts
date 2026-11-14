import type { SubjectRbac } from '@anievo-id/rbac-evolution'
import type { FastifyReply, FastifyRequest, preHandlerAsyncHookHandler } from 'fastify'

export type GuardKind = 'permission' | 'role' | 'role_or_permission'

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
export type GuardNames = string | readonly string[]

export class RbacMiddlewareMissingError extends Error {
  readonly code = 'RBAC_MIDDLEWARE_MISSING'
  readonly statusCode = 500

  constructor() {
    super('`request.rbac` is not set. Register the `rbacPlugin` before using RBAC guards.')
    this.name = 'RbacMiddlewareMissingError'
  }
}

const MESSAGES: Record<GuardKind, string> = {
  permission: 'User does not have the right permissions.',
  role: 'User does not have the right roles.',
  role_or_permission: 'User does not have any of the necessary access rights.',
}

const defaultUnauthenticated: GuardHandler = (_request, reply) =>
  reply.code(401).send({ error: 'UNAUTHENTICATED', message: 'User is not logged in.' })

const defaultForbidden =
  (expose: boolean): GuardHandler =>
  (_request, reply, context) =>
    reply.code(403).send({
      error: 'FORBIDDEN',
      reason: context.kind,
      message: MESSAGES[context.kind],
      ...(expose && { required: context.requirements }),
    })

const split = (name: string): string[] =>
  name
    .split('|')
    .map((n) => n.trim())
    .filter((n) => n !== '')

/** Each argument is a group (pipes = any within the group); arrays contribute one group per item. */
function toGroups(names: readonly GuardNames[]): string[][] {
  const groups: string[][] = []
  for (const name of names) {
    for (const item of typeof name === 'string' ? [name] : name) {
      const group = split(item)
      if (group.length > 0) groups.push(group)
    }
  }
  return groups
}

function parseArgs<O extends object>(args: readonly (GuardNames | O)[]): { names: GuardNames[]; options: O | undefined } {
  const last = args[args.length - 1]
  if (last !== undefined && typeof last === 'object' && !Array.isArray(last)) {
    return { names: args.slice(0, -1) as GuardNames[], options: last as O }
  }
  return { names: args as GuardNames[], options: undefined }
}

function createGuard(
  kind: GuardKind,
  requirements: string[][],
  handlers: GuardHandlers,
  check: (rbac: SubjectRbac) => Promise<boolean>,
): GuardHook {
  if (requirements.length === 0) {
    throw new TypeError(`[rbac-evolution] A ${kind} guard needs at least one name.`)
  }
  const onUnauthenticated = handlers.onUnauthenticated ?? defaultUnauthenticated
  const onForbidden = handlers.onForbidden ?? defaultForbidden(handlers.exposeRequirements ?? false)
  const context: GuardContext = { kind, requirements }

  return async function rbacGuard(request, reply) {
    const { rbac } = request
    if (rbac === undefined) throw new RbacMiddlewareMissingError()
    if (rbac === null) {
      await respond(onUnauthenticated, request, reply, context)
      return reply
    }
    if (await check(rbac)) return
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

async function every(groups: readonly string[][], test: (group: string[]) => Promise<boolean>): Promise<boolean> {
  for (const group of groups) {
    if (!(await test(group))) return false
  }
  return true
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
    const { names, options = {} } = parseArgs<PermissionGuardOptions>(args)
    const groups = toGroups(names)
    const requirements = options.any ? [groups.flat()] : groups
    return createGuard('permission', requirements, { ...defaults, ...options }, (rbac) =>
      every(requirements, (group) => rbac.canAny(group)),
    )
  }

  /**
   * Requires roles, like spatie's `role:` middleware.
   *
   * - `requireRole('admin')`, `requireRole('admin|editor')`, `requireRole('admin', 'editor')` — any of them
   * - `requireRole('admin', 'editor', { all: true })` — all of them
   */
  function requireRole(...args: (GuardNames | RoleGuardOptions)[]): GuardHook {
    const { names, options = {} } = parseArgs<RoleGuardOptions>(args)
    const all = toGroups(names).flat()
    const requirements = options.all ? all.map((r) => [r]) : [all]
    return createGuard('role', requirements, { ...defaults, ...options }, async (rbac) =>
      options.all ? rbac.hasAllRoles(all) : rbac.hasAnyRole(all),
    )
  }

  /**
   * Passes when the subject has ANY of the names as a role OR as a permission,
   * like spatie's `role_or_permission:` middleware.
   *
   * - `requireRoleOrPermission('admin|edit articles')`
   */
  function requireRoleOrPermission(...args: (GuardNames | RoleOrPermissionGuardOptions)[]): GuardHook {
    const { names, options = {} } = parseArgs<RoleOrPermissionGuardOptions>(args)
    const all = toGroups(names).flat()
    return createGuard('role_or_permission', [all], { ...defaults, ...options }, async (rbac) =>
      (await rbac.hasAnyRole(all)) || rbac.canAny(all),
    )
  }

  return { requirePermission, requireRole, requireRoleOrPermission }
}

export const { requirePermission, requireRole, requireRoleOrPermission } = createGuards()
