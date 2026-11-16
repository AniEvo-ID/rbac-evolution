// Public API use case: a Hono app. Most blocks are whole files that import `./rbac`, `./db`, ... from the
// stubs. The fragments of "Edge cases" use the names below.
type ApiRbac = import('../src/rbac').ApiRbac
declare const rbac: Rbac<ApiRbac>
declare const db: typeof import('../src/db').db
declare const dashboard: typeof import('../src/dashboard').dashboard
declare const requirePermission: typeof import('../src/rbac').requirePermission
declare const requireScope: typeof import('../src/rbac').requireScope
