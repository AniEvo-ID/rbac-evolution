// Internal tools use case: a Fastify app with a React front end. Most blocks are whole files that import
// `./rbac`, `./access-grants`, ... from the stubs. The fragments of "Edge cases" use the names below.
type ToolsRbac = import('../src/rbac').ToolsRbac
declare const rbac: Rbac<ToolsRbac>
/** The staff member of the current screen or webhook. */
declare const staffId: number
/** The app's own audit log. */
declare const auditLog: { write(entry: { action: string; subject: Subject; permissions: string[] }): Promise<void> }
