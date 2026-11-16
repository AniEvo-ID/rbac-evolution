declare const rbac: Rbac
declare const PrismaAdapter: typeof import('@anievo-id/rbac-evolution-prisma').PrismaAdapter
declare const prisma: import('@prisma/client').PrismaClient
/** The signed-in user and their organization (a team). */
declare const currentUser: { id: number }
declare const user: Subject
declare const org: { id: number }
