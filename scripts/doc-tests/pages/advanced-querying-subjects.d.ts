declare const rbac: Rbac
declare const user: Subject & SubjectRbac
// "Load the records with your own ORM".
declare const prisma: import('@prisma/client').PrismaClient
declare const db: typeof import('../src/schema').db
declare const users: typeof import('../src/schema').users
