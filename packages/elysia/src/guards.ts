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
  type RequirementKind,
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
import type { RbacContext, RbacRequestContext, TypesOf } from './plugin'


export type GuardKind = RequirementKind

/** Details about a failed check, passed to `onUnauthenticated` / `onForbidden`. */
export interface GuardContext {
  kind: GuardKind
  /** Groups of names: every group must pass, a group passes when ANY of its names matches. */
  requirements: string[][]
}

/**
 * The context the handlers of `createGuards<T>()` get: the request context plus an `rbac` with the names of `T`
 * (of guard `G` with per-guard names).
 */
export type GuardHandlerContext<
  T extends RbacTypeConfig | Rbac<RbacTypeConfig> = DefaultRbacTypes,
  G extends string = DefaultGuardName<TypesOf<T>>,
> = RbacRequestContext & RbacContext<T, G>

/**
 * Returns the response to send (any value Elysia can send: a `Response`, an object, a string), or throws (e.g.
 * Elysia's `status(403)` / an `error()`).
 */
export type GuardHandler<C = GuardHandlerContext> = (ctx: C, context: GuardContext) => unknown

export interface GuardHandlers<C = GuardHandlerContext> {
  /** Called when there is no subject (`rbac` is `null`). Default: 401 JSON. */
  onUnauthenticated?: GuardHandler<C> | undefined
  /** Called when the subject lacks access. Default: 403 JSON. */
  onForbidden?: GuardHandler<C> | undefined
  /**
   * Include the required roles/permissions in the default 403 body.
   * Default: `false` (like spatie's `display_permission_in_exception`).
   */
  exposeRequirements?: boolean | undefined
}

/** The options every guard takes: the handlers plus `guard` (check in another guard, like spatie's `role:admin,api`). */
export interface RouteGuardOptions<C = GuardHandlerContext> extends GuardHandlers<C> {
  /** Check in this guard instead of the request's (`subject.withScope({ guard })`). Default: the request's guard. */
  guard?: string | undefined
}

export interface PermissionGuardOptions<C = GuardHandlerContext> extends RouteGuardOptions<C> {
  /** Pass when the subject has ANY of the permissions (instead of all). Default: `false`. */
  any?: boolean | undefined
}

export interface RoleGuardOptions<C = GuardHandlerContext> extends RouteGuardOptions<C> {
  /** Require ALL of the roles (instead of any). Default: `false`. */
  all?: boolean | undefined
}

export type RoleOrPermissionGuardOptions<C = GuardHandlerContext> = RouteGuardOptions<C>

/** A name, a pipe-separated list (`'edit|delete'` = any of), or an array of names. */
export type GuardNames = RequirementNames

/**
 * A guard, used as an Elysia `beforeHandle` hook: `app.get('/x', handler, { beforeHandle: requireRole('admin') })`
 * or `app.guard({ beforeHandle: [...] }, (app) => ...)`. It returns nothing when the check passes, and the
 * response of `onUnauthenticated` / `onForbidden` otherwise, which ends the request.
 */
export type BeforeHandle = (ctx: object) => Promise<unknown>

export class RbacPluginMissingError extends Error {
  readonly code = 'RBAC_PLUGIN_MISSING'

  constructor() {
    super('`rbac` is not set on the context. Register `rbacPlugin()` before the routes that use RBAC guards.')
    this.name = 'RbacPluginMissingError'
  }
}

const json = (body: unknown, status: number): Response => Response.json(body, { status })

const defaultUnauthenticated: GuardHandler = () => json({ error: 'UNAUTHENTICATED', message: UNAUTHENTICATED_MESSAGE }, 401)

const defaultForbidden =
  (expose: boolean): GuardHandler =>
  (_ctx, context) =>
    json(
      {
        error: 'FORBIDDEN',
        reason: context.kind,
        message: REQUIREMENT_MESSAGES[context.kind],
        ...(expose && { required: context.requirements }),
      },
      403,
    )

function createGuard(requirement: RbacRequirement, handlers: GuardHandlers, guard: string | undefined): BeforeHandle {
  const onUnauthenticated = handlers.onUnauthenticated ?? defaultUnauthenticated
  const onForbidden = handlers.onForbidden ?? defaultForbidden(handlers.exposeRequirements ?? false)
  const context: GuardContext = { kind: requirement.kind, requirements: requirement.requirements }

  return async (ctx) => {
    const rbac = (ctx as { rbac?: SubjectRbac | null }).rbac
    if (rbac === undefined) throw new RbacPluginMissingError()
    const handlerCtx = ctx as unknown as GuardHandlerContext
    if (rbac === null) return onUnauthenticated(handlerCtx, context)
    if (await satisfiesRequirement(guard === undefined ? rbac : rbac.withScope({ guard }), requirement)) return undefined
    return onForbidden(handlerCtx, context)
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
 */
export type Guard<N extends string, O> = <const A extends readonly (GuardNames | O)[]>(
  ...args: A & RequirementArgs<A, N, O>
) => BeforeHandle

/** The guards returned by `createGuards<T>()`, with names narrowed by `T` (see `RbacTypeConfig`). */
export interface Guards<T extends RbacTypeConfig = DefaultRbacTypes> {
  requirePermission: Guard<PermissionName<T>, PermissionGuardOptions<GuardHandlerContext<T>>>
  requireRole: Guard<RoleName<T>, RoleGuardOptions<GuardHandlerContext<T>>>
  requireRoleOrPermission: Guard<PermissionName<T> | RoleName<T>, RoleOrPermissionGuardOptions<GuardHandlerContext<T>>>
  canAny: Guard<PermissionName<T>, RouteGuardOptions<GuardHandlerContext<T>>>
  canAll: Guard<PermissionName<T>, RouteGuardOptions<GuardHandlerContext<T>>>
}

/**
 * A guard of `createGuards<T, G>()` when `T` has per-guard names: the names are those of the guard the call checks
 * in, its `{ guard }` option or else `G` (the guard of the request).
 */
export type ScopedGuard<T extends RbacTypeConfig, G extends string, K extends GuardKind, O> = <
  const A extends readonly (GuardNames | O)[],
>(
  ...args: A & GuardRequirementArgs<A, T, K, G, O>
) => BeforeHandle

/** The guards returned by `createGuards<T, G>()` when `T` has per-guard names. */
export interface ScopedGuards<T extends RbacTypeConfig, G extends string = DefaultGuardName<T>> {
  requirePermission: ScopedGuard<T, G, 'permission', PermissionGuardOptions<GuardHandlerContext<T, G>>>
  requireRole: ScopedGuard<T, G, 'role', RoleGuardOptions<GuardHandlerContext<T, G>>>
  requireRoleOrPermission: ScopedGuard<T, G, 'role_or_permission', RoleOrPermissionGuardOptions<GuardHandlerContext<T, G>>>
  canAny: ScopedGuard<T, G, 'permission', RouteGuardOptions<GuardHandlerContext<T, G>>>
  canAll: ScopedGuard<T, G, 'permission', RouteGuardOptions<GuardHandlerContext<T, G>>>
}

/** What `createGuards<T, G>()` returns: {@link Guards}, or {@link ScopedGuards} for a config with `guards`. */
export type GuardsFor<T extends RbacTypeConfig = DefaultRbacTypes, G extends string = DefaultGuardName<T>> = T extends {
  guards: object
}
  ? ScopedGuards<T, G>
  : Guards<T>

/**
 * Builds the guards with shared defaults (e.g. a custom `onForbidden`).
 *
 * Pass the same type argument as `createRbac<AppTypes>()` (or `typeof rbac`) to check names at compile time:
 * `const { requirePermission } = createGuards<AppTypes>()`. With per-guard names, `G` is the guard of the requests
 * these guards run on: `createGuards<AppRbac, 'api'>()`.
 */
export function createGuards<
  T extends RbacTypeConfig | Rbac<RbacTypeConfig> = DefaultRbacTypes,
  G extends GuardName<TypesOf<T>> = DefaultGuardName<TypesOf<T>> & GuardName<TypesOf<T>>,
>(defaults: GuardHandlers<GuardHandlerContext<TypesOf<T>, G>> = {}): GuardsFor<TypesOf<T>, G> {
  // The typed handlers only narrow `rbac`; the implementation below works on any context.
  const shared = defaults as unknown as GuardHandlers

  /**
   * Requires permissions, like spatie's `permission:` middleware.
   *
   * - `requirePermission('edit articles')`
   * - `requirePermission('edit articles|delete articles')`: any of them
   * - `requirePermission('edit articles', 'publish articles')`: all of them
   * - `requirePermission('a', 'b', { any: true })`: any of them
   */
  function requirePermission(...args: readonly (GuardNames | PermissionGuardOptions)[]): BeforeHandle {
    const { names, options = {} } = splitRequirementArgs<PermissionGuardOptions>(args)
    return createGuard(permissionRequirement(names, options), withDefaults(shared, options), options.guard)
  }

  /**
   * Requires roles, like spatie's `role:` middleware.
   *
   * - `requireRole('admin')`, `requireRole('admin|editor')`, `requireRole('admin', 'editor')`: any of them
   * - `requireRole('admin', 'editor', { all: true })`: all of them
   */
  function requireRole(...args: readonly (GuardNames | RoleGuardOptions)[]): BeforeHandle {
    const { names, options = {} } = splitRequirementArgs<RoleGuardOptions>(args)
    return createGuard(roleRequirement(names, options), withDefaults(shared, options), options.guard)
  }

  /** Passes with ANY of the names as a role OR a permission, like spatie's `role_or_permission:` middleware. */
  function requireRoleOrPermission(...args: readonly (GuardNames | RoleOrPermissionGuardOptions)[]): BeforeHandle {
    const { names, options = {} } = splitRequirementArgs<RoleOrPermissionGuardOptions>(args)
    return createGuard(roleOrPermissionRequirement(names), withDefaults(shared, options), options.guard)
  }

  /** spatie v8.5 `canAny()`: passes with ANY of the listed permissions. */
  function canAny(...args: readonly (GuardNames | RouteGuardOptions)[]): BeforeHandle {
    const { names, options } = splitRequirementArgs<RouteGuardOptions>(args)
    return requirePermission(...names, { ...options, any: true })
  }

  /** spatie v8.5 `canAll()`: requires EVERY listed entry. A `'a|b'` entry still means "a or b". */
  function canAll(...args: readonly (GuardNames | RouteGuardOptions)[]): BeforeHandle {
    const { names, options } = splitRequirementArgs<RouteGuardOptions>(args)
    return requirePermission(...names, { ...options, any: false })
  }

  return { requirePermission, requireRole, requireRoleOrPermission, canAny, canAll } as unknown as GuardsFor<TypesOf<T>, G>
}

const defaultGuards: Guards = createGuards()

export const requirePermission: Guard<string, PermissionGuardOptions> = defaultGuards.requirePermission
export const requireRole: Guard<string, RoleGuardOptions> = defaultGuards.requireRole
export const requireRoleOrPermission: Guard<string, RouteGuardOptions> = defaultGuards.requireRoleOrPermission
export const canAny: Guard<string, RouteGuardOptions> = defaultGuards.canAny
export const canAll: Guard<string, RouteGuardOptions> = defaultGuards.canAll

