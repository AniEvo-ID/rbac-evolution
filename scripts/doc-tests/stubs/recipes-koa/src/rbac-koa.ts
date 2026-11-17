// The recipe's own `rbac-koa.ts` (its first block), as the second block imports it.
import type { Middleware, Context } from 'koa'
import type { Rbac, RequirementNames, Subject } from '@anievo-id/rbac-evolution'

export declare function rbacMiddleware(rbac: Rbac, getSubject: (ctx: Context) => Subject | null | undefined): Middleware
export declare const requirePermission: (...names: RequirementNames[]) => Middleware
export declare const requireRole: (...names: RequirementNames[]) => Middleware
export declare const requireRoleOrPermission: (...names: RequirementNames[]) => Middleware
