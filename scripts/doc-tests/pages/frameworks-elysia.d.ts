// Elysia guide: `app` is an Elysia app with `rbacPlugin()` registered (`rbac` in its context), the guards are the
// package's.
declare const rbac: Rbac
declare const adapter: RbacAdapter
declare const app: import('elysia').Elysia<
  '',
  { decorator: {}; store: {}; derive: {}; resolve: import('@anievo-id/rbac-evolution-elysia').RbacContext }
>
/** "your auth": reads the user from a bearer token. */
declare function getUserFromToken(authorization: string | undefined): Promise<{ id: string } | null>
declare const updateArticle: () => unknown
declare const getStats: () => unknown
declare const listArticles: () => unknown
declare const deleteArticle: () => unknown
declare const dashboard: () => unknown
declare const getReports: () => unknown
declare const Elysia: typeof import('elysia').Elysia
declare const requirePermission: typeof import('@anievo-id/rbac-evolution-elysia').requirePermission
declare const requireRole: typeof import('@anievo-id/rbac-evolution-elysia').requireRole
declare const rbacPlugin: typeof import('@anievo-id/rbac-evolution-elysia').rbacPlugin
