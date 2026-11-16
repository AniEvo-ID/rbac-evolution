// E-commerce use case: a NestJS app with a Vue admin UI. Most blocks are whole files that import `./rbac`,
// `./policies`, ... from the stubs. The fragments of "Edge cases" use the typed engine below.
type ShopRbac = import('../src/rbac').ShopRbac
declare const rbac: Rbac<ShopRbac>
