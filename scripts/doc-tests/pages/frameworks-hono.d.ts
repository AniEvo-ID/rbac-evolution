// Hono guide: `app` is the Hono app of "Setup" (its AppEnv), the guards are the package's.
type RbacEnv = import('@anievo-id/rbac-evolution-hono').RbacEnv
type AppEnv = { Variables: import('@anievo-id/rbac-evolution-hono').RbacVariables & { user: { id: string } | undefined } }
declare const rbac: Rbac
declare const adapter: RbacAdapter
declare const app: import('hono').Hono<AppEnv>
declare const handler: import('hono').Handler<AppEnv>
declare const updateArticle: import('hono').Handler<AppEnv>
declare const deleteArticle: import('hono').Handler<AppEnv>
/** "sets c.get('user')" */
declare const yourAuthMiddleware: import('hono').MiddlewareHandler

declare const Hono: typeof import('hono').Hono
declare const rbacMiddleware: typeof import('@anievo-id/rbac-evolution-hono').rbacMiddleware
declare const requirePermission: typeof import('@anievo-id/rbac-evolution-hono').requirePermission
declare const requireRole: typeof import('@anievo-id/rbac-evolution-hono').requireRole
declare const requireRoleOrPermission: typeof import('@anievo-id/rbac-evolution-hono').requireRoleOrPermission
declare const canAny: typeof import('@anievo-id/rbac-evolution-hono').canAny
declare const canAll: typeof import('@anievo-id/rbac-evolution-hono').canAll
declare const createGuards: typeof import('@anievo-id/rbac-evolution-hono').createGuards
