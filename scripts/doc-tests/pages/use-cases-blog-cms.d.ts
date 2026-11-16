// Blog / CMS use case: an Express app. Most blocks are whole files that import the app's modules (`./rbac`,
// `./db`, ...) from the stubs. The fragments of "Edge cases" use the names below.
type BlogRbac = import('../src/rbac').BlogRbac
declare const app: import('express').Express
declare const rbac: Rbac<BlogRbac>
declare const adapter: RbacAdapter
declare const db: typeof import('../src/db').db
declare const requirePermission: typeof import('../src/rbac').requirePermission

// What the app's own auth middleware puts on the request.
declare namespace Express {
  interface Request {
    user?: { id: number }
  }
}
