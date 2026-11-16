// Express guide: `app` is an Express app, the guards are the package's (or createGuards()'s).
declare const rbac: Rbac
declare const adapter: RbacAdapter
declare const app: import('express').Express
declare const handler: import('express').RequestHandler
declare const updateArticle: import('express').RequestHandler
declare const deleteArticle: import('express').RequestHandler
/** "sets req.user" */
declare const yourAuthMiddleware: import('express').RequestHandler

declare const rbacMiddleware: typeof import('@anievo-id/rbac-evolution-express').rbacMiddleware
declare const requirePermission: typeof import('@anievo-id/rbac-evolution-express').requirePermission
declare const requireRole: typeof import('@anievo-id/rbac-evolution-express').requireRole
declare const requireRoleOrPermission: typeof import('@anievo-id/rbac-evolution-express').requireRoleOrPermission
declare const canAny: typeof import('@anievo-id/rbac-evolution-express').canAny
declare const canAll: typeof import('@anievo-id/rbac-evolution-express').canAll
declare const createGuards: typeof import('@anievo-id/rbac-evolution-express').createGuards
declare const express: typeof import('express')

// What the app's own auth middleware puts on the request.
declare namespace Express {
  interface Request {
    user?: { id: number }
    apiClient?: { id: string }
  }
}
