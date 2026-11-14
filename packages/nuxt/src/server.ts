/**
 * @anievo-id/rbac-evolution-nuxt/server
 *
 * Server-side enforcement for Nitro / h3 event handlers. Runs on the server only.
 */

import type { Rbac, RbacSnapshot, Subject, SubjectRbac, TeamId } from '@anievo-id/rbac-evolution'
import { MESSAGES, requirementGroups, type RequirementKind, type RequirementNames, UNAUTHENTICATED_MESSAGE } from './requirements'

export type { RequirementKind, RequirementNames } from './requirements'

type MaybePromise<T> = T | Promise<T>

/** The part of an h3 `H3Event` this helper uses. */
export interface RbacEvent {
  context: object
}

export interface RbacServerOptions<E extends RbacEvent = RbacEvent> {
  /** The RBAC engine created with `createRbac(...)`. */
  rbac: Rbac
  /** Resolves the authenticated subject for this request (e.g. from a session). `null` / `undefined` for guests. */
  getSubject: (event: E) => MaybePromise<Subject | null | undefined>
  /** Guard name (e.g. `web` or `api`). Defaults to the engine's `defaultGuard`. */
  guard?: string
  /** Resolves the current team (only when the engine was created with `teams: true`). */
  team?: (event: E) => MaybePromise<TeamId | undefined>
  /** Include the required roles/permissions in the 403 body (`required`). Default: `false`. */
  exposeRequirements?: boolean
}

export interface PermissionRequirementOptions {
  /** Pass when the subject has ANY of the permissions (instead of all). Default: `false`. */
  any?: boolean
}

export interface RoleRequirementOptions {
  /** Require ALL of the roles (instead of any). Default: `false`. */
  all?: boolean
}

/** The JSON body of a failed check — identical to `@anievo-id/rbac-evolution-express`. */
export type RbacErrorBody =
  | { error: 'UNAUTHENTICATED'; message: string }
  | { error: 'FORBIDDEN'; reason: RequirementKind; message: string; required?: string[][] }

/**
 * Thrown by the `require*` helpers. h3 turns it into an error response with this `statusCode`
 * and the Express-style body under `data`.
 *
 * It is shaped like h3's `H3Error` (including the `__h3_error__` marker h3 checks), so h3 / Nitro
 * treat it as an expected HTTP error instead of logging it as an unhandled exception —
 * without this package depending on h3.
 */
export class RbacHttpError extends Error {
  static readonly __h3_error__ = true
  readonly statusCode: 401 | 403
  readonly statusMessage: string
  readonly data: RbacErrorBody
  readonly fatal = false
  readonly unhandled = false

  constructor(data: RbacErrorBody) {
    super(data.message)
    this.name = 'RbacHttpError'
    this.statusCode = data.error === 'UNAUTHENTICATED' ? 401 : 403
    this.statusMessage = data.error === 'UNAUTHENTICATED' ? 'Unauthorized' : 'Forbidden'
    this.data = data
  }

  /** Alias of `statusCode`. */
  get status(): 401 | 403 {
    return this.statusCode
  }

  toJSON() {
    return { message: this.message, statusCode: this.statusCode, statusMessage: this.statusMessage, data: this.data }
  }
}

export interface RbacServer<E extends RbacEvent = RbacEvent> {
  /**
   * Resolves the subject once per request (cached per helper instance) and stores it on
   * `event.context.rbac` (a `SubjectRbac`, or `null` for guests) unless another instance did
   * first. The Nuxt plugin reads it to hydrate the client.
   */
  resolve(event: E): Promise<SubjectRbac | null>
  /** The current subject's `{ roles, permissions }`, or `null` for guests. */
  snapshot(event: E): Promise<RbacSnapshot | null>
  /** Like Express `requirePermission`: arguments are all required, pipes mean any, `{ any: true }`. */
  requirePermission(event: E, ...args: (RequirementNames | PermissionRequirementOptions)[]): Promise<SubjectRbac>
  /** Like Express `requireRole`: any of the roles, `{ all: true }` for all. */
  requireRole(event: E, ...args: (RequirementNames | RoleRequirementOptions)[]): Promise<SubjectRbac>
  /** Like Express `requireRoleOrPermission`: any of the names as a role OR a permission. */
  requireRoleOrPermission(event: E, ...names: RequirementNames[]): Promise<SubjectRbac>
  /** spatie v8.5 `canAny()`: requires ANY of the listed permissions. */
  canAny(event: E, ...names: RequirementNames[]): Promise<SubjectRbac>
  /** spatie v8.5 `canAll()`: requires EVERY listed entry; a `'a|b'` entry still means "a or b". */
  canAll(event: E, ...names: RequirementNames[]): Promise<SubjectRbac>
}

const CONTEXT_KEY = 'rbac'

function parseArgs<O extends object>(args: readonly (RequirementNames | O)[]): { names: RequirementNames[]; options: O | undefined } {
  const last = args[args.length - 1]
  if (last !== undefined && typeof last === 'object' && !Array.isArray(last)) {
    return { names: args.slice(0, -1) as RequirementNames[], options: last as O }
  }
  return { names: args as RequirementNames[], options: undefined }
}

async function passes(rbac: SubjectRbac, kind: RequirementKind, group: string[]): Promise<boolean> {
  if (kind === 'permission') return rbac.canAny(group)
  if (kind === 'role') return rbac.hasAnyRole(group)
  return (await rbac.hasAnyRole(group)) || rbac.canAny(group)
}

/**
 * Creates request helpers for Nitro event handlers.
 *
 * ```ts
 * // server/utils/rbac.ts
 * export const rbacServer = createRbacServer({
 *   rbac,
 *   getSubject: async (event) => {
 *     const user = await getUserFromSession(event)
 *     return user ? { type: 'user', id: user.id } : null
 *   },
 * })
 *
 * // server/api/articles.post.ts
 * export default defineEventHandler(async (event) => {
 *   await rbacServer.requirePermission(event, 'articles.create')
 * })
 * ```
 */
export function createRbacServer<E extends RbacEvent = RbacEvent>(options: RbacServerOptions<E>): RbacServer<E> {
  const { rbac, getSubject, guard, team, exposeRequirements = false } = options
  // Per instance, so a second server (e.g. guard 'api') never reuses another guard's subject.
  const resolved = new WeakMap<object, SubjectRbac | null>()

  async function resolve(event: E): Promise<SubjectRbac | null> {
    const context = event.context as Record<string, unknown>
    if (resolved.has(context)) return resolved.get(context)!

    const subject = await getSubject(event)
    let result: SubjectRbac | null = null
    if (subject) {
      const teamId = team ? await team(event) : undefined
      result = rbac.for(subject, {
        ...(guard !== undefined && { guard }),
        ...(teamId !== undefined && { team: teamId }),
      })
    }
    resolved.set(context, result)
    // The client plugin hydrates from `event.context.rbac`: the first instance to resolve fills it.
    if (context[CONTEXT_KEY] === undefined) context[CONTEXT_KEY] = result
    return result
  }

  async function enforce(event: E, kind: RequirementKind, requirements: string[][]): Promise<SubjectRbac> {
    if (requirements.length === 0) {
      throw new TypeError(`[rbac-evolution] A ${kind} requirement needs at least one name.`)
    }
    const subject = await resolve(event)
    if (subject === null) throw new RbacHttpError({ error: 'UNAUTHENTICATED', message: UNAUTHENTICATED_MESSAGE })
    for (const group of requirements) {
      if (!(await passes(subject, kind, group))) {
        throw new RbacHttpError({
          error: 'FORBIDDEN',
          reason: kind,
          message: MESSAGES[kind],
          ...(exposeRequirements && { required: requirements }),
        })
      }
    }
    return subject
  }

  return {
    resolve,
    async snapshot(event) {
      const subject = await resolve(event)
      return subject ? subject.snapshot() : null
    },
    requirePermission(event, ...args) {
      const { names, options: opts } = parseArgs<PermissionRequirementOptions>(args)
      return enforce(event, 'permission', requirementGroups('permission', names, { any: opts?.any }))
    },
    requireRole(event, ...args) {
      const { names, options: opts } = parseArgs<RoleRequirementOptions>(args)
      return enforce(event, 'role', requirementGroups('role', names, { all: opts?.all }))
    },
    requireRoleOrPermission(event, ...names) {
      return enforce(event, 'role_or_permission', requirementGroups('role_or_permission', names))
    },
    canAny(event, ...names) {
      return enforce(event, 'permission', requirementGroups('permission', names, { any: true }))
    },
    canAll(event, ...names) {
      return enforce(event, 'permission', requirementGroups('permission', names))
    },
  }
}
