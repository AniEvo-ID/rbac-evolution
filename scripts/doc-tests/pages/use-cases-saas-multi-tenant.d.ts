// SaaS use case: a Next.js app. Most blocks are whole files that import `@/lib/rbac`, `@/lib/org`, ... from the
// stubs (plus `@/auth` and `@/lib/prisma` of the shared Next.js stubs). The fragments of "Edge cases" use the
// names below.
type SaasRbac = import('../lib/rbac').SaasRbac
declare const rbac: Rbac<SaasRbac>
declare const prisma: import('@prisma/client').PrismaClient
/** The organization and the user of the current screen. */
declare const orgId: string
declare const userId: string
