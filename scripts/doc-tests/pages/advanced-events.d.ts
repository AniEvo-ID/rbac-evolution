declare const rbac: Rbac
/** "`db` and `auditLog` stand for your own database client and table." */
declare const auditLog: typeof import('../src/db').auditLog
/** The subject the snippets change (`rbac.for(user, { actor })`). */
declare const user: Subject
declare const adapter: RbacAdapter
