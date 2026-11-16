// NestJS guide: Nest's decorators and the package's, as a controller file would import them.
declare const rbac: Rbac

declare const Controller: typeof import('@nestjs/common').Controller
declare const Get: typeof import('@nestjs/common').Get
declare const Post: typeof import('@nestjs/common').Post
declare const Put: typeof import('@nestjs/common').Put
declare const Delete: typeof import('@nestjs/common').Delete
declare const UseGuards: typeof import('@nestjs/common').UseGuards

declare const RbacModule: typeof import('@anievo-id/rbac-evolution-nestjs').RbacModule
declare const RbacGuard: typeof import('@anievo-id/rbac-evolution-nestjs').RbacGuard
declare const CurrentRbac: typeof import('@anievo-id/rbac-evolution-nestjs').CurrentRbac
declare const RequirePermissions: typeof import('@anievo-id/rbac-evolution-nestjs').RequirePermissions
declare const RequireRoles: typeof import('@anievo-id/rbac-evolution-nestjs').RequireRoles
declare const CanAny: typeof import('@anievo-id/rbac-evolution-nestjs').CanAny

// @nestjs/config (not installed here): the part "Async configuration" uses.
declare class ConfigModule {}
declare class ConfigService {
  get<T = string>(key: string): T | undefined
}
