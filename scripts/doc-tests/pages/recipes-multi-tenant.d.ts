// Multi-tenant recipe: an Express app, the engine of step 1 (teams on), your own database client.
declare const rbac: Rbac
declare const adapter: RbacAdapter
declare const app: import('express').Express
/** "`db` stands for your own database client" (Prisma here, with `team` and `membership` models). */
declare const db: import('@prisma/client').PrismaClient
declare const listProjects: import('express').RequestHandler
declare const inviteMember: import('express').RequestHandler
declare const updateBilling: import('express').RequestHandler
/** The team and user of the current screen. */
declare const teamId: string
declare const userId: string

// "In Next.js": the helpers of the Next.js guide's lib/rbac.ts, inside a page.
declare const requirePermission: ReturnType<typeof import('@anievo-id/rbac-evolution-next').createNextRbac>['requirePermission']
declare function requireMembership(userId: string, teamId: string): Promise<void>
declare const user: { id: string }
declare const params: { teamId: string }

// What the app's authentication puts on the request.
declare namespace Express {
  interface Request {
    user?: { id: string }
  }
}
