/**
 * @anievo-id/rbac-evolution-nuxt/server
 *
 * Server-side enforcement for Nitro / h3 event handlers. Runs on the server only.
 */

import type {
  CheckGuard,
  DefaultGuardName,
  DefaultRbacTypes,
  GuardOptions,
  GuardRequirementArgs,
  PermissionName,
  Rbac,
  RbacSnapshot,
  RbacTypeConfig,
  RequirementGuard,
  RoleName,
  ScopedGuardName,
  Subject,
  SubjectRbac,
  TeamId,
} from '@anievo-id/rbac-evolution'
import {
  permissionRequirement,
  type PermissionRequirementOptions,
  type RbacRequirement,
  type RequirementArgs,
  type RequirementKind,
  type RequirementNames,
  REQUIREMENT_MESSAGES,
  roleOrPermissionRequirement,
  roleRequirement,
  type RoleRequirementOptions,
  satisfiesRequirement,
  splitRequirementArgs,
  UNAUTHENTICATED_MESSAGE,
} from '@anievo-id/rbac-evolution'

export type { PermissionRequirementOptions, RequirementKind, RequirementNames, RoleRequirementOptions } from '@anievo-id/rbac-evolution'

type MaybePromise<T> = T | Promise<T>

/** The part of an h3 `H3Event` this helper uses. */
export interface RbacEvent {
  context: object
}

export interface RbacServerOptions<
  E extends RbacEvent = RbacEvent,
  T extends RbacTypeConfig = DefaultRbacTypes,
  G extends string = string,
> {
  /** The RBAC engine created with `createRbac(...)`. Its typed names flow into the `require*` / `can*` helpers. */
  rbac: Rbac<T>
  /** Resolves the authenticated subject for this request (e.g. from a session). `null` / `undefined` for guests. */
  getSubject: (event: E) => MaybePromise<Subject | null | undefined>
  /**
   * Guard name (e.g. `web` or `api`). Defaults to the engine's `defaultGuard`. With per-guard names, it must be one
   * of the typed guards (checked by `createRbacServer()`), and the helpers take its names.
   */
  guard?: G | undefined
  /** Resolves the current team (only when the engine was created with `teams: true`). */
  team?: (event: E) => MaybePromise<TeamId | undefined>
  /** Include the required roles/permissions in the 403 body (`required`). Default: `false`. */
  exposeRequirements?: boolean | undefined
}

/** The options every `require*` / `can*` helper takes (last argument). */
export interface RequireGuardOptions {
  /**
   * Check in this guard instead of the server's (`subject.withScope({ guard })`), like spatie's
   * `role:admin,api`. Default: the `guard` of `createRbacServer()`.
   */
  guard?: string | undefined
}

/** Options of `requirePermission()`: `{ any }` and `{ guard }`. */
export interface RequirePermissionOptions extends PermissionRequirementOptions, RequireGuardOptions {}

/** Options of `requireRole()`: `{ all }` and `{ guard }`. */
export interface RequireRoleOptions extends RoleRequirementOptions, RequireGuardOptions {}

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

/**
 * The helpers returned by `createRbacServer()`. `T` comes from the `rbac` option: with typed names, every
 * name (including each part of a `'a|b'` list) must be one of them; untyped, any string is accepted.
 * A call without names, or with options that are not the last argument, is a type error.
 */
export interface RbacServer<E extends RbacEvent = RbacEvent, T extends RbacTypeConfig = DefaultRbacTypes> {
  /**
   * Resolves the subject once per request (cached per helper instance) and stores it on
   * `event.context.rbac` (a `SubjectRbac`, or `null` for guests) unless another instance did
   * first. The Nuxt plugin reads it to hydrate the client.
   */
  resolve(event: E): Promise<SubjectRbac<T> | null>
  /** The current subject's `{ roles, permissions }`, or `null` for guests. */
  snapshot(event: E): Promise<RbacSnapshot | null>
  /**
   * Like Express `requirePermission`: arguments are all required, pipes mean any, `{ any: true }`.
   * With `{ guard: 'api' }` the check (and the returned subject) is in that guard.
   */
  requirePermission<const A extends readonly (RequirementNames | RequirePermissionOptions)[]>(
    event: E,
    ...args: A & RequirementArgs<A, PermissionName<T>, RequirePermissionOptions>
  ): Promise<SubjectRbac<T>>
  /** Like Express `requireRole`: any of the roles, `{ all: true }` for all, `{ guard: 'api' }` (spatie's `role:admin,api`). */
  requireRole<const A extends readonly (RequirementNames | RequireRoleOptions)[]>(
    event: E,
    ...args: A & RequirementArgs<A, RoleName<T>, RequireRoleOptions>
  ): Promise<SubjectRbac<T>>
  /** Like Express `requireRoleOrPermission`: any of the names as a role OR a permission. */
  requireRoleOrPermission<const A extends readonly (RequirementNames | RequireGuardOptions)[]>(
    event: E,
    ...args: A & RequirementArgs<A, PermissionName<T> | RoleName<T>, RequireGuardOptions>
  ): Promise<SubjectRbac<T>>
  /** spatie v8.5 `canAny()`: requires ANY of the listed permissions. */
  canAny<const A extends readonly (RequirementNames | RequireGuardOptions)[]>(
    event: E,
    ...args: A & RequirementArgs<A, PermissionName<T>, RequireGuardOptions>
  ): Promise<SubjectRbac<T>>
  /** spatie v8.5 `canAll()`: requires EVERY listed entry; a `'a|b'` entry still means "a or b". */
  canAll<const A extends readonly (RequirementNames | RequireGuardOptions)[]>(
    event: E,
    ...args: A & RequirementArgs<A, PermissionName<T>, RequireGuardOptions>
  ): Promise<SubjectRbac<T>>
}

/**
 * The helpers of `createRbacServer()` when the engine has per-guard names (`RbacTypeConfig['guards']`): like
 * {@link RbacServer}, but the names are those of the guard each call checks in, its `{ guard }` option or else `G`
 * (the `guard` of `createRbacServer()`), and the subject it returns is typed for that guard.
 * `requirePermission(event, 'orders.read', { guard: 'api' })` takes the `api` names.
 */
export interface ScopedRbacServer<
  E extends RbacEvent = RbacEvent,
  T extends RbacTypeConfig = DefaultRbacTypes,
  G extends string = DefaultGuardName<T>,
> {
  /**
   * Resolves the subject once per request (cached per helper instance) and stores it on
   * `event.context.rbac` (a `SubjectRbac`, or `null` for guests) unless another instance did
   * first. The Nuxt plugin reads it to hydrate the client.
   */
  resolve(event: E): Promise<SubjectRbac<T, G> | null>
  /** The current subject's `{ roles, permissions }`, or `null` for guests. */
  snapshot(event: E): Promise<RbacSnapshot | null>
  /**
   * Like Express `requirePermission`: arguments are all required, pipes mean any, `{ any: true }`.
   * With `{ guard: 'api' }` the check (and the returned subject) is in that guard.
   */
  requirePermission<const A extends readonly (RequirementNames | RequirePermissionOptions)[]>(
    event: E,
    ...args: A & GuardRequirementArgs<A, T, 'permission', G, RequirePermissionOptions>
  ): Promise<SubjectRbac<T, ScopedGuardName<T, RequirementGuard<A, G>>>>
  /** Like Express `requireRole`: any of the roles, `{ all: true }` for all, `{ guard: 'api' }` (spatie's `role:admin,api`). */
  requireRole<const A extends readonly (RequirementNames | RequireRoleOptions)[]>(
    event: E,
    ...args: A & GuardRequirementArgs<A, T, 'role', G, RequireRoleOptions>
  ): Promise<SubjectRbac<T, ScopedGuardName<T, RequirementGuard<A, G>>>>
  /** Like Express `requireRoleOrPermission`: any of the names as a role OR a permission. */
  requireRoleOrPermission<const A extends readonly (RequirementNames | RequireGuardOptions)[]>(
    event: E,
    ...args: A & GuardRequirementArgs<A, T, 'role_or_permission', G, RequireGuardOptions>
  ): Promise<SubjectRbac<T, ScopedGuardName<T, RequirementGuard<A, G>>>>
  /** spatie v8.5 `canAny()`: requires ANY of the listed permissions. */
  canAny<const A extends readonly (RequirementNames | RequireGuardOptions)[]>(
    event: E,
    ...args: A & GuardRequirementArgs<A, T, 'permission', G, RequireGuardOptions>
  ): Promise<SubjectRbac<T, ScopedGuardName<T, RequirementGuard<A, G>>>>
  /** spatie v8.5 `canAll()`: requires EVERY listed entry; a `'a|b'` entry still means "a or b". */
  canAll<const A extends readonly (RequirementNames | RequireGuardOptions)[]>(
    event: E,
    ...args: A & GuardRequirementArgs<A, T, 'permission', G, RequireGuardOptions>
  ): Promise<SubjectRbac<T, ScopedGuardName<T, RequirementGuard<A, G>>>>
}

/**
 * What `createRbacServer()` returns: {@link RbacServer} for an engine without per-guard names (as in 1.1), and
 * {@link ScopedRbacServer} for one with `guards`.
 */
export type RbacServerFor<
  E extends RbacEvent = RbacEvent,
  T extends RbacTypeConfig = DefaultRbacTypes,
  G extends string = DefaultGuardName<T>,
> = T extends { guards: object } ? ScopedRbacServer<E, T, G> : RbacServer<E, T>

/** The untyped implementation behind `RbacServer` (plain `string` names, spread-friendly). */
interface UntypedRbacServer<E extends RbacEvent> {
  resolve(event: E): Promise<SubjectRbac | null>
  snapshot(event: E): Promise<RbacSnapshot | null>
  requirePermission(event: E, ...args: (RequirementNames | RequirePermissionOptions)[]): Promise<SubjectRbac>
  requireRole(event: E, ...args: (RequirementNames | RequireRoleOptions)[]): Promise<SubjectRbac>
  requireRoleOrPermission(event: E, ...args: (RequirementNames | RequireGuardOptions)[]): Promise<SubjectRbac>
  canAny(event: E, ...args: (RequirementNames | RequireGuardOptions)[]): Promise<SubjectRbac>
  canAll(event: E, ...args: (RequirementNames | RequireGuardOptions)[]): Promise<SubjectRbac>
}

const CONTEXT_KEY = 'rbac'

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
 *
 * With a typed engine (`createRbac<AppTypes>(...)`), names are checked: `requirePermission(event, 'typo')` is a type error.
 */
export function createRbacServer<
  E extends RbacEvent = RbacEvent,
  T extends RbacTypeConfig = DefaultRbacTypes,
  G extends string = DefaultGuardName<T>,
>(
  options: RbacServerOptions<E, T, G> & (T extends { guards: object } ? GuardOptions<CheckGuard<T, G>> : unknown),
): RbacServerFor<E, T, ScopedGuardName<T, G>> {
  return buildRbacServer(options as unknown as RbacServerOptions<E>) as unknown as RbacServerFor<E, T, ScopedGuardName<T, G>>
}

function buildRbacServer<E extends RbacEvent>(options: RbacServerOptions<E>): UntypedRbacServer<E> {
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

  // Async so an empty requirement (TypeError) rejects the returned promise instead of throwing synchronously.
  async function enforce(event: E, build: () => RbacRequirement, scope: RequireGuardOptions = {}): Promise<SubjectRbac> {
    const requirement = build()
    const resolvedSubject = await resolve(event)
    if (resolvedSubject === null) throw new RbacHttpError({ error: 'UNAUTHENTICATED', message: UNAUTHENTICATED_MESSAGE })
    const subject = scope.guard === undefined ? resolvedSubject : resolvedSubject.withScope({ guard: scope.guard })
    if (!(await satisfiesRequirement(subject, requirement))) {
      throw new RbacHttpError({
        error: 'FORBIDDEN',
        reason: requirement.kind,
        message: REQUIREMENT_MESSAGES[requirement.kind],
        ...(exposeRequirements && { required: requirement.requirements }),
      })
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
      const { names, options } = splitRequirementArgs<RequirePermissionOptions>(args)
      return enforce(event, () => permissionRequirement(names, options), options)
    },
    requireRole(event, ...args) {
      const { names, options } = splitRequirementArgs<RequireRoleOptions>(args)
      return enforce(event, () => roleRequirement(names, options), options)
    },
    requireRoleOrPermission(event, ...args) {
      const { names, options } = splitRequirementArgs<RequireGuardOptions>(args)
      return enforce(event, () => roleOrPermissionRequirement(names), options)
    },
    canAny(event, ...args) {
      const { names, options } = splitRequirementArgs<RequireGuardOptions>(args)
      return enforce(event, () => permissionRequirement(names, { any: true }), options)
    },
    canAll(event, ...args) {
      const { names, options } = splitRequirementArgs<RequireGuardOptions>(args)
      return enforce(event, () => permissionRequirement(names), options)
    },
  }
}
