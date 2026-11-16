declare const adapter: RbacAdapter
declare const sharedRedisCacheStore: CacheStore
// "Next.js server action" tab: the helpers of the Next.js guide's lib/rbac.ts.
declare const withPermission: ReturnType<typeof import('@anievo-id/rbac-evolution-next').createNextRbac>['withPermission']
declare const db: import('@prisma/client').PrismaClient
// "Express route" tab.
declare const app: import('express').Express
declare const requirePermission: typeof import('@anievo-id/rbac-evolution-express').requirePermission
declare const deleteArticleHandler: import('express').RequestHandler
