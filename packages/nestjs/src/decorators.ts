import 'reflect-metadata'
import { applyDecorators, createParamDecorator, type ExecutionContext, UseGuards } from '@nestjs/common'
import { getRbac } from './context'
import { RbacGuard } from './guard'
import {
  type DefaultRbacTypes,
  type PermissionName,
  type PermissionRequirementOptions,
  permissionRequirement,
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

/** Appends a requirement (stacked decorators all apply), unlike `SetMetadata` which overwrites. */
function appendRequirement(requirement: RbacRequirement): ClassOrMethodDecorator {
  return (target, _propertyKey, descriptor) => {
    const holder: object = descriptor?.value !== undefined ? (descriptor.value as object) : target
    const current = (Reflect.getMetadata(RBAC_REQUIREMENTS, holder) as RbacRequirement[] | undefined) ?? []
    Reflect.defineMetadata(RBAC_REQUIREMENTS, [...current, requirement], holder)
  }
}

/** The decorator every `@Require*()` / `@Can*()` factory returns (usable on classes and methods). */
export type RbacDecorator = ReturnType<typeof applyDecorators>

const requirementDecorator = (requirement: RbacRequirement): RbacDecorator =>
  applyDecorators(appendRequirement(requirement), UseGuards(RbacGuard))

// Untyped implementations (plain `string` names, spread-friendly). The exported decorators add typed signatures.
function requirePermissions(...args: (RequirementNames | PermissionRequirementOptions)[]): RbacDecorator {
  const { names, options } = splitRequirementArgs<PermissionRequirementOptions>(args)
  return requirementDecorator(permissionRequirement(names, options))
}

function canAny(...names: RequirementNames[]): RbacDecorator {
  return requirePermissions(...names, { any: true })
}

function canAll(...names: RequirementNames[]): RbacDecorator {
  return requirePermissions(...names)
}

function requireRoles(...args: (RequirementNames | RoleRequirementOptions)[]): RbacDecorator {
  const { names, options } = splitRequirementArgs<RoleRequirementOptions>(args)
  return requirementDecorator(roleRequirement(names, options))
}

function requireRoleOrPermission(...names: RequirementNames[]): RbacDecorator {
  return requirementDecorator(roleOrPermissionRequirement(names))
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
   */
  RequirePermissions: <const A extends readonly (RequirementNames | PermissionRequirementOptions)[]>(
    ...args: A & RequirementArgs<A, PermissionName<T>, PermissionRequirementOptions>
  ) => RbacDecorator
  /**
   * Requires roles, like spatie's `role:` middleware.
   *
   * - `@RequireRoles('admin')`, `@RequireRoles('admin|editor')`, `@RequireRoles('admin', 'editor')` — any of them
   * - `@RequireRoles('admin', 'editor', { all: true })` — all of them
   */
  RequireRoles: <const A extends readonly (RequirementNames | RoleRequirementOptions)[]>(
    ...args: A & RequirementArgs<A, RoleName<T>, RoleRequirementOptions>
  ) => RbacDecorator
  /**
   * Passes when the subject has ANY of the names as a role OR as a permission,
   * like spatie's `role_or_permission:` middleware.
   *
   * - `@RequireRoleOrPermission('admin|edit articles')`
   */
  RequireRoleOrPermission: <const A extends readonly RequirementNames[]>(
    ...names: A & RequirementArgs<A, PermissionName<T> | RoleName<T>, never>
  ) => RbacDecorator
  /**
   * spatie v8.5 `canAny()`: passes with ANY of the listed permissions.
   *
   * - `@CanAny('edit articles', 'publish articles')`, `@CanAny(['edit articles', 'publish articles'])`
   */
  CanAny: <const A extends readonly RequirementNames[]>(
    ...names: A & RequirementArgs<A, PermissionName<T>, never>
  ) => RbacDecorator
  /**
   * spatie v8.5 `canAll()`: requires EVERY listed entry. A `'a|b'` entry still means "a or b".
   *
   * - `@CanAll('edit articles', 'publish articles')`, `@CanAll(['edit articles', 'publish|review'])`
   */
  CanAll: <const A extends readonly RequirementNames[]>(
    ...names: A & RequirementArgs<A, PermissionName<T>, never>
  ) => RbacDecorator
}

/**
 * Returns the requirement decorators with names checked against your typed names
 * (the same `T` as `createRbac<T>(...)`). Runtime behaviour is the same as the top-level decorators.
 *
 * ```ts
 * type AppTypes = { permissions: 'edit articles' | 'delete articles'; roles: 'admin' | 'writer' }
 * export const { RequirePermissions, RequireRoles } = createRbacDecorators<AppTypes>()
 *
 * @RequirePermissions('edit articles') // ok
 * @RequirePermissions('edit artcles')  // type error
 * ```
 */
export function createRbacDecorators<T extends RbacTypeConfig = DefaultRbacTypes>(): RbacDecorators<T> {
  const decorators = {
    RequirePermissions: requirePermissions,
    RequireRoles: requireRoles,
    RequireRoleOrPermission: requireRoleOrPermission,
    CanAny: canAny,
    CanAll: canAll,
  } satisfies Record<keyof RbacDecorators, unknown>
  return decorators as unknown as RbacDecorators<T>
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
