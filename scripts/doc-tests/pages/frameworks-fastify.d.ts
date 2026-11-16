// Fastify guide: `app` is a Fastify instance, the guards are the package's (or createGuards()'s).
declare const rbac: Rbac
declare const adapter: RbacAdapter
declare const app: import('fastify').FastifyInstance
declare const handler: import('fastify').RouteHandlerMethod
declare const updateArticle: import('fastify').RouteHandlerMethod
declare const deleteArticle: import('fastify').RouteHandlerMethod
/** "sets request.user" */
declare const yourAuthPlugin: import('fastify').FastifyPluginAsync

declare const rbacPlugin: typeof import('@anievo-id/rbac-evolution-fastify').rbacPlugin
declare const requirePermission: typeof import('@anievo-id/rbac-evolution-fastify').requirePermission
declare const requireRole: typeof import('@anievo-id/rbac-evolution-fastify').requireRole
declare const requireRoleOrPermission: typeof import('@anievo-id/rbac-evolution-fastify').requireRoleOrPermission
declare const canAny: typeof import('@anievo-id/rbac-evolution-fastify').canAny
declare const canAll: typeof import('@anievo-id/rbac-evolution-fastify').canAll
declare const createGuards: typeof import('@anievo-id/rbac-evolution-fastify').createGuards
