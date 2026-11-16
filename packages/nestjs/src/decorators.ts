import 'reflect-metadata'
import { applyDecorators, createParamDecorator, type ExecutionContext, UseGuards } from '@nestjs/common'
import { getRbac } from './context'
import { RbacGuard } from './guard'
import {
  type PermissionRequirementOptions,
  permissionRequirement,
  type RbacRequirement,
  type RequirementNames,
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

const requirementDecorator = (requirement: RbacRequirement) =>
  applyDecorators(appendRequirement(requirement), UseGuards(RbacGuard))

/**
 * Requires permissions, like spatie's `permission:` middleware. Works on controllers and handlers.
 *
 * - `@RequirePermissions('edit articles')`
 * - `@RequirePermissions('edit articles|delete articles')` — any of them
 * - `@RequirePermissions('edit articles', 'publish articles')` — all of them
 * - `@RequirePermissions('a', 'b', { any: true })` — any of them
 */
export function RequirePermissions(...args: (RequirementNames | PermissionRequirementOptions)[]) {
  const { names, options } = splitRequirementArgs<PermissionRequirementOptions>(args)
  return requirementDecorator(permissionRequirement(names, options))
}

/**
 * spatie v8.5 `canAny()`: passes with ANY of the listed permissions.
 *
 * - `@CanAny('edit articles', 'publish articles')`, `@CanAny(['edit articles', 'publish articles'])`
 */
export function CanAny(...names: RequirementNames[]) {
  return RequirePermissions(...names, { any: true })
}

/**
 * spatie v8.5 `canAll()`: requires EVERY listed entry. A `'a|b'` entry still means "a or b".
 *
 * - `@CanAll('edit articles', 'publish articles')`, `@CanAll(['edit articles', 'publish|review'])`
 */
export function CanAll(...names: RequirementNames[]) {
  return RequirePermissions(...names)
}

/**
 * Requires roles, like spatie's `role:` middleware.
 *
 * - `@RequireRoles('admin')`, `@RequireRoles('admin|editor')`, `@RequireRoles('admin', 'editor')` — any of them
 * - `@RequireRoles('admin', 'editor', { all: true })` — all of them
 */
export function RequireRoles(...args: (RequirementNames | RoleRequirementOptions)[]) {
  const { names, options } = splitRequirementArgs<RoleRequirementOptions>(args)
  return requirementDecorator(roleRequirement(names, options))
}

/**
 * Passes when the subject has ANY of the names as a role OR as a permission,
 * like spatie's `role_or_permission:` middleware.
 *
 * - `@RequireRoleOrPermission('admin|edit articles')`
 */
export function RequireRoleOrPermission(...names: RequirementNames[]) {
  return requirementDecorator(roleOrPermissionRequirement(names))
}

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
