/**
 * @anievo-id/rbac-evolution-nestjs
 *
 * NestJS module, guard and decorators for rbac-evolution.
 */

export { RbacModule } from './module'
export type { RbacModuleAsyncConfig, RbacModuleConfig, RbacModuleOptions } from './options'

export { RbacGuard } from './guard'
export {
  CanAll,
  CanAny,
  createRbacDecorators,
  CurrentRbac,
  RequirePermissions,
  RequireRoleOrPermission,
  RequireRoles,
} from './decorators'
export type { RbacDecorator, RbacDecorators } from './decorators'
export { getRbac, RbacGuardMissingError } from './context'
export { RBAC, RBAC_MODULE_OPTIONS, RBAC_REQUIREMENTS } from './tokens'

export type {
  PermissionRequirementOptions,
  RbacRequirement,
  RequirementKind,
  RequirementNames,
  RoleRequirementOptions,
} from '@anievo-id/rbac-evolution'
