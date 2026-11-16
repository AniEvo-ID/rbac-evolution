import {
  type DefaultGuardName,
  type DefaultRbacTypes,
  type GuardName,
  type GuardRequirementArgs,
  type PermissionName,
  permissionRequirement,
  type Rbac,
  type RbacTypeConfig,
  type RbacRequirement,
  type RequirementKind,
  type RequirementArgs,
  type RequirementNames,
  type RoleName,
  roleOrPermissionRequirement,
  roleRequirement,
  satisfiesRequirement,
  splitRequirementArgs,
  type SubjectRbac,
} from '@anievo-id/rbac-evolution'
import type { TRPCProcedureType } from '@trpc/server'
// Type-only. The main entry exports it as `TRPCMiddlewareFunction` in later 11.x releases, but not in 11.0.0;
// this entry has it in every 11.x.
import type { MiddlewareFunction } from '@trpc/server/unstable-core-do-not-import'
import type { GuardSubject, TypesOf } from './context'
import { forbiddenError, RbacContextMissingError, unauthenticatedError } from './errors'

type MaybePromise<T> = T | Promise<T>

export type GuardKind = RequirementKind

/** Details about a failed check, passed to `onUnauthenticated` / `onForbidden`. */
export interface GuardContext {
  kind: GuardKind
  /** Groups of names: every group must pass, a group passes when ANY of its names matches. */
  requirements: string[][]
}

/** The call a guard runs in, as `onUnauthenticated` / `onForbidden` and `resolve` get it. */
export interface GuardCallOptions {
  /** The procedure's context (after the middlewares that ran before the guard). */
  ctx: any
  /** The procedure's path, such as `post.byId`. */
  path: string
  type: TRPCProcedureType
}

/**
 * What `onUnauthenticated` / `onForbidden` get: the call, plus the subject the guard checked (`null` in
 * `onUnauthenticated`). `R` is that subject's type: `SubjectRbac` with the names of `T` in `createGuards<T>()`.
 */
export interface GuardHandlerOptions<R = SubjectRbac> extends GuardCallOptions {
  rbac: R | null
}

/**
 * Returns the error to throw (or throws it), e.g. a `TRPCError` with another code. Anything that is not a
 * `TRPCError` reaches the client as an `INTERNAL_SERVER_ERROR`.
 */
export type GuardHandler<R = SubjectRbac> = (opts: GuardHandlerOptions<R>, context: GuardContext) => MaybePromise<Error>

export interface GuardHandlers<R = SubjectRbac> {
  /** Called when there is no subject (`ctx.rbac` is `null`). Default: a `TRPCError` `UNAUTHORIZED`. */
  onUnauthenticated?: GuardHandler<R> | undefined
  /** Called when the subject lacks access. Default: a `TRPCError` `FORBIDDEN`. */
  onForbidden?: GuardHandler<R> | undefined
  /**
   * Include the required roles/permissions in the default error (`required` in its body).
   * Default: `false` (like spatie's `display_permission_in_exception`).
   */
  exposeRequirements?: boolean | undefined
}

/**
 * Reads the subject of a call, instead of `ctx.rbac`: `({ ctx }) => (ctx.user ? rbac.for(ctx.user) : null)`.
 * Return `null` / `undefined` for guests.
 */
export type RbacResolver<R = SubjectRbac> = (opts: GuardCallOptions) => MaybePromise<R | null | undefined>

/** The options of `createGuards()`: the shared handlers, plus a `resolve` that replaces `ctx.rbac`. */
export interface CreateGuardsOptions<R = SubjectRbac> extends GuardHandlers<R> {
  /**
   * Reads the subject of each call. Default: `ctx.rbac`, as `createRbacContext()` sets it. With `resolve`, the
   * procedures don't need `rbac` in their context. It runs once per guard and call.
   */
  resolve?: RbacResolver<R> | undefined
}

/**
 * The options every guard takes: the handlers plus `guard`.
 *
 * `guard` is per guard only (like spatie's `role:admin,api`), not a `createGuards()` default: the subject's guard
 * comes from `createRbacContext()` (or `resolve`). With per-guard names, tell the types which guard the subjects
 * have with `createGuards<AppRbac, 'api'>()`.
 */
export interface RouteGuardOptions<R = SubjectRbac> extends GuardHandlers<R> {
  /**
   * Check in this guard instead of the subject's (`subject.withScope({ guard })`), like spatie's
   * `role:admin,api`. Default: the guard of the subject.
   */
  guard?: string | undefined
}

export interface PermissionGuardOptions<R = SubjectRbac> extends RouteGuardOptions<R> {
  /** Pass when the subject has ANY of the permissions (instead of all). Default: `false`. */
  any?: boolean | undefined
}

export interface RoleGuardOptions<R = SubjectRbac> extends RouteGuardOptions<R> {
  /** Require ALL of the roles (instead of any). Default: `false`. */
  all?: boolean | undefined
}

export type RoleOrPermissionGuardOptions<R = SubjectRbac> = RouteGuardOptions<R>

/** A name, a pipe-separated list (`'edit|delete'` = any of), or an array of names. */
export type GuardNames = RequirementNames

/**
 * The context a guard needs: `ctx.rbac`, a `SubjectRbac` or `null` (see `createRbacContext()`). A procedure
 * whose context has no `rbac` can't `.use()` the guard (unless `createGuards()` got a `resolve`).
 */
export interface RbacProcedureContext {
  rbac: SubjectRbac<any, any> | null
}

/**
 * The middleware a guard returns, for `t.procedure.use(...)`. After it, `ctx.rbac` is `R`: the subject, never
 * `null`. `C` is the context it needs: {@link RbacProcedureContext} by default.
 */
export type RbacMiddleware<R = SubjectRbac, C = RbacProcedureContext> = MiddlewareFunction<
  C,
  any,
  any,
  { rbac: R },
  any
>

/**
 * A guard typed with the names `N` it accepts and its options `O`: `(...names, options?)`.
 * Every name (each part of a `'a|b'` list, each array item) must be one of `N`; with `N = string`, any name is.
 * A call without names, or with options that are not the last argument, is a type error.
 * The middleware narrows `ctx.rbac` to `R`, and needs the context `C`.
 */
export type Guard<N extends string, O, R = SubjectRbac, C = RbacProcedureContext> = <
  const A extends readonly (GuardNames | O)[],
>(
  ...args: A & RequirementArgs<A, N, O>
) => RbacMiddleware<R, C>

/**
 * The guards returned by `createGuards<T>()`, with names narrowed by `T` (see `RbacTypeConfig`). After them,
 * `ctx.rbac` is a `SubjectRbac` with the names of `T`.
 */
export interface Guards<T extends RbacTypeConfig = DefaultRbacTypes, C = RbacProcedureContext> {
  requirePermission: Guard<PermissionName<T>, PermissionGuardOptions<GuardSubject<T>>, GuardSubject<T>, C>
  requireRole: Guard<RoleName<T>, RoleGuardOptions<GuardSubject<T>>, GuardSubject<T>, C>
  requireRoleOrPermission: Guard<
    PermissionName<T> | RoleName<T>,
    RoleOrPermissionGuardOptions<GuardSubject<T>>,
    GuardSubject<T>,
    C
  >
  canAny: Guard<PermissionName<T>, RouteGuardOptions<GuardSubject<T>>, GuardSubject<T>, C>
  canAll: Guard<PermissionName<T>, RouteGuardOptions<GuardSubject<T>>, GuardSubject<T>, C>
}

/**
 * A guard of `createGuards<T, G>()` when `T` has per-guard names (`RbacTypeConfig['guards']`): like
 * {@link Guard}, but the names are those of the guard the call checks in, its `{ guard }` option or else `G`
 * (the guard of the subject). `requirePermission('orders.read', { guard: 'api' })` takes the `api` names.
 */
export type ScopedGuard<T extends RbacTypeConfig, G extends string, K extends GuardKind, O, C = RbacProcedureContext> = <
  const A extends readonly (GuardNames | O)[],
>(
  ...args: A & GuardRequirementArgs<A, T, K, G, O>
) => RbacMiddleware<GuardSubject<T, G>, C>

/**
 * The guards returned by `createGuards<T, G>()` when `T` has per-guard names: names follow the guard each call
 * checks in (see {@link ScopedGuard}), and `ctx.rbac` is in guard `G` after them.
 */
export interface ScopedGuards<T extends RbacTypeConfig, G extends string = DefaultGuardName<T>, C = RbacProcedureContext> {
  requirePermission: ScopedGuard<T, G, 'permission', PermissionGuardOptions<GuardSubject<T, G>>, C>
  requireRole: ScopedGuard<T, G, 'role', RoleGuardOptions<GuardSubject<T, G>>, C>
  requireRoleOrPermission: ScopedGuard<T, G, 'role_or_permission', RoleOrPermissionGuardOptions<GuardSubject<T, G>>, C>
  canAny: ScopedGuard<T, G, 'permission', RouteGuardOptions<GuardSubject<T, G>>, C>
  canAll: ScopedGuard<T, G, 'permission', RouteGuardOptions<GuardSubject<T, G>>, C>
}

/**
 * What `createGuards<T, G>()` returns: {@link Guards} for a config without per-guard names, and
 * {@link ScopedGuards} for one with `guards`.
 */
export type GuardsFor<
  T extends RbacTypeConfig = DefaultRbacTypes,
  G extends string = DefaultGuardName<T>,
  C = RbacProcedureContext,
> = T extends { guards: object } ? ScopedGuards<T, G, C> : Guards<T, C>

// ------------------------------------------------------------------------------------------ runtime

/** The untyped middleware the guards build; the public types above are only its face. */
type AnyMiddleware = (opts: GuardCallOptions & { next: (opts: { ctx: object }) => Promise<unknown> }) => Promise<unknown>

const fromContext: RbacResolver = ({ ctx }) => {
  const rbac = (ctx as { rbac?: SubjectRbac | null } | undefined)?.rbac
  if (rbac === undefined) throw new RbacContextMissingError()
  return rbac
}

const defaultUnauthenticated: GuardHandler = () => unauthenticatedError()

const defaultForbidden =
  (expose: boolean): GuardHandler =>
  (_opts, context) =>
    forbiddenError(context.kind, expose ? context.requirements : undefined)

function createGuard(
  requirement: RbacRequirement,
  handlers: GuardHandlers,
  guard: string | undefined,
  resolve: RbacResolver,
): AnyMiddleware {
  const onUnauthenticated = handlers.onUnauthenticated ?? defaultUnauthenticated
  const onForbidden = handlers.onForbidden ?? defaultForbidden(handlers.exposeRequirements ?? false)
  const context: GuardContext = { kind: requirement.kind, requirements: requirement.requirements }

  return async (opts) => {
    const call: GuardCallOptions = { ctx: opts.ctx, path: opts.path, type: opts.type }
    const rbac = (await resolve(call)) ?? null
    if (rbac === null) throw await onUnauthenticated({ ...call, rbac }, context)
    if (await satisfiesRequirement(guard === undefined ? rbac : rbac.withScope({ guard }), requirement)) {
      return opts.next({ ctx: { rbac } })
    }
    throw await onForbidden({ ...call, rbac }, context)
  }
}

/** `options` over `defaults`, where an option set to `undefined` keeps the default (as if left out). */
function withDefaults(defaults: GuardHandlers, options: GuardHandlers): GuardHandlers {
  const merged: Record<string, unknown> = { ...defaults }
  for (const [key, value] of Object.entries(options)) if (value !== undefined) merged[key] = value
  return merged as GuardHandlers
}

/**
 * Builds the guards with shared options: handlers (e.g. an `onForbidden` that throws `NOT_FOUND`), and a `resolve`
 * that reads the subject of a call instead of `ctx.rbac`.
 *
 * Pass the same type argument as `createRbac<AppRbac>()` (or `typeof rbac`) to check names at compile time:
 * `const { requirePermission } = createGuards<AppRbac>()`. After a guard, `ctx.rbac` has the same names and is
 * never `null`.
 *
 * With per-guard names (`RbacTypeConfig['guards']`), `G` is the guard of the subjects these guards check (the
 * `guard` of `createRbacContext()`; default: the default guard): `createGuards<AppRbac, 'api'>()`. Names are
 * checked in that guard, or in a procedure's `{ guard }`. It is a type only; the subject's guard still decides
 * at runtime.
 */
export function createGuards<
  T extends RbacTypeConfig | Rbac<RbacTypeConfig> = DefaultRbacTypes,
  G extends GuardName<TypesOf<T>> = DefaultGuardName<TypesOf<T>> & GuardName<TypesOf<T>>,
>(
  options: CreateGuardsOptions<GuardSubject<T, G>> & { resolve: RbacResolver<GuardSubject<T, G>> },
): GuardsFor<TypesOf<T>, G, any>
export function createGuards<
  T extends RbacTypeConfig | Rbac<RbacTypeConfig> = DefaultRbacTypes,
  G extends GuardName<TypesOf<T>> = DefaultGuardName<TypesOf<T>> & GuardName<TypesOf<T>>,
>(defaults?: GuardHandlers<GuardSubject<T, G>>): GuardsFor<TypesOf<T>, G>
export function createGuards(options: CreateGuardsOptions = {}): GuardsFor {
  const { resolve = fromContext, ...shared } = options

  /**
   * Requires permissions, like spatie's `permission:` middleware.
   *
   * - `requirePermission('edit articles')`
   * - `requirePermission('edit articles|delete articles')` — any of them
   * - `requirePermission('edit articles', 'publish articles')` — all of them
   * - `requirePermission('a', 'b', { any: true })` — any of them
   */
  function requirePermission(...args: readonly (GuardNames | PermissionGuardOptions)[]): AnyMiddleware {
    const { names, options = {} } = splitRequirementArgs<PermissionGuardOptions>(args)
    return createGuard(permissionRequirement(names, options), withDefaults(shared, options), options.guard, resolve)
  }

  /**
   * Requires roles, like spatie's `role:` middleware.
   *
   * - `requireRole('admin')`, `requireRole('admin|editor')`, `requireRole('admin', 'editor')` — any of them
   * - `requireRole('admin', 'editor', { all: true })` — all of them
   */
  function requireRole(...args: readonly (GuardNames | RoleGuardOptions)[]): AnyMiddleware {
    const { names, options = {} } = splitRequirementArgs<RoleGuardOptions>(args)
    return createGuard(roleRequirement(names, options), withDefaults(shared, options), options.guard, resolve)
  }

  /**
   * Passes when the subject has ANY of the names as a role OR as a permission,
   * like spatie's `role_or_permission:` middleware.
   *
   * - `requireRoleOrPermission('admin|edit articles')`
   */
  function requireRoleOrPermission(...args: readonly (GuardNames | RoleOrPermissionGuardOptions)[]): AnyMiddleware {
    const { names, options = {} } = splitRequirementArgs<RoleOrPermissionGuardOptions>(args)
    return createGuard(roleOrPermissionRequirement(names), withDefaults(shared, options), options.guard, resolve)
  }

  /**
   * spatie v8.5 `canAny()`: passes with ANY of the listed permissions.
   *
   * - `canAny('edit articles', 'publish articles')`, `canAny(['edit articles', 'publish articles'])`
   */
  function canAny(...args: readonly (GuardNames | RouteGuardOptions)[]): AnyMiddleware {
    const { names, options } = splitRequirementArgs<RouteGuardOptions>(args)
    return requirePermission(...names, { ...options, any: true })
  }

  /**
   * spatie v8.5 `canAll()`: requires EVERY listed entry. A `'a|b'` entry still means "a or b".
   *
   * - `canAll('edit articles', 'publish articles')`, `canAll(['edit articles', 'publish|review'])`
   */
  function canAll(...args: readonly (GuardNames | RouteGuardOptions)[]): AnyMiddleware {
    const { names, options } = splitRequirementArgs<RouteGuardOptions>(args)
    return requirePermission(...names, { ...options, any: false })
  }

  // The untyped functions above take any spread of names (`canAny` passes `...names` on); the typed signature
  // is only the public face, so a cast is enough. No runtime change.
  return { requirePermission, requireRole, requireRoleOrPermission, canAny, canAll } as unknown as GuardsFor
}

const defaultGuards: Guards = createGuards()

// Spelled out, so the declarations keep these types (`Guard<string, PermissionGuardOptions>`, ...).
export const requirePermission: Guard<string, PermissionGuardOptions> = defaultGuards.requirePermission
export const requireRole: Guard<string, RoleGuardOptions> = defaultGuards.requireRole
export const requireRoleOrPermission: Guard<string, RouteGuardOptions> = defaultGuards.requireRoleOrPermission
export const canAny: Guard<string, RouteGuardOptions> = defaultGuards.canAny
export const canAll: Guard<string, RouteGuardOptions> = defaultGuards.canAll
