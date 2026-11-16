import 'reflect-metadata'
import { applyDecorators, createParamDecorator, type ExecutionContext, UseGuards } from '@nestjs/common'
import { getRbac, type TypesOf } from './context'
import { RbacGuard } from './guard'
import {
  type DefaultGuardName,
  type DefaultRbacTypes,
  type GuardName,
  type GuardRequirementArgs,
  type PermissionName,
  type PermissionRequirementOptions,
  permissionRequirement,
  type Rbac,
  type RbacRequirement,
  type RbacTypeConfig,
  type RequirementArgs,
  type RequirementNames,
  type RoleName,
  roleOrPermissionRequirement,
  roleRequirement,
  type RoleRequirementOptions,
  splitRequirementArgs,
  type SubjectRbac,
} from '@anievo-id/rbac-evolution'
import { RBAC_REQUIREMENTS } from './tokens'

type ClassOrMethodDecorator = <T>(
  target: object,
  propertyKey?: string | symbol | undefined,
  descriptor?: TypedPropertyDescriptor<T> | undefined,
) => void

/** The options every requirement decorator takes (last argument). */
export interface RbacDecoratorOptions {
  /**
   * Check in this guard instead of the request's (`subject.withScope({ guard })`), like spatie's
   * `role:admin,api`. Default: the guard of the resolved subject (`RbacModule` `guard` option).
   */
  guard?: string | undefined
}

/** Options of `@RequirePermissions()`: `{ any }` and `{ guard }`. */
export interface RequirePermissionsOptions extends PermissionRequirementOptions, RbacDecoratorOptions {}

/** Options of `@RequireRoles()`: `{ all }` and `{ guard }`. */
export interface RequireRolesOptions extends RoleRequirementOptions, RbacDecoratorOptions {}

/** A requirement as stored under `RBAC_REQUIREMENTS`: `guard` is set only when the decorator got one. */
export interface StoredRbacRequirement extends RbacRequirement {
  guard?: string | undefined
}

/** Appends a requirement (stacked decorators all apply), unlike `SetMetadata` which overwrites. */
function appendRequirement(requirement: StoredRbacRequirement): ClassOrMethodDecorator {
  return (target, _propertyKey, descriptor) => {
    const holder: object = descriptor?.value !== undefined ? (descriptor.value as object) : target
    const current = (Reflect.getMetadata(RBAC_REQUIREMENTS, holder) as StoredRbacRequirement[] | undefined) ?? []
    Reflect.defineMetadata(RBAC_REQUIREMENTS, [...current, requirement], holder)
  }
}

/** The decorator every `@Require*()` / `@Can*()` factory returns (usable on classes and methods). */
export type RbacDecorator = ReturnType<typeof applyDecorators>

const requirementDecorator = (requirement: RbacRequirement, guard: string | undefined): RbacDecorator =>
  applyDecorators(
    appendRequirement(guard === undefined ? requirement : { ...requirement, guard }),
    UseGuards(RbacGuard),
  )

// Untyped implementations (plain `string` names, spread-friendly). The exported decorators add typed signatures.
function requirePermissions(...args: (RequirementNames | RequirePermissionsOptions)[]): RbacDecorator {
  const { names, options } = splitRequirementArgs<RequirePermissionsOptions>(args)
  return requirementDecorator(permissionRequirement(names, options), options?.guard)
}

function canAny(...args: (RequirementNames | RbacDecoratorOptions)[]): RbacDecorator {
  const { names, options } = splitRequirementArgs<RbacDecoratorOptions>(args)
  return requirePermissions(...names, { guard: options?.guard, any: true })
}

function canAll(...args: (RequirementNames | RbacDecoratorOptions)[]): RbacDecorator {
  const { names, options } = splitRequirementArgs<RbacDecoratorOptions>(args)
  return requirePermissions(...names, { guard: options?.guard })
}

function requireRoles(...args: (RequirementNames | RequireRolesOptions)[]): RbacDecorator {
  const { names, options } = splitRequirementArgs<RequireRolesOptions>(args)
  return requirementDecorator(roleRequirement(names, options), options?.guard)
}

function requireRoleOrPermission(...args: (RequirementNames | RbacDecoratorOptions)[]): RbacDecorator {
  const { names, options } = splitRequirementArgs<RbacDecoratorOptions>(args)
  return requirementDecorator(roleOrPermissionRequirement(names), options?.guard)
}

/**
 * The requirement decorators, with names checked against `T` (see `createRbacDecorators`).
 * With the default `T`, any name is accepted. In both cases a call without names, or with options
 * that are not the last argument, is a type error.
 */
export interface RbacDecorators<T extends RbacTypeConfig = DefaultRbacTypes> {
  /**
   * Requires permissions, like spatie's `permission:` middleware. Works on controllers and handlers.
   *
   * - `@RequirePermissions('edit articles')`
   * - `@RequirePermissions('edit articles|delete articles')` — any of them
   * - `@RequirePermissions('edit articles', 'publish articles')` — all of them
   * - `@RequirePermissions('a', 'b', { any: true })` — any of them
   * - `@RequirePermissions('edit articles', { guard: 'api' })` — in guard `api` (spatie's `permission:edit articles,api`)
   */
  RequirePermissions: <const A extends readonly (RequirementNames | RequirePermissionsOptions)[]>(
    ...args: A & RequirementArgs<A, PermissionName<T>, RequirePermissionsOptions>
  ) => RbacDecorator
  /**
   * Requires roles, like spatie's `role:` middleware.
   *
   * - `@RequireRoles('admin')`, `@RequireRoles('admin|editor')`, `@RequireRoles('admin', 'editor')` — any of them
   * - `@RequireRoles('admin', 'editor', { all: true })` — all of them
   * - `@RequireRoles('admin', { guard: 'api' })` — in guard `api` (spatie's `role:admin,api`)
   */
  RequireRoles: <const A extends readonly (RequirementNames | RequireRolesOptions)[]>(
    ...args: A & RequirementArgs<A, RoleName<T>, RequireRolesOptions>
  ) => RbacDecorator
  /**
   * Passes when the subject has ANY of the names as a role OR as a permission,
   * like spatie's `role_or_permission:` middleware.
   *
   * - `@RequireRoleOrPermission('admin|edit articles')`
   */
  RequireRoleOrPermission: <const A extends readonly (RequirementNames | RbacDecoratorOptions)[]>(
    ...args: A & RequirementArgs<A, PermissionName<T> | RoleName<T>, RbacDecoratorOptions>
  ) => RbacDecorator
  /**
   * spatie v8.5 `canAny()`: passes with ANY of the listed permissions.
   *
   * - `@CanAny('edit articles', 'publish articles')`, `@CanAny(['edit articles', 'publish articles'])`
   */
  CanAny: <const A extends readonly (RequirementNames | RbacDecoratorOptions)[]>(
    ...args: A & RequirementArgs<A, PermissionName<T>, RbacDecoratorOptions>
  ) => RbacDecorator
  /**
   * spatie v8.5 `canAll()`: requires EVERY listed entry. A `'a|b'` entry still means "a or b".
   *
   * - `@CanAll('edit articles', 'publish articles')`, `@CanAll(['edit articles', 'publish|review'])`
   */
  CanAll: <const A extends readonly (RequirementNames | RbacDecoratorOptions)[]>(
    ...args: A & RequirementArgs<A, PermissionName<T>, RbacDecoratorOptions>
  ) => RbacDecorator
}

/**
 * The decorators of `createRbacDecorators<T, G>()` when `T` has per-guard names (`RbacTypeConfig['guards']`):
 * like {@link RbacDecorators}, but the names are those of the guard each decorator checks in, its `{ guard }`
 * option or else `G` (the guard of the resolved subject, `RbacModule`'s `guard`).
 * `@RequirePermissions('orders.read', { guard: 'api' })` takes the `api` names.
 */
export interface ScopedRbacDecorators<T extends RbacTypeConfig, G extends string = DefaultGuardName<T>> {
  /** {@link RbacDecorators.RequirePermissions}, with the names of the guard it checks in. */
  RequirePermissions: <const A extends readonly (RequirementNames | RequirePermissionsOptions)[]>(
    ...args: A & GuardRequirementArgs<A, T, 'permission', G, RequirePermissionsOptions>
  ) => RbacDecorator
  /** {@link RbacDecorators.RequireRoles}, with the names of the guard it checks in. */
  RequireRoles: <const A extends readonly (RequirementNames | RequireRolesOptions)[]>(
    ...args: A & GuardRequirementArgs<A, T, 'role', G, RequireRolesOptions>
  ) => RbacDecorator
  /** {@link RbacDecorators.RequireRoleOrPermission}, with the names of the guard it checks in. */
  RequireRoleOrPermission: <const A extends readonly (RequirementNames | RbacDecoratorOptions)[]>(
    ...args: A & GuardRequirementArgs<A, T, 'role_or_permission', G, RbacDecoratorOptions>
  ) => RbacDecorator
  /** {@link RbacDecorators.CanAny}, with the names of the guard it checks in. */
  CanAny: <const A extends readonly (RequirementNames | RbacDecoratorOptions)[]>(
    ...args: A & GuardRequirementArgs<A, T, 'permission', G, RbacDecoratorOptions>
  ) => RbacDecorator
  /** {@link RbacDecorators.CanAll}, with the names of the guard it checks in. */
  CanAll: <const A extends readonly (RequirementNames | RbacDecoratorOptions)[]>(
    ...args: A & GuardRequirementArgs<A, T, 'permission', G, RbacDecoratorOptions>
  ) => RbacDecorator
}

/**
 * What `createRbacDecorators<T, G>()` returns: {@link RbacDecorators} for a config without per-guard names (as in
 * 1.1), and {@link ScopedRbacDecorators} for one with `guards`.
 */
export type RbacDecoratorsFor<
  T extends RbacTypeConfig = DefaultRbacTypes,
  G extends string = DefaultGuardName<T>,
> = T extends { guards: object } ? ScopedRbacDecorators<T, G> : RbacDecorators<T>

/**
 * Returns the requirement decorators with names checked against your typed names
 * (the same `T` as `createRbac<T>(...)`, or `typeof rbac`). Runtime behaviour is the same as the top-level
 * decorators.
 *
 * ```ts
 * type AppTypes = { permissions: 'edit articles' | 'delete articles'; roles: 'admin' | 'writer' }
 * export const { RequirePermissions, RequireRoles } = createRbacDecorators<AppTypes>()
 *
 * @RequirePermissions('edit articles') // ok
 * @RequirePermissions('edit artcles')  // type error
 * ```
 *
 * `@CurrentRbac()` can't type its parameter (a Nest parameter decorator never does): annotate it with the same
 * names, `@CurrentRbac() access: SubjectRbac<AppTypes>`.
 *
 * With per-guard names (`RbacTypeConfig['guards']`), `G` is the guard of the resolved subject (`RbacModule`'s
 * `guard`; default: the default guard): `createRbacDecorators<AppRbac, 'api'>()`. Names are checked in that guard,
 * or in a decorator's `{ guard }`, and `@CurrentRbac()` is a `SubjectRbac<AppRbac, 'api'>`.
 */
export function createRbacDecorators<
  T extends RbacTypeConfig | Rbac<RbacTypeConfig> = DefaultRbacTypes,
  G extends GuardName<TypesOf<T>> = DefaultGuardName<TypesOf<T>> & GuardName<TypesOf<T>>,
>(): RbacDecoratorsFor<TypesOf<T>, G> {
  const decorators = {
    RequirePermissions: requirePermissions,
    RequireRoles: requireRoles,
    RequireRoleOrPermission: requireRoleOrPermission,
    CanAny: canAny,
    CanAll: canAll,
  } satisfies Record<keyof RbacDecorators, unknown>
  return decorators as unknown as RbacDecoratorsFor<TypesOf<T>, G>
}

const defaults = createRbacDecorators()

/**
 * Requires permissions, like spatie's `permission:` middleware. Works on controllers and handlers.
 * Accepts any name; for typed names use `createRbacDecorators<T>()`.
 *
 * - `@RequirePermissions('edit articles')`
 * - `@RequirePermissions('edit articles|delete articles')` — any of them
 * - `@RequirePermissions('edit articles', 'publish articles')` — all of them
 * - `@RequirePermissions('a', 'b', { any: true })` — any of them
 */
export const RequirePermissions: RbacDecorators['RequirePermissions'] = defaults.RequirePermissions

/**
 * spatie v8.5 `canAny()`: passes with ANY of the listed permissions.
 *
 * - `@CanAny('edit articles', 'publish articles')`, `@CanAny(['edit articles', 'publish articles'])`
 */
export const CanAny: RbacDecorators['CanAny'] = defaults.CanAny

/**
 * spatie v8.5 `canAll()`: requires EVERY listed entry. A `'a|b'` entry still means "a or b".
 *
 * - `@CanAll('edit articles', 'publish articles')`, `@CanAll(['edit articles', 'publish|review'])`
 */
export const CanAll: RbacDecorators['CanAll'] = defaults.CanAll

/**
 * Requires roles, like spatie's `role:` middleware.
 *
 * - `@RequireRoles('admin')`, `@RequireRoles('admin|editor')`, `@RequireRoles('admin', 'editor')` — any of them
 * - `@RequireRoles('admin', 'editor', { all: true })` — all of them
 */
export const RequireRoles: RbacDecorators['RequireRoles'] = defaults.RequireRoles

/**
 * Passes when the subject has ANY of the names as a role OR as a permission,
 * like spatie's `role_or_permission:` middleware.
 *
 * - `@RequireRoleOrPermission('admin|edit articles')`
 */
export const RequireRoleOrPermission: RbacDecorators['RequireRoleOrPermission'] = defaults.RequireRoleOrPermission

/**
 * Injects the current subject's `SubjectRbac` (`null` for guests), as resolved by `RbacGuard`.
 *
 * ```ts
 * @Get('me/permissions')
 * @UseGuards(RbacGuard)
 * snapshot(@CurrentRbac() rbac: SubjectRbac | null) {
 *   return rbac?.snapshot() ?? null
 * }
 * ```
 */
export const CurrentRbac: () => ParameterDecorator = createParamDecorator(
  (_data: unknown, context: ExecutionContext): SubjectRbac | null => getRbac(context),
)
